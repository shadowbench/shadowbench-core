export async function runAgentUrl(
  agentUrl: string,
  payload: Record<string, unknown>
): Promise<string> {
  let response: Response;

  try {
    response = await fetch(agentUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Agent URL request failed: ${message}`);
  }

  if (!response.ok) {
    throw new Error(`Agent URL request failed: HTTP ${response.status}`);
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Agent URL request failed: ${message}`);
  }

  const answer = (parsed as { answer?: unknown }).answer;
  if (typeof answer !== "string") {
    throw new Error("Agent URL response must include an answer field.");
  }

  return answer;
}
