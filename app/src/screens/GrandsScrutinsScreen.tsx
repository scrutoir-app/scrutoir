import React, { useEffect, useState } from "react";
import { getGrandsScrutins } from "../api";
import type { ScrutinResume } from "../types";
import type { Nav } from "../nav";
import { ScrutinList } from "../components/ScrutinList";
import { useScrutinDateFilter } from "../components/ScrutinDateFilter";
import { TypeScrutinFilter } from "../components/TypeScrutinFilter";
import { compterParType, filtrerParType, doitAfficherFiltreType, typeEffectif, type TypeScrutin } from "../typeScrutin";

export function GrandsScrutinsScreen({ nav }: { nav: Nav }) {
  const [scrutins, setScrutins] = useState<ScrutinResume[] | null>(null);
  const { filtered, Bar } = useScrutinDateFilter(scrutins ?? []);
  const [typeScr, setTypeScr] = useState<TypeScrutin>("tous");

  useEffect(() => {
    getGrandsScrutins().then(setScrutins);
  }, []);

  const comptesType = compterParType(filtered);
  const visibles = filtrerParType(filtered, typeEffectif(typeScr, comptesType));

  return (
    <ScrutinList
      scrutins={scrutins == null ? null : visibles}
      contexte={{
        titre: "Grands scrutins",
        sousTitre: `Scrutins solennels et motions de censure · ${visibles.length}`,
      }}
      filtres={
        <>
          {Bar}
          {doitAfficherFiltreType(comptesType) && (
            <TypeScrutinFilter value={typeScr} onChange={setTypeScr} counts={comptesType} />
          )}
        </>
      }
      onDetail={(u) => nav.push({ name: "scrutin", uid: u })}
      onSituer={() => nav.push({ name: "testIntro" })}
    />
  );
}
