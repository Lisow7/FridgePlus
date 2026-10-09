import { supabase } from '@shared/lib/supabase/client'
import {
  publishStagingToRecipes,
  rejectStaging,
} from '../../../scripts/recipe-import/publishers/recipes-publisher.mjs'
import {
  adminCountCommunityRecipesByStatus,
  adminFindCommunityRecipesByStatus,
  adminFindCommunityRecipesByIds,
  adminFindRecentCommunityRecipesByUser,
  adminFindCommunityRecipeCreationsSince,
  adminUpdateCommunityRecipe as repoAdminUpdateCommunityRecipe,
  adminSoftDeleteCommunityRecipe,
  adminFindOfficialRecipesPaginated,
  adminUpsertOfficialRecipe,
  adminDeleteOfficialRecipe,
  adminPromoteCommunityRecipeToOfficial,
  countOfficialRecipes,
  countAllRecipes,
  countMissingImageBaseRecipes,
} from '@shared/lib/recipes/recipes-repository'

export { countMissingImageBaseRecipes }

const PER_PAGE = 50

async function logAdminAction(action, targetId = null, targetType = null) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('activity_logs').insert({
    user_id: user.id,
    action,
    target_id: targetId,
    target_type: targetType,
  })
}

// Sprint 5f : ces fonctions orchestrent (repo BDD + activity_logs).
// Le repo est responsable de la BDD pure, admin.js de l'audit.

export async function adminCountRecipesByStatus(status) {
  return adminCountCommunityRecipesByStatus(status)
}

export async function adminGetRecipesByStatus(status) {
  const { data, error } = await adminFindCommunityRecipesByStatus(status)
  if (error) { console.error('[admin] adminGetRecipesByStatus:', error.message); return { data: [], error } }
  if (!data?.length) return { data: [], error }

  const userIds = [...new Set(data.map(r => r.user_id))]
  const { data: profiles } = await supabase
    .from('profiles').select('id, username').in('id', userIds)
  const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p.username]))

  return { data: data.map(r => ({ ...r, username: byId[r.user_id] ?? null })), error }
}

// promotion d'une recette communauté en recette officielle.
// Appelle la RPC SQL promote_recipe_to_base via le repo (vérifie is_admin +
// consent + statut approved + non-déjà-promue côté SQL).
export async function adminPromoteRecipeToBase(customRecipeId) {
  return adminPromoteCommunityRecipeToOfficial(customRecipeId)
}

export async function adminUpdateCommunityRecipe(id, recipe) {
  const { id: _id, moderation_status: _ms, is_public: _ip, isCustom: _ic, _isCommunity: _ico, admin_modified: _am, ...rest } = recipe
  const { error } = await repoAdminUpdateCommunityRecipe(id, {
    title: recipe.name ?? recipe.title ?? '',
    data: rest,
    admin_modified: true,
  })
  if (!error) await logAdminAction('recipe_edited', id, 'recipe')
  return { error }
}

export async function adminSetRecipeStatus(id, status, reason = null) {
  const patch = {
    moderation_status: status,
    is_public: status === 'approved',
    moderation_reason: reason?.trim() || null,
  }
  const { error } = await repoAdminUpdateCommunityRecipe(id, patch)
  const actionMap = { approved: 'recipe_approved', rejected: 'recipe_rejected', pending: 'recipe_pending' }
  if (!error) await logAdminAction(actionMap[status] ?? 'recipe_approved', id, 'recipe')
  return { error }
}

export async function adminDeleteRecipe(id) {
  const { error } = await adminSoftDeleteCommunityRecipe(id)
  if (!error) await logAdminAction('recipe_deleted', id, 'recipe')
  return { error }
}

export async function adminGetRecipesByIds(ids) {
  return { data: await adminFindCommunityRecipesByIds(ids) }
}

export async function adminGetUsersByIds(ids) {
  if (!ids.length) return { data: [] }
  const { data } = await supabase
    .from('profiles')
    .select('id, username, avatar_id, role, banned')
    .in('id', ids)
  return { data: data ?? [] }
}

// Audit front §3 — pagination serveur de la liste utilisateurs (2026-07-22).
// adminGetAllUsers() rapatriait toute la table `profiles` puis paginait/filtrait
// côté client : coût qui grossit linéairement avec le nombre d'inscrits. On
// pousse pagination, recherche, filtre et tri côté SQL.
const USERS_PER_PAGE = 30

