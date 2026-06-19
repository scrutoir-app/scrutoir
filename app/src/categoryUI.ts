// Habillage des catégories : icône (MaterialCommunityIcons) + teinte douce neutre.
// Teintes désaturées volontairement — distinction visuelle sans connotation partisane.

export interface CatUI {
  icon: string; // nom MaterialCommunityIcons
  bg: string;
  fg: string;
  court?: string; // libellé court (grilles étroites)
  photos?: string[]; // images d'illustration (fond carrousel) — placeholders Unsplash, on en fait tourner 2-3
}

// Photos d'illustration par thème — PLACEHOLDERS Unsplash (libres) pour prototype.
// 2-3 par thème, on en fait tourner une selon le scrutin (cf. catPhoto).
// À remplacer par des visuels définitifs sous licence avant mise en ligne.
const UNSPLASH = "?w=800&q=70&auto=format&fit=crop";
const ph = (...ids: string[]) => ids.map((id) => `https://images.unsplash.com/${id}${UNSPLASH}`);

const FALLBACK: CatUI = { icon: "vote-outline", bg: "#ECEEF1", fg: "#5B6675" };

const MAP: Record<string, CatUI> = {
  ecologie: { icon: "leaf", bg: "#EAF1EC", fg: "#4F8A63", court: "Écologie", photos: ph("photo-1441974231531-c6227db76b6e", "photo-1518173946687-a4c8892bbd9f", "photo-1469474968028-56623f02e42e") },
  "securite-justice": { icon: "shield-half-full", bg: "#ECEFF4", fg: "#5B6675", court: "Sécurité", photos: ph("photo-1589829545856-d10d557cf95f", "photo-1453873531674-2151bcd01707", "photo-1436450412740-6b988f486c6b") },
  economie: { icon: "currency-eur", bg: "#F4EFE6", fg: "#A4823F", court: "Économie", photos: ph("photo-1554224155-6726b3ff858f", "photo-1611974789855-9c2a0a7236a3", "photo-1460925895917-afdab827c52f") },
  travail: { icon: "briefcase-variant", bg: "#EDEFEA", fg: "#6E7A52", court: "Travail", photos: ph("photo-1522202176988-66273c2fd55f", "photo-1556761175-5973dc0f32e7", "photo-1454165804606-c3d57bc86b40") },
  sante: { icon: "heart-pulse", bg: "#F3ECEF", fg: "#A35F76", court: "Santé", photos: ph("photo-1505751172876-fa1923c5c528", "photo-1551076805-e1869033e561", "photo-1538108149393-fbbd81895907") },
  education: { icon: "school", bg: "#EAEFF3", fg: "#4E7B96", court: "Éducation", photos: ph("photo-1481627834876-b7833e8f5570", "photo-1503676260728-1c00da094a0b", "photo-1497633762265-9d179a990aa6") },
  immigration: { icon: "passport", bg: "#EFEDE9", fg: "#8A7A63", court: "Immigration", photos: ph("photo-1473445730015-841f29a9490b", "photo-1488646953014-85cb44e25828", "photo-1526778548025-fa2f459cd5c1") },
  solidarites: { icon: "hand-heart", bg: "#F3EDEC", fg: "#A06A5E", court: "Solidarités", photos: ph("photo-1488521787991-ed7bbaae773c", "photo-1521791136064-7986c2920216", "photo-1593113598332-cd288d649433") },
  institutions: { icon: "bank", bg: "#ECEEF5", fg: "#5E6488", court: "Institutions", photos: ph("photo-1529107386315-e1a2ed48a620", "photo-1541872703-74c5e44368f9", "photo-1606925797300-0b35e9d1794e") },
  agriculture: { icon: "tractor-variant", bg: "#EFF1E8", fg: "#7A8A4A", court: "Agriculture", photos: ph("photo-1500382017468-9049fed747ef", "photo-1574943320219-553eb213f72d", "photo-1625246333195-78d9c38ad449") },
  "international-defense": { icon: "shield-star", bg: "#EBF0F1", fg: "#4E7E84", court: "International", photos: ph("photo-1451187580459-43490279c0fa", "photo-1526470608268-f674ce90ebd4") },
  logement: { icon: "home-city", bg: "#F0EDE9", fg: "#8A6F5A", court: "Logement", photos: ph("photo-1486406146926-c627a92ad1ab", "photo-1560518883-ce09059eeffa", "photo-1448630360428-65456885c650") },
};

export function catUI(id: string): CatUI {
  return MAP[id] ?? FALLBACK;
}

// Hash stable d'une chaîne (pour choisir une photo de façon déterministe par scrutin).
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Photo d'illustration d'un thème, en faisant tourner 2-3 visuels selon `seed` (ex. uid du scrutin). */
export function catPhoto(id: string, seed?: string): string | undefined {
  const photos = catUI(id).photos;
  if (!photos || photos.length === 0) return undefined;
  const idx = seed ? hashStr(seed) % photos.length : 0;
  return photos[idx];
}
