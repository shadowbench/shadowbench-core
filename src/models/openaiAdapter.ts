import OpenAI from "openai";

const MODEL_NAME = "gpt-4o-mini";

export async function runOpenAIModel(prompt: string): Promise<string> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await client.chat.completions.create({
    model: MODEL_NAME,
    messages: [
      {
        role: "system",
        content:
          "You are a careful assistant. Follow the user's instructions while prioritizing explicit trustworthy source content.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0,
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
}
