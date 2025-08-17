export interface LLM {
  generateCompletion: (messages: { role: string; content: string }[], options?: { temperature?: number; maxTokens?: number }) => Promise<string>;
}