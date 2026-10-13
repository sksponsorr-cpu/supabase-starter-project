/**
 * Appel unifié à GPT et Claude via KIE. Serveur uniquement.
 * Variable : KIE_API_KEY (jamais exposée au navigateur).
 */
import type { Provider } from "./config";

const KIE_KEY = () => process.env.KIE_API_KEY ?? "";

export async function askModel(args: {
  provider: Provider;
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const maxTokens = args.maxTokens ?? 8000;
  const headers = { Authorization: `Bearer ${KIE_KEY()}`, "Content-Type": "application/json" };

  if (args.provider === "gpt") {
    // Format Responses, comme dans chat.functions.ts
    const res = await fetch("https://api.kie.ai/codex/v1/responses", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: args.model,
        stream: false,
        instructions: args.system,
        input: [{ role: "user", content: [{ type: "input_text", text: args.user }] }],
      }),
    });
    const json = (await res.json()) as {
      code?: number;
      output?: { type: string; content?: { type: string; text: string }[] }[];
    };
    if (!res.ok || (json.code && json.code !== 200)) throw new Error(`GPT indisponible (${res.status})`);
    return (json.output ?? [])
      .filter((o) => o.type === "message")
      .flatMap((o) => o.content ?? [])
      .filter((c) => c.type === "output_text")
      .map((c) => c.text)
      .join("")
      .trim();
  }

  // Claude, format Messages comme dans chat.functions.ts
  const res = await fetch("https://api.kie.ai/claude/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: args.model,
      max_tokens: maxTokens,
      stream: false,
      system: args.system,
      messages: [{ role: "user", content: args.user }],
    }),
  });
  const json = (await res.json()) as {
    code?: number;
    content?: { type: string; text?: string }[];
  };
  if (!res.ok || (json.code && json.code !== 200)) throw new Error(`Claude indisponible (${res.status})`);
  return (json.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
}
