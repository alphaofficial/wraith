import OpenAI from 'openai';
import { Embeder } from '../ports/Embedder';

export class OpenAiEmbedder implements Embeder {
    private readonly client: OpenAI;

    constructor() {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY is not set');
        }
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    async getEmbeddings(text: string, metadata?: Record<string, any>): Promise<number[]> {
        const response = await this.client.embeddings.create({
            model: "text-embedding-3-small",
            input: text
        })
        return response.data[0].embedding
    }
}