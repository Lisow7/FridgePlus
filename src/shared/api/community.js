import { supabase } from '@shared/lib/supabase/client'
import {
  findCommunityRecipesForResolution,
  findCommunityRecipeNamesByIds,
  findPublicCommunityRecipesAttachable,
  findPublicCommunityRecipesByUser,
} from '@shared/lib/recipes/recipes-repository'

// Communauté (posts, réponses, likes).
//
// Conventions :
//   • Tous les `select` filtrent `deleted_at IS NULL` côté requête (la RLS
//     l'impose aussi mais on rend l'intention explicite).
//   • Auteur = jointure profile (username, avatar_id) — limited disclosure
//     (pas d'email).
//   • Pagination simple via offset/limit. Pour un MVP avec quelques
//     centaines de posts, suffisant. Cursor-based à voir si ça grossit.

// embed profiles via FK explicite `!user_id` pour lever
// l'ambiguïté quand Supabase détecte plusieurs relations entre les deux
// tables (community_replies et community_likes pointent aussi vers
// profiles). Sans cet hint, l'API renvoie l'erreur :
// « Could not embed because more than one relationship was found »
const POST_SELECT = 'id, user_id, category, title, body, recipe_id, likes_count, replies_count, created_at, updated_at, profile:profiles!user_id(username, avatar_id)'
// likes_count + parent_reply_id ajoutés
const REPLY_SELECT = 'id, post_id, user_id, body, parent_reply_id, likes_count, created_at, updated_at, profile:profiles!user_id(username, avatar_id)'

const VALID_CATEGORIES = ['tips', 'questions', 'pride', 'feedback', 'general']

// ── Posts : list + get ─────────────────────────────────────────────────

/**
 * Liste les posts (feed).
 * @param {object} opts
 * @param {string=} opts.category — filtre catégorie ('all' ou null = pas de filtre)
 * @param {'recent'|'popular'} opts.sort — défaut 'recent'
 * @param {number=} opts.offset
 * @param {number=} opts.limit — défaut 20
 */
export async function listPosts({ category, sort = 'recent', offset = 0, limit = 20 } = {}) {
  let q = supabase.from('community_posts').select(POST_SELECT).is('deleted_at', null)
  if (category && category !== 'all' && VALID_CATEGORIES.includes(category)) {
    q = q.eq('category', category)
  }
  if (sort === 'popular') {
    q = q.order('likes_count', { ascending: false }).order('created_at', { ascending: false })
  } else {
    q = q.order('created_at', { ascending: false })
  }
  q = q.range(offset, offset + limit - 1)
  const { data, error } = await q
  if (error) {
    if (import.meta.env.DEV) console.error('[community] listPosts:', error.message)
    return []
  }
  return data ?? []
}

export async function getPost(postId) {
  const { data, error } = await supabase
    .from('community_posts')
    .select(POST_SELECT)
    .eq('id', postId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) {
    if (import.meta.env.DEV) console.error('[community] getPost:', error.message)
    return null
  }
  return data
}

// ── Posts : create / update / delete ───────────────────────────────────

export async function createPost(userId, { category, title, body, recipe_id }) {
  if (!userId || !VALID_CATEGORIES.includes(category)) return { error: 'invalid' }
  const row = { user_id: userId, category, title, body }
  if (recipe_id) row.recipe_id = recipe_id
  const { data, error } = await supabase
    .from('community_posts')
    .insert(row)
    .select(POST_SELECT)
    .single()
  if (error) return { error: error.message }
  return { data }
}

export async function updatePost(postId, { title, body, category, recipe_id }) {
  const patch = {}
  if (title !== undefined) patch.title = title
  if (body !== undefined) patch.body = body
  if (category !== undefined && VALID_CATEGORIES.includes(category)) patch.category = category
  if (recipe_id !== undefined) patch.recipe_id = recipe_id ?? null
  const { data, error } = await supabase
    .from('community_posts')
    .update(patch)
    .eq('id', postId)
    .select(POST_SELECT)
    .single()
  if (error) return { error: error.message }
  return { data }
}

/** Soft delete. L'auteur peut restaurer dans les 24h via restorePost. */
export async function deletePost(postId) {
  const { error } = await supabase
    .from('community_posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', postId)
  if (error) return { error: error.message }
  return { ok: true }
}

export async function restorePost(postId) {
  const { error } = await supabase
    .from('community_posts')
    .update({ deleted_at: null })
    .eq('id', postId)
  if (error) return { error: error.message }
  return { ok: true }
}

