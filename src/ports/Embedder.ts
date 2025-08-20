export interface Embeder {
  getEmbeddings: (text: string, metadata?: Record<string, any>) => Promise<number[]>;
}