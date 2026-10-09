# 0002 — i18n inline par composant (pas de lib globale)

- Statut : accepté
- Date : 2026-06-22

## Contexte et problème
L'app est en 5 langues (`fr`, `en`, `es`, `de`, `ja`). Il fallait une stratégie d'internationalisation.

## Décision
**Aucune librairie i18n** (vérifié : pas d'`i18next`/`react-intl`/`lingui` dans `package.json`).
Chaque composant qui en a besoin définit son propre objet `I18N` / `PANEL_I18N` indexé par code
langue (≈ 69 fichiers). La langue est un prop `lang` descendu dans l'arbre (détectée navigateur,
sauvée dans `localStorage('fridge-lang')`).

## Conséquences
- (+) Zéro dépendance i18n ; les traductions vivent au plus près du composant qui les utilise.
- (−) Pas de gestion centralisée (extraction, pluriels, fallback automatique) ; risque de
  divergence/oubli entre composants. Un nouveau dev qui ajoute une string doit la fournir **dans
  les 5 langues**, localement.
- ⚠️ Ne pas introduire une lib i18n globale sans un plan de migration des ~69 objets inline —
  sinon double système incohérent.
- Le branding « Fridge+ » n'est pas traduisible (garder tel quel).
