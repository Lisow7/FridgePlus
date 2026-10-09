import { useState, useEffect } from 'react'
import { useAuth } from '@shared/contexts/auth-provider'
import { listRecentCookingLogs, countCookingLogs, listAllCookingLogs } from '@shared/api/cooking-logs'
import { getCommunityTermsAcceptedAt } from '@shared/api/community'

// State partagé entre les sous-pages Profile. Centralise le lazy-loading
// du journal de cuisine, des stats personnelles, et de l'acceptation
// charte communauté.
//
// Sprint 11 S11.a.1 — extrait depuis ProfileModal (1861 l). Avant, ces
// fetch étaient inline dans la modale et conditionnés à `tab === 'X'`.
// Désormais chaque sous-page demande ce dont elle a besoin via les flags
// `enableX`. Évite de tout charger sur /profile/account et permet à
// chaque sous-page de gérer son propre cycle de vie.
//
// Pattern :
//   /profile/activity    → useProfileState({ enableJournal: true, enableStats: true })
//   /profile/preferences → useProfileState({ enableCommunityTerms: true })
//   /profile/account     → useProfileState()                       (no-op)

export function useProfileState({
  enableJournal = false,
  enableStats = false,
  enableCommunityTerms = false,
} = {}) {
  const { user } = useAuth()

  const [journalLogs, setJournalLogs] = useState(null)
  const [journalCount, setJournalCount] = useState(0)
  const [statsLogs, setStatsLogs] = useState(null)
  const [communityTermsAt, setCommunityTermsAt] = useState(null)

  useEffect(() => {
    if (!enableJournal || !user?.id) return
    let cancelled = false
    Promise.all([
      listRecentCookingLogs(user.id, 20),
      countCookingLogs(user.id),
    ]).then(([logs, count]) => {
      if (cancelled) return
      setJournalLogs(logs)
      setJournalCount(count)
    })
    return () => { cancelled = true }
  }, [enableJournal, user?.id])

  useEffect(() => {
    if (!enableStats || !user?.id) return
    let cancelled = false
    listAllCookingLogs(user.id, 1000).then((logs) => {
      if (cancelled) return
      setStatsLogs(logs)
    })
    return () => { cancelled = true }
  }, [enableStats, user?.id])

  useEffect(() => {
    if (!enableCommunityTerms || !user?.id) return
    let cancelled = false
    getCommunityTermsAcceptedAt(user.id).then((at) => {
      if (cancelled) return
      setCommunityTermsAt(at)
    })
    return () => { cancelled = true }
  }, [enableCommunityTerms, user?.id])

  return {
    journalLogs,
    journalCount,
    statsLogs,
    communityTermsAt,
    setCommunityTermsAt,
  }
}
