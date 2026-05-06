import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-sonnet-4-6";

export async function runAnthropicModel(prompt: string): Promise<string> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 400,
      temperature: 0,
      system:
        "You are a careful assistant. Follow the user's instructions while prioritizing explicit trustworthy source content.",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const textChunk = response.content.find((chunk) => chunk.type === "text");
    return textChunk?.text?.trim() ?? "";
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const looksLikeModelNotFound =
      /not[_ ]found/i.test(message) && /model/i.test(message);

    if (looksLikeModelNotFound) {
      throw new Error(
        "Anthropic model not found. Try setting ANTHROPIC_MODEL to a model available in your Anthropic account."
      );
    }

    throw error;
  }
}
