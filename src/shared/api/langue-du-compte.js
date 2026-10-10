import { supabase } from '@shared/lib/supabase/client'
import { logError } from '@shared/lib/observability/sentry'

// La langue des e-mails de Supabase Auth (confirmation d'inscription, mot de
// passe oublié, changement d'adresse) : leurs modèles la lisent dans
// user_metadata — `{{ .Data.lang }}`, cf. supabase/email-templates/ —, pas dans
// `profiles.language` (audit du 2026-10-04, CPT-18). L'écriture déclenche
// USER_UPDATED : le fournisseur d'auth relit le compte, comme après tout
// `updateUser`. Un échec s'écrit au journal et ne lève jamais : l'appelant ne
// l'attend pas.
export async function retenirLaLangueDesEmails(lang) {
  try {
    const { error } = await supabase.auth.updateUser({ data: { lang } })
    if (error) logError(error, { tag: 'langue.emails' })
    return { error: error ?? null }
  } catch (err) {
    logError(err, { tag: 'langue.emails' })
    return { error: err }
  }
}
