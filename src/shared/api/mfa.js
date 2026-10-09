import { supabase } from '@shared/lib/supabase/client'

// Helpers wrappant l'API Supabase MFA TOTP.
//
// Flow Supabase :
//   1. enroll({ factorType: 'totp' }) → retourne { id, totp: { qr_code, secret, uri } }
//   2. user scanne le QR code dans Authy/Google Authenticator
//   3. user saisit le 1er code OTP → challengeAndVerify pour activer le facteur
//   4. au login suivant : si AAL1 (just password), getAuthenticatorAssuranceLevel
//      indique 'aal1' alors que nextLevel est 'aal2' → on doit prompter OTP
//      pour atteindre AAL2 et déverrouiller les actions sensibles.
//
// Note : ces fonctions ne s'occupent PAS de la persistence d'état côté
// app — c'est `useMFA` qui gère la cache des factors + sync.

export async function listMFAFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) return { totp: [], all: [], error }
  return {
    totp: data?.totp ?? [],
    all:  data?.all  ?? [],
    error: null,
  }
}

// Démarre l'enrollment d'un nouveau facteur TOTP.
// Retourne { id, qrCode (base64 SVG), secret, uri } pour affichage UI.
// Le facteur est en statut 'unverified' tant que verify() n'a pas été
// appelé avec un code OTP correct.
export async function enrollTOTP(friendlyName = 'Fridge+ TOTP') {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType:   'totp',
    friendlyName,
  })
  if (error) return { error }
  return {
    id:      data.id,
    qrCode:  data.totp?.qr_code,   // base64 SVG (data:image/svg+xml;...)
    secret:  data.totp?.secret,
    uri:     data.totp?.uri,
    error:   null,
  }
}

// Vérifie un code OTP pour activer le facteur (ou pour passer AAL2).
// Combine challenge + verify en un appel.
export async function verifyTOTP({ factorId, code }) {
  const { data, error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code,
  })
  return { data, error }
}

// Supprime un facteur TOTP (escape valve / reset).
// Note : si l'user n'a plus aucun facteur, le compte revient AAL1.
export async function unenrollFactor(factorId) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  return { error }
}

// Niveau d'assurance courant : aal1 (password only) ou aal2 (password + MFA).
// Le second nombre `nextLevel` indique le niveau requis si MFA est enrolled.
export async function getAAL() {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) return { current: null, next: null, error }
  return {
    current: data?.currentLevel ?? null,    // 'aal1' | 'aal2' | null
    next:    data?.nextLevel    ?? null,    // 'aal1' | 'aal2' | null
    error:   null,
  }
}