const USER_LIST_COLUMNS =
  'id, username, avatar_id, role, banned, subscription_status, subscription_plan, subscription_ends_at, special_role, created_at'

// Filtre de statut partagé entre la liste paginée et les compteurs de badge,
// pour que les deux restent cohérents.
function applyUserStatusFilter(query, filter) {
  if (filter === 'active') return query.eq('banned', false).neq('role', 'admin')
  if (filter === 'banned') return query.eq('banned', true)
  if (filter === 'admins') return query.eq('role', 'admin')
  return query
}

export async function adminGetUsers({ page = 0, search = '', filter = 'all', sort = 'newest' } = {}) {
  let query = supabase
    .from('profiles')
    .select(USER_LIST_COLUMNS, { count: 'exact' })

  query = applyUserStatusFilter(query, filter)

  // Neutralise les métacaractères LIKE/PostgREST pour préserver une recherche
  // « contient » (comportement de l'ancien filtre client). Aligné sur
  // adminGetIngredients.
  const s = search.trim().replace(/[%_,()"\\]/g, '')
  if (s) query = query.ilike('username', `%${s}%`)

  if (sort === 'az')          query = query.order('username',   { ascending: true })
  else if (sort === 'oldest') query = query.order('created_at', { ascending: true })
  else                        query = query.order('created_at', { ascending: false })

  query = query.range(page * USERS_PER_PAGE, (page + 1) * USERS_PER_PAGE - 1)

  const { data, error, count } = await query
  return { data: data ?? [], count: count ?? 0, error }
}

// Compteurs des badges de filtre (indépendants de la recherche, comme avant) :
// 4 requêtes count `head:true`, aucune donnée rapatriée.
export async function adminGetUserCounts() {
  const base = () => supabase.from('profiles').select('id', { count: 'exact', head: true })
  const [all, active, banned, admins] = await Promise.all([
    base(),
    base().eq('banned', false).neq('role', 'admin'),
    base().eq('banned', true),
    base().eq('role', 'admin'),
  ])
  return {
    all:    all.count ?? 0,
    active: active.count ?? 0,
    banned: banned.count ?? 0,
    admins: admins.count ?? 0,
  }
}

export async function adminGrantCompedAccess(userId, action) {
  const { error } = await supabase.rpc('grant_comped_access', {
    p_target_user_id: userId,
    p_action:         action,   // 'grant' | 'revoke'
  })
  if (!error) {
    await logAdminAction(
      action === 'grant' ? 'user_comped_granted' : 'user_comped_revoked',
      userId,
      'user'
    )
  }
  return { error }
}

export async function adminToggleBan(userId, banned) {
  const { error } = await supabase
    .from('profiles')
    .update({ banned })
    .eq('id', userId)
  if (!error) await logAdminAction(banned ? 'user_banned' : 'user_unbanned', userId, 'user')
  return { error }
}

const ITEMS_PER_PAGE = 50

export async function adminGetStats() {
  const [{ count: ingCount }, recCount, { count: usersCount }, pending] =
    await Promise.all([
      supabase.from('ingredients').select('id', { count: 'exact', head: true }),
      countOfficialRecipes(),  // Sprint 5f : délégué au repository
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      adminCountRecipesByStatus('pending'),
    ])
  return { ingredients: ingCount ?? 0, baseRecipes: recCount, users: usersCount ?? 0, pending }
}

export async function adminGetIngredients({ page = 0, search = '', subcategory = '' } = {}) {
  let query = supabase
    .from('ingredients')
    // inclut les colonnes ajoutées en v3.3.12 (nutrition, pack_size,
    // allergens, breaks_diets, default_unit) pour permettre leur édition
    // dans IngredientForm sans appel supplémentaire.
    .select('id, labels, emoji, subcategory, storage, sort_order, group_id, price, nutrition, pack_size, allergens, breaks_diets, default_unit', { count: 'exact' })
    .order('subcategory').order('sort_order')
    .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1)
  if (search.trim()) {
    // Neutralise les métacaractères du filtre PostgREST `.or()` (%, virgule,
    // parenthèses, guillemet, antislash) — sinon un terme comme `a,b` ou `a(b`
    // casse la syntaxe du filtre. Aligné sur adminGetImportQueue.
    const s = search.trim().replace(/[%,()"\\]/g, '')
    query = query.or(`id.ilike.%${s}%,labels->>fr.ilike.%${s}%`)
  }
  if (subcategory) query = query.eq('subcategory', subcategory)
  const { data, error, count } = await query
  return { data: data ?? [], count: count ?? 0, error }
}

export async function adminUpsertIngredient({ _isNew, ...row }) {
  const { error } = await supabase.from('ingredients').upsert(row, { onConflict: 'id' })
  if (!error) await logAdminAction(_isNew ? 'ingredient_added' : 'ingredient_updated', row.id, 'ingredient')
  return { error }
}

export async function adminDeleteIngredient(id) {
  const { error } = await supabase.from('ingredients').delete().eq('id', id)
  if (!error) await logAdminAction('ingredient_deleted', id, 'ingredient')
  return { error }
}

// Data Quality v2 (Sprint 8) — étendu à recipes_unified (officials + community)
// + nouveaux checks couvrant les 5 dimensions DQ 2026 :
// completeness / accuracy / consistency / validity / uniqueness.
// Vues SQL refactorisées : cf. migrations s8_quality_v2_health_checks.
// Filtre RGPD soft-deleted côté view (deleted_at IS NULL).
export async function adminGetHealthChecks() {
  const [
    { data: recipes,     error: recErr },
    { data: ingredients, error: ingErr },
    totalRecipes,
    { count: totalIngredients },
  ] = await Promise.all([
    // origin ajouté → permet badge official/community côté UI
    // orphan_count, bad_slot_count, broken_diets → contexte pour debug
    supabase.from('recipe_health_check')
      .select('id, name_fr, origin, status, country, issues, orphan_count, bad_slot_count, broken_diets, updated_at'),
    supabase.from('ingredient_health_check')
      .select('id, label_fr, subcategory, storage, issues, eur_per_kg, updated_at'),
    // Sprint 5f : délégué au repository (recipes_unified count, excl. soft-deleted).
    countAllRecipes(),
    supabase.from('ingredients').select('id', { count: 'exact', head: true }),
  ])
  return {
    recipes:          (recipes     ?? []).filter(r => r.issues?.length),
    ingredients:      (ingredients ?? []).filter(i => i.issues?.length),
    totalRecipes,
    totalIngredients: totalIngredients ?? 0,
    error: recErr ?? ingErr ?? null,
  }
}

export async function adminGetBaseRecipes(filters = {}) {
  // Sprint 5f : délégué au repository
  return adminFindOfficialRecipesPaginated({ ...filters, pageSize: ITEMS_PER_PAGE })
}

// Fetch une recette officielle par id (drill-down Qualité → éditeur). Réutilise
// la recherche existante (search matche id.ilike) + filtre l'id exact côté client.
export async function adminGetBaseRecipeById(id) {
  if (!id) return { data: null }
  const { data } = await adminGetBaseRecipes({ search: id })
  return { data: (data ?? []).find(r => r.id === id) ?? null }
}

// Fetch un ingrédient par id (drill-down Qualité → éditeur).
export async function adminGetIngredientById(id) {
  if (!id) return { data: null }
  const { data } = await adminGetIngredients({ search: id })
  return { data: (data ?? []).find(i => i.id === id) ?? null }
}

export async function adminUpsertBaseRecipe({ _isNew, ...row }) {
  // Sprint 5f : délégué au repository (INSTEAD OF trigger gère ON CONFLICT).
  const { error } = await adminUpsertOfficialRecipe(row)
  if (!error) await logAdminAction(_isNew ? 'base_recipe_added' : 'base_recipe_updated', row.id, 'base_recipe')
  return { error }
}

export async function adminDeleteBaseRecipe(id) {
  const { error } = await adminDeleteOfficialRecipe(id)
  if (!error) await logAdminAction('base_recipe_deleted', id, 'base_recipe')
  return { error }
}

export async function adminGetAuthUsers() {
  const { data, error } = await supabase.rpc('admin_get_auth_users')
  if (error) return {}
  return Object.fromEntries((data ?? []).map(u => [u.id, { email: u.email, lastSignIn: u.last_sign_in_at }]))
}

export async function adminGetUserProfile(userId) {
  const [{ data: profile }, { data: favorites }, recipes] = await Promise.all([
    supabase.from('profiles').select('allergen_prefs').eq('id', userId).single(),
    supabase.from('user_favorites').select('recipe_id').eq('user_id', userId),
    // Sprint 5f : délégué au repository
    adminFindRecentCommunityRecipesByUser(userId, 20),
  ])
  return {
    allergens: profile?.allergen_prefs ?? [],
    favorites: (favorites ?? []).map(f => f.recipe_id),
    recipes,
  }
}

export async function adminGetFavoriteCountsByIds(ids) {
  if (!ids.length) return {}
  const { data } = await supabase.from('user_favorites').select('recipe_id').in('recipe_id', ids)
  const counts = {}
  ;(data ?? []).forEach(r => { counts[r.recipe_id] = (counts[r.recipe_id] || 0) + 1 })
  return counts
}

export async function adminGetLogs(page = 0) {
  const from = page * PER_PAGE
  const { data, error, count } = await supabase
    .from('activity_logs')
    .select('id, action, user_id, target_id, target_type, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + PER_PAGE - 1)
  if (error || !data?.length) return { data: data ?? [], count: count ?? 0, error }

  const userIds = [...new Set(data.map(r => r.user_id).filter(Boolean))]
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles').select('id, username').in('id', userIds)
    const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p.username]))
    return {
      data: data.map(r => ({ ...r, username: r.user_id ? (byId[r.user_id] ?? null) : null })),
      count: count ?? 0,
      error,
    }
  }
  return { data, count: count ?? 0, error }
}

