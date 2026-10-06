export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Un problème est survenu — Sam flash</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      * { box-sizing: border-box; }
      body { font: 15px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: #05070f; background-image: linear-gradient(180deg, #05070f 0%, #0b1226 60%, #080d1c 100%); color: #f3f6ff; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.25rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2.25rem 1.75rem; border: 1px solid rgba(148,163,184,.22); border-radius: 1.5rem; background: rgba(15,23,42,.55); }
      .icon { width: 4rem; height: 4rem; margin: 0 auto 1.25rem; border-radius: 999px; display: grid; place-items: center; background: rgba(59,130,246,.16); color: #5b9bff; font-size: 1.75rem; font-weight: 700; }
      h1 { font-size: 1.5rem; margin: 0 0 .75rem; letter-spacing: -0.01em; }
      p { color: #9aa6c0; margin: 0 0 1.75rem; }
      .actions { display: flex; gap: .5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: .75rem 1.5rem; border-radius: 999px; font: inherit; font-weight: 600; cursor: pointer; text-decoration: none; border: 0; }
      .primary { background: #3b82f6; color: #fff; }
      .secondary { background: rgba(148,163,184,.16); color: #f3f6ff; font-weight: 500; }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="icon">!</div>
      <h1>Oups, un problème est survenu</h1>
      <p>Cette page n'a pas pu se charger. Ce n'est pas de votre faute : réessayez dans un instant ou revenez à l'accueil.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Réessayer</button>
        <a class="secondary" href="/">Accueil</a>
      </div>
    </main>
  </body>
</html>`;
}
