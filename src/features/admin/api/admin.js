import { supabase } from '@shared/lib/supabase/client'
import { logError } from '@shared/lib/observability/sentry'
import { auMoinsUneLigne } from '@shared/lib/supabase/rows-affected'
import { versErreur } from '@shared/lib/supabase/lever-si-erreur'
import { motifContient, motifDansOu } from '@shared/lib/supabase/motif-de-recherche'
import { slugify } from '@features/admin/lib/slug'
import { choisirUnIdLibre } from '@features/admin/lib/id-libre'
import { logAuditAction, AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from '@features/admin/lib/audit'
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

// Le journal (`activity_logs`) s'écrit par `logAuditAction` seul : vocabulaire
// fermé, métadonnées filtrées. `admin.js` avait son propre écrivain, qui
// ignorait l'erreur et ne filtrait rien (audit du 2026-10-04, ADM-27). La
// trace s'écrit « au mieux », après l'écriture réussie : son échec ne défait
// pas la modération.
const { RECIPE, BASE_RECIPE, INGREDIENT, USER } = AUDIT_TARGET_TYPES
const tracer = (action, targetId, targetType, metadata) => logAuditAction(action, { targetId, targetType, metadata })

// Sprint 5f : ces fonctions orchestrent (repo BDD + activity_logs).
// Le repo est responsable de la BDD pure, admin.js de l'audit.

async function adminCountRecipesByStatus(status) {
  return adminCountCommunityRecipesByStatus(status)
}

export async function adminGetRecipesByStatus(status) {
  const { data, error } = await adminFindCommunityRecipesByStatus(status)
  if (error) { logError(error, { tag: 'admin.recipesByStatus', status }); return { data: [], error } }
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
  if (!error) await tracer(AUDIT_ACTIONS.RECIPE_EDITED, id, RECIPE)
  return { error }
}

export async function adminSetRecipeStatus(id, status, reason = null) {
  const patch = {
    moderation_status: status,
    is_public: status === 'approved',
    moderation_reason: reason?.trim() || null,
  }
  const { error } = await repoAdminUpdateCommunityRecipe(id, patch)
  const actionMap = { approved: AUDIT_ACTIONS.RECIPE_APPROVED, rejected: AUDIT_ACTIONS.RECIPE_REJECTED, pending: AUDIT_ACTIONS.RECIPE_PENDING }
  if (!error) await tracer(actionMap[status] ?? AUDIT_ACTIONS.RECIPE_APPROVED, id, RECIPE, { reason: patch.moderation_reason })
  return { error }
}

export async function adminDeleteRecipe(id) {
  const { error } = await adminSoftDeleteCommunityRecipe(id)
  if (!error) await tracer(AUDIT_ACTIONS.RECIPE_DELETED, id, RECIPE)
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

  // La saisie protégée, pas tronquée : retirer `_` rendait le pseudo
  // « jean_dupont » introuvable (audit ADM-10).
  if (search.trim()) query = query.ilike('username', motifContient(search))

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

// Les écritures de ce fichier demandent les lignes touchées : si la règle de
// la base filtre la ligne, PostgREST répond sans erreur et 0 ligne — l'écran
// annonçait un succès (audit ADM-26).
// `adminToggleBan` (écrire `profiles.banned` seul) a été retiré le 2026-10-06 :
// il bannissait sans motif, sans durée et sans couper la session. Bannir passe
// par `admin_bannir` — `features/admin/api/bannissement.js` (lot 3c-3b).

const ITEMS_PER_PAGE = 50

// Lève si un comptage échoue : le fournisseur admin dit alors « les compteurs
// n'ont pas pu être lus » au lieu d'afficher des zéros (audit ADM-08).
export async function adminGetStats() {
  const [{ count: ingCount, error: ingErr }, recCount, { count: usersCount, error: usersErr }, pending] =
    await Promise.all([
      supabase.from('ingredients').select('id', { count: 'exact', head: true }),
      countOfficialRecipes(),  // Sprint 5f : délégué au repository
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      adminCountRecipesByStatus('pending'),
    ])
  if (ingErr || usersErr) throw versErreur(ingErr ?? usersErr)
  return { ingredients: ingCount ?? 0, baseRecipes: recCount, users: usersCount ?? 0, pending }
}

// Le tri se fait ICI, sur tout le catalogue : à l'écran, il ne rangeait que les
// 50 lignes de la page affichée (audit ADM-10). L'identifiant départage les
// égalités, pour qu'une ligne ne saute pas d'une page à l'autre.
const ORDRES_DES_INGREDIENTS = {
  subcategory: ['subcategory', 'sort_order', 'id'],
  name: ['labels->>fr', 'id'],
  id: ['id'],
}

export async function adminGetIngredients({ page = 0, search = '', subcategory = '', sort = 'subcategory' } = {}) {
  let query = supabase
    .from('ingredients')
    // inclut les colonnes ajoutées en v3.3.12 (nutrition, pack_size,
    // allergens, breaks_diets, default_unit) pour permettre leur édition
    // dans IngredientForm sans appel supplémentaire.
    .select('id, labels, emoji, subcategory, storage, sort_order, group_id, price, nutrition, pack_size, allergens, breaks_diets, default_unit', { count: 'exact' })
    .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1)
  for (const colonne of ORDRES_DES_INGREDIENTS[sort] ?? ORDRES_DES_INGREDIENTS.subcategory) query = query.order(colonne)
  if (search.trim()) {
    // Une virgule ou une parenthèse reste ce qu'elle est (les retirer changeait
    // la recherche) ; `%` et `_` aussi (audit ADM-10).
    const m = motifDansOu(search)
    query = query.or(`id.ilike.${m},labels->>fr.ilike.${m}`)
  }
  if (subcategory) query = query.eq('subcategory', subcategory)
  const { data, error, count } = await query
  return { data: data ?? [], count: count ?? 0, error }
}

export async function adminUpsertIngredient({ _isNew, ...row }) {
  // Un NOUVEL ingrédient s'INSÈRE : l'upsert écrasait en silence celui qui
  // portait déjà l'identifiant (libellés, nutrition, allergènes), et l'écran
  // disait « Ingrédient ajouté » (audit du 2026-10-04, ADM-16). La base refuse
  // désormais le doublon (23505), que le formulaire dit en clair.
  const table = supabase.from('ingredients')
  const { error } = await (_isNew ? table.insert(row) : table.upsert(row, { onConflict: 'id' }))
  if (!error) await tracer(_isNew ? AUDIT_ACTIONS.INGREDIENT_ADDED : AUDIT_ACTIONS.INGREDIENT_UPDATED, row.id, INGREDIENT)
  return { error }
}

// Combien de recettes (officielles et de la communauté) se servent d'un
// ingrédient : la confirmation de suppression le dit, au lieu de demander à
// l'admin de « vérifier » sans liste ni compteur (ADM-16). Les références
// vivent dans le jsonb `ingredients` ([{ ids: [...] }, …]) ; la contenance
// s'écrit en TEXTE JSON — un tableau, postgrest-js l'encoderait en littéral de
// tableau PostgreSQL (`cs.{…}`), faux pour du jsonb.
export async function adminCountIngredientUsage(id) {
  const { count, error } = await supabase.from('recipes_unified')
    .select('id', { count: 'exact', head: true })
    .contains('ingredients', JSON.stringify([{ ids: [id] }]))
  return { count: count ?? 0, error }
}

export async function adminDeleteIngredient(id) {
  const { error } = auMoinsUneLigne(await supabase.from('ingredients').delete().eq('id', id).select('id'))
  if (!error) await tracer(AUDIT_ACTIONS.INGREDIENT_DELETED, id, INGREDIENT)
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
  // Une recette NEUVE n'avait pas d'identifiant : sa création échouait
  // toujours (23502, vérifié sur la vraie base le 2026-10-08, ADM-16). Il se
  // tire de son nom, et doit être LIBRE : la vue `base_recipes` (déclencheur
  // INSTEAD OF qui gère ON CONFLICT) remplace la recette qui le porte déjà.
  let ligne = row
  if (_isNew) {
    // Tirets de bord retirés : un nom fait d'espaces donnait l'identifiant « - ».
    const base = slugify((row.name?.fr ?? '').trim()).replace(/^-+|-+$/g, '')
    if (!base) return { error: { message: 'Le nom FR fait l\'identifiant de la recette : il est requis.' } }
    const { data, error: lecture } = await supabase.from('base_recipes').select('id').like('id', `${base}%`)
    if (lecture) return { error: lecture }
    ligne = { ...row, id: choisirUnIdLibre(base, (data ?? []).map((r) => r.id)) }
  }
  // Sprint 5f : délégué au repository.
  const { error } = await adminUpsertOfficialRecipe(ligne)
  if (!error) await tracer(_isNew ? AUDIT_ACTIONS.BASE_RECIPE_ADDED : AUDIT_ACTIONS.BASE_RECIPE_UPDATED, ligne.id, BASE_RECIPE)
  return { error }
}

export async function adminDeleteBaseRecipe(id) {
  const { error } = await adminDeleteOfficialRecipe(id)
  if (!error) await tracer(AUDIT_ACTIONS.BASE_RECIPE_DELETED, id, BASE_RECIPE)
  return { error }
}

// Les données sensibles d'UN compte — e-mail, dernière connexion, allergènes —
// passent par la base, qui écrit la trace (motif compris) AVANT de les rendre
// (audit du 2026-10-04, ADM-05 ; migration 20261008095232). L'écran ne les lit
// plus autrement : `admin_get_auth_users` rapatriait les e-mails de TOUS les
// comptes à l'ouverture de l'onglet, sans trace.
// Rend `{ donnee, error }` : aucune ligne est une erreur, pas une donnée vide.
export async function adminRevelerCompte(userId, motif) {
  const { data, error } = await supabase.rpc('admin_reveler_compte', { p_user_id: userId, p_motif: motif })
  if (error) return { donnee: null, error }
  const ligne = data?.[0]
  if (!ligne) return { donnee: null, error: { message: 'Compte introuvable' } }
  return {
    donnee: { email: ligne.email, derniereConnexion: ligne.derniere_connexion, allergenes: ligne.allergenes ?? [] },
    error: null,
  }
}

// La fiche d'un compte : ses favoris et ses recettes. Ses allergènes (donnée
// potentiellement de santé) ne se lisent plus ici, mais derrière le rideau
// « Données sensibles » (`adminRevelerCompte`), avec un motif et une trace.
export async function adminGetUserProfile(userId) {
  const [{ data: favorites }, recipes] = await Promise.all([
    supabase.from('user_favorites').select('recipe_id').eq('user_id', userId),
    // Sprint 5f : délégué au repository
    adminFindRecentCommunityRecipesByUser(userId, 20),
  ])
  return {
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

// Les filtres du journal, appliqués PAR LA BASE (audit ADM-10 : ils ne
// portaient que sur les 50 lignes de la page affichée — une catégorie pouvait
// dire « Aucune entrée » quand la page suivante en était pleine) :
//   actions     : ne garder que ces actions (une catégorie) ;
//   saufActions : écarter celles-ci (la catégorie « Autres ») ;
//   auteur      : le pseudo de l'auteur, « contient ».
//   limite      : lignes par page (PER_PAGE) — le tableau de bord n'en veut que dix ;
//   compter     : le comptage exact (une seconde passe sur la table), utile à la
//                 pagination du journal, inutile aux dix dernières lignes (ADM-12 (4)).
export async function adminGetLogs(page = 0, { actions, saufActions, auteur, limite = PER_PAGE, compter = true } = {}) {
  const from = page * limite
  let auteurs = null
  if (auteur?.trim()) {
    const { data: trouves, error: lecture } = await supabase
      .from('profiles').select('id').ilike('username', motifContient(auteur))
    if (lecture) return { data: [], count: 0, error: lecture }
    auteurs = (trouves ?? []).map((p) => p.id)
    if (!auteurs.length) return { data: [], count: 0, error: null }
  }
  let query = supabase
    .from('activity_logs')
    // `metadata` : le motif d'une consultation de données sensibles (ADM-05).
    .select('id, action, user_id, target_id, target_type, metadata, created_at', compter ? { count: 'exact' } : undefined)
  if (actions) query = query.in('action', actions)
  // Noms d'actions en snake_case : rien à protéger dans la liste.
  if (saufActions?.length) query = query.not('action', 'in', `(${saufActions.join(',')})`)
  if (auteurs) query = query.in('user_id', auteurs)
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + limite - 1)
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
  // Lève sur erreur : le graphique (qui l'attrape) dit « échec » au lieu
  // d'« Aucune donnée sur cette période » (audit ADM-08).
  const [{ data: logs, error: logsErr }, { data: users, error: usersErr }, recipes] = await Promise.all([
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
  if (logsErr || usersErr) throw versErreur(logsErr ?? usersErr)
  return { logs: logs ?? [], users: users ?? [], recipes }
}

export async function adminGrantSpecialAccess(userId, role, note = null) {
  const { error } = await supabase.rpc('grant_special_access', {
    p_user_id: userId,
    p_role:    role,
    p_note:    note,
  })
  if (!error) {
    await tracer(AUDIT_ACTIONS.SPECIAL_ACCESS_GRANTED, userId, USER, { role })
  }
  return { error }
}

export async function adminRevokeSpecialAccess(userId) {
  const { error } = await supabase.rpc('revoke_special_access', {
    p_user_id: userId,
  })
  if (!error) {
    await tracer(AUDIT_ACTIONS.SPECIAL_ACCESS_REVOKED, userId, USER)
  }
  return { error }
}

// La note interne d'un accès spécial en cours, lue quand on le modifie (ADM-13 :
// la fenêtre n'offrait que « Révoquer » — changer de rôle ou de note imposait de
// révoquer puis réattribuer). L'effacer = enregistrer une note vide :
// `grant_special_access` met à jour rôle et note.
export async function adminGetSpecialAccessNote(userId) {
  const { data, error } = await supabase.from('special_access')
    .select('note').eq('user_id', userId).is('revoked_at', null).maybeSingle()
  return { note: data?.note ?? null, error }
}

// La file d'import vit dans `./import-queue` ; ré-exportée ici pour les
// écrans et les tests qui l'appellent par `@features/admin/api/admin`.
export {
  adminGetImportQueue,
  adminPublishStaged,
  adminRejectStaged,
  adminGetImportMetrics,
  adminBatchPublishValid,
} from './import-queue'
