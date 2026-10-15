// Recipes Repository — couche d'abstraction centralisée pour toutes les
// opérations BDD sur les recettes (officials + community).
//
// Pourquoi ce module (Sprint 5f, refonte BDD) :
//   - Élimine la dispersion des `.from('base_recipes'|'custom_recipes'|
//     'recipes_unified')` dans 8 fichiers (30 calls).
//   - Centralise le mapping shape jsonb `{...r.data, id: r.id}` qui était
//     dupliqué partout — 1 seul endroit à toucher si la shape évolue.
//   - Permet aux futurs devs d'avoir 1 point d'entrée unique pour la
//     persistance recettes ("Clean Architecture" pattern Supabase 2026).
//   - Facilite les tests : on mock le repository plutôt que supabase.from()
//     directement.
//
// Conventions :
//   - Toutes les fonctions retournent soit un objet recipe (avec id, data
//     déstructurée, métadonnées community en top-level), soit `null`
//     si non trouvée, soit `[]` si liste vide. Pas de wrappers `{ data, error }`
//     (sauf les writes côté admin pour transmettre l'erreur au caller).
//   - Les reads filtrent automatiquement `deleted_at IS NULL` (RGPD Art. 17 —
//     l'auteur a soft-deleted, le contenu disparaît).
//   - Les writes communauté passent par les VIEWS `custom_recipes` (Sprint 5d
//     INSTEAD OF triggers gèrent l'upsert vers recipes_unified).
//   - Les writes officials passent par la view `base_recipes` (idem).

import { supabase } from '@shared/lib/supabase/client'
import { auMoinsUneLigne } from '@shared/lib/supabase/rows-affected'
import { versErreur } from '@shared/lib/supabase/lever-si-erreur'
import { motifContient, motifDansOu } from '@shared/lib/supabase/motif-de-recherche'

// ─── Helpers de mapping ──────────────────────────────────────────────────────

// Mappe une row community (issue du view custom_recipes ou batch admin) vers
// le shape attendu par les consumers : `{ ...r.data, id, moderation_status,
// is_public, admin_modified, consent_to_promote, user_id? }`.
// Centralisé ici car répété dans 8+ fichiers avant Sprint 5f.
function mapCommunityRecipe(row, opts = {}) {
  if (!row) return null
  return {
    ...(row.data ?? {}),
    id:                 row.id,
    moderation_status:  row.moderation_status,
    is_public:          row.is_public,
    admin_modified:     row.admin_modified ?? false,
    consent_to_promote: row.consent_to_promote ?? false,
    ...(opts.withUserId      ? { user_id: row.user_id }         : {}),
    ...(opts.withCreatedAt   ? { created_at: row.created_at }   : {}),
    ...(opts.withTitle       ? { title: row.title }             : {}),
  }
}

// Mappe une row official (depuis view base_recipes) — colonnes structurées
// au lieu de jsonb data, donc on retourne tel quel + on s'assure du nom localisé.
function pickOfficialName(row, lang = 'fr') {
  if (!row?.name) return row?.id ?? ''
  if (typeof row.name === 'object') return row.name[lang] ?? row.name.fr ?? row.name.en ?? row.id
  return row.name
}

// ═══════════════════════════════════════════════════════════════════════════
// Reads — recettes communauté (view custom_recipes)
// ═══════════════════════════════════════════════════════════════════════════

// Les recettes d'un compte (tous statuts sauf supprimées) : `{ recipes, error }`.
//
// 🔴 Rend l'ERREUR. Jusqu'au 2026-10-05 cette lecture (`findCommunityRecipesByUser`)
// rendait une liste vide quand la base refusait : « Mes recettes » se vidait à
// l'écran sur un simple chargement raté — à la connexion, et après chaque
// enregistrement ou suppression, qui rechargent la liste.
export async function loadCommunityRecipesByUser(userId) {
  if (!userId) return { recipes: [], error: null }
  const { data, error } = await supabase
    .from('custom_recipes')
    .select('id, data, moderation_status, is_public, admin_modified, consent_to_promote')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) return { recipes: [], error }
  return { recipes: (data ?? []).map(r => mapCommunityRecipe(r)), error: null }
}

