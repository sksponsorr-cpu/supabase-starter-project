import { CODE_MODELS, DEFAULT_CODE_MODEL } from "@/lib/flash-motion/config";

/** Sélecteur de modèle pour l'utilisateur (GPT ou Claude). */
export function ModelPicker({
  value = DEFAULT_CODE_MODEL,
  onChange,
}: {
  value?: string;
  onChange: (id: string) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
      <span>Modèle de création</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #d4d4d8" }}
      >
        {CODE_MODELS.map(m => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
    </label>
  );
}
