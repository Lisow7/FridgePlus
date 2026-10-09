# Feature `community`

> Espace communautaire : publications (recettes partagées / forum), réponses, réactions/likes,
> profils publics, charte et **signalement/modération**. (Code lu sur `dev` le 2026-06-22.)

## Rôle
Permettre aux utilisateurs de publier, commenter, réagir et signaler — avec une charte à accepter et
des garde-fous (mute, blocage, gating).

## Particularité : feature « mince », logique dans `shared/`
Contrairement aux autres features, `community` ne contient **que des composants** ; sa **donnée et son
i18n vivent dans `shared/`** :
- **API : `@shared/api/community.js`** — `listPosts`/`getPost`/`createPost`/`updatePost`/`deletePost`,
  `listReplies`/`createReply`/`deleteReply`, réactions (`reactToPost`…), likes de réponses,
  `canPost`/`canReply` (gating), `getMyMuteStatus`, `acceptCommunityTerms`/`getCommunityTermsAcceptedAt`,
  `listMyBlockedUserIds`, `listAttachableRecipes`, `reportPost`/`reportReply`/`reportProfile`.
- **i18n : `@shared/lib/i18n/community-i18n.js`** (`COMMUNITY_I18N`, `REPORT_REASONS`) — **centralisé**,
  donc **exception** au pattern i18n inline par composant ([ADR 0002](../../../docs/adr/0002-i18n-inline-par-composant.md)), comme `admin`.

## Modération (à connaître)
- **`report-modal.jsx`** (réutilisable post/reply/profil) → un signalement **crée un ticket dans
  `support_tickets`** : la modération communautaire **transite par le support** (côté admin :
  `features/admin` onglets Reports/Support + `api/community-admin.js`).
- **Garde-fous** côté API : `canPost`/`canReply`, mute (`getMyMuteStatus`), blocage
  (`listMyBlockedUserIds`), et **charte obligatoire** (`acceptCommunityTerms`).

## Structure
- **`components/`** — `community-page` (feed + UI principale), `community-profile-modal` (profil
  public d'un membre), `community-terms-modal` (acceptation de la charte), `report-modal` (signalement).
  Depuis le découpage de `community-page` (2026-07-25/26, audit front §2), ses sous-composants vivent
  à côté : `community-theme` (palettes + helpers), `community-category-icon`, `community-feed-states`,
  `community-trending-card`, `community-recipe-preview-card`, `community-emoji-reaction-bar`,
  `community-reply-card`, `community-post-card`, `community-feed-content`.
- **`hooks/`** — `use-post-detail` (état de la vue détail : chargement post + réponses + likes,
  réaction, envoi/suppression de réponse). Appelé dans `DetailView`, pas dans `CommunityPage`.
- **`pages/community-page-route.jsx`** — montage routé. **`index.js`** — façade publique.

## Dépendances
- `@shared/api/community`, `@shared/lib/i18n/community-i18n`, `@shared/contexts/auth-provider`,
  `@shared/contexts/data-provider` (recettes attachables), Supabase (`support_tickets` pour les reports).
- Recouvrement admin : `src/features/admin` (modération). Vue d'ensemble : `docs/ARCHITECTURE.md`.