// ── Analytics ─────────────────────────────────────────────────────────────────
// Retourne les 3 datasets bruts (dates uniquement) pour le graphique du Dashboard.
// On fetch 2 ans max pour couvrir vue "Tout", agrégation côté client.
export async function adminGetAnalyticsData() {
  const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 3600 * 1000).toISOString()
  const [{ data: logs }, { data: users }, recipes] = await Promise.all([
    supabase.from('activity_logs')
      .select('created_at')
      .gte('created_at', twoYearsAgo)
      .order('created_at'),
    supabase.from('profiles')
      .select('created_at')
      .gte('created_at', twoYearsAgo)
      .order('created_at'),
    // Sprint 5f : délégué au repository
    adminFindCommunityRecipeCreationsSince(twoYearsAgo),
  ])
  return { logs: logs ?? [], users: users ?? [], recipes }
}

export async function adminGrantSpecialAccess(userId, role, note = null) {
  const { error } = await supabase.rpc('grant_special_access', {
    p_user_id: userId,
    p_role:    role,
    p_note:    note,
  })
  if (!error) {
    await logAdminAction('special_access_granted', userId, 'user')
  }
  return { error }
}

export async function adminRevokeSpecialAccess(userId) {
  const { error } = await supabase.rpc('revoke_special_access', {
    p_user_id: userId,
  })
  if (!error) {
    await logAdminAction('special_access_revoked', userId, 'user')
  }
  return { error }
}

