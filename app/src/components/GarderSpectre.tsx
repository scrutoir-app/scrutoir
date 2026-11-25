import React from "react";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ICON, CONTROL } from "../theme";
import { Button } from "./ui";
import { InstallGuide } from "./InstallGuide";
import { CarteSombre, TexteSombre, tesReponses, useCopierEtInstaller } from "./installation";
import { nomNavigateurIOS } from "../pwa";

/**
 * Écran du résultat, sur iPhone / iPad hors app installée (écran 5) : « Garde ton spectre ».
 * L'app installée a son propre stockage : « Copier et installer » pose le lien de transfert
 * dans le presse-papiers (sur le téléphone), puis ouvre le guide d'installation. L'app propose
 * de le coller à sa première ouverture (RepriseEcran). Le lien ne passe par aucun serveur.
 */
export function GarderSpectre({ n, style }: { n: number; style?: object }) {
  const { copier, recopier, transfert, guide, fermerGuide } = useCopierEtInstaller("resultat");
  const nav = nomNavigateurIOS();
  const de = nav === "ce navigateur" ? "de ce navigateur" : `de ${nav}`;
  const titre = `Emporte ${tesReponses(n)} dans l'app`;
  const pronom = n > 1 ? "les" : "la";
  const accord = n > 1 ? "Elles passent" : "Elle passe";
  return (
    <View style={style}>
      <CarteSombre etiquette="GARDE TON SPECTRE" titre={titre}>
        <TexteSombre>
          On {pronom} copie dans ton presse-papiers, tu installes Scrutoir, l'app te propose de {pronom} coller à l'ouverture. {accord} {de} à
          l'app sur ton téléphone, jamais par Scrutoir.
        </TexteSombre>
        <Button
          label="Copier et installer"
          onPress={copier}
          variant="citron"
          fullWidth
          iconLeft={<Feather name="copy" size={ICON.base} />}
          style={{ minHeight: CONTROL.lg }}
        />
      </CarteSombre>
      <InstallGuide visible={guide} onClose={fermerGuide} transfert={transfert} onRecopier={recopier} />
    </View>
  );
}
