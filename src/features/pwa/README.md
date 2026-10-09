# Feature `pwa`

> Progressive Web App : invite à **installer l'app** (A2HS) et **bandeau de mise à jour** quand un
> nouveau service worker est prêt. (Code lu sur `dev` le 2026-06-23.)

## `components/update-prompt.jsx` — mise à jour du service worker
- **Stratégie `registerType: 'autoUpdate'`** (`vite.config.js`) : le SW s'auto-active à chaque deploy
  (skipWaiting + clientsClaim), sans attendre un clic utilisateur. Avant : stratégie « prompt » (ce
  composant affichait un toast « Recharger » et attendait l'OK, pour ne pas perdre une saisie en
  cours) — abandonnée car le toast ne se déclenchait pas chez des users en prod, qui restaient
  bloqués sur un vieux bundle SW (champs profil vides après hard refresh post-deploy, etc. — cf.
  session 2026-05-15, ~45 min de diag). `<UpdatePrompt>` reste utilisé aujourd'hui uniquement pour
  le message `offlineReady` (« prêt à fonctionner hors-ligne »), plus pour proposer un rechargement.
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
