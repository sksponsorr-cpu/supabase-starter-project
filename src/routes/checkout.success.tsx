import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { getOrderStatus } from "@/lib/payments.functions";

export const Route = createFileRoute("/checkout/success")({
  head: () => ({
    meta: [
      { title: "Paiement confirmé — Sam flash 2.0" },
      {
        name: "description",
        content:
          "Confirmation de votre paiement par carte bancaire et activation de votre abonnement Sam flash 2.0.",
      },
      { property: "og:title", content: "Paiement confirmé — Sam flash 2.0" },
      {
        property: "og:description",
        content: "Votre abonnement Sam flash 2.0 est activé dès la validation du paiement.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoutSuccessPage,
  errorComponent: () => (
    <Shell title="Vérification impossible">
      Nous n'avons pas pu vérifier ce paiement pour le moment. Réessayez dans quelques instants.
    </Shell>
  ),
  notFoundComponent: () => <Shell title="Page introuvable">Cette page n'existe pas.</Shell>,
});

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{children}</p>
      <Link to="/app" className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground">
        Retour à l'application
      </Link>
    </main>
  );
}

function CheckoutSuccessPage() {
  const checkStatus = useServerFn(getOrderStatus);
  const [state, setState] = useState<"loading" | "payee" | "en_attente" | "echouee">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const transactionId = new URLSearchParams(window.location.search).get("transaction_id");
    if (!transactionId) {
      setState("en_attente");
      return;
    }
    let stop = false;
    let tries = 0;
    const tick = async () => {
      tries += 1;
      try {
        const res = await checkStatus({ data: { transactionId } });
        if (stop) return;
        if (res.ok) {
          const status = res.order.status;
          if (status === "payee") return setState("payee");
          if (status === "echouee") {
            setMessage(res.order.error_message ?? null);
            return setState("echouee");
          }
        } else {
          setMessage(res.message);
        }
      } catch {
        // On retente : le prestataire peut confirmer avec un léger délai.
      }
      if (!stop) {
        setState("en_attente");
        if (tries < 10) setTimeout(() => void tick(), 3000);
      }
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [checkStatus]);

  if (state === "payee") {
    return (
      <Shell title="Paiement confirmé">
        <span className="flex flex-col items-center gap-3">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          Merci ! Votre abonnement est activé.
        </span>
      </Shell>
    );
  }

  if (state === "echouee") {
    return (
      <Shell title="Paiement non abouti">
        <span className="flex flex-col items-center gap-3">
          <XCircle className="h-10 w-10 text-destructive" />
          {message ?? "Le paiement a été refusé ou annulé. Vous pouvez réessayer."}
        </span>
      </Shell>
    );
  }

  return (
    <Shell title={state === "loading" ? "Vérification du paiement…" : "Paiement en cours de validation"}>
      <span className="flex flex-col items-center gap-3">
        <Clock className="h-10 w-10 animate-pulse text-muted-foreground" />
        Nous confirmons votre paiement auprès de la banque. Cette page se met à jour automatiquement.
      </span>
    </Shell>
  );
}
