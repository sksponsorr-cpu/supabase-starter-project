// Injecté dans chaque composition avant le rendu. Fournit des helpers
// déterministes : aucune horloge réelle, seulement le temps t en secondes.
window.FM = {
  clamp: (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)),
  lerp: (a, b, p) => a + (b - a) * p,
  // Progression 0..1 d'une fenêtre [start, start+dur] au temps t
  seg(t, start, dur) { return this.clamp((t - start) / dur); },
  easeOutCubic: p => 1 - Math.pow(1 - p, 3),
  easeInOutCubic: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  easeOutBack: p => { const c = 1.70158; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
  // Apparition mot par mot à partir des timings de la voix off
  wordsVisible(words, t) { return words.filter(w => t >= w.start); },
};
