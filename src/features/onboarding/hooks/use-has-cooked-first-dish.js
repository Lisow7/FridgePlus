import { useState, useEffect } from 'react'
import { hasCookedAtLeastOnce } from '@shared/api/cooking-logs'

// Vrai si l'utilisateur a cuisiné ≥ 1 plat (4ᵉ étape onboarding). Faux pour un
// invité ('guest'). Re-fetch au changement d'uid.
//
// `null` tant que la réponse du serveur n'est pas arrivée pour un compte
// connecté : « on ne sait pas encore » n'est pas « jamais cuisiné ». Rendre
// `false` d'emblée faisait clignoter la carte du débutant chez un compte ancien,
// le temps de la requête (audit du 2026-10-04, P-08). `null` aussi quand la
// lecture ÉCHOUE : on ne sait toujours pas.
const estUnCompte = (uid) => !!uid && uid !== 'guest'

export function useHasCookedFirstDish(uid) {
  // `pour` : le compte auquel appartient la réponse — celle d'un autre compte
  // ne vaut rien pour celui-ci.
  const [reponse, setReponse] = useState({ pour: null, hasCooked: null })
  useEffect(() => {
    if (!estUnCompte(uid)) return
    let cancelled = false
    hasCookedAtLeastOnce(uid)
      .then((v) => { if (!cancelled) setReponse({ pour: uid, hasCooked: v }) })
      .catch(() => { if (!cancelled) setReponse({ pour: uid, hasCooked: null }) })
    return () => { cancelled = true }
  }, [uid])
  if (!estUnCompte(uid)) return false
  return reponse.pour === uid ? reponse.hasCooked : null
}
