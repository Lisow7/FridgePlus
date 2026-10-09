# Feature `push-notifications`

> Notifications push du navigateur : s'abonner, se désabonner, lire ses préférences. (Code lu sur
> `dev` le 2026-10-05.)

## Ce que fait la feature
- **`lib/use-push-subscription.js`** — `usePushSubscription()`, l'unique source de vérité de l'état
  d'abonnement : `{ available, enabled, loading, error, blocked, toggle }`.
  - `available` : le drapeau `push_notifications` est allumé ET la personne est connectée.
  - `enabled` : lu dans les préférences (`inactivity_reminder`).
  - `blocked` : iPhone hors application installée — Safari n'y autorise pas le push
    (`lib/is-ios-standalone.js`).
- **`api/push-subscriptions.js`** — `subscribeToPush`, `unsubscribeFromPush`, `getPushPreferences`,
  `updatePushPreferences`. Contrat `{ error }` : l'appelant lit l'échec.
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