// ── Replies ────────────────────────────────────────────────────────────

export async function listReplies(postId) {
  const { data, error } = await supabase
    .from('community_replies')
    .select(REPLY_SELECT)
    .eq('post_id', postId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) {
    if (import.meta.env.DEV) console.error('[community] listReplies:', error.message)
    return []
  }
  return data ?? []
}

/**
 * v3.16.0 — Crée une réponse au post ou à une autre réponse.
 * @param {string=} parentReplyId — null = réponse directe au post.
 *   Le trigger BDD bloque si parent a lui-même un parent (1 niveau max).
 */
export async function createReply(userId, postId, body, parentReplyId = null) {
  if (!userId || !postId || !body) return { error: 'invalid' }
  const row = { user_id: userId, post_id: postId, body }
  if (parentReplyId) row.parent_reply_id = parentReplyId
  const { data, error } = await supabase
    .from('community_replies')
    .insert(row)
    .select(REPLY_SELECT)
    .single()
  if (error) return { error: error.message }
  return { data }
}

export async function deleteReply(replyId) {
  const { error } = await supabase
    .from('community_replies')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', replyId)
  if (error) return { error: error.message }
  return { ok: true }
}

// ── Likes (legacy — conservé pour la rétrocompatibilité des réponses) ─────────

/** Renvoie l'ensemble des post_ids likés par l'utilisateur (pour init UI). */
// Refonte BDD S6c — PR-DB-16a : SELECT engagement filtré type='post_like'
// au lieu de community_likes (sync trigger PR-DB-15 garantit no drift).
// Alias post_id:target_post_id pour conserver le shape côté consumer.
export async function listMyLikedPostIds(userId) {
  if (!userId) return new Set()
  const { data, error } = await supabase
    .from('engagement')
    .select('post_id:target_post_id')
    .eq('type', 'post_like')
    .eq('user_id', userId)
  if (error) return new Set()
  return new Set((data ?? []).map(r => r.post_id))
}

// Refonte BDD Sprint 6e — PR-DB-17a : cutover writes vers engagement.
// UNIQUE engagement_unique_post_engagement (user_id, type, target_post_id)
// permet l'upsert. `type` doit être dans onConflict : l'index couvre à la
// fois post_like et reaction sur la même colonne target_post_id, et n'est
// plus partiel depuis le fix 2026-07-16 (cf.
// 20260716_fix_engagement_upsert_conflict.sql).
export async function likePost(userId, postId) {
  const { error } = await supabase
    .from('engagement')
    .upsert({ user_id: userId, type: 'post_like', target_post_id: postId }, {
      onConflict: 'user_id,type,target_post_id',
      ignoreDuplicates: true,
    })
  if (error) return { error: error.message }
  return { ok: true }
}

// ── Réactions émoji (v3.164.0) ────────────────────────────────────────────────

const VALID_EMOJIS = ['❤️', '😋', '🔥', '😮', '👏']

/** Renvoie une Map<postId, emoji> pour tous les posts réactionnés par le user. */
// Refonte BDD S6c — PR-DB-16a : SELECT engagement filtré type='reaction'
// au lieu de post_reactions.
export async function listMyPostReactions(userId) {
  if (!userId) return new Map()
  const { data, error } = await supabase
    .from('engagement')
    .select('post_id:target_post_id, emoji')
    .eq('type', 'reaction')
    .eq('user_id', userId)
  if (error) return new Map()
  return new Map((data ?? []).map(r => [r.post_id, r.emoji]))
}

/** Pose ou change une réaction (upsert). */
// Refonte BDD S6e — PR-DB-17a : cutover write vers engagement.
// Cf. commentaire de likePost ci-dessus (fix 2026-07-16) : même index
// partagé (user_id, type, target_post_id), `type` requis dans onConflict.
export async function reactToPost(userId, postId, emoji) {
  if (!userId || !postId || !VALID_EMOJIS.includes(emoji)) return { error: 'invalid' }
  const { error } = await supabase
    .from('engagement')
    .upsert(
      { user_id: userId, type: 'reaction', target_post_id: postId, emoji },
      { onConflict: 'user_id,type,target_post_id' }
    )
  if (error) return { error: error.message }
  return { ok: true }
}

/** Retire la réaction du user sur un post. */
// Refonte BDD S6e — PR-DB-17a : cutover write vers engagement.
export async function removePostReaction(userId, postId) {
  if (!userId || !postId) return { error: 'invalid' }
  const { error } = await supabase
    .from('engagement')
    .delete()
    .eq('user_id', userId)
    .eq('type', 'reaction')
    .eq('target_post_id', postId)
  if (error) return { error: error.message }
  return { ok: true }
}

