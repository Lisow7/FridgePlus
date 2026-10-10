import { supabase } from '@shared/lib/supabase/client'
import { motifDansOu } from '@shared/lib/supabase/motif-de-recherche'
import {
  publishStagingToRecipes,
  rejectStaging,
} from '../../../scripts/recipe-import/publishers/recipes-publisher.mjs'

// La file d'import de recettes (Refonte Recettes, phase 5a) : réviser,
// publier ou rejeter les lignes de `recipe_imports_staging`, et ses
// métriques. RLS admin seulement (règle `recipe_imports_staging_admin`,
// `is_admin()`). Sortie d'`admin.js` (650 lignes) au lot 14f de l'audit du
// 2026-10-04 ; `admin.js` ré-exporte ces fonctions, les écrans n'ont pas bougé.
//
// Publication et rejet délèguent au publisher du pipeline (module Node
// partagé avec le CLI) — le lot 12l les remplacera par des RPC
// transactionnelles côté base (ADM-17).

const IMPORT_QUEUE_PAGE_SIZE = 50

/**
 * Liste paginée des staging rows avec filtres.
 *
 * @param {Object} [opts]
 * @param {string} [opts.status]    - pending|valid|invalid|admin_review|published|rejected|all
 * @param {string} [opts.batchId]
 * @param {string} [opts.search]
 * @param {number} [opts.page=0]
 * @param {number} [opts.pageSize=50]
 */
export async function adminGetImportQueue({
  status = 'all',
  batchId = '',
  search = '',
  page = 0,
  pageSize = IMPORT_QUEUE_PAGE_SIZE,
} = {}) {
  let query = supabase
    .from('recipe_imports_staging')
    .select('id, batch_id, source, external_key, status, errors, parsed_data, admin_notes, resolved_at, resolved_by, published_recipe_id, backfill_audit, created_at, updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (status && status !== 'all') query = query.eq('status', status)
  if (batchId)                    query = query.eq('batch_id', batchId)
  if (search.trim()) {
    const m = motifDansOu(search)
    query = query.or(`external_key.ilike.${m},parsed_data->>name.ilike.${m}`)
  }

  const { data, count, error } = await query
  return { data: data ?? [], count: count ?? 0, error }
}

/**
 * Publie 1 staging row vers recipes_unified (délègue au publisher).
 */
export async function adminPublishStaged(stagingId) {
  const { data: { user } = {} } = await supabase.auth.getUser()
  return publishStagingToRecipes(supabase, { stagingId, actorId: user?.id ?? null })
}

/**
 * Rejette 1 staging row.
 */
export async function adminRejectStaged(stagingId, reason) {
  const { data: { user } = {} } = await supabase.auth.getUser()
  return rejectStaging(supabase, { stagingId, reason, actorId: user?.id ?? null })
}

/**
 * Métriques agrégées de la queue d'import recettes.
 * Refonte Recettes Phase 8 — observability admin.
 *
 * Retourne :
 *   - byStatus : { pending, valid, invalid, admin_review, published, rejected }
 *   - bySource : { themealdb, ia_batch, json_file, admin_ui, backfill_audit }
 *   - topErrorCodes : [{ code, count }] top 5 par fréquence
 *   - eventsLast7d : { imported, validated, invalidated, published, rejected, ... }
 *   - avgReviewMinutes : null (MVP — à implémenter via vue SQL si besoin)
 */
export async function adminGetImportMetrics() {
  // 1. Status counts
  const { data: statusRows, error: statusErr } = await supabase
    .from('recipe_imports_staging')
    .select('status')
  if (statusErr) return { error: statusErr }

  const byStatus = { pending: 0, valid: 0, invalid: 0, admin_review: 0, published: 0, rejected: 0 }
  for (const r of statusRows ?? []) {
    if (byStatus[r.status] != null) byStatus[r.status]++
  }

  // 2. Source counts
  const { data: sourceRows, error: sourceErr } = await supabase
    .from('recipe_imports_staging')
    .select('source')
  if (sourceErr) return { error: sourceErr }

  const bySource = {}
  for (const r of sourceRows ?? []) {
    if (!r.source) continue
    bySource[r.source] = (bySource[r.source] ?? 0) + 1
  }

  // 3. Top error codes — aggregate côté JS depuis errors[] jsonb
  const { data: errorRows, error: errErr } = await supabase
    .from('recipe_imports_staging')
    .select('errors')
    .neq('status', 'published')
  if (errErr) return { error: errErr }

  const errorCounts = new Map()
  for (const r of errorRows ?? []) {
    for (const e of r.errors ?? []) {
      if (!e?.code) continue
      errorCounts.set(e.code, (errorCounts.get(e.code) ?? 0) + 1)
    }
  }
  const topErrorCodes = Array.from(errorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => ({ code, count }))

  // 4. Events last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: eventsRows, error: evErr } = await supabase
    .from('recipe_import_events')
    .select('event_type, created_at')
    .gte('created_at', sevenDaysAgo)
  if (evErr) return { error: evErr }

  const eventsLast7d = {}
  for (const e of eventsRows ?? []) {
    eventsLast7d[e.event_type] = (eventsLast7d[e.event_type] ?? 0) + 1
  }

  // 5. Avg review time — MVP : null. À implémenter via vue SQL si besoin.
  const avgReviewMinutes = null

  return {
    error: null,
    metrics: { byStatus, bySource, topErrorCodes, eventsLast7d, avgReviewMinutes },
  }
}

/**
 * Bulk publish : publie tous les rows status='valid' d'un batch.
 * Continue sur erreur partielle.
 */
export async function adminBatchPublishValid(batchId) {
  const { data: { user } = {} } = await supabase.auth.getUser()
  const actorId = user?.id ?? null

  const { data: candidates, error: fetchErr } = await supabase
    .from('recipe_imports_staging')
    .select('id')
    .eq('batch_id', batchId)
    .eq('status', 'valid')

  if (fetchErr) return { error: fetchErr, published: 0, failed: [] }

  const failed = []
  let published = 0
  for (const row of candidates ?? []) {
    const { error } = await publishStagingToRecipes(supabase, { stagingId: row.id, actorId })
    if (error) failed.push({ stagingId: row.id, error: error.message })
    else published++
  }
  return { error: null, published, failed }
}
