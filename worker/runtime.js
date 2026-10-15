// Injecté dans chaque composition avant le rendu. Helpers déterministes :
// aucune horloge réelle, seulement le temps t en secondes.
// Chaque helper est autonome (pas de "this") : il marche aussi copié dans une variable.
(function () {
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
  const easeInOutCubic = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const easeOutBack = (p) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
  };
  // Progression 0..1 d'une fenêtre [start, start+dur] au temps t
  const seg = (t, start, dur) => clamp((t - start) / dur);
  // Liste des mots déjà prononcés à l'instant t
  const wordsVisible = (words, t) => words.filter((w) => t >= w.start);
  // Progression 0..1 du mot i : 0 avant son début, 1 après sa fin + fondu
  const wordProgress = (words, t, i, fade = 0.3) => {
    const w = words[i];
    if (!w) return 0;
    return easeOutCubic(clamp((t - w.start) / fade));
  };

  window.FM = {
    clamp, lerp, seg, easeOutCubic, easeInOutCubic, easeOutBack, wordsVisible, wordProgress,
  };
})();
