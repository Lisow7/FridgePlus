import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@shared/contexts/auth-provider'
import {
  listMFAFactors, enrollTOTP, verifyTOTP, unenrollFactor, getAAL,
} from '@shared/api/mfa'

// Hook React qui expose l'état MFA de l'utilisateur courant + actions.
//
// État exposé :
//   • factors           — liste des facteurs TOTP actifs (status 'verified')
//   • hasVerifiedFactor — true si au moins un facteur 'verified'
//   • aal               — { current, next } : niveau d'assurance courant
//   • isAAL2            — true si user authentifié en aal2 (password + OTP)
//   • loading           — durant le fetch initial / refresh
//
// Actions :
//   • refresh()              — re-fetch listFactors + AAL
//   • startEnroll()          — appelle enrollTOTP, retourne { id, qrCode, secret }
//   • verify({ factorId, code }) — verify OTP (active le facteur OU élève AAL2)
//   • unenroll(factorId)     — supprime le facteur

export function useMFA() {
  const { user } = useAuth()
  const [factors,           setFactors]           = useState([])
  const [aal,               setAAL]               = useState({ current: null, next: null })
  const [loading,           setLoading]           = useState(false)
  // Compte dont les facteurs ont été lus (null : personne, rien à lire). Tant
  // que ce n'est pas celui de la session, la carte 2FA disait « Inactive »
  // à un compte protégé (audit du 2026-10-04, comptes et authentification).
  const [pretPour,          setPretPour]          = useState(undefined)

  const userId = user?.id ?? null
  const refresh = useCallback(async () => {
    if (!userId) {
      setFactors([])
      setAAL({ current: null, next: null })
      setPretPour(null)
      return
    }
    setLoading(true)
    const [{ totp }, aalRes] = await Promise.all([
      listMFAFactors(),
      getAAL(),
    ])
    setFactors(totp)
    setAAL({ current: aalRes.current, next: aalRes.next })
    setLoading(false)
    setPretPour(userId)
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  const startEnroll = useCallback(async (friendlyName) => {
    return enrollTOTP(friendlyName)
  }, [])

  const verify = useCallback(async ({ factorId, code }) => {
    const result = await verifyTOTP({ factorId, code })
    if (!result.error) await refresh()
    return result
  }, [refresh])

  const unenroll = useCallback(async (factorId) => {
    const result = await unenrollFactor(factorId)
    if (!result.error) await refresh()
    return result
  }, [refresh])

  const verifiedFactors = factors.filter(f => f.status === 'verified')

  return {
    factors:           verifiedFactors,
    hasVerifiedFactor: verifiedFactors.length > 0,
    aal,
    isAAL2:            aal.current === 'aal2',
    needsAAL2:         aal.current === 'aal1' && aal.next === 'aal2',
    loading,
    pret:              pretPour === userId,
    refresh,
    startEnroll,
    verify,
    unenroll,
  }
}
