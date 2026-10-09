// Edge Function — modération de contenu UGC via OpenAI Moderation API.
//
// Appelée depuis le client React au moment de la soumission de contenu
// utilisateur (recette custom, ticket support, bio profil, avis recette,
// post communauté). Bloque le contenu inapproprié AVANT de l'insérer en BDD.
//
// Pourquoi pas côté client :
//   • OPENAI_API_KEY est secret, ne doit jamais être exposée au browser
//   • La modération doit être server-side pour ne pas être bypassable
//
// Pourquoi OpenAI Moderation API :
//   • Gratuite (omni-moderation-latest), texte ET image
//   • 13 catégories : hate, sexual, violence, self-harm, harassment, etc.
//   • Multilingue (FR/EN/ES/DE/JA tous supportés)
//   • Robuste et bien maintenue par OpenAI
//
// Chantier avis + communauté (PR2, 2026-07-16) : accepte en plus une image
// (`image_base64`). Quand `feature==='community-post'` ET une image est
// fournie ET acceptée par la modération, cette fonction CRÉE ELLE-MÊME la
// ligne `community_posts` via `service_role` (strip EXIF puis upload avant
// insert) — le client n'écrit JAMAIS `photo_url` directement (colonne
// verrouillée côté RLS en plus, cf. migration 20260716_review_photos.sql).
// Voir la conception « avis-recettes-communaute » du 2026-07-16.
//
// Limite connue et assumée (pas cachée) : omni-moderation-latest ne couvre
// que 6 des 13 catégories sur les images (sexuel, violence, auto-mutilation
// et sous-catégories) — pas haine/harcèlement/illicite sur l'image
// elle-même. Le signalement communautaire existant reste le filet
// complémentaire pour ces cas.
//
// Flow (texte seul, inchangé) :
//   1. Auth obligatoire (JWT) → 2. Validation payload → 3. Rate limit
//   → 4. Cache lookup (ai_cache, verdict seul) → 5. Appel OpenAI → 6. Log + retour
//
// Flow (avec image) : identique, puis si non flagged → strip EXIF → upload
// review-photos → insert community_posts → renvoie { ...résultat, post }.
//
// Configuration requise :
//   • Secret : OPENAI_API_KEY (Project Settings → Edge Functions → Secrets)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'
import piexif from 'https://esm.sh/piexifjs@1.0.6'
import { getCorsHeaders } from '../_shared/cors.ts'
import { reponseErreur } from '../_shared/reponse-erreur.ts'
import { runAfterResponse } from '../_shared/apres-reponse.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'

const MAX_CONTENT_LENGTH = 10_000
const ALLOWED_FEATURES = new Set(['recipe', 'ticket', 'profile-bio', 'review', 'community-post'])
// ~6 Mo d'image d'origine en base64 : marge confortable au-dessus du
// plafond client de 2 Mo compressé (base64 gonfle la taille d'~33%).
const MAX_IMAGE_BASE64_LENGTH = 8_000_000

const MODEL = 'omni-moderation-latest'

interface ModerationPayload {
  content: string
  feature: 'recipe' | 'ticket' | 'profile-bio' | 'review' | 'community-post'
  image_base64?: string
  recipe_id?: string
  title?: string
}

interface OpenAIModerationResult {
  flagged: boolean
  categories: Record<string, boolean>
  category_scores: Record<string, number>
}

