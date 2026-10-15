// RGPD — droit d'accès et droit à la portabilité (articles 15 et 20)
// Agrège les données personnelles d'un utilisateur en un objet JSON
// téléchargeable depuis le profil. Self-service, pas de demande email à
// traiter manuellement.
//
// Toutes les requêtes sont filtrées par RLS via auth.uid() : l'utilisateur
// n'obtient que ses propres données. Aucun accès cross-user possible.
//
// 🔴 2026-10-04 (audit CPT-08) — l'export est COMPLET ou il est REFUSÉ.
// Avant, l'erreur d'aucune requête n'était lue : une lecture refusée laissait un
// trou dans le fichier, et l'écran annonçait « Téléchargement démarré ». Il
// manquait aussi le journal de cuisine, les dépenses, les messages de la
// communauté, les avis et les notifications.
//
// « Complet » vaut aussi pour un gros compte : le serveur plafonne chaque
// réponse (1 000 lignes par défaut chez Supabase) SANS le dire. Chaque liste
// est donc lue page après page, dans un ordre stable (voir `lireTout`).

import { supabase } from '@shared/lib/supabase/client'
import { SUPPORT_EMAIL } from '@shared/lib/contact'

// Chaque jeu de données : sa clé dans le fichier, la table lue, la colonne qui
// désigne le compte, et la liste EXPLICITE des colonnes (jamais `*`) — on
// n'exporte que ce que la personne a fourni ou produit, pas l'état interne de
// modération ou de sécurité. `order` = la colonne qui ordonne la lecture par
// pages ; à défaut `id`, la clé de presque toutes ces tables.
//
// Un test (`data-export-complet.test.js`) lit les types de la base et fait
// tomber la suite si une table qui porte un compte n'est ni ici ni dans
// `NOT_EXPORTED`, ou si une colonne demandée ici n'existe pas — une colonne
// inexistante ferait refuser toute la lecture de sa table, donc tout l'export.
export const EXPORTED_DATASETS = [
  { key: 'stock', table: 'user_stock', owner: 'user_id', columns: 'ingredient_id, added_at, expires_at' },
  { key: 'favorites', table: 'user_favorites', owner: 'user_id', columns: 'recipe_id, created_at' },
  { key: 'custom_recipes', table: 'custom_recipes', owner: 'user_id',
    columns: 'id, title, data, moderation_status, moderation_reason, is_public, admin_modified, consent_to_promote, published_consent_at, published_consent_version, created_at, updated_at, deleted_at' },
  { key: 'basket_items', table: 'basket_items', owner: 'user_id',
    columns: 'id, recipe_id, recipe_name, recipe_emoji, recipe_servings, recipe_servings_initial, ingredient_id, label, amount, amount_initial, unit, price, checked, added_at' },
  { key: 'leftovers', table: 'user_leftovers', owner: 'user_id', columns: 'id, name, emoji, ingredient_id, dlc_days, created_at, expires_at, deleted_at' },
  { key: 'shopping_lists', table: 'shopping_lists', owner: 'user_id', columns: 'id, name, items, created_at, updated_at' },
  { key: 'shared_baskets', table: 'shared_baskets', owner: 'user_id', columns: 'id, payload, expires_at, created_at' },
  { key: 'cooking_logs', table: 'cooking_logs', owner: 'user_id', columns: 'id, recipe_id, recipe_source, servings, cooked_at' },
  { key: 'spending_events', table: 'spending_events', owner: 'user_id', columns: 'id, occurred_at, total_eur, items_count, items_json' },
  { key: 'stock_events', table: 'stock_events', owner: 'user_id', columns: 'id, ingredient_id, removed_at, outcome, est_price_eur, est_carbon_g' },
  { key: 'community_posts', table: 'community_posts', owner: 'user_id',
    columns: 'id, category, title, body, recipe_id, photo_url, likes_count, replies_count, created_at, updated_at, deleted_at, deleted_by_admin' },
  { key: 'community_replies', table: 'community_replies', owner: 'user_id',
    columns: 'id, post_id, parent_reply_id, body, likes_count, created_at, updated_at, deleted_at, deleted_by_admin' },
  // Avis sur les recettes, réactions et « j'aime » de la communauté.
  { key: 'engagement', table: 'engagement', owner: 'user_id',
    columns: 'id, type, target_post_id, target_reply_id, target_recipe_id, emoji, rating, body, created_at, updated_at, deleted_at, deleted_by_admin' },
  // Pas de colonne `id` : la clé est (compte, compte bloqué).
  { key: 'community_blocks', table: 'community_blocks', owner: 'user_id', columns: 'blocked_user_id, created_at', order: 'blocked_user_id' },
  { key: 'notifications', table: 'notifications', owner: 'recipient_id', columns: 'id, type, title, body, link, metadata, read_at, created_at, expires_at' },
  { key: 'support_tickets', table: 'support_tickets', owner: 'user_id',
    columns: 'id, type, title, status, target_type, target_id, reason_key, has_unread_user, created_at, updated_at' },
  // Les messages se lisent par ticket (voir `exportUserData`) : ceux des tickets du compte.
  { key: 'support_messages', table: 'support_messages', owner: null, columns: 'id, ticket_id, sender_id, is_admin, content, created_at' },
  // Abonnements push : endpoint = identifiant d'appareil (donnée personnelle).
  // p256dh/auth_key exclus : matériel cryptographique sans valeur de
  // portabilité pour l'utilisateur.
  { key: 'push_subscriptions', table: 'push_subscriptions', owner: 'user_id', columns: 'endpoint, created_at, last_seen_at' },
]

