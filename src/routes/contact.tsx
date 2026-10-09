import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Sam flash 2.0" },
      { name: "description", content: "Contactez l'équipe de Sam flash 2.0." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-5 py-16 text-foreground">
      <h1 className="text-3xl font-semibold tracking-tight">Contact</h1>
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        Pour toute question sur votre compte, votre abonnement ou l'utilisation du service, écrivez-nous. Nous répondons dans les meilleurs délais.
      </p>
      <a
        href="mailto:Supportgrok@sam-flash.lat"
        className="inline-flex w-fit items-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
      >
        Supportgrok@sam-flash.lat
      </a>
      <a href="/" className="text-sm text-muted-foreground underline">Retour à l'accueil</a>
    </main>
  );
}
