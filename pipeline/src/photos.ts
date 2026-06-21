import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PHOTOS_DIR = path.resolve(__dirname, "../../app/public/photos");

/**
 * Rapatrie les photos des députés en local (app/public/photos/<id>.jpg) et réécrit
 * `deputes.photo_url` vers ce chemin local → plus aucun appel aux serveurs de
 * l'Assemblée côté utilisateur (vie privée, fiabilité, hors-ligne). Ne télécharge que
 * les photos manquantes (les autres sont committées / déjà présentes). Si une photo
 * est introuvable, on garde l'URL distante (l'image s'affiche quand même).
 */
export async function localiserPhotos(db: Database.Database): Promise<{ local: number; manquantes: number }> {
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
  const rows = db.prepare("SELECT uid, photo_url FROM deputes WHERE photo_url IS NOT NULL").all() as {
    uid: string;
    photo_url: string;
  }[];
  const upd = db.prepare("UPDATE deputes SET photo_url = ? WHERE uid = ?");
  let local = 0;
  let manquantes = 0;

  for (const r of rows) {
    if (r.photo_url.startsWith("/photos/")) { local++; continue; } // déjà localisée
    const m = r.photo_url.match(/\/([^/]+\.jpg)$/i);
    if (!m) continue;
    const file = m[1];
    const dest = path.join(PHOTOS_DIR, file);
    if (!fs.existsSync(dest)) {
      try {
        const res = await fetch(r.photo_url);
        if (!res.ok) { manquantes++; continue; }
        fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      } catch {
        manquantes++;
        continue;
      }
    }
    upd.run("/photos/" + file, r.uid);
    local++;
  }
  return { local, manquantes };
}
