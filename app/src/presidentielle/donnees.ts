// Rubrique Présidentielle 2027 : lecture des fichiers data/presidentielle/** et état partagé.
// L'index est lu UNE fois au lancement (App.tsx). Liste vide, fichier absent ou erreur réseau :
// la rubrique est absente partout (accueil, fiche parti, liens profonds), sans message d'erreur.
import { useEffect, useState } from "react";
import { lireDonnee } from "../api";
import type { ChapitreDetail, ChiffrageDetail, IndexPresidentielle, Programme } from "./types";
import { INDEX_VIDE as VIDE, indexValide } from "./logique";

export { indexValide };

let etat: IndexPresidentielle | null = null; // null = pas encore lu
let enCours: Promise<IndexPresidentielle> | null = null;
const abonnes = new Set<(i: IndexPresidentielle) => void>();

/** Lit l'index (une fois). Ne rejette jamais : en cas d'échec, « aucun programme ». */
export function chargerIndexPresidentielle(): Promise<IndexPresidentielle> {
  if (etat) return Promise.resolve(etat);
  if (!enCours) {
    enCours = lireDonnee<unknown>("presidentielle/index")
      .then(indexValide)
      .catch(() => VIDE)
      .then((i) => {
        etat = i;
        enCours = null;
        abonnes.forEach((f) => f(i));
        return i;
      });
  }
  return enCours;
}

/** Index courant (null tant qu'il n'est pas lu). */
export const indexCourant = () => etat;

/** Pour les tests et le rechargement des données. */
export function reinitialiserIndexPresidentielle(i: IndexPresidentielle | null = null) {
  etat = i;
  enCours = null;
  if (i) abonnes.forEach((f) => f(i));
}

/** Index de la rubrique : null pendant la lecture, puis la liste (éventuellement vide). */
export function useIndexPresidentielle(): IndexPresidentielle | null {
  const [i, setI] = useState<IndexPresidentielle | null>(etat);
  useEffect(() => {
    abonnes.add(setI);
    if (!etat) chargerIndexPresidentielle();
    else setI(etat);
    return () => {
      abonnes.delete(setI);
    };
  }, []);
  return i;
}

const sur = (id: string) => /^[a-z0-9-]+$/.test(id);

export function getProgramme(id: string): Promise<Programme> {
  if (!sur(id)) return Promise.reject(new Error("programme inconnu"));
  return lireDonnee<Programme>(`presidentielle/${id}/programme`);
}

export function getChapitreProgramme(id: string, chapitre: string): Promise<ChapitreDetail> {
  if (!sur(id) || !/^p\d+c\d+$/.test(chapitre)) return Promise.reject(new Error("chapitre inconnu"));
  return lireDonnee<ChapitreDetail>(`presidentielle/${id}/chapitre/${chapitre}`);
}

export function getChiffrageProgramme(id: string): Promise<ChiffrageDetail> {
  if (!sur(id)) return Promise.reject(new Error("programme inconnu"));
  return lireDonnee<ChiffrageDetail>(`presidentielle/${id}/chiffrage`);
}

/** Lien externe lu dans les DONNÉES : gardé seulement en https (jamais un javascript: ou autre). */
export function lienSur(url: string | null | undefined): string | null {
  return typeof url === "string" && /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(url) ? url : null;
}

/** « melenchon2027.fr » depuis une URL (affiché à côté du lien). */
export function domaine(url: string | null | undefined): string {
  const m = (url ?? "").match(/^https:\/\/(?:www\.)?([^/]+)/i);
  return m ? m[1] : "";
}

// Mouvement « une fois » : les anneaux se tracent une fois par session, les listes n'entrent
// en échelonné qu'à la première ouverture d'un écran.
const dejaVu = new Set<string>();
export function premiereFois(cle: string): boolean {
  if (dejaVu.has(cle)) return false;
  dejaVu.add(cle);
  return true;
}
