// src/lib/audit.js
// ============================================================
// Audit logger structuré pour `activity_logs`.
// ------------------------------------------------------------
// Centralise toutes les actions admin/user qui doivent laisser une trace
// dans la table append-only `activity_logs`. Garantit deux choses
// essentielles pour la conformité RGPD :
//
//  1. **Vocabulaire fermé** — `AUDIT_ACTIONS` est une whitelist. Tout call
//     avec une action inconnue plante en dev (warning + insert quand même
//     pour ne pas bloquer la prod). Évite la prolifération de noms ad-hoc
//     qui rendraient l'audit illisible.
//
//  2. **Metadata whitelistée** — pour chaque action, `METADATA_KEYS` définit
//     les clés autorisées dans le jsonb. Toute clé non listée est filtrée
//     avant l'INSERT. Évite de logger accidentellement email/IP/données
//     sensibles (RGPD : minimisation).
//
// Ce module ne remplace PAS `sensitiveAudit.js` (qui logue les CONSULTATIONS
// de données sensibles avec un workflow ReasonSelector dédié) ; il couvre
// uniquement les ACTIONS (modifications d'état, événements user/admin).
// ============================================================

import { supabase } from '@shared/lib/supabase/client'

// ─── Whitelist d'actions ─────────────────────────────────────────────────────
//
// Convention : verbe au passé, snake_case. Ajoute ici toute nouvelle action
// avant de l'utiliser. Les actions historiques (déjà loggées avant cette
// whitelist) sont marquées `legacy:` dans les commentaires.

export const AUDIT_ACTIONS = Object.freeze({
  // Compte utilisateur
  ACCOUNT_SOFT_DELETED:    'account_soft_deleted',     // legacy : AuthContext
  ACCOUNT_RESTORED:        'account_restored',
  ACCOUNT_ANONYMIZED:      'account_anonymized',       // RPC anonymize_user (Sprint 8)

  // Recettes admin
  RECIPE_EDITED:           'recipe_edited',            // legacy : admin.js
  RECIPE_APPROVED:         'recipe_approved',          // legacy : admin.js
  RECIPE_REJECTED:         'recipe_rejected',          // legacy : admin.js
  RECIPE_DELETED:          'recipe_deleted',           // legacy : admin.js
  RECIPE_PENDING:          'recipe_pending',           // remise en attente (admin.js)
  RECIPE_PROMOTED:         'recipe_promoted',          // legacy : RPC promote_recipe_to_base
  BASE_RECIPE_ADDED:       'base_recipe_added',        // admin.js
  BASE_RECIPE_UPDATED:     'base_recipe_updated',      // admin.js
  BASE_RECIPE_DELETED:     'base_recipe_deleted',      // legacy : admin.js

  // Ingrédients admin
  INGREDIENT_ADDED:        'ingredient_added',
  INGREDIENT_UPDATED:      'ingredient_updated',
  INGREDIENT_DELETED:      'ingredient_deleted',       // legacy : admin.js

  // Accès spécial (comp, testeur…) accordé ou retiré par l'admin
  SPECIAL_ACCESS_GRANTED:  'special_access_granted',   // admin.js
  SPECIAL_ACCESS_REVOKED:  'special_access_revoked',   // admin.js

  // Données sensibles (consultation, séparé de sensitiveAudit.js mais cohérent)
  SENSITIVE_DATA_ACCESSED: 'sensitive_data_accessed',  // legacy : sensitiveAudit.js

  // Modération communauté
  COMMUNITY_POST_DELETED:  'community_post_deleted',   // soft-delete admin
  COMMUNITY_POST_PURGED:   'community_post_purged',    // hard-delete admin
  COMMUNITY_REPLY_DELETED: 'community_reply_deleted',
  COMMUNITY_REPLY_PURGED:  'community_reply_purged',
  COMMUNITY_USER_MUTED:    'community_user_muted',
  COMMUNITY_USER_UNMUTED:  'community_user_unmuted',

  // Modération avis recettes
  RECIPE_REVIEW_DELETED:   'recipe_review_deleted',    // soft-delete admin
  RECIPE_REVIEW_PURGED:    'recipe_review_purged',     // hard-delete admin

  // Profil — RGPD self-service (Sprint 11 S11.a.5)
  PROFILE_DATA_VIEWED:     'profile_data_viewed',     // entrée sur /profile/compte
  PROFILE_DATA_EXPORTED:   'profile_data_exported',   // RGPD Art. 15 — export JSON
})

// ─── Whitelist de target_type ────────────────────────────────────────────────

export const AUDIT_TARGET_TYPES = Object.freeze({
  USER:            'user',
  RECIPE:          'recipe',           // custom_recipes
  BASE_RECIPE:     'base_recipe',
  INGREDIENT:      'ingredient',
  TICKET:          'ticket',
  REPORT:          'report',           // Sprint 7
  COMMUNITY_POST:  'community_post',   // v3.15.1
  COMMUNITY_REPLY: 'community_reply',  // v3.15.1
  RECIPE_REVIEW:   'recipe_review',    // v3.17.3
})

// ─── Whitelist des clés metadata par action ──────────────────────────────────
//
// Pour chaque action, énumère les clés autorisées dans `metadata` (jsonb).
// Toute clé non listée est silencieusement filtrée avant l'INSERT.
//
// **Anti-pattern à éviter** : ne jamais ajouter `email`, `ip`, `phone`,
// `password`, `token`, `auth_*`. Ces champs n'ont rien à faire dans un audit
// log accessible à plusieurs admins (RGPD : minimisation, principe 1).

