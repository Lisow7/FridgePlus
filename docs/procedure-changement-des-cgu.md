# Changer les conditions générales d’utilisation

Décision du 2026-10-08 : chaque changement des CGU est annoncé **30 jours avant** son entrée en
vigueur, comme elles le promettent (« En cas de modification substantielle, les utilisateurs connectés
sont informés au moins 30 jours avant l’entrée en vigueur, par notification dans l’application et/ou
par e-mail. La poursuite de l’utilisation du Service après cette période vaut acceptation des nouvelles
CGU. »).

Le texte vit dans `src/features/legal/data/legal-content.js`, section `terms`, en français **et** en
anglais. Sa date de version et son empreinte vivent dans
`src/features/legal/data/version-des-conditions.js` ; la date s’affiche au bas des conditions, sur
`/legal` comme dans son HTML servi.

## À chaque modification du texte

1. **Modifier les deux langues** dans `legal-content.js`.
2. **Qualifier le changement** :
   - *de fond* : un droit, une obligation, l’âge minimum, les données, le prix, la résiliation, la
     responsabilité — tout ce qui change ce que la personne accepte ;
   - *de forme* : orthographe, typographie, clarté sans changement de sens.
3. **Nouvelle date de version** dans `version-des-conditions.js` (`date`), et **nouvelle empreinte**
   (`empreinte`) : le garde-fou `src/test/unit/conditions-versionnees.test.js` l’affiche dans son
   message d’échec. Il rougit à toute modification du texte tant que les deux ne suivent pas.
4. **Changement de fond seulement — l’annonce, le jour de la mise en production :**
   - Panneau admin → Notifications → annonce à tous (titre et texte en français et en anglais) :
     ce qui change, en une phrase ; la date d’entrée en vigueur (**mise en production + 30 jours**) ;
     le lien vers `/legal#terms` ;
   - si possible, le même message par e-mail ;
   - jusqu’à cette date, la version précédente s’applique ; continuer à utiliser l’app après vaut
     accord.
5. **Le journal des versions** dit le changement dans la version qui le porte.

## Modèle d’annonce

> **Nos conditions d’utilisation changent le JJ mois AAAA.** Ce qui change : … Tu peux les lire dès
> maintenant dans Mentions légales → Conditions d’utilisation. Continuer à utiliser Fridge+ après le
> JJ mois AAAA vaut accord.

> **Our terms of service change on DD Month YYYY.** What changes: … You can read them now in Legal →
> Terms of service. Continuing to use Fridge+ after DD Month YYYY means you accept them.
