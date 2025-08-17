import OpenAI from 'openai';
import { LLM } from '../ports/LLM';

export class OpenAIChatAdapter implements LLM {
    private readonly client: OpenAI;

    constructor() {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY is not set');
        }
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    async generateCompletion(messages: { role: string; content: string }[], options?: { temperature?: number; maxTokens?: number }): Promise<string> {
        const response = await this.client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: messages as any,
            temperature: options?.temperature || 0.7,
            max_tokens: options?.maxTokens || 1000
        });

        return response.choices[0]?.message?.content || '';
    }
}