// Tables qui portent des données du compte mais que le compte ne peut PAS lire
// lui-même : la base les réserve à l'admin. Elles ne sont donc pas dans le
// fichier, et le fichier le dit (`export_metadata.not_included`). Les fournir en
// self-service demande une lecture côté serveur — à faire.
export const NOT_EXPORTED = {
  activity_logs: 'Journal des actions faites sur le compte (connexions, exports, suppressions).',
  ai_usage_log: 'Décompte des appels aux fonctions d’IA faits pour le compte (substituts, modération).',
  email_log: 'Décompte des e-mails envoyés au compte (plafond quotidien), effacé au bout de 7 jours.',
  product_events: 'Mesure d’usage de l’application rattachée au compte.',
  subscription_events: 'Historique des changements d’abonnement.',
  special_access: 'Accès particuliers accordés par l’équipe (testeur, partenaire).',
}

// Allow-list délibérée (pas select('*')) : n'exporte que les données
// fournies/générées par l'usage de l'utilisateur (RGPD Art. 20). Exclut
// l'état interne admin/sécurité/modération (role, banned, special_role,
// restore_token, stripe_customer_id, community_muted_until,
// inactive_warned_at, deleted_at, username_confirmed,
// push_last_variant_index) — fail-safe pour toute future colonne
// sensible ajoutée à `profiles` (elle n'apparaît pas ici par défaut).
const PROFILE_COLUMNS = 'username, avatar_id, created_at, updated_at, password_changed_at, ' +
  'allergen_prefs, allergen_consent_at, language, last_login_at, consent_terms_accepted_at, ' +
  'consent_privacy_accepted_at, community_terms_accepted_at, ' +
  'subscription_status, trial_ends_at, subscription_ends_at, subscription_plan, ' +
  'monthly_budget, per_trip_budget, community_bio, profiling_opted_out, ' +
  'banner_id, unlocked_banners, country_code, push_preferences, fridge_shape'

// Une lecture ; un refus ou un appel qui lève (réseau coupé) rend une erreur.
async function lire(requete) {
  try {
    const { data, error, count } = await requete
    return { data: error ? null : data, error: error ?? null, count: count ?? null }
  } catch (err) {
    return { data: null, error: err ?? new Error('unknown'), count: null }
  }
}

const PAGE = 1000
// Garde-fou contre une boucle sans fin si une base rendait toujours des
// lignes : 500 pages, soit 500 000 lignes pour une seule table d'un seul compte.
const PAGES_MAX = 500
// Identifiants de tickets par requête : au-delà, l'adresse devient trop longue.
const TICKETS_PAR_REQUETE = 100

// Lit TOUTES les lignes d'une liste, page après page.
//
// Le serveur ne rend jamais plus qu'un certain nombre de lignes par réponse, et
// ne dit pas qu'il a coupé. On lui demande donc de COMPTER (`count: 'exact'`,
// à poser par l'appelant) et on lit jusqu'à avoir ce qu'il a compté — quel que
// soit son plafond, même plus bas que `PAGE`. S'il ne compte pas, on lit
// jusqu'à ce qu'il n'ait plus rien à rendre.
//   construire : () => une requête neuve, déjà filtrée ET ordonnée.
async function lireTout(construire) {
  const lignes = []
  for (let page = 0; page < PAGES_MAX; page++) {
    const { data, error, count } = await lire(construire().range(lignes.length, lignes.length + PAGE - 1))
    if (error) return { data: null, error }
    lignes.push(...(data ?? []))
    const plusRien = !data || data.length === 0
    if (plusRien || (typeof count === 'number' && lignes.length >= count)) return { data: lignes, error: null }
  }
  return { data: null, error: new Error('too_many_rows') }
}

