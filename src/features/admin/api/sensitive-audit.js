import { supabase } from '@shared/lib/supabase/client'

// Logge un accès admin à une donnée sensible (email, IP, last_sign_in…)
// dans activity_logs. Conformité RGPD : minimisation + traçabilité.
//
// L'action enregistre :
//   • who    → user_id de l'admin (auth.uid)
//   • what   → resourceType + resourceId + fieldName
//   • why    → reason (clé normalisée + détails libres)
//   • when   → timestamp auto
//
// Distinction avec adminLogAction normal : ici on logge une CONSULTATION
// (pas une modification). On utilise l'action 'sensitive_data_accessed'
// pour différencier dans l'audit log et permettre des filtres dédiés.

export async function logSensitiveDataAccess({
  resourceType,    // 'user' | 'recipe' | 'ticket' | etc.
  resourceId,      // l'ID de la ressource consultée
  fieldName,       // 'email' | 'ip' | 'last_sign_in' | 'phone' | ...
  reason,          // string formatée par formatReason() (ReasonSelector)
}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { message: 'Not authenticated' } }

  const { error } = await supabase
    .from('activity_logs')
    .insert({
      user_id:     user.id,
      action:      'sensitive_data_accessed',
      target_id:   String(resourceId ?? ''),
      target_type: `${resourceType}.${fieldName}`,
      // metadata JSONB : la colonne existe sur activity_logs (migration
      // notifications/logs). On y stocke la raison normalisée de l'accès.
      metadata:    { reason: reason ?? null },
    })

  if (error && import.meta.env.DEV) {
    console.error('[logSensitiveDataAccess]', error.message)
  }
  return { error }
}
