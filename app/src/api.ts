import { Platform } from "react-native";
import type {
  ProfilDepute, DetailScrutin, DeputeResume, ScrutinResume, Periode, CategorieRef, Dissidence, Votant,
} from "./types";

/**
 * URL de l'API. Sur le web (prévisualisation), localhost fonctionne.
 * Pour tester sur un téléphone via Expo Go, remplace par l'IP LAN de ton Mac,
 * ex: "http://192.168.1.20:4000".
 */
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ??
  (Platform.OS === "web" ? "http://localhost:4000" : "http://localhost:4000");

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status} sur ${path}`);
  return res.json() as Promise<T>;
}

export function rechercher(q: string) {
  return get<{ deputes: DeputeResume[]; scrutins: ScrutinResume[] }>(
    `/search?q=${encodeURIComponent(q)}`
  );
}

export function getProfil(uid: string, periode: Periode) {
  return get<ProfilDepute>(`/deputes/${uid}?periode=${periode}`);
}

export function getScrutin(uid: string) {
  return get<DetailScrutin>(`/scrutins/${uid}`);
}

export function getGrandsScrutins() {
  return get<ScrutinResume[]>(`/scrutins-recents`);
}

export function getCategories() {
  return get<CategorieRef[]>(`/categories`);
}

export function getScrutinsCategorie(id: string) {
  return get<ScrutinResume[]>(`/categories/${id}/scrutins`);
}

export function getDissidences(uid: string) {
  return get<Dissidence[]>(`/deputes/${uid}/dissidences`);
}

export function getVotesDepute(uid: string, categorie: string, position: string, periode: Periode) {
  return get<ScrutinResume[]>(
    `/deputes/${uid}/votes?categorie=${categorie}&position=${position}&periode=${periode}`
  );
}

export function getVotants(scrutinUid: string, position: string, groupe?: string) {
  const g = groupe ? `&groupe=${groupe}` : "";
  return get<Votant[]>(`/scrutins/${scrutinUid}/votants?position=${position}${g}`);
}
