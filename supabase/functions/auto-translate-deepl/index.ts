// Edge Function — auto-traduction via DeepL Pro API.
//
// Appelée depuis le panel admin (bouton « Auto-i18n » sur les modales
// d'édition d'ingrédients/recettes — actuellement stub côté client en
// attendant cette function).
//
// Pourquoi DeepL Pro et pas DeepL Free :
//   • DeepL Free utilise les requêtes pour entraîner ses modèles (interdit RGPD
//     pour des données utilisateurs).
//   • DeepL Pro garantit dans ses CGU de NE PAS stocker ni utiliser les requêtes.
//
// Sécurité :
//   • Auth obligatoire (vérifie le JWT du caller)
//   • is_admin() check : seul un admin peut traduire (évite l'usage abusif/coûteux)
//   • Rate limiting : DeepL Pro impose un quota de caractères/mois ; côté
//     application on limite la longueur des inputs (max 2000 chars / appel) et
//     le nombre de langues cibles (max 4, soit FR + 4 = 5 langues totales).
//
// Configuration requise :
//   • Secret Supabase : DEEPL_API_KEY (Project Settings → Edge Functions → Secrets)
//   • Compte DeepL Pro actif (~5,49 € HT/mois pour 500 000 chars)
//
// API DeepL Pro : https://api.deepl.com/v2/translate
// Doc : https://developers.deepl.com/docs/api-reference/translate

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'

const MAX_TEXT_LENGTH = 2000     // chars par requête (sécurité quota)
const MAX_TARGET_LANGS = 4        // EN+ES+DE+JA depuis FR par exemple
const ALLOWED_LANGS = new Set(['fr', 'en', 'es', 'de', 'ja'])

// Mapping codes Fridge+ → codes DeepL (DeepL veut majuscules pour certaines)
const DEEPL_LANG_MAP: Record<string, string> = {
  fr: 'FR',
  en: 'EN-US',  // EN-GB ou EN-US, on prend US par défaut
  es: 'ES',
  de: 'DE',
  ja: 'JA',
}

interface Payload {
  text: string
  sourceLang: string
  targetLangs: string[]
}

interface DeepLResponse {
  translations: Array<{ detected_source_language: string; text: string }>
}

Deno.serve(async (req: Request) => {
  const CORS = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: CORS })
  }

  // ─── 1. Auth obligatoire ─────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS })
  }

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SB_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: userErr } = await supabaseUser.auth.getUser()
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: 'invalid_token' }), { status: 401, headers: CORS })
  }

  // ─── 2. Vérification admin ───────────────────────────────────────────────
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: CORS })
  }

  // v3.206.0 — Rate limit anti-burnout quota DeepL : 30 req / min / admin.
  // Protège le quota mensuel DeepL Pro même si un admin (ou un compte
  // admin compromis) lance un script automatisé.
  const rateLimited = applyRateLimit(req, 'auto-translate-deepl', { max: 30, windowMs: 60_000 }, user.id, CORS)
  if (rateLimited) return rateLimited

  // ─── 3. Validation payload ───────────────────────────────────────────────
  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: CORS })
  }

  const { text, sourceLang, targetLangs } = payload
  if (!text || typeof text !== 'string') {
    return new Response(JSON.stringify({ error: 'missing_text' }), { status: 400, headers: CORS })
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return new Response(JSON.stringify({ error: 'text_too_long', max: MAX_TEXT_LENGTH }), { status: 400, headers: CORS })
  }
  if (!ALLOWED_LANGS.has(sourceLang)) {
    return new Response(JSON.stringify({ error: 'invalid_source_lang' }), { status: 400, headers: CORS })
  }
  if (!Array.isArray(targetLangs) || targetLangs.length === 0) {
    return new Response(JSON.stringify({ error: 'missing_target_langs' }), { status: 400, headers: CORS })
  }
  if (targetLangs.length > MAX_TARGET_LANGS) {
    return new Response(JSON.stringify({ error: 'too_many_targets', max: MAX_TARGET_LANGS }), { status: 400, headers: CORS })
  }
  for (const t of targetLangs) {
    if (!ALLOWED_LANGS.has(t) || t === sourceLang) {
      return new Response(JSON.stringify({ error: 'invalid_target_lang', lang: t }), { status: 400, headers: CORS })
    }
  }

  // ─── 4. Appel DeepL Pro ──────────────────────────────────────────────────
  const apiKey = Deno.env.get('DEEPL_API_KEY')
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'deepl_not_configured' }), { status: 503, headers: CORS })
  }

  const translations: Record<string, string> = {}
  const errors: Record<string, string> = {}

  // Une requête DeepL par langue cible (l'API ne fait pas N→N en un seul call).
  // Parallélisé via Promise.all pour la latence.
  const promises = targetLangs.map(async (target) => {
    try {
      const formData = new URLSearchParams()
      formData.set('text', text)
      formData.set('source_lang', DEEPL_LANG_MAP[sourceLang] ?? sourceLang.toUpperCase())
      formData.set('target_lang', DEEPL_LANG_MAP[target] ?? target.toUpperCase())
      formData.set('preserve_formatting', '1')

      const res = await fetch('https://api.deepl.com/v2/translate', {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      })

      if (!res.ok) {
        errors[target] = `deepl_${res.status}`
        return
      }
      const data = await res.json() as DeepLResponse
      const translated = data.translations?.[0]?.text
      if (translated) translations[target] = translated
      else errors[target] = 'no_translation'
    } catch (err) {
      errors[target] = err instanceof Error ? err.message : 'unknown'
    }
  })

  await Promise.all(promises)

  // ─── 5. Audit log côté Postgres ──────────────────────────────────────────
  try {
    await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      action: 'i18n_auto_translated',
      target_type: null,
      metadata: {
        source_lang: sourceLang,
        target_langs: targetLangs,
        chars_count: text.length,
        success_count: Object.keys(translations).length,
        error_count: Object.keys(errors).length,
      },
    })
  } catch { /* audit non bloquant */ }

  return new Response(
    JSON.stringify({ translations, errors }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
  )
})