// Liste les recettes communauté publiques (approuvées + visibles).
// Utilisée par CommunityFeed + listAttachableRecipes.
export async function findPublicCommunityRecipes() {
  const { data } = await supabase
    .from('custom_recipes')
    .select('id, data, moderation_status, is_public, admin_modified')
    .eq('is_public', true)
    .eq('moderation_status', 'approved')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  return (data ?? []).map(r => mapCommunityRecipe(r))
}

// Fetch single recipe par id (deep-linking). Retourne null si introuvable
// ou si l'user n'a pas le droit (RLS-enforced).
export async function findCommunityRecipeById(id) {
  if (!id) return null
  const { data, error } = await supabase
    .from('custom_recipes')
    .select('id, user_id, data, moderation_status, is_public, admin_modified')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  // ⚠️ Une PANNE et une ABSENCE ne se confondent pas. `.maybeSingle()` rend
  // `{data: null, error: null}` quand la ligne n'existe pas ou que la RLS l'a
  // filtrée — c'est un vrai « pas accessible », qu'on rend `null`. Un `error`
  // truthy est une panne : on la propage pour que l'appelant puisse le dire,
  // au lieu d'annoncer « recette introuvable » à tort.
  if (error) throw error
  if (!data) return null
  return mapCommunityRecipe(data, { withUserId: true })
}

// Map { recipeId → name jsonb } pour résoudre des refs (ex: posts community).
// Filtre RLS-friendly : ne retourne que les recettes accessibles au caller.
export async function findCommunityRecipeNamesByIds(ids) {
  if (!ids?.length) return new Map()
  const uniqueIds = [...new Set(ids.filter(Boolean))]
  if (!uniqueIds.length) return new Map()
  const { data } = await supabase
    .from('custom_recipes')
    .select('id, data')
    .in('id', uniqueIds)
    .is('deleted_at', null)
  const map = new Map()
  for (const row of data ?? []) {
    if (row.data?.name) map.set(row.id, row.data.name)
  }
  return map
}

// Liste les recettes communauté d'un user pour résolution (journal cuisine).
// Format ultra-léger : juste les noms pour matcher des cooking_logs.
export async function findCommunityRecipesForResolution(userId) {
  if (!userId) return []
  const { data } = await supabase
    .from('custom_recipes')
    .select('id, data')
    .eq('user_id', userId)
    .is('deleted_at', null)
  return (data ?? []).map(r => ({ ...r.data, id: r.id }))
}

// Liste les recettes attachables à un post communauté (publiques approuvées).
// Identique à findPublicCommunityRecipes mais avec flags additionnels.
export async function findPublicCommunityRecipesAttachable() {
  const { data } = await supabase
    .from('custom_recipes')
    .select('id, data, user_id, is_public, moderation_status')
    .eq('is_public', true)
    .eq('moderation_status', 'approved')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  return (data ?? []).map(r => ({
    ...r.data,
    id:                r.id,
    user_id:           r.user_id,
    is_public:         r.is_public,
    moderation_status: r.moderation_status,
    isCustom:          true,
    _isCommunity:      true,
  }))
}

// Recettes publiées (publiques approuvées) d'un user spécifique.
// Utilisée par profil communauté.
export async function findPublicCommunityRecipesByUser(userId) {
  if (!userId) return []
  const { data } = await supabase
    .from('custom_recipes')
    .select('id, data, created_at')
    .eq('user_id', userId)
    .eq('is_public', true)
    .eq('moderation_status', 'approved')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  return (data ?? []).map(r => ({ ...r.data, id: r.id, created_at: r.created_at }))
}

// Recherche texte sur titre communauté (recherche signalement).
// Retourne shape minimal { id, label, emoji } pour ContextSelector.
export async function searchCommunityRecipes(query) {
  if (!query?.trim()) return []
  const { data } = await supabase
    .from('custom_recipes')
    .select('id, title, data')
    .eq('is_public', true)
    .ilike('title', motifContient(query))
    .limit(8)
  return (data ?? []).map(r => ({
    id:    String(r.id),
    label: r.title ?? r.id,
    emoji: r.data?.emoji ?? '🍽️',
  }))
}