const METADATA_KEYS = Object.freeze({
  [AUDIT_ACTIONS.ACCOUNT_SOFT_DELETED]:    ['scheduled_purge_at'],
  [AUDIT_ACTIONS.ACCOUNT_RESTORED]:        ['restored_via'],
  [AUDIT_ACTIONS.ACCOUNT_ANONYMIZED]:      ['recipes_anonymized', 'reason'],
  [AUDIT_ACTIONS.RECIPE_EDITED]:           ['fields_changed'],
  [AUDIT_ACTIONS.RECIPE_APPROVED]:         [],
  [AUDIT_ACTIONS.RECIPE_REJECTED]:         ['reason'],
  [AUDIT_ACTIONS.RECIPE_DELETED]:          ['reason'],
  [AUDIT_ACTIONS.RECIPE_PENDING]:          ['reason'],
  [AUDIT_ACTIONS.RECIPE_PROMOTED]:         ['promoted_from_id', 'original_author_id'],
  [AUDIT_ACTIONS.BASE_RECIPE_ADDED]:       [],
  [AUDIT_ACTIONS.BASE_RECIPE_UPDATED]:     [],
  [AUDIT_ACTIONS.BASE_RECIPE_DELETED]:     ['reason'],
  [AUDIT_ACTIONS.SPECIAL_ACCESS_GRANTED]:  ['role'],
  [AUDIT_ACTIONS.SPECIAL_ACCESS_REVOKED]:  [],
  [AUDIT_ACTIONS.INGREDIENT_ADDED]:        ['subcategory'],
  [AUDIT_ACTIONS.INGREDIENT_UPDATED]:      ['fields_changed'],
  [AUDIT_ACTIONS.INGREDIENT_DELETED]:      ['reason'],
  [AUDIT_ACTIONS.SENSITIVE_DATA_ACCESSED]: ['reason'],
  [AUDIT_ACTIONS.COMMUNITY_POST_DELETED]:  ['reason', 'reported_count'],
  [AUDIT_ACTIONS.COMMUNITY_POST_PURGED]:   ['reason'],
  [AUDIT_ACTIONS.COMMUNITY_REPLY_DELETED]: ['reason', 'reported_count'],
  [AUDIT_ACTIONS.COMMUNITY_REPLY_PURGED]:  ['reason'],
  [AUDIT_ACTIONS.COMMUNITY_USER_MUTED]:    ['reason', 'until_iso', 'duration_days'],
  [AUDIT_ACTIONS.COMMUNITY_USER_UNMUTED]:  ['reason'],
  [AUDIT_ACTIONS.RECIPE_REVIEW_DELETED]:   ['reason', 'reported_count'],
  [AUDIT_ACTIONS.RECIPE_REVIEW_PURGED]:    ['reason'],
  [AUDIT_ACTIONS.PROFILE_DATA_VIEWED]:     ['lang'],
  [AUDIT_ACTIONS.PROFILE_DATA_EXPORTED]:   ['lang', 'size_kb'],
})

// ─── Helpers internes ────────────────────────────────────────────────────────

const KNOWN_ACTIONS = new Set(Object.values(AUDIT_ACTIONS))
const KNOWN_TARGET_TYPES = new Set(Object.values(AUDIT_TARGET_TYPES))

function filterMetadata(action, metadata) {
  if (!metadata || typeof metadata !== 'object') return null
  const allowed = METADATA_KEYS[action]
  if (!allowed || !allowed.length) return null
  const filtered = {}
  let hasAny = false
  for (const key of allowed) {
    if (key in metadata && metadata[key] !== undefined) {
      filtered[key] = metadata[key]
      hasAny = true
    }
  }
  return hasAny ? filtered : null
}

// ─── API publique ────────────────────────────────────────────────────────────

/**
 * Logue une action dans `activity_logs` (table append-only RGPD).
 *
 * @param {string} action — clé de AUDIT_ACTIONS (vocabulaire fermé)
 * @param {object} [opts]
 * @param {string} [opts.targetId] — id de la ressource cible (ex: recipe.id)
 * @param {string} [opts.targetType] — type, à choisir dans AUDIT_TARGET_TYPES
 * @param {object} [opts.metadata] — données contextuelles, filtrées par
 *   METADATA_KEYS[action] avant l'INSERT (jamais d'email/IP/etc.)
 * @returns {Promise<{ error: object|null }>}
 */
export async function logAuditAction(action, { targetId, targetType, metadata } = {}) {
  if (!KNOWN_ACTIONS.has(action)) {
    if (import.meta.env?.DEV) {
      console.warn(`[audit] action inconnue : ${action}. Ajoute-la à AUDIT_ACTIONS.`)
    }
  }
  if (targetType && !KNOWN_TARGET_TYPES.has(targetType)) {
    if (import.meta.env?.DEV) {
      console.warn(`[audit] target_type inconnu : ${targetType}. Ajoute-le à AUDIT_TARGET_TYPES.`)
    }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { message: 'Not authenticated' } }

  const filteredMetadata = filterMetadata(action, metadata)

  const row = {
    user_id:     user.id,
    action,
    target_id:   targetId ? String(targetId) : null,
    target_type: targetType ?? null,
  }
  if (filteredMetadata) row.metadata = filteredMetadata

  const { error } = await supabase.from('activity_logs').insert(row)
  if (error && import.meta.env?.DEV) {
    console.error('[audit] insert failed:', error.message)
  }
  return { error }
}

// Exporté pour les tests uniquement.
export const __test__ = { filterMetadata, METADATA_KEYS }
