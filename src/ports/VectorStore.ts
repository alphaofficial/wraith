export interface DocumentChunk {
  content: string;
  embedding: number[];
  metadata: Record<string, any>;
  source: string;
  chunkIndex: number;
}

export interface SearchResult {
  id: number;
  content: string;
  metadata: Record<string, any>;
  source: string;
  similarity: number;
}

export interface VectorStore {
  insertDocuments(chunks: DocumentChunk[]): Promise<void>;
  searchSimilar(queryEmbedding: number[], limit?: number): Promise<SearchResult[]>;
  close(): Promise<void>;
}