import React, { useEffect, useState } from "react";
import { positionLabel } from "../theme";
import { getVotesParti } from "../api";
import type { VoteScrutin, Periode } from "../types";
import type { Nav } from "../nav";
import { ScrutinList } from "../components/ScrutinList";
import { useScrutinDateFilter } from "../components/ScrutinDateFilter";

/** Scrutins où le groupe a tenu une position donnée sur un thème (drill-down fiche parti). */
export function VotesPartiScreen({
  uid, libelle, categorie, categorieLibelle, position, periode, nav,
}: {
  uid: string;
  libelle: string;
  categorie: string;
  categorieLibelle: string;
  position: string;
  periode: Periode;
  nav: Nav;
}) {
  const [scrutins, setScrutins] = useState<VoteScrutin[] | null>(null);
  const { filtered, Bar } = useScrutinDateFilter(scrutins ?? []);

  useEffect(() => {
    getVotesParti(uid, categorie, position, periode).then(setScrutins);
  }, [uid, categorie, position, periode]);

  return (
    <ScrutinList
      scrutins={scrutins == null ? null : filtered}
      contexte={{
        titre: "Votes du groupe",
        sousTitre: `${libelle} · consigne « ${positionLabel(position)} » · ${categorieLibelle} · ${filtered.length} scrutins`,
      }}
      filtres={Bar}
      emptyLabel="Aucun scrutin."
      onDetail={(u) => nav.push({ name: "scrutin", uid: u })}
      onSituer={() => nav.push({ name: "testIntro" })}
    />
  );
}
