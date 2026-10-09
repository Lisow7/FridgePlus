// Le code de double authentification est-il dû pour CETTE session ? (audit du
// 2026-10-04, CPT-01, CPT-02.)
//
// Jusqu'au 2026-10-05, activer la double authentification ne protégeait rien :
// le code n'était demandé nulle part après le mot de passe, ni après un lien
// « mot de passe oublié ». `AuthProvider` pose maintenant cet état, et la porte
// « Vérification en 2 étapes » (`features/auth/components`) le lit.
//
// ── Pourquoi un calcul SYNCHRONE ──────────────────────────────────────────
// `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` fait la même chose — le
// claim `aal` du jeton, et les facteurs vérifiés de l'utilisateur — mais en
// asynchrone. L'attendre dans `onAuthStateChange` aurait posé l'utilisateur
// AVANT l'état « code dû » : quelques images où l'application est visible et
// cliquable, sans code. Lu ici depuis la session reçue, il est posé dans le
// même rendu que l'utilisateur.
//
// Fermé par défaut : un jeton illisible, sur un compte qui a un facteur
// vérifié, exige le code.

export const MFA_AUCUN = Object.freeze({ requis: false, facteurId: null })

function facteursVerifies(session) {
  return (session?.user?.factors ?? []).filter((f) => f?.status === 'verified')
}

function lireAal(jeton) {
  try {
    const charge = jeton.split('.')[1]
    const base64 = charge.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))).aal ?? null
  } catch {
    return null
  }
}

export function mfaRequis(session) {
  if (!session?.user || facteursVerifies(session).length === 0) return false
  return lireAal(session.access_token) !== 'aal2'
}

// Le facteur à défier : le premier TOTP vérifié du compte.
export function facteurAVerifier(session) {
  return facteursVerifies(session).find((f) => f.factor_type === 'totp')?.id ?? null
}

// L'état complet, tel qu'`AuthProvider` le pose à chaque événement.
export function etatMfa(session) {
  return mfaRequis(session) ? { requis: true, facteurId: facteurAVerifier(session) } : MFA_AUCUN
}
