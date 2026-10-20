import { createFileRoute } from "@tanstack/react-router";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Serveur MCP Sam Flash (protocole JSON-RPC 2.0). Authentification : en-tête « Authorization: Bearer <clé> ». */
export const Route = createFileRoute("/api/public/mcp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
        const { verifyApiKey } = await import("@/lib/mcp/api-keys.server");
        const userId = key ? await verifyApiKey(key) : null;
        if (!userId) {
          return json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Clé API invalide ou révoquée." } }, 401);
        }

        const body = (await request.json().catch(() => null)) as
          | { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> }
          | null;
        if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string") {
          return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Requête invalide." } }, 400);
        }
        // Notification (pas d'identifiant) : pas de réponse.
        if (body.id === undefined) return new Response(null, { status: 202 });

        const id = body.id;
        const ok = (result: unknown) => json({ jsonrpc: "2.0", id, result });
        const fail = (code: number, message: string) => json({ jsonrpc: "2.0", id, error: { code, message } });

        switch (body.method) {
          case "initialize":
            return ok({
              protocolVersion: "2024-11-05",
              capabilities: { tools: {} },
              serverInfo: { name: "sam-flash", version: "1.0.0" },
            });
          case "ping":
            return ok({});
          case "tools/list": {
            const { MCP_TOOLS } = await import("@/lib/mcp/tools.server");
            return ok({ tools: MCP_TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) });
          }
          case "tools/call": {
            const { MCP_TOOLS } = await import("@/lib/mcp/tools.server");
            const name = String(body.params?.name ?? "");
            const args = (body.params?.arguments ?? {}) as Record<string, unknown>;
            const tool = MCP_TOOLS.find((t) => t.name === name);
            if (!tool) return fail(-32602, `Outil inconnu : ${name}`);
            try {
              const result = await tool.run(userId, args);
              return ok({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
            } catch {
              return ok({ isError: true, content: [{ type: "text", text: "Erreur pendant l'outil. Tes crédits ne sont pas décomptés." }] });
            }
          }
          default:
            return fail(-32601, `Méthode non prise en charge : ${body.method}`);
        }
      },
    },
  },
});