// Recettes communauté pour data-export RGPD (Art. 20).
export async function findCommunityRecipesForDataExport(userId) {
  if (!userId) return []
  const { data } = await supabase
    .from('custom_recipes')
    .select('id, title, data, moderation_status, is_public, created_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
  return data ?? []
}

// Récupère id + title pour batch (reports + admin batch view).
export async function findCommunityRecipeTitlesByIds(ids) {
  if (!ids?.length) return []
  const { data } = await supabase
    .from('custom_recipes')
    .select('id, title')
    .in('id', ids)
  return data ?? []
}

// ═══════════════════════════════════════════════════════════════════════════
// Reads — recettes officials (view base_recipes)
// ═══════════════════════════════════════════════════════════════════════════

// Recherche texte sur nom officials (recherche signalement, multi-lang).
export async function searchOfficialRecipes(query, lang = 'fr') {
  if (!query?.trim()) return []
  const m = motifDansOu(query)
  const { data } = await supabase
    .from('base_recipes')
    .select('id, name, emoji')
    .or(`id.ilike.${m},name->>${lang}.ilike.${m},name->>fr.ilike.${m}`)
    .limit(8)
  return (data ?? []).map(r => ({
    id:    String(r.id),
    label: pickOfficialName(r, lang),
    emoji: r.emoji ?? '🍽️',
  }))
}

// Récupère id + name pour batch (reports module).
export async function findOfficialRecipeNamesByIds(ids) {
  if (!ids?.length) return []
  const { data } = await supabase
    .from('base_recipes')
    .select('id, name')
    .in('id', ids)
  return data ?? []
}

// ═══════════════════════════════════════════════════════════════════════════
// Reads — recipes_unified (table source, accès direct pour initial app load)
// ═══════════════════════════════════════════════════════════════════════════

// Fetch tous les officials publiés (initial load via data-provider).
// Lecture directe sur recipes_unified pour bypass le filtre view.
export async function findAllPublishedOfficialRecipes() {
  const { data } = await supabase
    .from('recipes_unified')
    .select(
      'id, name, description, emoji, time_min, prep_time_min, cook_time_min, ' +
      'difficulty, type, servings, country, diet, allergens, ingredients, steps, ' +
      'image_url, status, promoted_from_id, promoted_at, original_author_id, original_author_name, created_at'
    )
    .eq('origin', 'official')
  return data ?? []
}

// Count total recettes non-soft-deleted (admin stats).
// Les comptages LÈVENT sur erreur : un 0 cachait le badge et se lisait « rien
// à modérer » (audit ADM-08).
export async function countAllRecipes() {
  const { count, error } = await supabase
    .from('recipes_unified')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
  if (error) throw versErreur(error)
  return count ?? 0
}

// Count officials sans image (admin curation — badge manquant).
export async function countMissingImageBaseRecipes() {
  const { count } = await supabase
    .from('base_recipes')
    .select('id', { count: 'exact', head: true })
    .or('image_url.is.null,image_url.eq.')
  return count ?? 0
}

// ═══════════════════════════════════════════════════════════════════════════
// Writes — recettes communauté (user-facing)
// ═══════════════════════════════════════════════════════════════════════════

// Crée ou met à jour une recette communauté. View INSTEAD OF INSERT trigger
// fait l'upsert en interne (Sprint 5d, donc .insert() suffit).
// Throws Error avec code='approved_recipe_locked' si trigger prevent_edit_approved
// rejette la modif (recette approuvée éditée par non-admin).
export async function saveCommunityRecipe(recipe, userId) {
  const { id, ...data } = recipe
  const { error } = await supabase.from('custom_recipes').insert({
    id,
    user_id: userId,
    title: recipe.name ?? recipe.title ?? '',
    data,
    moderation_status: recipe.moderation_status ?? 'private',
    is_public: recipe.is_public ?? false,
    consent_to_promote: recipe.consent_to_promote ?? false,
    // 🔴 `admin_modified` et `moderation_reason` doivent transiter, même si ce
    // formulaire ne les édite pas : `custom_recipes` est une VUE à trigger
    // INSTEAD OF dont le ON CONFLICT réécrit toutes les colonnes. Omises,
    // elles repartaient à false/NULL — une recette éditée par la modération
    // perdait son bandeau « modifiée par l'admin » dès que l'auteur la
    // ré-enregistrait, alors que ce drapeau est lu et affiché (badge de carte
    // + bandeau de fiche). Corrigé le 2026-08-28.
    admin_modified: recipe.admin_modified ?? false,
    moderation_reason: recipe.moderation_reason ?? null,
    // R-03 — preuve de consentement à la publication communautaire en colonnes
    // dédiées (requêtable/auditable). NULL = privée ou antérieure à R-03.
    published_consent_at:      recipe.published_consent_at ?? null,
    published_consent_version: recipe.published_consent_version ?? null,
  })
  if (error?.code === '42501') {
    const e = new Error('approved_recipe_locked')
    e.code = 'approved_recipe_locked'
    throw e
  }
  return { error }
}

// Soft-delete : marque deleted_at, RGPD Art. 17.
export async function softDeleteCommunityRecipe(id, userId) {
  const { error } = await supabase.from('custom_recipes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
  return { error }
}

// User a vu les modifs admin → reset le flag pour ne plus afficher la bannière.
// Rend `{ error }` : si l'écriture échoue, le bandeau reviendrait au rechargement.
export async function markCommunityRecipeAdminModifiedRead(id, userId) {
  const { error } = await supabase.from('custom_recipes')
    .update({ admin_modified: false })
    .eq('id', id)
    .eq('user_id', userId)
  return { error: error ?? null }
}

// Upsert batch (migration localStorage → DB au 1er login).
// INSTEAD OF INSERT trigger gère l'upsert en interne (idempotent).
export async function migrationUpsertCommunityRecipes(rows) {
  const { error } = await supabase.from('custom_recipes').insert(rows)
  return { error }
}

// ═══════════════════════════════════════════════════════════════════════════
// Wrappers RPC (déjà sécurisés côté SQL)
// ═══════════════════════════════════════════════════════════════════════════

export async function countRecipeReferences(recipeId) {
  const { data, error } = await supabase.rpc('count_recipe_references', {
    p_recipe_id: String(recipeId),
  })
  if (error) {
    if (import.meta.env.DEV) console.error('[countRecipeReferences]', error)
    return { favoriters: 0, basket: 0 }
  }
  return data ?? { favoriters: 0, basket: 0 }
}

export async function deleteCommunityRecipeRGPD(recipeId) {
  const { data, error } = await supabase.rpc('delete_custom_recipe_rgpd', {
    p_recipe_id: recipeId,
  })
  if (error) {
    if (import.meta.env.DEV) console.error('[deleteCommunityRecipeRGPD]', error)
    return { error }
  }
  return { data, error: null }
}

// ═══════════════════════════════════════════════════════════════════════════
// Admin — opérations de modération + curation
// ───────────────────────────────────────────────────────────────────────────
// NB : ces fonctions n'incluent PAS l'écriture activity_logs (l'admin.js
// orchestrateur en a la responsabilité après succès). Repository = pure BDD.

// Count recettes communauté par statut de modération.
export async function adminCountCommunityRecipesByStatus(status) {
  const { count, error } = await supabase
    .from('custom_recipes')
    .select('id', { count: 'exact', head: true })
    .eq('moderation_status', status)
    .is('deleted_at', null)
  if (error) throw versErreur(error)
  return count ?? 0
}

// Liste les recettes communauté par statut (modération queue).
// Retourne le shape raw (id, title, data, user_id, ...) car l'admin a besoin
// de toutes les colonnes pour l'UI moderation. Pas de transformation.
export async function adminFindCommunityRecipesByStatus(status) {
  const { data, error } = await supabase
    .from('custom_recipes')
    .select('id, title, data, user_id, moderation_status, admin_modified, created_at')
    .eq('moderation_status', status)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  return { data: data ?? [], error }
}

// Batch fetch par IDs (admin signalements + analytics).
export async function adminFindCommunityRecipesByIds(ids) {
  if (!ids.length) return []
  const { data } = await supabase
    .from('custom_recipes')
    .select('id, title, data, moderation_status')
    .in('id', ids)
  return data ?? []
}

// Recettes récentes d'un user (admin profile inspect, max 20).
export async function adminFindRecentCommunityRecipesByUser(userId, limit = 20) {
  const { data } = await supabase
    .from('custom_recipes')
    .select('id, title, moderation_status, created_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

// Update community recipe par admin (édition contenu, flag admin_modified).
// Les écritures admin demandent les lignes touchées (audit ADM-26) : 0 ligne =
// échec. Par les vues `custom_recipes` / `base_recipes`, le RETURNING rend
// bien la ligne (leurs déclencheurs INSTEAD OF renvoient NEW / OLD — vérifié
// sur la vraie base le 2026-10-05).
export async function adminUpdateCommunityRecipe(id, patch) {
  const { error } = auMoinsUneLigne(await supabase.from('custom_recipes').update(patch).eq('id', id).select('id'))
  return { error }
}

// Soft-delete admin (deleted_at).
export async function adminSoftDeleteCommunityRecipe(id) {
  const { error } = auMoinsUneLigne(await supabase
    .from('custom_recipes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select('id'))
  return { error }
}

// Officials — admin pagination + filtres (admin Base Recipes panel).
// Tri côté base, sur tout le catalogue (audit ADM-10 : l'écran ne triait que
// la page affichée). Les favoris, eux, se comptent page par page : leur tri
// reste à l'écran, et dit « cette page ».
const ORDRES_DES_RECETTES = { name: ['name->>fr', 'id'], type: ['type', 'id'] }

export async function adminFindOfficialRecipesPaginated({
  page = 0,
  pageSize = 50,
  search = '',
  sort = 'id',
  type = '',
  difficulty = '',
  timeRange = '',
  missingImage = false,
} = {}) {
  let query = supabase
    .from('base_recipes')
    .select(
      'id, name, emoji, time_min, prep_time_min, cook_time_min, difficulty, type, ' +
      'servings, country, description, allergens, diet, status, ingredients, steps, image_url, ' +
      // 🔴 Colonnes de PROMOTION/PATERNITÉ, ajoutées le 2026-08-28. Elles ne
      // sont pas affichées par le formulaire, mais elles doivent transiter :
      // `base_recipes` est une VUE à trigger INSTEAD OF, dont le
      // `ON CONFLICT DO UPDATE SET col = EXCLUDED.col` réécrit TOUTES les
      // colonnes. Une colonne non chargée repartait donc à NULL à la première
      // édition admin — le badge « Authentique » (piloté par
      // `promoted_from_id`) et le crédit à l'auteur d'origine disparaissaient.
      // ⛔ Sur une VUE, contrairement à une table, l'omission est DESTRUCTRICE.
      'promoted_from_id, promoted_at, original_author_id, original_author_name',
      { count: 'exact' }
    )
    .range(page * pageSize, (page + 1) * pageSize - 1)
  for (const colonne of ORDRES_DES_RECETTES[sort] ?? ['id']) query = query.order(colonne)
  if (search.trim()) {
    // Une virgule ou une parenthèse cassait le filtre (400) : l'écran disait
    // « Aucune recette » (audit ADM-10).
    const m = motifDansOu(search)
    query = query.or(`id.ilike.${m},name->>fr.ilike.${m}`)
  }
  if (type)       query = query.eq('type', type)
  if (difficulty) query = query.eq('difficulty', difficulty)
  if (timeRange === 'quick')  query = query.lte('time_min', 20)
  if (timeRange === 'medium') query = query.gte('time_min', 21).lte('time_min', 45)
  if (timeRange === 'long')   query = query.gte('time_min', 46)
  if (missingImage) query = query.or('image_url.is.null,image_url.eq.')
  const { data, error, count } = await query
  return { data: data ?? [], count: count ?? 0, error }
}

// Upsert official (admin add/edit). INSTEAD OF trigger gère le ON CONFLICT.
export async function adminUpsertOfficialRecipe(row) {
  const { error } = await supabase.from('base_recipes').insert(row)
  return { error }
}

// Delete official (hard delete admin).
export async function adminDeleteOfficialRecipe(id) {
  const { error } = auMoinsUneLigne(await supabase.from('base_recipes').delete().eq('id', id).select('id'))
  return { error }
}

// Promote community recipe → official (wrapper RPC promote_recipe_to_base).
export async function adminPromoteCommunityRecipeToOfficial(customRecipeId) {
  const { data, error } = await supabase.rpc('promote_recipe_to_base', {
    p_custom_id: customRecipeId,
  })
  if (error) {
    if (import.meta.env.DEV) console.error('[adminPromoteCommunityRecipeToOfficial]', error)
    return { error }
  }
  return { data, error: null }
}
