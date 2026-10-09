import { supabase } from '@shared/lib/supabase/client'

// Récupère la langue active depuis localStorage ; fallback 'fr'.
// Utilisé pour passer la lang aux Edge Functions de notification.
function getCurrentLang() {
  try { return localStorage.getItem('fridge-lang') ?? 'fr' }
  catch { return 'fr' }
}

// Envoi non bloquant d'une notification email après modification profil
// (pseudo / email / password). En cas d'échec on log mais on n'interrompt
// pas le flux : la modif est déjà appliquée en DB / auth, l'email est
// purement informatif.
export async function sendChangeNotification(type, opts = {}) {
  try {
    await supabase.functions?.invoke('send-profile-change-notification', {
      body: {
        type,
        lang: opts.lang ?? getCurrentLang(),
        oldValue: opts.oldValue,
        newValue: opts.newValue,
      },
    })
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[AuthContext] notification', type, 'failed:', err)
  }
}
