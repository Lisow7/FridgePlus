# Feature `support`

> Support & signalements : panneau in-app unique (`SupportPanel`) qui combine **aide rapide
> self-service**, **flux guidé de signalement**, et **messagerie de tickets** (user ↔ admin).
> (Code lu sur `dev` le 2026-06-23.)

## Pièce maîtresse : `components/support-panel.jsx`
Modale ouverte depuis le header (`app/components/app-modals-root.jsx`). Un seul composant orchestre
plusieurs **flux** choisis via une grille de `CATEGORIES`, chacune ayant un `flow` :
- **`report`** — signaler une recette officielle/communauté, un ingrédient, un utilisateur, ou une
  erreur de prix. Recherche la cible (`searchBaseRecipes` / `searchCommunityRecipes` /
  `searchIngredients` / `searchUsersForReport`) puis crée un signalement via `createReport`
  (`@shared/api/reports`). Les motifs proposés dépendent de la cible (`REASON_SUBSETS`).
- **`bug`** — problème technique (voix, formulaire recette, profil) : passe **d'abord** par l'aide
  rapide, sinon ouvre un ticket `question`.
- **`free`** — question libre (`question`) ou suggestion (`request`) → ticket direct.

## Aide rapide self-service : `data/support-self-help.js`
- `SUPPORT_SELF_HELP` = Q/R **100 % statiques (FR + EN), sans IA ni BDD** (aligné Launch Free), clé =
  id de catégorie du flux guidé. Affiché **avant** la création de ticket pour que l'utilisateur résolve
  seul les soucis courants → désengorge la file admin. Seules les catégories où l'auto-résolution a du
  sens ont du contenu (les signalements sautent l'étape). Helper : `getSelfHelp(...)`.

## Tickets : `api/support.js` (côté user **et** admin)
- **User** : `getUserTickets`, `getTicketMessages`, `createTicket`, `sendUserMessage`,
  `markTicketReadByUser`, `countUnreadTickets`, `deleteUserMessage`, `deleteUserTicket`,
  `updateTicketTitle`. **Plafond `MAX_OPEN_TICKETS = 3`** (statuts `open`/`in_progress`) → `createTicket`
  renvoie `max_tickets_reached` au-delà. La constante vit dans
  `@shared/lib/support/open-tickets-cap` — **source unique**, partagée avec
  `shared/api/reports.js` qui en portait une copie.
  ⚠️ Ce plafond est **aussi appliqué en base** par la policy RLS
  `support_tickets_insert` (migration `20260812_plafond_serveur_tickets_ouverts.sql`) :
  le contrôle client seul se contournait par un appel PostgREST direct. Les deux
  nombres doivent rester égaux — garde-fou : `src/test/unit/plafond-tickets-coherence.test.js`.
- **Admin** : `adminGetAllTickets` (joint le `username` des profils), `adminReplyTicket`,
  `adminSetTicketStatus`, `adminCountOpenTickets`, `adminCountUnreadTickets`, `markTicketReadByAdmin`,
  `adminDeleteMessage` / `adminDeleteAnyMessage` / `adminDeleteTicket`.
- **Helpers de recherche** réutilisés par le flux signalement (s'appuient sur
  `@shared/lib/recipes/recipes-repository`).
- Tables Supabase : `support_tickets` + `support_messages`. Drapeaux de lecture **bidirectionnels**
  (`has_unread_user` / `has_unread_admin`) qui pilotent les pastilles des deux côtés.

## Notification e-mail (best-effort)
`adminReplyTicket` invoque l'Edge Function `send-ticket-notification` (Resend) pour prévenir le user.
**Non bloquant** : enveloppé dans une IIFE async + try/catch — si l'envoi échoue (ou
`supabase.functions` indispo en test/legacy), le ticket est quand même mis à jour et la notif in-app
reste affichée.

## Modération à la saisie
Le panneau passe le contenu utilisateur par `moderateContent` (`@shared/hooks/use-moderation`) avant
envoi.

## Dépendances & consommateurs
- `@shared/api/reports` (`createReport`), `@shared/hooks/use-moderation`,
  `@shared/lib/recipes/recipes-repository`, `@shared/lib/supabase/client`, `@shared/ui/button`.
- `index.js` re-exporte **toute** l'API (`export *`) car la section admin en consomme tout. Consommé
  par : `app/components/app-modals-root.jsx` (panneau), `app/hooks/use-admin-badges.js`,
  `features/admin/.../support-section.jsx` + `reports-section.jsx` + `admin-provider.jsx`,
  `shared/api/reports.js`.
- i18n **inline** dans le panneau (fr/en), cf. [ADR 0002](../../../docs/adr/0002-i18n-inline-par-composant.md).
  Vue d'ensemble : `docs/ARCHITECTURE.md`.
