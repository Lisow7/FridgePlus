# Feature `profile`

> Espace utilisateur : identité, préférences, activité (journal de cuisine, stats), récompenses
> (quêtes/badges), dépenses (premium), compte & sécurité, et les **droits RGPD** self-service.
> (Code lu sur `dev` le 2026-06-22.)

## Rôle
Tout ce qui concerne « mon compte » : profil public (avatar/bannière/badges), préférences
(allergènes, charte communauté, opt-out profilage), activité personnelle, abonnement, et la gestion
des données personnelles (export, suppression).

## Architecture (migration modal → pages)
Sprint 11 : l'ancienne `ProfileModal` (**1861 lignes**) a été **supprimée** au profit de **pages
routées** avec une sidebar (`profile-sidebar`). Pages : `profile-page` (conteneur) + `identity`,
`preferences`, `activity`, `account`, `rewards`, `spending`.
- **`hooks/use-profile-state.js`** — state partagé entre sous-pages avec **lazy-loading par flags**
  (`enableJournal`, `enableStats`, `enableCommunityTerms`) : chaque sous-page ne charge que ce dont
  elle a besoin (ex. `/profile/account` = no-op). **Ne pas re-fetcher dans les sous-pages** : passer
  par ce hook.

## RGPD (droits utilisateur — ne pas contourner)
- **`api/data-export.js`** — **Article 20 (portabilité)** : agrège toutes les données perso en un
  **JSON téléchargeable**, **self-service** (pas de demande email à traiter). Toutes les requêtes sont
  **filtrées par RLS via `auth.uid()`** → l'utilisateur n'obtient que ses propres données.
- **`components/profiling-opt-out-section.jsx`** — opt-out du profilage.
- **`components/erase-spending-history-section.jsx`** — effacement de l'historique de dépenses.
- **`components/danger-zone.jsx`** — suppression de compte.

## Gamification (Récompenses)
- **`@shared/lib/recipes/achievements.js`** — catalogue unique de progression (`BADGE_DEFINITIONS`,
  14 paliers en 4 thèmes), dérivé du journal de cuisine existant (**zéro nouvelle collecte**). Chaque
  palier peut désigner une bannière-récompense (`reward.banner`), verrouillée dans le picker jusqu'à
  déblocage (`isBannerLocked`, `badgeForBanner`, `computeNewlyUnlocked`, `nextReward`). Pour ajouter un
  palier/une bannière : la note interne sur l’ajout de quêtes et de cosmétiques.
- `badges-grid`, `streak-card`, `avatar-picker-modal`, `banner-picker-modal`.

## Premium & sécurité
- **Dépenses (premium)** : `spending-dashboard`, `spending-insights`, page `profile-spending`.
- **`mfa-card.jsx`** — gestion 2FA (TOTP). **`subscription-tab.jsx`** — abonnement.
- **`anti-gaspi-stats-card.jsx`** — le score anti-gaspi (déplacé ici, onglet Activité).

## Dépendances
- `@shared/contexts/auth-provider` (user), `@shared/api/cooking-logs` (journal), `@shared/api/community`
  (charte), Supabase + RLS pour l'export/les données. i18n inline → [ADR 0002](../../../docs/adr/0002-i18n-inline-par-composant.md).
- Vue d'ensemble : `docs/ARCHITECTURE.md`.
