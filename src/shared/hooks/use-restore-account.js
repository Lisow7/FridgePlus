import { useEffect, useState } from 'react'

// Hook de restauration de compte via lien email (Sprint 9 S9.h.1).
//
// Détecte le paramètre URL `?restore-account=<token>`, déclenche l'appel
// API de restauration (fonction passée depuis le AuthContext), et expose
// un bandeau auto-dismiss après 8 secondes.
//
// Usage :
//   const { restoreAccount } = useAuth()
//   const [banner] = useRestoreAccount({ lang, restoreAccount })
//
// Le paramètre URL est nettoyé immédiatement après lecture (évite la
// boucle de retry sur refresh).

const RESTORE_MSG = {
  fr: {
    ok:      'Compte restauré ! Tu peux te reconnecter.',
    expired: 'Le lien a expiré (plus de 30 jours).',
    invalid: 'Lien invalide ou déjà utilisé.',
    generic: 'Erreur lors de la restauration.',
  },
  en: {
    ok:      'Account restored! You can sign back in.',
    expired: 'Link expired (over 30 days).',
    invalid: 'Invalid or already used link.',
    generic: 'Restoration error.',
  },
}

export function useRestoreAccount({ lang = 'fr', restoreAccount }) {
  const [banner, setBanner] = useState(null) // { ok: bool, msg: string } | null

  // Auto-dismiss après 8s.
  useEffect(() => {
    if (!banner) return
    const id = setTimeout(() => setBanner(null), 8000)
    return () => clearTimeout(id)
  }, [banner])

  // Read URL param + call API once on mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('restore-account')
    if (!token) return

    // Nettoyer l'URL avant l'appel (évite boucle si refresh).
    params.delete('restore-account')
    const newSearch = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${newSearch ? '?' + newSearch : ''}`)

    ;(async () => {
      const { error } = await restoreAccount(token)
      const tt = RESTORE_MSG[lang] ?? RESTORE_MSG.fr
      if (!error)                              setBanner({ ok: true,  msg: tt.ok })
      else if (error.code === 'expired')       setBanner({ ok: false, msg: tt.expired })
      else if (error.code === 'invalid_token') setBanner({ ok: false, msg: tt.invalid })
      else                                     setBanner({ ok: false, msg: tt.generic })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return [banner, () => setBanner(null)]
}
