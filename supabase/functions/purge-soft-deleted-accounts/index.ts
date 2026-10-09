// Edge Function — purge définitive des comptes soft-deleted > 30 jours.
//
// À appeler par un CRON externe (cron-job.org, GitHub Actions, etc.) une
// fois par jour avec :
//   POST /functions/v1/purge-soft-deleted-accounts
//   Authorization: Bearer <PURGE_CRON_SECRET>
//
// Pour chaque profil avec deleted_at < now() - 30 jours :
//   1. auth.admin.deleteUser(user.id) — supprime de auth.users
//   2. La cascade SQL ON DELETE CASCADE efface profiles + toutes les
//      tables applicatives qui référencent l'user_id
//
// Renvoie { purged: N, errors: [...] } pour permettre au CRON de logger.
//
// Sécurité :
//   • Header Authorization obligatoire avec le secret PURGE_CRON_SECRET
//   • PAS d'auth utilisateur — c'est un endpoint backend-to-backend
//
// Secrets requis :
//   • PURGE_CRON_SECRET — token aléatoire fort (à générer toi-même,
//     ex. `openssl rand -hex 32`) puis configuré côté Supabase ET côté
//     service de cron.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'

const RETENTION_DAYS = 30

Deno.serve(async (req: Request) => {
  const CORS = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: CORS })
  }

  // S10.d.4 — rate-limit defense in depth : déjà protégé par PURGE_CRON_SECRET
  // mais on coupe le brute-force possible sur le secret côté caller. Cron
  // normal = 1 appel/jour, donc 3/min par IP est très large.
  const rateLimited = applyRateLimit(req, 'purge-soft-deleted-accounts', { max: 3, windowMs: 60_000 }, null, CORS)
  if (rateLimited) return rateLimited

  // ── Vérif du secret CRON ────────────────────────────────────
  const expectedSecret = Deno.env.get('PURGE_CRON_SECRET')
  if (!expectedSecret) {
    return new Response(
      JSON.stringify({ error: 'cron_secret_not_configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  }
  const authHeader = req.headers.get('Authorization')
  const provided   = authHeader?.replace('Bearer ', '') ?? ''
  if (provided !== expectedSecret) {
    return new Response(
      JSON.stringify({ error: 'forbidden' }),
      { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  }

  // ── Liste les profils à purger ──────────────────────────────
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: rows, error: listErr } = await supabaseAdmin
    .from('profiles')
    .select('id, username, deleted_at')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff)

  if (listErr) {
    return new Response(
      JSON.stringify({ error: 'db_error', detail: listErr.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  }

  if (!rows || rows.length === 0) {
    return new Response(
      JSON.stringify({ success: true, purged: 0 }),
      { headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  }

  // ── Suppression définitive un par un ────────────────────────
  // (auth.admin.deleteUser ne supporte pas le batch, et ça reste rapide
  // tant que les volumes sont raisonnables).
  const errors: { id: string; username?: string; error: string }[] = []
  let purged = 0
  for (const row of rows) {
    // v3.3.11 — anonymisation RGPD : avant de supprimer le user, on
    // efface le snapshot du username sur ses recettes promues en
    // base_recipes. La FK original_author_id (ON DELETE SET NULL)
    // s'occupe de l'id automatiquement via le cascade auth.users delete,
    // mais le `original_author_name` (text snapshot) doit être nettoyé
    // explicitement.
    await supabaseAdmin
      .from('base_recipes')
      .update({ original_author_name: null })
      .eq('original_author_id', row.id)

    // Chantier avis+communauté (PR2, 2026-07-16) — RGPD droit à l'effacement :
    // supprime les photos d'avis/posts de cet utilisateur. Chemin par
    // user_id → opération ciblée, pas un scan du bucket entier.
    const { data: userFiles } = await supabaseAdmin.storage.from('review-photos').list(row.id)
    if (userFiles?.length) {
      const paths = userFiles.map(f => `${row.id}/${f.name}`)
      await supabaseAdmin.storage.from('review-photos').remove(paths)
    }

    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(row.id)
    if (delErr) {
      errors.push({ id: row.id, username: row.username, error: delErr.message })
    } else {
      purged++
    }
  }

  return new Response(
    JSON.stringify({ success: true, purged, total: rows.length, errors }),
    { headers: { 'Content-Type': 'application/json', ...CORS } }
  )
})
