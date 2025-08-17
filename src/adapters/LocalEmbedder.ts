import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import { Embedder } from '../ports/Embedder';

export class LocalEmbedder implements Embedder {
  private model: FeatureExtractionPipeline | null = null;
  private readonly modelName = 'Xenova/all-MiniLM-L6-v2';

  private async initializeModel(): Promise<void> {
    if (!this.model) {
      console.log('🤖 Loading local embedding model...');
      this.model = await pipeline('feature-extraction', this.modelName) as FeatureExtractionPipeline;
      console.log('✅ Local embedding model loaded successfully');
    }
  }

  async getEmbeddings(text: string): Promise<number[]> {
    await this.initializeModel();
    
    if (!this.model) {
      throw new Error('Failed to initialize embedding model');
    }

    try {
      // Generate embeddings with mean pooling and normalization
      const result = await this.model(text, { 
        pooling: 'mean', 
        normalize: true 
      });
      
      // Convert tensor to array
      const embeddings = Array.from(result.data) as number[];
      
      // Verify expected dimensions (384 for all-MiniLM-L6-v2)
      if (embeddings.length !== 384) {
        throw new Error(`Unexpected embedding dimension: ${embeddings.length}, expected 384`);
      }
      
      return embeddings;
    } catch (error) {
      throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async close(): Promise<void> {
    // Cleanup if needed
    this.model = null;
  }
}