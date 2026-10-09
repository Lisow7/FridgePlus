# Feature `admin`

> Back-office : tableau de bord (KPI), modération, gestion des recettes/ingrédients/prix, support,
> utilisateurs, qualité des données, feature flags. (Code lu sur `dev` le 2026-06-22.)

## Rôle
Panel d'administration unique (`AdminPanel`, lazy-loaded depuis `App.jsx`), réservé aux admins
(`isAdmin` via `useAuth`). Bloc cohérent qui **consomme beaucoup d'autres features** (recipes,
community, support, notifications, premium, reports).

## Architecture interne (2 spécificités à connaître)
- **Provider/context `useAdmin`** (`providers/admin-provider.jsx`) — **exception au props-drilling**
  du reste de l'app. Une seule instance par `AdminPanel` ; expose le **rôle** courant
  (`admin`/`moderator`/`support` — `support`/`moderator` prévus, `admin` seul actif), les **stats KPI**
  agrégées (refresh à la demande) et la **section active**. Les sections lisent `useAdmin()` au lieu de
  refetch. La section active est **persistée** (`lib/admin-section-storage.js`) → l'admin retrouve son
  écran à la réouverture.
- **i18n CENTRALISÉ** (`i18n/admin-i18n.js`, `ADMIN_I18N` × 5 langues) — **exception assumée** au
  pattern i18n inline par composant ([ADR 0002](../../../docs/adr/0002-i18n-inline-par-composant.md)) :
  ici tout l'admin partage un seul fichier « pour cohérence ». Ne pas « corriger » en inline.

## Audit & RGPD (ne pas contourner)
- **`lib/audit.js`** — logger structuré vers la table append-only `activity_logs`. Garantit :
  (1) **vocabulaire fermé** (`AUDIT_ACTIONS` whitelist ; action inconnue → warning dev mais insert
  quand même pour ne pas bloquer la prod), (2) **metadata whitelistée par action** (`METADATA_KEYS` ;
  clés non listées filtrées).
- **`api/sensitive-audit.js`** — logge toute **consultation** admin d'une donnée sensible (email, IP,
  `last_sign_in`…) avec action `sensitive_data_accessed` (who/what/why/when). RGPD : minimisation +
  traçabilité. Distinct de `adminLogAction` (qui trace les *modifications*).

## Structure
- **`api/`** — `admin.js` (stats, health checks, actions), `community-admin.js`, `recipe-reviews-admin.js`,
  `sensitive-audit.js`.
- **`components/sections/`** — **14 onglets** : `base-recipes`, `community`, `custom-recipes`,
  `data-quality`, `features` (feature flags), `import-queue-tab`/`import-metrics`, `ingredients`,
  `journal`, `notifications`, `pricing`, `recipe-reviews`, `reports`, `support`, `users`.
- **`components/shared/`** — primitives admin réutilisables : `bulk-action-bar`, `search-input`,
  `stat-card`, `analytics-chart`, `confirm-modals`, `reason-selector`, `sensitive-data-toggle`,
  `feedback-banner`, `hover-icon-button`.
- **`components/`** — `admin-panel` (shell), `dashboard`, éditeurs (`ingredients-editor`,
  `steps-editor`, `recipe-live-preview`).
- **`hooks/use-selection.js`** — sélection multiple (actions en masse). **`lib/`** — `audit`,
  `admin-section-storage`, `missing-image`, `dev-crash-trigger` (déclenche un crash pour tester Sentry).
- **`data/`** — `admin-help-content`, `support-quick-replies`. **`providers/`** — `admin-provider`.

## Dépendances
- `@shared/contexts/auth-provider` (`isAdmin`), `@features/support/api/support` (compteurs tickets),
  `@shared/api/reports` (compteurs signalements), `@shared/lib/moderation`, Supabase (`activity_logs`).
- Vue d'ensemble : `docs/ARCHITECTURE.md`.
