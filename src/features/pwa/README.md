# Feature `pwa`

> Progressive Web App : invite à **installer l'app** (A2HS) et **bandeau de mise à jour** quand un
> nouveau service worker est prêt. (Code lu sur `dev` le 2026-06-23 ; mise à jour le 2026-10-05.)

## `components/update-prompt.jsx` — mise à jour du service worker
- **Stratégie `registerType: 'prompt'`** (`vite.config.js`, depuis le 2026-07-09 ; ce README a affirmé
  `autoUpdate` jusqu'au 2026-10-05) : après un déploiement, le SW neuf **attend** l'OK de l'utilisateur,
  pour ne pas perdre une saisie en cours. La bannière « Nouvelle version disponible » propose de recharger.
  Une vérification active (toutes les heures, et au retour sur l'onglet) détecte une nouvelle version dans
  un onglet resté ouvert.
- **Au retour sur l'onglet** (`lib/au-retour-d-onglet.js`) : tant qu'une version attend, la bannière revient
  — « Plus tard » ne la cache plus pour toute la vie de l'onglet.
- **Fichier disparu après un déploiement** (`lib/version-perimee.js`, installé par `src/main.jsx`) : qui garde
  l'ancienne version charge à la demande des morceaux dont le nom a changé (dont les trois hors précache :
  vendor-sentry, admin-panel, vendor-recharts). Sur `vite:preloadError`, la version neuve est activée puis la
  page recharge — **seulement** sur la preuve d'une version plus récente (SW neuf, ou adresse d'entrée changée
  sans SW), une fois par session, jamais hors ligne. Un morceau bloqué par un bloqueur de publicité ne recharge
  rien. Le bouton « Recharger la page » de l'écran d'erreur active lui aussi la version en attente.
- L'API `useRegisterSW` vient du **module virtuel `virtual:pwa-register/react`**, qui **n'existe qu'au
  build** → import **dynamique à l'exécution** (try/catch) pour ne pas casser le dev/les tests.
  Chargé en **lazy** par `app/components/global-overlays.jsx`.

## `components/install-button.jsx` — installation (A2HS)
- Bouton « Installer l'app » dans le **footer** (`app/layout/footer.jsx`). Apparaît quand le navigateur
  émet `beforeinstallprompt` (Chromium / Edge / Samsung) ; le clic déclenche le prompt natif différé.
- **iOS Safari** n'a pas cet event → affiche un mini-guide manuel (Partager → « Sur l'écran
  d'accueil »). Détection via `isIos()` ; masqué si déjà installé (`isStandalone()` :
  `display-mode: standalone` ou `navigator.standalone`). Écoute `appinstalled` pour se masquer.

## Dépendances & consommateurs
- `@shared/ui/button`, `react-icons/lu`, `vite-plugin-pwa` (`virtual:pwa-register/react`, runtime only).
- `UpdatePrompt` consommé par `app/components/global-overlays.jsx` (lazy) ; `InstallButton` par
  `app/layout/footer.jsx`.
- i18n **inline par composant** (fr/en), cf. [ADR 0002](../../../docs/adr/0002-i18n-inline-par-composant.md).
  La config PWA (manifest, icônes, stratégie de cache) vit côté build (`vite.config`) et scripts
  (`npm run pwa-icons`), hors de cette feature. Vue d'ensemble : `docs/ARCHITECTURE.md`.
