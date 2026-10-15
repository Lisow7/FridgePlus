import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { useAuth } from '@shared/contexts/auth-provider'
import { adminGetStats } from '@features/admin/api/admin'
import { readStoredSection, storeSection } from '@features/admin/lib/admin-section-storage'
import { versErreur } from '@shared/lib/supabase/lever-si-erreur'
import { logError } from '@shared/lib/observability/sentry'

// Context partagé pour les sections du panel admin :
//  - role courant ('admin' / 'moderator' / 'support' — futur ; pour l'instant 'admin')
//  - stats agrégées (KPI header) refresh à la demande
//  - state UI : section active (pour permettre drill-down depuis Dashboard)
//
// Une seule instance par AdminPanel. Les sections lisent depuis le hook
// `useAdmin()` au lieu de refetch elles-mêmes.

const AdminContext = createContext(null)

export function AdminProvider({ children }) {
  const { user, isAdmin } = useAuth()
  const [section, _setSection] = useState(readStoredSection)
  // Ergonomie : persiste la section active → l'admin retrouve son écran à la
  // réouverture du panel au lieu de repartir du dashboard.
  const setSection = useCallback((next) => {
    _setSection(next)
    storeSection(next)
  }, [])

  // Stats KPI partagées
  const [stats, setStats] = useState({
    usersCount:        null,
    recipesPending:    null,
    baseRecipesCount:  null,
    ingredientsCount:  null,
    ticketsOpen:       null,
    ticketsUnread:     null,
  })
  const [statsLoading, setStatsLoading] = useState(false)
  // Les compteurs n'ont pas pu être lus : le tableau de bord le dit (audit ADM-08).
  // Avant, l'échec était avalé et les badges restaient à 0 — « rien à modérer ».
  const [statsError, setStatsError] = useState(null)

  // Badge counts — exposés aux sections pour la sidebar et les mises à jour optimistes
  const [pendingCount,  setPendingCount]  = useState(0)
  const [supportBadge,  setSupportBadge]  = useState(0)
  const [healthCount,   setHealthCount]   = useState(0)
  const [reportsCount,  setReportsCount]  = useState(0)

  // Drill-down : id d'item à ouvrir dans l'éditeur de la section cible (ex. clic
  // sur un problème Qualité → ouvre la recette/ingrédient). Consommé une fois par
  // la section, puis remis à null.
  const [focusEditId,   setFocusEditId]   = useState(null)

  // Les neuf compteurs en UNE lecture (`admin_compteurs`, lot 12l de l'audit du
  // 2026-10-04, ADM-12 (1, 2)). Avant : cinq comptages et les deux vues de santé
  // téléchargées en entier pour un badge, à l'ouverture et après chaque
  // enregistrement. La Qualité, qui affiche les problèmes, lit les vues elle-même.
  const refreshStats = useCallback(async () => {
    if (!isAdmin) return
    setStatsLoading(true)
    try {
      const c = await adminGetStats()
      setStats({
        usersCount:       c.users,
        recipesPending:   c.pending,
        baseRecipesCount: c.baseRecipes,
        ingredientsCount: c.ingredients,
        ticketsOpen:      c.ticketsOpen,
        ticketsUnread:    c.ticketsUnread,
      })
      setPendingCount(c.pending)
      setSupportBadge(c.ticketsUnread)
      setHealthCount(c.healthCount)
      setReportsCount(c.reportsOpen)
      setStatsError(null)
    } catch (err) {
      logError(err, { tag: 'admin.refreshStats' })
      setStatsError(versErreur(err))
    } finally {
      setStatsLoading(false)
    }
  }, [isAdmin])

  // Premier chargement
  useEffect(() => {
    if (isAdmin) refreshStats()
  }, [isAdmin, refreshStats])

  // Pour l'instant le rôle est binaire admin/non-admin. Préparé pour des
  // rôles plus fins ('moderator', 'support') quand on les ajoutera côté
  // BDD au sprint 4.
  const role = isAdmin ? 'admin' : null

  // Mémoïsation du value Provider (cf. PR S3.b).
  const value = useMemo(() => ({
    role,
    userId: user?.id,
    section,
    setSection,
    stats,
    statsLoading,
    statsError,
    refreshStats,
    pendingCount,  setPendingCount,
    supportBadge,  setSupportBadge,
    healthCount,   setHealthCount,
    reportsCount,  setReportsCount,
    focusEditId,   setFocusEditId,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [role, user?.id, section, stats, statsLoading, statsError, pendingCount, supportBadge, healthCount, reportsCount, focusEditId])

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin doit être appelé dans <AdminProvider>')
  return ctx
}
