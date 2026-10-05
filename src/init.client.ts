/**
 * Fichier d'initialisation client
 * Force l'activation de tous les changements
 * À importer dans le layout principal
 */

// 1. Forcer la réapplication des styles CSS
export function initializeStyles() {
  // Vérifier que les animations CSS sont chargées
  if (!document.querySelector("style[data-animations]")) {
    const style = document.createElement("style");
    style.setAttribute("data-animations", "true");
    style.textContent = `
      /* Animations de messages */
      @keyframes messagePulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.8; transform: scale(1.02); }
      }
      
      @keyframes messageGlow {
        0%, 100% { box-shadow: 0 0 10px rgba(255, 59, 48, 0.3); }
        50% { box-shadow: 0 0 20px rgba(255, 59, 48, 0.6); }
      }
      
      @keyframes slideInTop {
        from { opacity: 0; transform: translateY(-20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      /* Challenge animations */
      @keyframes challengeGlow {
        0%, 100% { box-shadow: 0 0 15px rgba(59, 130, 246, 0.4); transform: scale(1); }
        50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.8); transform: scale(1.03); }
      }
      
      @keyframes badgeBounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-5px); }
      }
      
      /* Appliquer les styles */
      .message-glow {
        animation: messageGlow 1.5s ease-in-out infinite !important;
        background-color: rgba(255, 59, 48, 0.1) !important;
        border: 1px solid rgba(255, 59, 48, 0.5) !important;
      }
      
      .message-slide-in {
        animation: slideInTop 0.4s ease-out !important;
      }
      
      .challenge-glow {
        animation: challengeGlow 2.5s ease-in-out infinite !important;
      }
      
      .challenge-badge {
        animation: badgeBounce 1.2s ease-in-out infinite !important;
        background: linear-gradient(135deg, #3b82f6, #60a5fa) !important;
        color: white !important;
        font-weight: bold !important;
        padding: 4px 8px !important;
        border-radius: 50% !important;
        font-size: 12px !important;
        display: inline-block !important;
      }
    `;
    document.head.appendChild(style);
  }
}

// 2. Forcer la mise à jour des messages
export function forceMessageUpdates() {
  // Observer les nouveaux messages et leur appliquer les classes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            const el = node as HTMLElement;
            
            // Si c'est un message d'erreur/service indisponible
            if (el.textContent?.includes("indisponible") || 
                el.textContent?.includes("saturés") ||
                el.textContent?.includes("SERVICE_UNAVAILABLE")) {
              el.classList.add("message-glow", "message-slide-in");
            }
          }
        });
      }
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: false,
  });
  
  return observer;
}

// 3. Forcer l'animation du challenge
export function forceChallengeAnimation() {
  // Trouver tous les éléments avec le challenge
  const challengeElements = document.querySelectorAll(
    '[class*="challenge"], [class*="promo"]'
  );
  
  challengeElements.forEach((el) => {
    if (el instanceof HTMLElement) {
      el.classList.add("challenge-glow");
      
      // Ajouter le badge animé s'il n'y en a pas
      if (!el.querySelector(".challenge-badge")) {
        const badge = document.createElement("div");
        badge.className = "challenge-badge";
        badge.textContent = "⚡";
        badge.style.position = "absolute";
        badge.style.top = "-10px";
        badge.style.right = "-10px";
        el.style.position = "relative";
        el.appendChild(badge);
      }
    }
  });
}

// 4. Forcer le rechargement du DOM
export function forceUpdateDOM() {
  // Forcer un re-render en triggering une mutation
  const root = document.documentElement;
  const event = new Event("force-update", { bubbles: true });
  root.dispatchEvent(event);
}

// 5. Initialisation complète
export function initializeAll() {
  console.log("[INIT] Initialisation des changements...");
  
  // Étape 1 : Charger les styles
  initializeStyles();
  console.log("[INIT] ✅ Styles CSS activés");
  
  // Étape 2 : Observer les nouveaux messages
  forceMessageUpdates();
  console.log("[INIT] ✅ Observer de messages activé");
  
  // Étape 3 : Animer le challenge
  setTimeout(() => {
    forceChallengeAnimation();
    console.log("[INIT] ✅ Animation challenge activée");
  }, 500);
  
  // Étape 4 : Forcer mise à jour DOM
  forceUpdateDOM();
  console.log("[INIT] ✅ DOM mis à jour");
  
  // Réappliquer chaque 10 secondes (au cas où)
  setInterval(() => {
    forceChallengeAnimation();
  }, 10000);
  
  console.log("[INIT] ✅ Tous les changements sont activés!");
}

// Exécuter au chargement de la page
if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeAll);
  } else {
    initializeAll();
  }
}
