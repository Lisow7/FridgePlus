// Edge Function — suggestions de substituts d'ingrédient via gpt-4o-mini.
//
// Appelée quand un user a une recette qui demande un ingrédient absent de son
// stock. Renvoie 3 substituts plausibles avec ratio + explication courte.
//
// Pourquoi gpt-4o-mini :
//   • Très cheap (~$0.0005 par appel avec un prompt de 300 tokens)
//   • Qualité largement suffisante pour des suggestions culinaires courantes
//   • Cache agressif : la même demande revient souvent (top 100 ingrédients
//     × top 50 recettes = 5000 entrées max, quasi-tout cached après 1 mois)
//
// Flow :
//   1. Auth obligatoire (JWT)
//   2. Rate limit 20 req/min par user (gpt-4o-mini reste tolérant)
//   3. Cache lookup (ai_cache)
//   4. Si miss : appel OpenAI avec response_format=json_object
//   5. Parse JSON + log dans ai_usage_log + sauvegarde cache
//   6. Retourne { substitutes: [...3 items] }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { reponseErreur } from '../_shared/reponse-erreur.ts'
import { runAfterResponse } from '../_shared/apres-reponse.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'
import { applyBudgetGuard } from '../_shared/budget-guard.ts'

const MODEL = 'gpt-4o-mini'
const COST_CENTS_ESTIMATE = 1  // ~$0.005 par appel (prompt + completion ~600 tokens)
const ALLOWED_LANGS = new Set(['fr', 'en', 'es', 'de', 'ja'])

interface SubstitutePayload {
  ingredient_label: string         // libellé de l'ingrédient à substituer
  recipe_context?: string          // contexte recette (nom + cuisine) pour pertinence
  lang: string                     // langue de réponse (fr/en/es/de/ja)
}

interface Substitute {
  label: string
  reason: string
  ratio: string
}