/** Renvoie [{emoji, count}] triés par count desc pour un lot de postIds. */
// Refonte BDD S6c — PR-DB-16a : SELECT engagement filtré type='reaction'.
export async function getPostsReactionSummary(postIds) {
  if (!postIds?.length) return {}
  const { data, error } = await supabase
    .from('engagement')
    .select('post_id:target_post_id, emoji')
    .eq('type', 'reaction')
    .in('target_post_id', postIds)
  if (error) return {}
  // Agréger côté client : { postId: { emoji: count } }
  const result = {}
  for (const { post_id, emoji } of data ?? []) {
    if (!result[post_id]) result[post_id] = {}
    result[post_id][emoji] = (result[post_id][emoji] ?? 0) + 1
  }
  return result
}

// ── v3.16.0 — Likes sur réponses ───────────────────────────────────────

/**
 * Renvoie l'ensemble des reply_ids likés par l'utilisateur, restreint
 * à un postId pour économiser le payload (on ne charge que ce dont la
 * vue Detail a besoin).
 */
// Refonte BDD S6c — PR-DB-16a : SELECT engagement filtré type='reply_like'.
// Le inner join community_replies filtre par post_id côté SQL.
export async function listMyLikedReplyIds(userId, postId) {
  if (!userId || !postId) return new Set()
  const { data, error } = await supabase
    .from('engagement')
    .select('reply_id:target_reply_id, community_replies!inner(post_id)')
    .eq('type', 'reply_like')
    .eq('user_id', userId)
    .eq('community_replies.post_id', postId)
  if (error) {
    if (import.meta.env.DEV) console.error('[community] listMyLikedReplyIds:', error.message)
    return new Set()
  }
  return new Set((data ?? []).map(r => r.reply_id))
}

// Refonte BDD S6e — PR-DB-17a : cutover writes vers engagement.
// UNIQUE engagement_unique_reply_like (user_id, type, target_reply_id),
// non partiel depuis le fix 2026-07-16 (cf.
// 20260716_fix_engagement_upsert_conflict.sql) — `type` requis dans onConflict.
export async function likeReply(userId, replyId) {
  const { error } = await supabase
    .from('engagement')
    .upsert({ user_id: userId, type: 'reply_like', target_reply_id: replyId }, {
      onConflict: 'user_id,type,target_reply_id',
      ignoreDuplicates: true,
    })
  if (error) return { error: error.message }
  return { ok: true }
}

export async function unlikeReply(userId, replyId) {
  const { error } = await supabase
    .from('engagement')
    .delete()
    .eq('user_id', userId)
    .eq('type', 'reply_like')
    .eq('target_reply_id', replyId)
  if (error) return { error: error.message }
  return { ok: true }
}

export async function unlikePost(userId, postId) {
  const { error } = await supabase
    .from('engagement')
    .delete()
    .eq('user_id', userId)
    .eq('type', 'post_like')
    .eq('target_post_id', postId)
  if (error) return { error: error.message }
  return { ok: true }
}

// ── Anti-spam ──────────────────────────────────────────────────────────

export async function canPost(userId) {
  if (!userId) return false
  const { data, error } = await supabase.rpc('community_can_post', { uid: userId })
  if (error) return false
  return data === true
}

export async function canReply(userId) {
  if (!userId) return false
  const { data, error } = await supabase.rpc('community_can_reply', { uid: userId })
  if (error) return false
  return data === true
}

// ── Signalements (user → admin via support_tickets) ────────────────────

const VALID_REPORT_REASONS = ['spam', 'inappropriate', 'harassment', 'plagiarism', 'wrong_info', 'other']

/**
 * Signale un post à l'admin. Réutilise support_tickets (target_type =
 * 'community_post', reason_key, body optionnel comme contexte).
 */
export async function reportPost(userId, postId, reasonKey, contextBody) {
  if (!userId || !postId || !VALID_REPORT_REASONS.includes(reasonKey)) {
    return { error: 'invalid' }
  }
  const { error } = await supabase.from('support_tickets').insert({
    user_id: userId,
    type: 'report',
    target_type: 'community_post',
    target_id: postId,
    reason_key: reasonKey,
    body: contextBody?.trim() || null,
    status: 'open',
  })
  if (error) return { error: error.message }
  return { ok: true }
}

