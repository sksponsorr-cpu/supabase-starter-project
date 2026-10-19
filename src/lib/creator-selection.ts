/**
 * Choix du créateur (modèle, type, durée), partagé entre le sélecteur et la barre de saisie.
 * Données seulement dans le navigateur. Aucun secret.
 */
import { useSyncExternalStore } from "react";
import { CREATOR_MODELS, type CreatorModel, type VideoMode } from "@/lib/creator-models";

export type CreatorSelection = { modelId: string; mode: VideoMode; seconds: number; active?: boolean };

const DEFAULT: CreatorSelection = {
  modelId: CREATOR_MODELS[0].id,
  mode: CREATOR_MODELS[0].modes[0],
  seconds: CREATOR_MODELS[0].durations[0],
};

let current: CreatorSelection = DEFAULT;
const listeners = new Set<() => void>();

export function setCreatorSelection(next: CreatorSelection) {
  current = next;
  listeners.forEach((l) => l());
}

export function getCreatorSelection(): CreatorSelection {
  return current;
}

export function useCreatorSelection(): CreatorSelection {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => DEFAULT,
  );
}

export function modelOf(sel: CreatorSelection): CreatorModel {
  return CREATOR_MODELS.find((m) => m.id === sel.modelId) ?? CREATOR_MODELS[0];
}
