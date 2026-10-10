import { useCallback, useEffect, useState } from 'react'
import { fetchProfile } from '@shared/lib/auth/fetch-profile'

// Filet de sécurité du profil — sorti d'auth-provider.jsx, qui franchissait
// 500 lignes. Si `user` est là mais pas `profile` (course Strict Mode, Lock
// Manager Supabase, changement de compte rapide), on relit avec un délai
// croissant : 4 essais (200, 500, 1 000, 2 000 ms), comme depuis le sprint 11.
//
// Audit du 2026-10-04 : après le dernier essai, la personne restait
// « connectée sans profil » sans un mot (CPT-12) — `profilIndisponible` le dit,
// et `relancerLeProfil` repart de zéro. Et tant que rien n'est su,
// `profileLoading` évite d'affirmer « pas Premium » ou « pas admin » (PREM-06).
const DELAIS_MS = [200, 500, 1000, 2000]

/**
 * @param {{ user: object|null, profile: object|null, loading: boolean, setProfile: Function }} p
 */
export function useProfilDeSecours({ user, profile, loading, setProfile }) {
  const [profilIndisponible, setProfilIndisponible] = useState(false)
  const [relecture, setRelecture] = useState(0)

  useEffect(() => {
    if (!user || profile !== null || loading) return
    let annule = false
    let essai = 0
    let minuteur = null

    async function relire() {
      if (annule) return
      const p = await fetchProfile(user.id)
      if (annule) return
      if (p) {
        setProfile(p)
        return
      }
      essai += 1
      if (essai < DELAIS_MS.length) {
        minuteur = setTimeout(relire, DELAIS_MS[essai])
      } else {
        setProfilIndisponible(true)
      }
    }
    minuteur = setTimeout(relire, DELAIS_MS[0])

    return () => {
      annule = true
      if (minuteur) clearTimeout(minuteur)
    }
  }, [user, profile, loading, relecture, setProfile])

  const relancerLeProfil = useCallback(() => {
    setProfilIndisponible(false)
    setRelecture((n) => n + 1)
  }, [])

  const profileLoading = !!user && profile === null && !profilIndisponible

  return { profileLoading, profilIndisponible, relancerLeProfil, setProfilIndisponible }
}