export async function reportReply(userId, replyId, reasonKey, contextBody) {
  if (!userId || !replyId || !VALID_REPORT_REASONS.includes(reasonKey)) {
    return { error: 'invalid' }
  }
  const { error } = await supabase.from('support_tickets').insert({
    user_id: userId,
    type: 'report',
    target_type: 'community_reply',
    target_id: replyId,
    reason_key: reasonKey,
    body: contextBody?.trim() || null,
    status: 'open',
  })
  if (error) return { error: error.message }
  return { ok: true }
}

/**
 * v3.166.3 — Signale le profil communauté d'un autre utilisateur.
 * Réutilise support_tickets, target_type='community_profile'.
 * Auto-signalement bloqué côté UI (bouton caché si current user).
 */
export async function reportProfile(userId, targetUserId, reasonKey, contextBody) {
  if (!userId || !targetUserId || !VALID_REPORT_REASONS.includes(reasonKey)) {
    return { error: 'invalid' }
  }
  if (userId === targetUserId) return { error: 'invalid' }
  const { error } = await supabase.from('support_tickets').insert({
    user_id: userId,
    type: 'report',
    target_type: 'community_profile',
    target_id: targetUserId,
    reason_key: reasonKey,
    body: contextBody?.trim() || null,
    status: 'open',
  })
  if (error) return { error: error.message }
  return { ok: true }
}

/**
 * Vérifie si le user est muté de la communauté.
 * @returns {Promise<{ muted: boolean, until: string|null }>}
 */
export async function getMyMuteStatus(userId) {
  if (!userId) return { muted: false, until: null }
  const { data, error } = await supabase
    .from('profiles')
    .select('community_muted_until')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data?.community_muted_until) return { muted: false, until: null }
  const muted = new Date(data.community_muted_until) > new Date()
  return { muted, until: data.community_muted_until }
}

// ── Charte communauté (v3.15.2) ────────────────────────────────────────

/**
 * Récupère la date d'acceptation de la charte par l'utilisateur.
 * @returns {Promise<string|null>} timestamptz ISO ou null si pas accepté
 */
export async function getCommunityTermsAcceptedAt(userId) {
  if (!userId) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('community_terms_accepted_at')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data.community_terms_accepted_at ?? null
}

/**
 * Marque la charte comme acceptée (timestamp = now). Preuve RGPD.
 * Côté RLS, le user ne peut update que sa propre row (policy existante
 * sur profiles).
 */
export async function acceptCommunityTerms(userId) {
  if (!userId) return { error: 'invalid' }
  const nowIso = new Date().toISOString()
  const { error } = await supabase
    .from('profiles')
    .update({ community_terms_accepted_at: nowIso })
    .eq('id', userId)
  if (error) return { error: error.message }
  return { ok: true, acceptedAt: nowIso }
}

/**
 * Révoque l'acceptation de la charte (passe à NULL). L'utilisateur
 * conserve son contenu existant mais retombe en mode lecture seule.
 */
export async function revokeCommunityTerms(userId) {
  if (!userId) return { error: 'invalid' }
  const { error } = await supabase
    .from('profiles')
    .update({ community_terms_accepted_at: null })
    .eq('id', userId)
  if (error) return { error: error.message }
  return { ok: true }
}

// ── Profil communauté (v3.166.0) ──────────────────────────────────────────────

/**
 * Récupère les infos publiques affichées sur la page profil communauté.
 * @returns {Promise<{id, username, avatar_id, community_bio, created_at} | null>}
 */
export async function getCommunityProfile(userId) {
  if (!userId) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_id, banner_id, community_bio, created_at')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    if (import.meta.env.DEV) console.error('[community] getCommunityProfile:', error.message)
    return null
  }
  return data
}

/**
 * Récupère les recettes custom du user (toutes, peu importe statut).
 * Bridge shared/ pour les features qui ne peuvent pas importer features/recipes/
 * directement (cross-feature interdit, cf. ESLint config).
 *
 * Utilisée par profile-activity-page pour résoudre les noms des recettes
 * custom dans le Journal de cuisine (et filtrer les orphelins).
 *
 * Sécurité : RLS recipes_select_own enforce que le user n'accède qu'à
 * SES propres recettes (auth.uid() = user_id).
 */
export async function getMyCustomRecipesForResolution(userId) {
  // Sprint 5f : délégué au repository
  return findCommunityRecipesForResolution(userId)
}

