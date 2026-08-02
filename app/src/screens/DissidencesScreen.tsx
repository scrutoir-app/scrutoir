import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { C, positionLabel } from "../theme";
import { Chip } from "../components/ui";
import { getDissidences } from "../api";
import type { Dissidence, ScrutinResume } from "../types";
import type { Nav } from "../nav";
import { ScrutinList } from "../components/ScrutinList";

// La Dissidence est « sparse » (ni sort_code, ni comptes, ni catégorie) : on la présente comme un
// ScrutinResume minimal — les cartes complètent le reste depuis le détail (cf. hydratation), et on
// conserve position/consigne pour l'annotation « A voté / Consigne ».
type DissidenceScrutin = ScrutinResume & { position: string; consigne: string };

export function DissidencesScreen({ uid, nom, nav }: { uid: string; nom: string; nav: Nav }) {
  const [liste, setListe] = useState<Dissidence[] | null>(null);

  useEffect(() => {
    getDissidences(uid).then(setListe);
  }, [uid]);

  const scrutins: DissidenceScrutin[] | null = useMemo(
    () =>
      liste == null
        ? null
        : liste.map((d) => ({
            uid: d.uid,
            numero: d.numero,
            date: d.date,
            titre: d.titre,
            objet: d.objet,
            sort_code: null,
            sort_libelle: d.sort_libelle,
            position: d.position,
            consigne: d.consigne,
          })),
    [liste]
  );

  const renderAnnotation = (s: DissidenceScrutin) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <Chip label={`A voté : ${positionLabel(s.position)}`} fg={C.loyalBas} bg={C.loyalBasBg} radius={8} ph={8} bold={false} />
      <Chip label={`Consigne : ${positionLabel(s.consigne)}`} fg={C.textMuted} bg={C.surfaceAlt} radius={8} ph={8} bold={false} />
    </View>
  );

  return (
    <ScrutinList
      scrutins={scrutins}
      contexte={{
        titre: "Dissidences",
        sousTitre: `${nom} · ${scrutins?.length ?? 0} scrutins où le vote diffère de la consigne du groupe (les plus récents d'abord)`,
      }}
      emptyLabel="Aucune dissidence : vote toujours conforme à la consigne du groupe."
      onDetail={(u) => nav.push({ name: "scrutin", uid: u })}
      onSituer={() => nav.push({ name: "testIntro" })}
      renderAnnotation={renderAnnotation}
    />
  );
}
