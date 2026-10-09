import { useEffect, useRef } from 'react'
import { useAuth } from '@shared/contexts/auth-provider'
import { useLang } from '@shared/contexts/ui-provider'

// La langue suit le compte, dans les deux sens.
//
// Jusqu'au 2026-10-04 elle ne vivait que dans le navigateur
// (`localStorage('fridge-lang')`) :
//   - un compte qui changeait d'appareil retrouvait la langue du navigateur ;
//   - `profiles.language` n'était écrite par personne, alors que quatre
//     fonctions du serveur la lisent pour choisir la langue des e-mails et des
//     notifications (`notify-inactive`, `send-push-notification`,
//     `send-announcement-push`, `send-leftover-expiry-push`) : tout partait en
//     français.
//
// La règle :
//   - quand la langue du compte ARRIVE (connexion) ou CHANGE (autre appareil,
//     par le canal temps réel du profil), l'appareil la prend ;
//   - quand la langue change ICI, le compte la retient ;
//   - un compte sans langue prend celle de l'appareil.
// `seenRef` retient la dernière langue du compte déjà traitée : c'est ce qui
// distingue « le compte vient de changer » de « l'appareil vient de changer »,
// et empêche deux appareils de se renvoyer la balle.
export function useAccountLanguageSync() {
  const { user, profile, updateProfile } = useAuth()
  const { lang, setLang } = useLang()
  const seenRef = useRef({ id: null, language: undefined })
  const writingRef = useRef(null)

  const userId = user?.id ?? null
  const profileId = profile?.id ?? null
  const accountLanguage = profile ? (profile.language ?? null) : undefined

  useEffect(() => {
    if (!userId || !profileId) {
      seenRef.current = { id: null, language: undefined }
      return
    }
    const write = () => {
      // Une seule écriture à la fois pour une même langue (les effets sont
      // joués deux fois en développement).
      if (writingRef.current === lang) return
      writingRef.current = lang
      Promise.resolve(updateProfile({ language: lang })).finally(() => {
        if (writingRef.current === lang) writingRef.current = null
      })
    }
    const seen = seenRef.current
    if (seen.id !== profileId || seen.language !== accountLanguage) {
      seenRef.current = { id: profileId, language: accountLanguage }
      if (accountLanguage && accountLanguage !== lang) setLang(accountLanguage)
      else if (!accountLanguage) write()
      return
    }
    if (accountLanguage !== lang) write()
    // `updateProfile` change d'identité à chaque rendu du fournisseur : le
    // suivre rejouerait l'effet sans raison. Seuls le compte et la langue comptent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, profileId, accountLanguage, lang])
}
