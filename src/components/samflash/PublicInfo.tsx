/** Présentation publique du service (visible sans connexion). */
const STEPS = [
  { t: "1. Décrivez votre idée", d: "Écrivez en quelques mots la scène, l'ambiance ou le sujet que vous imaginez, en français ou dans une autre langue." },
  { t: "2. Choisissez image ou vidéo", d: "Sélectionnez le type de création, le format et la durée, puis lancez la génération." },
  { t: "3. Retrouvez vos créations", d: "Chaque résultat est enregistré dans votre historique et votre galerie pour être revu, téléchargé ou refait." },
];

const FEATURES = [
  { t: "Vidéos par IA", d: "Transformez un texte ou une image en courte vidéo, depuis votre téléphone." },
  { t: "Images par IA", d: "Créez des visuels originaux pour vos réseaux, vos projets ou simplement par curiosité." },
  { t: "Amélioration des prompts", d: "Un assistant reformule votre description pour obtenir de meilleurs résultats." },
  { t: "Projets et historique", d: "Organisez vos créations par projet et retrouvez-les à tout moment." },
];

export function PublicInfo() {
  return (
    <section className="mx-auto w-full max-w-2xl px-5 py-12 text-foreground">
      <h2 className="text-2xl font-semibold tracking-tight">Qu'est-ce que Sam flash 2.0 ?</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
        Sam flash 2.0 est un studio de création par intelligence artificielle. Il permet de générer des images et de courtes
        vidéos à partir d'une simple description écrite, directement depuis un navigateur mobile ou ordinateur, sans
        installer de logiciel ni savoir monter une vidéo.
      </p>

      <h3 className="mt-10 text-xl font-semibold">Comment ça marche</h3>
      <div className="mt-4 space-y-3">
        {STEPS.map((s) => (
          <div key={s.t} className="rounded-2xl border border-border/70 bg-card/50 p-4">
            <p className="font-semibold">{s.t}</p>
            <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{s.d}</p>
          </div>
        ))}
      </div>

      <h3 className="mt-10 text-xl font-semibold">Ce que vous pouvez faire</h3>
      <div className="mt-4 grid gap-3">
        {FEATURES.map((f) => (
          <div key={f.t} className="rounded-2xl border border-border/70 bg-card/50 p-4">
            <p className="font-semibold">{f.t}</p>
            <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </div>

      <h3 className="mt-10 text-xl font-semibold">Gratuit ou abonnement</h3>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
        Vous pouvez essayer le service gratuitement avec une allocation quotidienne limitée. Les abonnements offrent plus de
        crédits, des vidéos plus longues et une génération plus rapide. Vous pouvez résilier à tout moment depuis votre compte.
      </p>

      <h3 className="mt-10 text-xl font-semibold">Utilisation responsable</h3>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
        Les contenus illicites, violents, haineux, sexuels, trompeurs ou portant atteinte aux droits d'autrui sont interdits.
        Consultez nos <a href="/conditions" className="underline">conditions d'utilisation</a> et notre{" "}
        <a href="/confidentialite" className="underline">politique de confidentialité</a>, ou{" "}
        <a href="/contact" className="underline">contactez-nous</a>.
      </p>
    </section>
  );
}
