import { useEffect, useState } from 'react'
// Le dépôt des recettes, pas l'API admin : importée ici, celle-ci (600 lignes,
// partagée avec le panneau chargé à la demande) entrait TOUT ENTIÈRE dans le
// morceau de démarrage de chaque visiteur (mesuré le 2026-10-08).
import { adminCountCommunityRecipesByStatus } from '@shared/lib/recipes/recipes-repository'
import { countUnreadTickets, adminCountOpenTickets } from '@features/support/api/support'
import { logError } from '@shared/lib/observability/sentry'

// Hook centralisé pour les compteurs de badge admin/support.
// Sprint 10 S10.a.3 — extrait depuis App.jsx.
//
// Renvoie :
//   - adminPendingCount   : recettes communauté en attente de modération
//   - adminSupportCount   : tickets support ouverts (admin only)
//   - supportUnread       : tickets non lus côté user (badge cloche)
//
// Refetch :
//   - Au mount + à chaque changement de `adminPanelOpen` (refresh quand
//     l'admin ferme le panel — voit le compteur à jour à la prochaine
//     ouverture).
//   - Au mount + à chaque changement de `user.id` (un user qui se
//     connecte/déconnecte voit son badge support remis à zéro).
//
// Defense in depth :
//   - Les counts sont à titre informatif (badge UI). Les vrais checks de
//     permissions admin sont côté Supabase RLS.

export function useAdminBadges({ isAdmin, adminPanelOpen, userId }) {
  const [adminPendingCount, setAdminPendingCount] = useState(0)
  const [adminSupportCount, setAdminSupportCount] = useState(0)
  const [supportUnread,     setSupportUnread]     = useState(0)

  // Counts admin (recettes pending + tickets support ouverts)
  // Refetch quand l'admin referme son panel (le compteur a peut-être bougé).
  useEffect(() => {
    if (!isAdmin || adminPanelOpen) return
    Promise.all([
      adminCountCommunityRecipesByStatus('pending'),
      adminCountOpenTickets(),
    ])
      .then(([recipes, tickets]) => {
        setAdminPendingCount(recipes ?? 0)
        setAdminSupportCount(tickets ?? 0)
      })
      .catch(err => logError(err, { tag: 'useAdminBadges.adminCounts' }))
  }, [isAdmin, adminPanelOpen])

  // Count tickets non lus côté user (badge cloche).
  useEffect(() => {
    if (!userId) { setSupportUnread(0); return }
    countUnreadTickets(userId)
      .then(setSupportUnread)
      .catch(err => logError(err, { tag: 'useAdminBadges.countUnreadTickets', userId }))
  }, [userId])

  // Refetch ciblé du support unread (utilisé après actions user dans
  // SupportPanel : ouverture/fermeture d'un ticket marque lu).
  function refreshSupportUnread() {
    if (!userId) return
    countUnreadTickets(userId)
      .then(setSupportUnread)
      .catch(err => logError(err, { tag: 'useAdminBadges.refreshSupportUnread', userId }))
  }

  return {
    adminPendingCount, adminSupportCount, supportUnread,
    setAdminPendingCount, setAdminSupportCount,
    refreshSupportUnread,
  }
}