/**
 * Récupère les noms (jsonb multi-langue) d'une liste d'IDs de recettes
 * custom (UUIDs). Utilisé après listPosts pour résoudre les noms des
 * recettes attachées qui ne sont pas dans baseRecipes (= custom/public).
 *
 * Retourne un Map { recipeId → name (objet multi-langue ou string) }.
 * Les IDs introuvables ou supprimés (deleted_at) sont absents du Map.
 *
 * Sécurité : RLS Supabase enforce — seules les recettes publiques
 * approved sont retournées pour les visiteurs (ce qui est exactement
 * ce qu'on veut afficher dans le feed publié).
 */
export async function getRecipeNamesByIds(ids) {
  // Sprint 5f : délégué au repository (centralise la dédup + filtre RGPD)
  return findCommunityRecipeNamesByIds(ids)
}

/**
 * Liste les recettes attachables à un post communauté.
 *
 * Scope (intentionnel) : UNIQUEMENT les recettes validées et publiées
 * par l'admin :
 *   - `moderation_status = 'approved'`
 *   - `is_public = true`
 *
 * On exclut volontairement :
 *   - Les recettes custom privées de l'user (pas validées)
 *   - Les recettes pending (en attente de validation)
 *   - Les recettes rejected
 *
 * Les recettes « promues » par l'admin (RPC `promote_recipe_to_base`)
 * deviennent des base_recipes et sont donc déjà incluses via le param
 * `baseRecipes` du picker ComposeModal — pas besoin de les requérir ici.
 *
 * Format aligné sur getPublicRecipes : { ...data, id, isCustom, _isCommunity }.
 */
export async function listAttachableRecipes() {
  // Sprint 5f : délégué au repository
  return findPublicCommunityRecipesAttachable()
}

/**
 * Liste les recettes publiées (validées + publiques) d'un utilisateur.
 * Format aligné sur getPublicRecipes : { ...data, id }.
 */
export async function listUserPublishedRecipes(userId) {
  // Sprint 5f : délégué au repository
  return findPublicCommunityRecipesByUser(userId)
}

/**
 * Met à jour la bio communauté de l'utilisateur (max 200 chars).
 * Côté BDD un CHECK length<=200 garantit le plafond.
 * @returns {Promise<{ok:true}|{error:string}>}
 */
export async function updateCommunityBio(userId, bio) {
  if (!userId) return { error: 'invalid' }
  const value = (bio ?? '').trim()
  if (value.length > 200) return { error: 'too_long' }
  const { error } = await supabase
    .from('profiles')
    .update({ community_bio: value || null })
    .eq('id', userId)
  if (error) return { error: error.message }
  return { ok: true }
}

// ── Blocage utilisateur communauté (v3.166.3) ─────────────────────────────────

/**
 * Liste les IDs utilisateur bloqués par l'utilisateur courant.
 * Utilisé au mount de CommunityPage pour filtrer le feed.
 */
export async function listMyBlockedUserIds(userId) {
  if (!userId) return new Set()
  const { data, error } = await supabase
    .from('community_blocks')
    .select('blocked_user_id')
    .eq('user_id', userId)
  if (error) {
    if (import.meta.env.DEV) console.error('[community] listMyBlockedUserIds:', error.message)
    return new Set()
  }
  return new Set((data ?? []).map(r => r.blocked_user_id))
}

/** Vérifie si targetUserId est bloqué par userId. */
export async function isUserBlocked(userId, targetUserId) {
  if (!userId || !targetUserId || userId === targetUserId) return false
  const { data, error } = await supabase
    .from('community_blocks')
    .select('user_id')
    .eq('user_id', userId)
    .eq('blocked_user_id', targetUserId)
    .maybeSingle()
  if (error) return false
  return !!data
}

export async function blockUser(userId, targetUserId) {
  if (!userId || !targetUserId) return { error: 'invalid' }
  if (userId === targetUserId) return { error: 'cannot_self_block' }
  const { error } = await supabase
    .from('community_blocks')
    .upsert({ user_id: userId, blocked_user_id: targetUserId }, { onConflict: 'user_id,blocked_user_id', ignoreDuplicates: true })
  if (error) return { error: error.message }
  return { ok: true }
}

export async function unblockUser(userId, targetUserId) {
  if (!userId || !targetUserId) return { error: 'invalid' }
  const { error } = await supabase
    .from('community_blocks')
    .delete()
    .eq('user_id', userId)
    .eq('blocked_user_id', targetUserId)
  if (error) return { error: error.message }
  return { ok: true }
}
