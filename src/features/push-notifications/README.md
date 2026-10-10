# Feature `push-notifications`

> Notifications push du navigateur : s'abonner, se désabonner, lire ses préférences. (Code lu sur
> `dev` le 2026-10-05.)

## Ce que fait la feature
- **`lib/use-push-subscription.js`** — `usePushSubscription()`, l'unique source de vérité de l'état
  d'abonnement : `{ available, enabled, loading, error, blocked, toggle }`.
  - `available` : le drapeau `push_notifications` est allumé ET la personne est connectée.
  - `enabled` : l'état de CET appareil — le navigateur tient un abonnement ET il est rattaché au
    compte courant (`@shared/lib/push/cet-appareil`). Pas les préférences du compte : elles diraient
    « Activées » sur un appareil sans abonnement, et le couper éteindrait les autres appareils.
  - `error` : `null`, `permission_denied` (« Bloquer » dans le navigateur), `unsupported`, `failed`,
    `read_failed` — la fenêtre des cookies choisit son mot selon la cause.
  - `blocked` : iPhone hors application installée — Safari n'y autorise pas le push
    (`lib/is-ios-standalone.js`).
- **`api/push-subscriptions.js`** — `subscribeToPush`, `unsubscribeFromPush`, `getPushPreferences`,
  `updatePushPreferences`. Contrat `{ error }` : l'appelant lit l'échec.
  - `unsubscribeFromPush` désactive sur CET appareil (sa ligne, puis le navigateur) ; les préférences
    du compte ne passent à faux que s'il ne reste plus aucun appareil abonné.
- **La déconnexion** (`signOut` du contexte d'auth, donc chaque écran qui déconnecte) détache cet
  appareil avant de fermer la session, sans toucher aux préférences du compte
  (`detacherCetAppareilAvantDePartir`, borné à 3 s, échec au journal).
  - `subscribeToPush` demande la permission du navigateur : **jamais au chargement**, seulement après
    un geste explicite (règle des navigateurs, et respect de la personne).
  - La clé publique VAPID vient de `VITE_VAPID_PUBLIC_KEY` (`.trim()` : une valeur collée à la main
    dans Vercel embarque facilement un espace, fatal pour `atob`).

## Où c'est branché
- Le **toggle** vit dans la catégorie « notifications » de `features/legal/components/cookie-modal.jsx` ;
  le **récapitulatif** (lecture seule) dans `features/legal/components/confidentiality-panel.jsx`.
- Côté service worker : `public/push-handler.js` (importé par Workbox, `vite.config.js`).
- Côté serveur : les fonctions edge `send-push-notification`, `send-announcement-push`,
  `send-leftover-expiry-push` (`supabase/functions/`).

## Dépendances
`@shared/contexts/auth-provider`, `@shared/contexts/feature-flags-provider`,
`@shared/lib/supabase/client`, `@shared/lib/observability/sentry`.
