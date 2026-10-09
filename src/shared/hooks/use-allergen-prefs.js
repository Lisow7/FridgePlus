import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@shared/lib/supabase/client'

// Préférences allergènes — invité → localStorage ; connecté →
// `profile.allergen_prefs`. Sorti d'`auth-provider.jsx` le 2026-10-05 (il
// franchissait 500 lignes) ; c'est `AuthProvider` qui l'appelle et l'expose.
//
// Pour un compte, une donnée de santé ne part qu'avec un accord explicite
// (RGPD art. 9.2.a ; décision du 2026-10-06, « allergenes = case ») : la
// base le date (`accepter_l_enregistrement_des_allergenes`) ; le retirer
// efface les allergènes ET la date (`retirer_l_accord_allergenes`). Un invité
// garde les siens sur son appareil, sans envoi.
const CLE_APPAREIL = 'fridge-allergen-prefs'

function lireAppareil() {
  try { return JSON.parse(localStorage.getItem(CLE_APPAREIL) ?? '[]') }
  catch { return [] }
}

export function useAllergenPrefs({ user, profile, loading, updateProfile, setProfile }) {
  const [allergenPrefs, setAllergenPrefs] = useState(lireAppareil)

  useEffect(() => {
    if (profile) {
      setAllergenPrefs(profile.allergen_prefs ?? [])
    } else if (!loading) {
      setAllergenPrefs(lireAppareil())
    }
  }, [profile, loading])

  // Ce que la base contient, d'après le profil — lu à la réponse d'une
  // écriture, donc synchronisé après le rendu.
  const profileRef = useRef(profile)
  useEffect(() => { profileRef.current = profile }, [profile])
  // Le compte affiché : la réponse en retard d'une écriture ne doit pas
  // remettre à l'écran les allergènes du compte précédent — ils disent quelque
  // chose de la santé de quelqu'un.
  const userIdRef = useRef(user?.id)
  useEffect(() => { userIdRef.current = user?.id }, [user?.id])

  // L'écran change tout de suite ; si l'écriture échoue il REVIENT aux
  // allergènes enregistrés et l'erreur est rendue (l'appelant dit « Pas
  // enregistré »). Avant le 2026-10-04 la nouvelle valeur restait affichée :
  // sur un réglage de sécurité alimentaire, on se croyait protégé (CPT-11).
  //
  // « Enregistrés » = ceux du profil, pas ceux d'avant le geste : quand deux
  // réglages se croisent, l'état d'avant le second est celui que le premier
  // venait d'afficher, et que la base a peut-être refusé aussi. Le profil, lui,
  // n'avance que sur une écriture acceptée (`updateProfile`).
  const accordLe = profile?.allergen_consent_at ?? null

  async function updateAllergenPrefs(prefs) {
    // Sans accord, un allergène ne part même pas (tout effacer, si).
    if (user && !accordLe && prefs.length > 0) return { error: { message: 'allergen_consent_required' } }
    const avant = allergenPrefs
    const emetteur = user?.id
    setAllergenPrefs(prefs)
    let error = null
    if (user) {
      // Un appel qui lève (réseau coupé) rend une erreur comme les autres.
      try { ({ error } = await updateProfile({ allergen_prefs: prefs })) }
      catch (err) { error = err ?? new Error('unknown') }
    } else {
      try { localStorage.setItem(CLE_APPAREIL, JSON.stringify(prefs)) }
      catch (err) { error = err }
    }
    if (error && userIdRef.current === emetteur) {
      setAllergenPrefs(user && profileRef.current ? (profileRef.current.allergen_prefs ?? []) : avant)
    }
    return { error: error ?? null }
  }

  async function acceptAllergenConsent() {
    try {
      const { data, error } = await supabase.rpc('accepter_l_enregistrement_des_allergenes')
      if (error) return { error }
      setProfile?.(p => (p ? { ...p, allergen_consent_at: p.allergen_consent_at ?? data } : p))
      return { error: null }
    } catch (err) {
      return { error: err ?? new Error('unknown') }
    }
  }

  async function withdrawAllergenConsent() {
    try {
      const { error } = await supabase.rpc('retirer_l_accord_allergenes')
      if (error) return { error }
      setProfile?.(p => (p ? { ...p, allergen_prefs: [], allergen_consent_at: null } : p))
      setAllergenPrefs([])
      return { error: null }
    } catch (err) {
      return { error: err ?? new Error('unknown') }
    }
  }

  // Un objet stable tant que rien ne change : `AuthProvider` l'étale dans sa
  // valeur mémoïsée (31+ consommateurs de `useAuth`). Comme elle, il ignore les
  // fonctions (`updateProfile` est recréée à chaque rendu).
  return useMemo(() => ({
    allergenPrefs, updateAllergenPrefs,
    allergenConsentAt: accordLe, acceptAllergenConsent, withdrawAllergenConsent,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [allergenPrefs, accordLe, user?.id])
}