export async function adminClearSpecialAccessNote(userId) {
  const { error } = await supabase.rpc('clear_special_access_note', {
    p_user_id: userId,
  })
  if (!error) {
    await logAdminAction('special_access_note_cleared', userId, 'user')
  }
  return { error }
}

// ─── Refonte Recettes Phase 5a — Admin Import Queue ─────────────────────────
// API pour réviser, corriger, publier ou rejeter les staging rows du pipeline.
// RLS admin-only (policy recipe_imports_staging_admin via is_admin()).

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
    const s = search.trim().replace(/[%,()"\\]/g, '')
    query = query.or(`external_key.ilike.%${s}%,parsed_data->>name.ilike.%${s}%`)
  }

  const { data, count, error } = await query
  return { data: data ?? [], count: count ?? 0, error }
}

/**
 * UPDATE errors persistantes + repasse status='pending' (admin corrige inline).
 */
export async function adminUpdateStagingErrors(stagingId, newErrors) {
  const { error } = await supabase
    .from('recipe_imports_staging')
    .update({ errors: newErrors, status: 'pending' })
    .eq('id', stagingId)
  return { error }
}

/**
 * MVP : re-validation complète se fait via CLI (catalogue ingrédients côté Node).
 * Côté admin UI on retourne un message indicatif.
 */

export async function adminReRunValidators(stagingId) {
  return {
    error: null,
    message: `Re-validation via CLI : \`npm run recipes:revalidate -- --staging=${stagingId}\``,
  }
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
