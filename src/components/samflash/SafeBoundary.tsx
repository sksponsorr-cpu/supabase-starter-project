/**
 * Zone de protection : si un composant plante, seule cette zone le signale
 * (avec le message d'erreur réel) au lieu de faire tomber toute la page.
 */
import { Component, type ReactNode } from "react";

type Props = { name: string; children: ReactNode };
type State = { error: Error | null };

export class SafeBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error(`[${this.props.name}]`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="mx-2 my-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-left text-xs text-red-200">
        <p className="font-semibold text-red-300">Erreur dans « {this.props.name} »</p>
        <p className="mt-2 break-words font-mono">{error.name}: {error.message}</p>
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] opacity-70">
          {(error.stack ?? "").split("\n").slice(0, 6).join("\n")}
        </pre>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="mt-3 rounded-full bg-white/10 px-4 py-1.5 text-white"
        >
          Réessayer
        </button>
      </div>
    );
  }
}
