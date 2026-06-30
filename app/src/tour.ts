import { useEffect, useState } from "react";

/**
 * Visibilité du « tour guidé de la navigation » (lancé depuis le résultat du test de
 * proximité). Petit store module + listeners — même mécanique que onboarding/follows —
 * pour ouvrir l'overlay depuis un écran sans prop-drilling, et le rendre au niveau de
 * l'App (là où vit la barre d'onglets que le tour pointe). Aucune persistance : c'est une
 * action ponctuelle, rejouable.
 */
let visible = false;
let note: string | undefined; // message contextuel passé à l'ouverture (ex. accueil vide)
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function ouvrirTourNav(noteContextuelle?: string): void {
  visible = true;
  note = noteContextuelle;
  notify();
}

export function fermerTourNav(): void {
  visible = false;
  notify();
}

/** Message contextuel du tour courant (lu au rendu de l'overlay). */
export function getTourNote(): string | undefined {
  return note;
}

export function useTourNavVisible(): boolean {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return visible;
}
