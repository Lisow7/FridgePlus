import { useState, useEffect } from 'react'
import { useAuth } from '@shared/contexts/auth-provider'
import { loadRecentCookingLogs, loadCookingLogsCount, loadAllCookingLogs } from '@shared/api/cooking-logs'
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
//
// 2026-10-04 (audit CPT-11) — trois états, plus deux :
//   `null`            en cours de chargement (ou pas chargé du tout) ;
//   une liste         chargée, éventuellement vide ;
//   `…Error = true`   le chargement a échoué — la liste reste `null`.
// Avant, un échec rendait une liste vide : « pas chargé » et « jamais cuisiné »
// donnaient le même écran. `reloadCookingLogs()` relance le chargement — et
// efface l'erreur le temps de la nouvelle tentative : si elle revient, c'est
// que la tentative a échoué aussi, pas que le bouton n'a rien fait.

export function useProfileState({
  enableJournal = false,
  enableStats = false,
  enableCommunityTerms = false,
} = {}) {
  const { user } = useAuth()

  const [journalLogs, setJournalLogs] = useState(null)
  const [journalCount, setJournalCount] = useState(0)
  const [statsLogs, setStatsLogs] = useState(null)
  const [journalError, setJournalError] = useState(false)
  const [statsError, setStatsError] = useState(false)
  const [communityTermsAt, setCommunityTermsAt] = useState(null)
  // « Réessayer » relance les deux chargements.
  const [tentative, setTentative] = useState(0)

  useEffect(() => {
    if (!enableJournal || !user?.id) return
    let cancelled = false
    Promise.all([
      loadRecentCookingLogs(user.id, 20),
      loadCookingLogsCount(user.id),
    ]).then(([recents, total]) => {
      if (cancelled) return
      if (recents.error) { setJournalError(true); return }
      setJournalLogs(recents.logs)
      setJournalCount(total.count)
      setJournalError(false)
    }).catch(() => { if (!cancelled) setJournalError(true) })
    return () => { cancelled = true }
  }, [enableJournal, user?.id, tentative])

  useEffect(() => {
    if (!enableStats || !user?.id) return
    let cancelled = false
    loadAllCookingLogs(user.id, 1000).then(({ logs, error }) => {
      if (cancelled) return
      if (error) { setStatsError(true); return }
      setStatsLogs(logs)
      setStatsError(false)
    }).catch(() => { if (!cancelled) setStatsError(true) })
    return () => { cancelled = true }
  }, [enableStats, user?.id, tentative])

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
    journalError,
    statsError,
    reloadCookingLogs: () => {
      setJournalError(false)
      setStatsError(false)
      setTentative((n) => n + 1)
    },
    communityTermsAt,
    setCommunityTermsAt,
  }
}