/**
 * Récupère les données personnelles de l'utilisateur connecté.
 *
 * @param {string} userId - L'UUID Supabase de l'utilisateur
 * @returns {Promise<{ok: true, data: object, size: number} | {ok: false, incomplete: string[]}>}
 *   `incomplete` = les tables qui n'ont pas pu être lues. Aucun fichier n'est
 *   produit : un export avec un trou ne se distinguerait pas d'un export complet.
 */
export async function exportUserData(userId) {
  if (!userId) throw new Error('userId required')

  const parTable = new Map()
  const messages = EXPORTED_DATASETS.find((jeu) => jeu.table === 'support_messages')

  // 1. Tout ce qui se lit directement par la colonne du compte, en parallèle.
  const directs = EXPORTED_DATASETS.filter((jeu) => jeu.owner)
  const [profil, ...lectures] = await Promise.all([
    lire(supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle()),
    ...directs.map((jeu) => lireTout(() => supabase.from(jeu.table)
      .select(jeu.columns, { count: 'exact' })
      .eq(jeu.owner, userId)
      .order(jeu.order ?? 'id', { ascending: true }))),
  ])
  parTable.set('profiles', profil)
  directs.forEach((jeu, i) => parTable.set(jeu.table, lectures[i]))

  // 2. Les messages du support, par les tickets du compte — par paquets de
  //    tickets, l'un après l'autre.
  const tickets = parTable.get('support_tickets')
  if (tickets.error) {
    parTable.set('support_messages', { data: null, error: tickets.error })
  } else {
    const ticketIds = (tickets.data ?? []).map((ticket) => ticket.id)
    const lus = { data: [], error: null }
    for (let i = 0; i < ticketIds.length && !lus.error; i += TICKETS_PAR_REQUETE) {
      const paquet = ticketIds.slice(i, i + TICKETS_PAR_REQUETE)
      const lecture = await lireTout(() => supabase.from('support_messages')
        .select(messages.columns, { count: 'exact' })
        .in('ticket_id', paquet)
        .order(messages.order ?? 'id', { ascending: true }))
      if (lecture.error) { lus.data = null; lus.error = lecture.error } else lus.data.push(...lecture.data)
    }
    parTable.set('support_messages', lus)
  }

  const incomplete = [...parTable].filter(([, lecture]) => lecture.error).map(([table]) => table)
  if (incomplete.length > 0) return { ok: false, incomplete }

  const data = {
    export_metadata: {
      generated_at: new Date().toISOString(),
      schema_version: '1.1',
      app_name: 'Fridge+',
      user_id: userId,
      note: 'Données personnelles exportées conformément aux articles 15 et 20 du RGPD (droit d’accès et droit à la portabilité). Format JSON structuré.',
      not_included: NOT_EXPORTED,
      not_included_note: `Ces données existent mais ne peuvent pas être lues depuis ton compte. Pour les obtenir, écris à ${SUPPORT_EMAIL}.`,
    },
    profile: profil.data ?? null,
  }
  for (const jeu of EXPORTED_DATASETS) data[jeu.key] = parTable.get(jeu.table).data ?? []

  // `handleExport` (profile-account-page.jsx) attend ce contrat { ok, data,
  // size } — l'ancien retour (objet brut) faisait échouer `result?.ok` à
  // CHAQUE appel, même quand toutes les requêtes ci-dessus réussissaient
  // (bug remonté 2026-07-10 : "Erreur. Réessaie plus tard." systématique).
  const json = JSON.stringify(data)
  return { ok: true, data, size: json.length }
}

/**
 * Déclenche le téléchargement d'un fichier JSON dans le navigateur.
 * Utilise l'API Blob + URL.createObjectURL pour générer un lien
 * téléchargeable côté client, sans serveur.
 *
 * @param {object} data - L'objet JSON à télécharger
 * @param {string} filename - Le nom du fichier (sans extension)
 */
export function triggerJsonDownload(data, filename = 'fridge-plus-mes-donnees') {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  const date = new Date().toISOString().split('T')[0]
  a.href = url
  a.download = `${filename}-${date}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
