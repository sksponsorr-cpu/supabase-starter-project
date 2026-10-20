import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMcpKeys, createMcpKey, revokeMcpKey } from "@/lib/mcp/api-keys.functions";
import { toast } from "@/lib/toast";

type Key = { id: string; name: string; key_prefix: string; created_at: string; last_used_at: string | null; revoked_at: string | null };

/** Section « Connecter Sam Flash à Claude ou ChatGPT » : adresse MCP, clés personnelles, mode d'emploi. */
export function McpKeysPanel() {
  const list = useServerFn(listMcpKeys);
  const create = useServerFn(createMcpKey);
  const revoke = useServerFn(revokeMcpKey);
  const [keys, setKeys] = useState<Key[]>([]);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/api/public/mcp` : "/api/public/mcp";

  const refresh = () =>
    list().then((r) => setKeys(r.keys as Key[])).catch(() => toast.error("Impossible de charger tes clés."));

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCreate = async () => {
    setBusy(true);
    try {
      const r = await create({ data: { name } });
      setFresh(r.key);
      setName("");
      await refresh();
    } catch {
      toast.error("Impossible de créer la clé.");
    } finally {
      setBusy(false);
    }
  };

  const onRevoke = async (id: string) => {
    await revoke({ data: { id } });
    await refresh();
  };

  return (
    <section className="space-y-4 rounded-3xl border border-border bg-card p-4 text-sm">
      <div>
        <p className="font-semibold text-foreground">Connecter Sam Flash à Claude ou ChatGPT</p>
        <p className="mt-1 text-muted-foreground">
          Crée une clé, puis colle l'adresse ci-dessous dans les connecteurs de ton assistant.
          Tu pourras ensuite générer des images et des vidéos depuis la conversation. Les crédits sont débités de ton compte.
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Adresse du serveur</p>
        <code className="block break-all rounded-xl bg-muted p-2 text-xs text-foreground">{url}</code>
      </div>

      <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
        <li>Crée une clé ci-dessous et copie-la tout de suite : elle ne sera plus affichée.</li>
        <li>Dans Claude : Paramètres → Connecteurs → Ajouter un connecteur personnalisé, puis colle l'adresse. Dans l'en-tête d'autorisation, mets « Bearer » suivi de ta clé.</li>
        <li>Dans ChatGPT : Paramètres → Connecteurs (mode développeur), même adresse, même clé.</li>
      </ol>

      {fresh && (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3">
          <p className="text-xs text-foreground">Ta nouvelle clé (à copier maintenant) :</p>
          <code className="mt-1 block break-all text-xs text-foreground">{fresh}</code>
          <button type="button" onClick={() => setFresh(null)} className="mt-2 text-xs text-muted-foreground">J'ai copié ma clé</button>
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom de la clé (ex. Claude)"
          maxLength={60}
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
        />
        <button type="button" disabled={busy} onClick={() => void onCreate()} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">
          Créer
        </button>
      </div>

      <ul className="space-y-2">
        {keys.map((k) => (
          <li key={k.id} className="flex items-center justify-between gap-2 rounded-xl border border-border p-2">
            <span className="text-xs text-foreground">
              {k.name} · {k.key_prefix}… {k.revoked_at ? "(révoquée)" : ""}
            </span>
            {!k.revoked_at && (
              <button type="button" onClick={() => void onRevoke(k.id)} className="text-xs text-red-500">
                Révoquer
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
