export interface Embedder {
  getEmbeddings: (text: string, metadata?: Record<string, any>) => Promise<number[]>;
}