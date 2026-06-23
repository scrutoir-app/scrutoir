import React from "react";
import { View, Text, Image } from "react-native";
import { C, F } from "../theme";
import { usePartyLogos } from "../prefs";

/**
 * Avatar de groupe parlementaire : logo officiel si disponible, sinon monogramme
 * (rond couleur du groupe + sigle). Les logos sont servis depuis /logos/partis/.
 *
 * Light/dark : les logos sont posés sur un fond clair neutre → lisibles dans les DEUX
 * thèmes (ils sont conçus pour fond clair ; seul HOR a une variante blanche officielle,
 * non nécessaire ici puisqu'on ne les met jamais sur fond foncé). Le monogramme, lui,
 * utilise la couleur du groupe (donnée), comme avant.
 */
const LOGO_FILE: Record<string, string> = {
  rn: "rn.svg",
  epr: "epr.svg",
  "lfi-nfp": "lfi-nfp.svg",
  soc: "soc.svg",
  dr: "dr.png",
  ecos: "ecos.svg",
  dem: "dem.svg",
  hor: "hor.svg",
  liot: "liot.png",
  uddplr: "uddplr.svg",
  gdr: "gdr.svg",
  // NI : pas de logo de groupe → monogramme.
};

export function PartyLogo({
  abrev,
  couleur,
  size = 52,
}: {
  abrev?: string | null;
  couleur?: string | null;
  size?: number;
}) {
  const [logosOn] = usePartyLogos();
  const key = (abrev ?? "").toLowerCase().trim();
  const file = logosOn ? LOGO_FILE[key] : undefined; // opt-in : sinon monogramme (prod)
  // Carré à coins arrondis (comme les thèmes) → distingue visuellement un GROUPE suivi
  // d'un DÉPUTÉ (dont l'avatar reste rond).
  const rad = Math.round(size * 0.28);

  if (file) {
    const pad = Math.round(size * 0.16);
    return (
      <View
        style={{
          width: size, height: size, borderRadius: rad,
          backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: C.borderStrong,
          alignItems: "center", justifyContent: "center", overflow: "hidden",
        }}
      >
        <Image
          source={{ uri: `/logos/partis/${file}` }}
          resizeMode="contain"
          style={{ width: size - pad * 2, height: size - pad * 2 }}
        />
      </View>
    );
  }

  // Fallback monogramme : sigle à la taille de la version précédente (~13px à 52).
  // Sous 28px (puces), on n'affiche que le carré couleur (le sigle figure déjà à côté).
  return (
    <View
      style={{
        width: size, height: size, borderRadius: rad,
        backgroundColor: couleur ?? C.accent,
        alignItems: "center", justifyContent: "center",
      }}
    >
      {size >= 28 && (
        <Text numberOfLines={1} style={{ fontFamily: F.extra, fontSize: Math.round(size * 0.25), color: "#fff" }}>
          {abrev ?? "?"}
        </Text>
      )}
    </View>
  );
}
