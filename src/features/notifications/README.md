# Feature `notifications`

> Cloche + panneau de notifications utilisateur (et flux admin). (Code lu sur `dev` le 2026-06-22.)

## Rôle
Afficher à l'utilisateur ses notifications (réponse à un ticket, recette soumise/changement de
statut…), les marquer lues, les supprimer ; côté admin, consulter/envoyer un flux.

## ⚠️ Invariant clé : les notifs sont créées par des **triggers Postgres**, pas par le client
`api/notifications.js` est une couche **lecture/écriture restreinte** : les **INSERT sont gérés
EXCLUSIVEMENT par des triggers Postgres** (`supabase/migrations/20260502_notifications.sql`),
**atomiques avec l'événement source** (ticket reply, recette soumise, changement de statut). Le client
ne peut donc QUE **lire / marquer lu / supprimer ses propres** notifs (RLS).
👉 **Ne jamais insérer une notif côté client** : ajouter/modifier le trigger correspondant côté BDD.

Autres détails de la couche API :
- Exclut les notifs **expirées** (filet si le job `pg_cron` de purge est en retard).
- Filtre `recipient_id IS NOT NULL` → exclut les **broadcasts admin** (`recipient_id NULL` +
  `recipient_role = 'admin'`).

## Structure
- **`providers/notifications-provider.jsx`** + **`hooks/use-notifications.js`** — contexte + hook
  (compteur non-lus, liste). **`components/`** — `notifications-bell` (cloche + badge),
  `notifications-panel` (liste déroulante).
- **API** (`api/notifications.js`) : `getMyNotifications`, `countUnreadNotifications`,
  `markNotificationRead`/`markAllNotificationsRead`, `deleteNotification`/`deleteAllReadNotifications`,
  + admin : `getAdminFeed`, `adminSendNotification`, `adminDeleteNotification`.

## i18n
`NOTIF_I18N` / `formatRelativeTime` / `localizeNotifText` vivent dans
`@shared/lib/i18n/notifications-i18n.js` (déplacé Sprint 9 pour un **flux unidirectionnel** — réutilisé
par `cart`, `admin`). **i18n centralisé** = exception au pattern inline ([ADR 0002](../../../docs/adr/0002-i18n-inline-par-composant.md)).

## Dépendances
- Supabase (`@shared/lib/supabase/client`) + **triggers** `20260502_notifications.sql`, `pg_cron`
  (purge des expirées), `@shared/lib/i18n/notifications-i18n`. Vue d'ensemble : `docs/ARCHITECTURE.md`.
