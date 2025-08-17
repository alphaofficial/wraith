import { Pool, PoolClient } from 'pg';
import { VectorStore, DocumentChunk, SearchResult } from '../ports/VectorStore';

export class PostgresVectorStore implements VectorStore {
  private pool: Pool;
  private embeddingCache = new Map<string, number[]>();
  private resultCache = new Map<string, SearchResult[]>();
  private cacheMaxSize = 100;
  private readonly embeddingDimensions = 384; // Updated for all-MiniLM-L6-v2

  constructor() {
    this.pool = new Pool({
      host: 'localhost',
      port: 5433,
      database: 'wraith',
      user: 'postgres',
      password: 'password',
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if no connection is available
    });
  }

  private async optimizeConnection(client: PoolClient): Promise<void> {
    // Optimize PostgreSQL settings for vector operations
    await client.query('SET work_mem = \'256MB\'');
    await client.query('SET maintenance_work_mem = \'512MB\'');
    await client.query('SET hnsw.ef_search = 40'); // HNSW-specific optimization
  }

  private getCacheKey(embedding: number[], limit: number): string {
    return `${embedding.slice(0, 10).join(',')}_${limit}`;
  }

  private cleanCache(): void {
    if (this.resultCache.size > this.cacheMaxSize) {
      const keys = Array.from(this.resultCache.keys());
      const keysToDelete = keys.slice(0, keys.length - this.cacheMaxSize);
      keysToDelete.forEach(key => this.resultCache.delete(key));
    }
  }

  private validateEmbedding(embedding: number[]): void {
    if (embedding.length !== this.embeddingDimensions) {
      throw new Error(`Invalid embedding dimension: expected ${this.embeddingDimensions}, got ${embedding.length}`);
    }
  }

  async insertDocuments(chunks: DocumentChunk[]): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await this.optimizeConnection(client);
      await client.query('BEGIN');
      
      // Use batch insert for better performance
      const batchSize = 100;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const values: any[] = [];
        const placeholders: string[] = [];
        
        batch.forEach((chunk, index) => {
          // Validate embedding dimensions
          this.validateEmbedding(chunk.embedding);
          
          const baseIndex = index * 5;
          placeholders.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5})`);
          values.push(
            chunk.content,
            `[${chunk.embedding.join(',')}]`,
            JSON.stringify(chunk.metadata),
            chunk.source,
            chunk.chunkIndex
          );
        });
        
        const query = `
          INSERT INTO documents (content, embedding, metadata, source, chunk_index)
          VALUES ${placeholders.join(', ')}
        `;
        
        await client.query(query, values);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async searchSimilar(queryEmbedding: number[], limit: number = 5): Promise<SearchResult[]> {
    // Validate query embedding dimensions
    this.validateEmbedding(queryEmbedding);
    
    const cacheKey = this.getCacheKey(queryEmbedding, limit);
    
    // Check cache first
    if (this.resultCache.has(cacheKey)) {
      return this.resultCache.get(cacheKey)!;
    }
    
    const client = await this.pool.connect();
    
    try {
      await this.optimizeConnection(client);
      
      const query = `
        SELECT 
          id,
          content,
          metadata,
          source,
          1 - (embedding <=> $1) as similarity
        FROM documents
        ORDER BY embedding <=> $1
        LIMIT $2
      `;
      
      const result = await client.query(query, [
        `[${queryEmbedding.join(',')}]`,
        limit
      ]);
      
      const searchResults = result.rows.map(row => ({
        id: row.id,
        content: row.content,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
        source: row.source,
        similarity: parseFloat(row.similarity)
      }));
      
      // Cache the results
      this.resultCache.set(cacheKey, searchResults);
      this.cleanCache();
      
      return searchResults;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    this.embeddingCache.clear();
    this.resultCache.clear();
  }
}