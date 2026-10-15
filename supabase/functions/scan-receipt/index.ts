// supabase/functions/scan-receipt/index.ts
//
// Edge Function — reconnaissance de texte sur photo de ticket de caisse via
// Google Cloud Vision (DOCUMENT_TEXT_DETECTION). Renvoie une version allégée
// de la réponse (blocks/paragraphs/words + positions), sans extraire ni
// quantité, ni prix, ni conditionnement — ça, c'est le rôle du parser client
// (receipt-line-parser.js), qui ne garde que les libellés de produits.
//
// Gratuit, sans gating premium. Le palier gratuit Google (1000 scans/mois)
// est partagé par toute l'app : on le suit via ai_usage_log (feature =
// 'receipt_ocr') et on bloque proprement au-delà, jamais de dépassement
// facturé silencieusement.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'

const MODEL = 'google-vision-document-text-detection'
const MONTHLY_FREE_QUOTA = 1000
// Plafond PAR COMPTE (audit du 2026-10-04, BDD-08) : sans lui, un seul compte
// épuisait les 1 000 scans du mois de toute l'app en moins de deux heures.
const USER_MONTHLY_QUOTA = 30
const MAX_BASE64_LENGTH = 7_000_000 // ~5 Mo décodé — l'image est déjà compressée côté client

interface Vertex { x?: number; y?: number }
interface BoundingPoly { vertices?: Vertex[] }
interface VisionSymbol { text: string }
interface VisionWord { boundingBox?: BoundingPoly; symbols: VisionSymbol[] }
interface VisionParagraph { boundingBox?: BoundingPoly; words: VisionWord[] }
interface VisionBlock { boundingBox?: BoundingPoly; paragraphs: VisionParagraph[] }
interface VisionPage { blocks?: VisionBlock[] }
interface VisionAnnotateResponse {
  responses?: [{
    fullTextAnnotation?: { pages?: VisionPage[] }
    error?: { message: string }
  }]
}

interface Rect { x0: number; y0: number; x1: number; y1: number }

function rect(poly?: BoundingPoly): Rect {
  const vertices = poly?.vertices ?? []
  const xs = vertices.map(v => v.x ?? 0)
  const ys = vertices.map(v => v.y ?? 0)
  return {
    x0: xs.length ? Math.min(...xs) : 0,
    x1: xs.length ? Math.max(...xs) : 0,
    y0: ys.length ? Math.min(...ys) : 0,
    y1: ys.length ? Math.max(...ys) : 0,
  }
}

function wordText(word: VisionWord): string {
  return (word.symbols ?? []).map(s => s.text).join('')
}

