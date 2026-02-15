import Anthropic from "@anthropic-ai/sdk";

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY || "placeholder-key";
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

// Lazy initialization - client is created on first access
export const anthropic = getAnthropicClient();
