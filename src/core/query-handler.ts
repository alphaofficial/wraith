import { VectorStore } from "../ports/VectorStore";
import { LLM } from "../ports/LLM";
import { Embedder } from "../ports/Embedder";

export class QueryHandler {
  constructor(private readonly vectorStore: VectorStore, private readonly embedder: Embedder, private readonly llm: LLM) {}

  async run(question: string): Promise<{ answer: string, sources: string[] }> {
    const queryEmbedding = await this.embedder.getEmbeddings(question);
    
    const results = await this.vectorStore.searchSimilar(queryEmbedding, 5);

    const relevantChunks = results.map(result => result.content);
    const sources = results.map(result => result.source);

    const context = relevantChunks.join('\n\n');

    const messages = [
      {
        role: 'system',
        content: 'You are a helpful assistant that answers questions based on the provided context. If the context does not contain enough information to answer the question, say so clearly.'
      },
      {
        role: 'user',
        content: `Context:\n${context}\n\nQuestion: ${question}`
      }
    ];

    const answer = await this.llm.generateCompletion(messages);

    const uniqueSources = sources.filter((source, index, arr) => arr.indexOf(source) === index);

    return { answer, sources: uniqueSources };
  }
}