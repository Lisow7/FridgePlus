import { supabase } from '@shared/lib/supabase/client'

export async function scanReceiptImage(imageBase64) {
  const { data, error } = await supabase.functions.invoke('scan-receipt', {
    body: { image_base64: imageBase64 },
  })
  if (error) {
    // FunctionsHttpError.message est générique ("Edge Function returned a
    // non-2xx status code") — le vrai code d'erreur (quota_exceeded…) est
    // dans le corps de la réponse. Même pattern que auth-provider.jsx.
    let code = error.message
    try {
      const body = await error.context?.json?.()
      if (body?.error) code = body.error
    } catch { /* ignore */ }
    throw new Error(code)
  }
  return data
}
