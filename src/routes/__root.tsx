import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { PresencePing } from "@/components/samflash/PresencePing";
import { Compass, Home, RefreshCw, TriangleAlert } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { I18nProvider } from "../lib/i18n";
import { ThemeProvider } from "../lib/theme";
import { Toaster } from "../components/ui/sonner";
import { ReferralCapture } from "../components/samflash/ReferralCapture";
import { MaintenanceGate } from "../components/samflash/MaintenanceGate";

function ErrorLayout({
  icon,
  code,
  title,
  text,
  children,
}: {
  icon: ReactNode;
  code?: string;
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-background px-5"
      style={{ background: "var(--gradient-hero)" }}
    >
      <div className="w-full max-w-md rounded-3xl border border-border/70 bg-card/50 p-8 text-center backdrop-blur-xl">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          {icon}
        </span>
        {code ? (
          <p className="mt-5 text-6xl font-bold tracking-tight text-foreground">{code}</p>
        ) : null}
        <h1 className={`${code ? "mt-2" : "mt-5"} text-2xl font-semibold tracking-tight text-foreground`}>
          {title}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{text}</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">{children}</div>
      </div>
    </main>
  );
}

const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform active:scale-95";
const secondaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-full bg-secondary px-6 py-3 text-sm font-medium text-foreground transition-transform active:scale-95";

function NotFoundComponent() {
  return (
    <ErrorLayout
      icon={<Compass className="h-7 w-7" />}
      code="404"
      title="Page introuvable"
      text="Cette adresse n'existe pas ou a été déplacée. Vérifiez le lien ou retournez à l'accueil."
    >
      <Link to="/" className={primaryBtn}>
        <Home className="h-4 w-4" /> Retour à l'accueil
      </Link>
      <Link to="/app" className={secondaryBtn}>
        Ouvrir le studio
      </Link>
    </ErrorLayout>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <ErrorLayout
      icon={<TriangleAlert className="h-7 w-7" />}
      title="Oups, un problème est survenu"
      text="Cette page n'a pas pu se charger. Ce n'est pas de votre faute : réessayez, ou revenez à l'accueil. Si le problème persiste, contactez le support depuis Réglages."
    >
      <button
        type="button"
        onClick={() => {
          router.invalidate();
          reset();
        }}
        className={primaryBtn}
      >
        <RefreshCw className="h-4 w-4" /> Réessayer
      </button>
      <a href="/" className={secondaryBtn}>
        <Home className="h-4 w-4" /> Accueil
      </a>
    </ErrorLayout>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Sam flash 2.0 — Studio IA" },
      { name: "description", content: "Sam flash 2.0 — Générez vidéos et images par IA." },
      { property: "og:title", content: "Sam flash 2.0 — Studio IA" },
      { property: "og:description", content: "Sam flash 2.0 — Générez vidéos et images par IA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", href: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/favicon-48x48.png", type: "image/png", sizes: "48x48" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/favicon-512x512.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <MaintenanceGate>
            <Outlet />
          </MaintenanceGate>
          <ReferralCapture />
          <PresencePing />
          <Toaster position="top-center" richColors closeButton />
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
