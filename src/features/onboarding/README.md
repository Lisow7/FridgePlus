# Feature `onboarding`

> Première expérience : écran de bienvenue, visite guidée, hub d'aide — et la **source unique des
> tiers d'accès** par feature (free / account / premium). (Code lu sur `dev` le 2026-06-22.)

## Rôle
Accueillir un nouvel utilisateur (welcome au 1ᵉʳ passage, tour guidé), donner un point d'aide, et
exposer **quel tier d'accès** chaque feature requiert (utilisé par l'onboarding ET les pastilles).

## Composants
- **`welcome-screen.jsx`** — écran de bienvenue au **1ᵉʳ passage**. Affichage piloté par
  `lib/welcome-storage.js` : flag `localStorage('fridge-welcome-seen-v1')`
  (`hasSeenWelcome`/`markWelcomeSeen`). ⚠️ Fallback : si `localStorage` indisponible → considéré
  « vu » (pour **ne pas spammer**).
- **`tour-wizard.jsx`** — visite guidée pas-à-pas (steps depuis `i18n/tour-steps-i18n.js`,
  `useFocusTrap`, CSS injecté une fois dans `<head>`, portal). Tient compte de `PREMIUM_ENABLED`.
- **`help-guide.jsx`** — hub d'aide (référence `CURRENT_VERSION`).

## Tiers d'accès
Trois niveaux : invité (frigo, recettes, voix, filtres), compte (favoris, communauté, création,
profil), Premium (panier, coûts, mode cuisine vocal, listes, partage) — affiché « Bientôt » tant
que `PREMIUM_ENABLED=false`. Les pastilles (`@shared/ui/tier-badge`) reçoivent leur tier en prop.
La table `FEATURE_TIER` qui se disait « LA référence » a été retirée le 2026-10-09 : rien ne la
lisait (audit du 2026-10-04, ARCH-14). Une table commune des fonctions Premium, lue par le verrou,
la fenêtre d'abonnement et les CGV, est prévue au lot 15 (PREM-09).

## i18n
`i18n/welcome-i18n.js` + `i18n/tour-steps-i18n.js` — **fichiers i18n centralisés** par la feature →
**exception** au pattern inline par composant ([ADR 0002](../../../docs/adr/0002-i18n-inline-par-composant.md)).

## Dépendances
- `@shared/lib/premium-config` (`PREMIUM_ENABLED`), `@shared/hooks/use-focus-trap`,
  `@shared/lib/version` (`CURRENT_VERSION` dans le hub d'aide), `localStorage`.
- Le tier d'accès est cross-cutting (pastilles, verrous Premium). Vue d'ensemble : `docs/ARCHITECTURE.md`.