function slimResponse(vision: VisionAnnotateResponse) {
  const page = vision.responses?.[0]?.fullTextAnnotation?.pages?.[0]
  const blocks = (page?.blocks ?? []).map(block => {
    const paragraphs = (block.paragraphs ?? []).map(paragraph => {
      const words = (paragraph.words ?? []).map(w => ({ boundingBox: rect(w.boundingBox), text: wordText(w) }))
      return { boundingBox: rect(paragraph.boundingBox), text: words.map(w => w.text).join(' '), words }
    })
    return { boundingBox: rect(block.boundingBox), paragraphs }
  })
  return { blocks }
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

  // ─── 1b. Le drapeau « receipt_scan » (décision du 2026-10-08 : qu'il coupe vraiment) ──
  // Éteint dans l'admin, la photo du ticket est refusée ICI, pas seulement masquée
  // dans l'app : une version restée ouverte, ou un appel direct, ne passe plus.
  // Une ligne absente vaut « éteint », comme côté client (`useFeatureFlag(…, false)`).
  const { data: drapeau, error: drapeauErr } = await supabaseUser
    .from('feature_flags').select('enabled').eq('key', 'receipt_scan').maybeSingle()
  if (drapeauErr) {
    return new Response(JSON.stringify({ error: 'flag_unavailable' }), { status: 503, headers: CORS })
  }
  if (!drapeau?.enabled) {
    return new Response(JSON.stringify({ error: 'feature_disabled' }), { status: 403, headers: CORS })
  }

  // ─── 2. Rate limit (10 req/min/utilisateur — anti-abus individuel) ───────
  const limited = applyRateLimit(req, 'scan-receipt', { max: 10, windowMs: 60_000 }, user.id, CORS)
  if (limited) return limited

  // ─── 2b. Rate limit GLOBAL (toute l'app, indépendant du par-utilisateur) ──
  // Le quota gratuit Google (1000/mois) est partagé par toute l'app — sans
  // plafond global, quelques comptes suffiraient à l'épuiser en quelques
  // minutes (10 req/min/utilisateur × N comptes). 50/min tous utilisateurs
  // confondus laisse largement de la marge pour un usage légitime tout en
  // rendant un épuisement rapide du quota mensuel nettement plus coûteux
  // pour un attaquant (limité en mémoire d'instance, comme le rate-limit
  // par-utilisateur — cf. _shared/rate-limit.ts).
  const globalLimited = applyRateLimit(req, 'scan-receipt-global', { max: 50, windowMs: 60_000 }, 'global', CORS)
  if (globalLimited) return globalLimited

  // ─── 3. Validation payload ────────────────────────────────────────────────
  let payload: { image_base64?: string }
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: CORS })
  }
  const imageBase64 = payload.image_base64
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return new Response(JSON.stringify({ error: 'image_base64_required' }), { status: 400, headers: CORS })
  }
  if (imageBase64.length > MAX_BASE64_LENGTH) {
    return new Response(JSON.stringify({ error: 'image_too_large' }), { status: 413, headers: CORS })
  }

  // ─── 4. Client admin (service_role) pour quota + log ─────────────────────
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // ─── 5. Quota mensuel global (palier gratuit Google : 1000/mois) ─────────
  //
  // C'est CE garde qui protège le quota Vision — pas le rate limit global de
  // l'étape précédente, qui borne le débit (50/min) et vit en mémoire
  // d'instance. Celui-ci lit `ai_usage_log`, donc il survit aux démarrages à
  // froid et vaut pour toutes les instances à la fois.
  //
  // Deux propriétés assumées, écrites pour qu'on ne les redécouvre pas :
  //   • FAIL-CLOSED — si le comptage échoue, on REFUSE (500). L'inverse du
  //     `budget-guard` de `suggest-substitutes`, volontairement fail-open : là
  //     une panne de télémétrie ne doit pas couper la fonctionnalité ; ici
  //     laisser passer sans savoir, c'est risquer un dépassement facturé.
  //   • Lecture puis écriture, sans verrou : N requêtes simultanées peuvent
  //     toutes lire 999 et passer. Le dépassement est borné par la concurrence
  //     réelle, elle-même bornée par le rate limit — même compromis que le
  //     plafond de tickets, qui arrête l'abus séquentiel et non l'inondation
  //     concurrente. À revoir si le volume s'approche du millier mensuel
  //     (12 scans depuis le 2026-07-07 au moment où ceci est écrit).
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const { count, error: countErr } = await supabaseAdmin
    .from('ai_usage_log')
    .select('id', { count: 'exact', head: true })
    .eq('feature', 'receipt_ocr')
    .gte('created_at', monthStart.toISOString())
  if (countErr) {
    return new Response(JSON.stringify({ error: 'quota_check_failed' }), { status: 500, headers: CORS })
  }
  if ((count ?? 0) >= MONTHLY_FREE_QUOTA) {
    return new Response(JSON.stringify({ error: 'quota_exceeded' }), { status: 429, headers: CORS })
  }

  // ─── 5b. Quota mensuel PAR COMPTE ──────────────────────────────────────
  // Même lecture, mêmes propriétés (fail-closed, sans verrou), limitée aux
  // scans de ce compte : `ai_usage_log.user_id` est écrit à chaque appel.
  const { count: countUser, error: countUserErr } = await supabaseAdmin
    .from('ai_usage_log')
    .select('id', { count: 'exact', head: true })
    .eq('feature', 'receipt_ocr')
    .eq('user_id', user.id)
    .gte('created_at', monthStart.toISOString())
  if (countUserErr) {
    return new Response(JSON.stringify({ error: 'quota_check_failed' }), { status: 500, headers: CORS })
  }
  if ((countUser ?? 0) >= USER_MONTHLY_QUOTA) {
    return new Response(JSON.stringify({ error: 'user_quota_exceeded' }), { status: 429, headers: CORS })
  }

  // ─── 6. Appel Google Cloud Vision (DOCUMENT_TEXT_DETECTION) ──────────────
  const visionKey = Deno.env.get('GOOGLE_VISION_API_KEY')
  if (!visionKey) {
    return new Response(JSON.stringify({ error: 'vision_key_missing' }), { status: 500, headers: CORS })
  }

  let visionResp: Response
  try {
    visionResp = await fetch('https://vision.googleapis.com/v1/images:annotate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': visionKey },
      body: JSON.stringify({
        requests: [{
          image: { content: imageBase64 },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          imageContext: { languageHints: ['fr'] },
        }],
      }),
    })
  } catch (err) {
    console.error('scan-receipt: vision fetch unreachable', err)
    return new Response(JSON.stringify({ error: 'vision_unreachable' }), { status: 502, headers: CORS })
  }

  // ─── 7. Log usage — dès qu'un appel a réellement atteint Google (succès OU
  // erreur), pas seulement sur le chemin de succès. Une requête qui échoue
  // côté Google (image invalide, erreur par-image...) a quand même sollicité
  // l'API — la traiter comme "gratuite" sous-compterait notre usage réel par
  // rapport à celui que Google suit de son côté (comportement observé sur des
  // API Google similaires : une requête en erreur 400/500 compte contre le
  // quota même sans facturation token). Bloquant : la justesse du comptage
  // de quota en dépend (contrairement à un log analytics best-effort comme
  // suggest-substitutes).
  await supabaseAdmin.from('ai_usage_log').insert({
    user_id: user.id, feature: 'receipt_ocr', model: MODEL, cost_cents: 0,
  })

  if (!visionResp.ok) {
    const text = await visionResp.text()
    console.error('scan-receipt: vision_error', visionResp.status, text)
    return new Response(JSON.stringify({ error: 'vision_error' }), { status: 502, headers: CORS })
  }

  const visionJson: VisionAnnotateResponse = await visionResp.json()
  const visionError = visionJson.responses?.[0]?.error
  if (visionError) {
    console.error('scan-receipt: vision_error (per-image)', visionError.message)
    return new Response(JSON.stringify({ error: 'vision_error' }), { status: 502, headers: CORS })
  }

  const slim = slimResponse(visionJson)

  return new Response(JSON.stringify(slim), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
})
