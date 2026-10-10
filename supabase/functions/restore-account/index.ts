// Edge Function — restore d'un compte soft-deleted via le lien email.
//
// Appelée depuis App.jsx quand l'URL contient ?restore-account=TOKEN.
// Aucune authentification requise (le user a été signed out au moment du
// soft-delete et ne peut pas se connecter sans restaurer d'abord).
//
// Sécurité :
//   • Le token est un UUID v4 généré au moment du soft-delete.
//     Single-use : effacé dès la restauration réussie.
//   • Lookup contraint à `deleted_at IS NOT NULL` ET dans la fenêtre
//     de 30 jours — passé ce délai, le compte sera (ou aura été) purgé
//     par le CRON et ne sera plus restaurable.
//
// Codes d'erreur :
//   • 400 'missing_token'     → pas de token dans le body
//   • 404 'invalid_token'     → token inconnu, déjà utilisé, ou compte
//                                jamais soft-deleted
//   • 410 'expired'           → > 30 jours, restauration impossible

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { reponseErreur } from '../_shared/reponse-erreur.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'

const RETENTION_DAYS = 30

interface Payload {
  token: string
}

Deno.serve(async (req: Request) => {
  const CORS = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: CORS })
  }

  // v3.206.0 — Rate limit anti-bruteforce token : 5 tentatives / min / IP.
  // L'endpoint accepte un UUID v4 en POST sans auth (lien email) → un bot
  // pourrait scanner l'espace UUID pour tomber sur un token valide. 5 req/min
  // rend l'attaque infaisable en pratique (10^36 combinaisons).
  const rateLimited = applyRateLimit(req, 'restore-account', { max: 5, windowMs: 60_000 }, null, CORS)
  if (rateLimited) return rateLimited

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: CORS })
  }
  const { token } = payload
  if (!token) {
    return new Response(JSON.stringify({ error: 'missing_token' }), { status: 400, headers: CORS })
  }
  // Un jeton qui n'a pas la forme d'un UUID n'atteint pas la base (sinon :
  // erreur 22P02 de Postgres, et son message renvoyé au client).
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return reponseErreur('invalid_token', 404, CORS)
  }

  // Lookup du profil par restore_token. Pas de filtre temporel ici —
  // on veut différencier « token introuvable » de « expiré ».
  const { data: profile, error: lookupErr } = await supabaseAdmin
    .from('profiles')
    .select('id, deleted_at')
    .eq('restore_token', token)
    .maybeSingle()

  if (lookupErr) return reponseErreur('db_error', 500, CORS, lookupErr, 'restore-account')
  if (!profile || !profile.deleted_at) {
    return new Response(
      JSON.stringify({ error: 'invalid_token' }),
      { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  }

  // Vérifie la fenêtre 30 jours
  const deletedAt = new Date(profile.deleted_at).getTime()
  const expiresAt = deletedAt + RETENTION_DAYS * 24 * 60 * 60 * 1000
  if (Date.now() > expiresAt) {
    return new Response(
      JSON.stringify({ error: 'expired' }),
      { status: 410, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  }

  // Restauration : efface deleted_at et restore_token
  const { error: updErr } = await supabaseAdmin
    .from('profiles')
    .update({
      deleted_at:    null,
      restore_token: null,
    })
    .eq('id', profile.id)

  if (updErr) return reponseErreur('db_error', 500, CORS, updErr, 'restore-account')

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { 'Content-Type': 'application/json', ...CORS } }
  )
})