interface SubstituteResponse {
  substitutes: Substitute[]
}

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function buildPrompt(payload: SubstitutePayload): string {
  const { ingredient_label, recipe_context, lang } = payload
  const ctx = recipe_context ? ` in the recipe "${recipe_context}"` : ''
  // Le prompt force du JSON strict via system message + response_format
  return `Suggest 3 culinary substitutes for "${ingredient_label}"${ctx}. ` +
         `Respond in ${lang}. ` +
         `Return ONLY a JSON object: {"substitutes": [{"label": "...", "reason": "<1 sentence>", "ratio": "1:1 or e.g. 1 cup = 100g"}, ...3 items]}`
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

  // ─── 1b. Premium requis (feature IA coûteuse — chaque appel = coût OpenAI) ─
  //   Défense en profondeur : l'UI gate déjà (UpgradeGate), mais on re-vérifie
  //   ici pour qu'un appel direct ne puisse pas déclencher de dépense OpenAI.
  //   Premium = abonnement actif/offert, essai en cours, ou admin (cf. client
  //   useSubscription). Lecture du profil de l'user via RLS (sa propre ligne).
  const { data: prof } = await supabaseUser
    .from('profiles')
    .select('role, subscription_status, trial_ends_at')
    .eq('id', user.id)
    .maybeSingle()
  const isPremium =
    prof?.role === 'admin' ||
    prof?.subscription_status === 'active' ||
    prof?.subscription_status === 'comped' ||
    (prof?.subscription_status === 'trialing' &&
      !!prof?.trial_ends_at && new Date(prof.trial_ends_at).getTime() > Date.now())
  if (!isPremium) {
    return new Response(JSON.stringify({ error: 'premium_required' }), { status: 403, headers: CORS })
  }

  // ─── 2. Rate limit (20 req/min par user) ─────────────────────────────────
  const limited = applyRateLimit(req, 'suggest-substitutes', { max: 20, windowMs: 60_000 }, user.id, CORS)
  if (limited) return limited

  // ─── 3. Validation payload ───────────────────────────────────────────────
  let payload: SubstitutePayload
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: CORS })
  }

  const ingredient_label = (payload.ingredient_label ?? '').trim()
  const recipe_context = (payload.recipe_context ?? '').trim() || undefined
  const lang = payload.lang ?? 'fr'

  if (!ingredient_label) {
    return new Response(JSON.stringify({ error: 'ingredient_label_required' }), { status: 400, headers: CORS })
  }
  if (ingredient_label.length > 100) {
    return new Response(JSON.stringify({ error: 'label_too_long' }), { status: 400, headers: CORS })
  }
  if (!ALLOWED_LANGS.has(lang)) {
    return new Response(JSON.stringify({ error: 'invalid_lang' }), { status: 400, headers: CORS })
  }

  // ─── 4. Client admin (service_role) pour cache + log ─────────────────────
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Cache key intègre lang + recipe_context : substituts dépendent du contexte
  const cacheKey = await sha256Hex(`${MODEL}:substitute:${lang}:${ingredient_label}:${recipe_context ?? ''}`)

  // ─── 5. Cache lookup ─────────────────────────────────────────────────────
  const { data: cached } = await supabaseAdmin
    .from('ai_cache')
    .select('response')
    .eq('cache_key', cacheKey)
    .maybeSingle()

  if (cached?.response) {
    // Écritures best-effort (analytics) : via EdgeRuntime.waitUntil pour qu'elles
    // s'exécutent après le return SANS bloquer ni faire échouer la réponse user.
    // (un simple `void` ne s'exécute pas : l'isolate est gelé après le return.)
    runAfterResponse(Promise.allSettled([
      supabaseAdmin.from('ai_cache').update({ last_hit_at: new Date().toISOString() }).eq('cache_key', cacheKey),
      supabaseAdmin.from('ai_usage_log').insert({
        user_id: user.id, feature: 'substitute', model: MODEL,
        cost_cents: 0, cached: true,
        metadata: { ingredient_label, lang },
      }),
    ]))
    return new Response(JSON.stringify(cached.response), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  // ─── 5b. Plafond budgétaire mensuel ($50) ────────────────────────────────
  // Placé APRÈS le cache : un cache hit ne coûte rien, le bloquer serait
  // absurde. C'est le seul endroit de tout le projet où une dépense OpenAI
  // réelle est engagée (`moderate-content` et `scan-receipt` sont gratuits) —
  // donc le seul qui ait besoin de ce garde. Fail-open si la RPC échoue.
  const overBudget = await applyBudgetGuard(supabaseAdmin, COST_CENTS_ESTIMATE, CORS)
  if (overBudget) return overBudget

  // ─── 6. Appel OpenAI Chat Completions (JSON mode) ────────────────────────
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiKey) {
    return new Response(JSON.stringify({ error: 'openai_key_missing' }), { status: 500, headers: CORS })
  }

  const prompt = buildPrompt(payload)

  let openaiResp: Response
  try {
    openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: 'You are a culinary substitution expert. Always respond with valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
        max_tokens: 400,
      }),
    })
  } catch (err) {
    return reponseErreur('openai_unreachable', 502, CORS, err, 'suggest-substitutes')
  }

  if (!openaiResp.ok) {
    const text = await openaiResp.text()
    return reponseErreur('openai_error', 502, CORS, text, 'suggest-substitutes', { status: openaiResp.status })
  }

  const data = await openaiResp.json()
  const content = data.choices?.[0]?.message?.content
  const usage = data.usage ?? { prompt_tokens: 0, completion_tokens: 0 }
  if (!content) {
    return new Response(JSON.stringify({ error: 'openai_empty_response' }), { status: 502, headers: CORS })
  }

  let parsed: SubstituteResponse
  try {
    parsed = JSON.parse(content)
  } catch {
    return new Response(JSON.stringify({ error: 'openai_invalid_json', raw: content }), { status: 502, headers: CORS })
  }

  if (!Array.isArray(parsed.substitutes) || parsed.substitutes.length === 0) {
    return new Response(JSON.stringify({ error: 'openai_no_substitutes', raw: parsed }), { status: 502, headers: CORS })
  }

  const cleanResult: SubstituteResponse = {
    substitutes: parsed.substitutes.slice(0, 3).map(s => ({
      label: String(s.label ?? '').slice(0, 80),
      reason: String(s.reason ?? '').slice(0, 200),
      ratio: String(s.ratio ?? '1:1').slice(0, 40),
    })),
  }

  // Coût réel calculé depuis usage tokens : $0.15/1M input + $0.60/1M output (en cents)
  const realCostCents = Math.ceil(
    (usage.prompt_tokens * 0.015 + usage.completion_tokens * 0.060) / 1000 * 100,
  ) / 100

  // Cache : correctness (les futurs hits en dépendent) → await (bloquant).
  // Sinon l'écriture ne s'exécute pas après le return (isolate Edge gelé) → le
  // cache ne se remplit jamais et chaque appel re-paie OpenAI.
  await supabaseAdmin.from('ai_cache').upsert({
    cache_key: cacheKey, feature: 'substitute', model: MODEL,
    response: cleanResult, last_hit_at: new Date().toISOString(),
  }, { onConflict: 'cache_key' })

  // Usage log : best-effort (analytics coût) → waitUntil : ne doit JAMAIS bloquer
  // ni faire échouer la réponse user si l'insert throw.
  runAfterResponse(supabaseAdmin.from('ai_usage_log').insert({
    user_id: user.id, feature: 'substitute', model: MODEL,
    cost_cents: Math.max(1, Math.round(realCostCents)),  // arrondi sup, min 1 cent pour tracking
    cached: false,
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    metadata: { ingredient_label, lang, recipe_context: recipe_context ?? null },
  }))

  return new Response(JSON.stringify(cleanResult), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
})

// (Le `export const _ = COST_CENTS_ESTIMATE` qui vivait ici n'a plus lieu
// d'être : la constante est désormais RÉELLEMENT utilisée, par le plafond
// budgétaire de la section 5b. Elle n'était gardée en vie que par ce hack —
// signe, rétrospectivement, que le garde manquait.)