interface OpenAIModerationResponse {
  id: string
  model: string
  results: OpenAIModerationResult[]
}

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
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

  // ─── 2. Validation payload ───────────────────────────────────────────────
  // Le parsing est fait AVANT le rate-limit (contrairement à la version
  // texte-seule précédente) car le quota dépend de la présence d'une image.
  let payload: ModerationPayload
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: CORS })
  }

  const content = (payload.content ?? '').trim()
  const feature = payload.feature
  const imageBase64 = payload.image_base64

  if (!content && !imageBase64) {
    return new Response(JSON.stringify({ error: 'empty_content' }), { status: 400, headers: CORS })
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return new Response(JSON.stringify({ error: 'content_too_long', max: MAX_CONTENT_LENGTH }), { status: 400, headers: CORS })
  }
  if (!ALLOWED_FEATURES.has(feature)) {
    return new Response(JSON.stringify({ error: 'invalid_feature' }), { status: 400, headers: CORS })
  }
  if (imageBase64 && imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    return new Response(JSON.stringify({ error: 'image_too_large' }), { status: 400, headers: CORS })
  }
  if (imageBase64 && feature !== 'community-post') {
    return new Response(JSON.stringify({ error: 'image_not_supported_for_feature' }), { status: 400, headers: CORS })
  }
  if (imageBase64 && (!payload.recipe_id || !payload.title)) {
    return new Response(JSON.stringify({ error: 'missing_fields', required: ['recipe_id', 'title'] }), { status: 400, headers: CORS })
  }

  // ─── 3. Rate limit — plus strict si une image est jointe ────────────────
  const rateLimit = imageBase64 ? { max: 10, windowMs: 60_000 } : { max: 30, windowMs: 60_000 }
  const limited = applyRateLimit(req, 'moderate-content', rateLimit, user.id, CORS)
  if (limited) return limited

  // ─── 4. Client admin (service_role) pour cache + log + storage + insert ──
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const cacheKey = await sha256Hex(`${MODEL}:${content}:${imageBase64 ?? ''}`)

  // ─── 5. Verdict : le cache, sinon OpenAI ─────────────────────────────────
  // Le cache ne garde que le VERDICT (flagged, categories, category_scores),
  // jamais le post créé à l'étape 7 : la clé ne dépend pas du compte, et un
  // second envoi de la même photo par quelqu'un d'autre aurait reçu le post du
  // premier — défaut latent, masqué tant que les écritures `void` ne partaient
  // jamais (audit du 2026-10-04, BDD-18 (5)). Un cache atteint crée donc quand
  // même le post. Les écritures partent APRÈS la réponse (`runAfterResponse`).
  const journal = (outcome: string, cached: boolean, extra: Record<string, unknown> = {}) =>
    runAfterResponse(supabaseAdmin.from('ai_usage_log').insert({
      user_id: user.id, feature: 'moderation', model: MODEL, cost_cents: 0, cached,
      metadata: { feature_hint: feature, outcome, ...extra },
    }))

  let verdict: OpenAIModerationResult
  let cached = false
  const { data: enCache } = await supabaseAdmin
    .from('ai_cache')
    .select('response')
    .eq('cache_key', cacheKey)
    .maybeSingle()

  if (enCache?.response?.categories) {
    verdict = {
      flagged: Boolean(enCache.response.flagged),
      categories: enCache.response.categories,
      category_scores: enCache.response.category_scores ?? {},
    }
    cached = true
    runAfterResponse(supabaseAdmin.from('ai_cache').update({ last_hit_at: new Date().toISOString() }).eq('cache_key', cacheKey))
  } else {
    // ─── 6. Appel OpenAI Moderation API ────────────────────────────────────
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return reponseErreur('openai_key_missing', 500, CORS)
    }

    const moderationInput = imageBase64
      ? [
          ...(content ? [{ type: 'text', text: content }] : []),
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
        ]
      : content

    let openaiResp: Response
    try {
      openaiResp = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: MODEL, input: moderationInput }),
      })
    } catch (err) {
      journal('error', false, { reason: 'openai_unreachable' })
      return reponseErreur('openai_unreachable', 502, CORS, err, 'moderate-content')
    }

    if (!openaiResp.ok) {
      const text = await openaiResp.text()
      journal('error', false, { reason: `openai_error_${openaiResp.status}` })
      return reponseErreur('openai_error', 502, CORS, text, 'moderate-content', { status: openaiResp.status })
    }

    const data: OpenAIModerationResponse = await openaiResp.json()
    const result = data.results?.[0]
    if (!result) {
      journal('error', false, { reason: 'openai_invalid_response' })
      return reponseErreur('openai_invalid_response', 502, CORS)
    }
    verdict = { flagged: result.flagged, categories: result.categories, category_scores: result.category_scores }

    runAfterResponse(supabaseAdmin.from('ai_cache').upsert({
      cache_key: cacheKey,
      feature: 'moderation',
      model: MODEL,
      response: verdict,
      last_hit_at: new Date().toISOString(),
    }, { onConflict: 'cache_key' }))
  }

  let cleanResult: OpenAIModerationResult & { post?: unknown } = { ...verdict }

  // ─── 7. Photo acceptée : strip EXIF, upload, crée le post ────────────────
  if (imageBase64 && !verdict.flagged) {
    // Le chemin déposé, pour retirer la photo du bucket si le post ne se crée
    // pas : sinon un fichier orphelin reste public (BDD-18 (6)).
    let cheminDepose: string | null = null
    try {
      // atob() produit une "binary string" (1 caractère = 1 octet) — format
      // natif attendu par piexifjs pour un JPEG.
      const binaryString = atob(imageBase64)
      const stripped = piexif.remove(binaryString)
      const bytes = Uint8Array.from(stripped, (c: string) => c.charCodeAt(0))

      const path = `${user.id}/${crypto.randomUUID()}.jpg`
      const { error: uploadErr } = await supabaseAdmin.storage
        .from('review-photos')
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: false })
      if (uploadErr) {
        journal('error', cached, { reason: 'storage_upload_failed' })
        return reponseErreur('storage_upload_failed', 502, CORS, uploadErr, 'moderate-content')
      }
      cheminDepose = path

      const { data: { publicUrl } } = supabaseAdmin.storage.from('review-photos').getPublicUrl(path)

      const { data: post, error: postErr } = await supabaseAdmin
        .from('community_posts')
        .insert({
          user_id: user.id,
          category: 'pride',
          title: payload.title,
          body: content || payload.title,
          recipe_id: payload.recipe_id,
          photo_url: publicUrl,
        })
        .select('id, user_id, category, title, body, recipe_id, photo_url, likes_count, replies_count, created_at, updated_at')
        .single()
      if (postErr) {
        runAfterResponse(supabaseAdmin.storage.from('review-photos').remove([path]))
        journal('error', cached, { reason: 'post_insert_failed' })
        return reponseErreur('post_insert_failed', 502, CORS, postErr, 'moderate-content')
      }
      cleanResult = { ...cleanResult, post }
    } catch (err) {
      if (cheminDepose) runAfterResponse(supabaseAdmin.storage.from('review-photos').remove([cheminDepose]))
      journal('error', cached, { reason: 'exif_strip_or_upload_exception' })
      return reponseErreur('photo_processing_failed', 502, CORS, err, 'moderate-content')
    }
  }

  // ─── 8. Journal d'usage, après la réponse ────────────────────────────────
  journal(verdict.flagged ? 'flagged' : 'passed', cached)

  return new Response(JSON.stringify(cleanResult), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
})
