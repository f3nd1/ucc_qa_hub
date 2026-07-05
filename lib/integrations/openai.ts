/* OpenAI helpers for Settings: test the key and list available models. */

const API_BASE = "https://api.openai.com";

/** Fetch the account's model ids (sorted). Doubles as a key test. */
export async function fetchOpenAIModels(key: string, apiBase: string = API_BASE): Promise<string[]> {
  if (!key) throw new Error("Add your OpenAI API key first.");
  const res = await fetch(apiBase + "/v1/models", { headers: { Authorization: "Bearer " + key } });
  if (!res.ok) {
    const t = await res.text();
    throw new Error("HTTP " + res.status + ": " + t.slice(0, 120));
  }
  const data = (await res.json()) as { data?: Array<{ id?: string }> };
  return (data.data || [])
    .map((m) => m.id || "")
    .filter(Boolean)
    .sort();
}

/** Narrow a model list to the chat-capable ones worth choosing between. */
export function chatModels(ids: string[]): string[] {
  const chat = ids.filter((id) => /gpt|o1|o3|o4|chatgpt/i.test(id) && !/embedding|whisper|tts|dall|moderation|audio|realtime|image/i.test(id));
  return chat.length ? chat : ids;
}
