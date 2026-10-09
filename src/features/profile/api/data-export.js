// RGPD — droit à la portabilité (Article 20)
// Agrège toutes les données personnelles d'un utilisateur en un objet JSON
// téléchargeable depuis le profil. Self-service, pas de demande email à
// traiter manuellement.
//
// Toutes les requêtes sont filtrées par RLS via auth.uid() : l'utilisateur
// n'obtient que ses propres données. Aucun accès cross-user possible.

import { supabase } from '@shared/lib/supabase/client'

/**
 * Récupère toutes les données personnelles de l'utilisateur connecté
 * et les renvoie sous forme d'objet JSON structuré.
 *
 * @param {string} userId - L'UUID Supabase de l'utilisateur
 * @returns {Promise<{ok: true, data: object, size: number}>}
 */
export async function exportUserData(userId) {
  if (!userId) throw new Error('userId required')

  // 1. Récupérer les tickets pour pouvoir filtrer les messages associés
  const { data: tickets } = await supabase.from('support_tickets')
    .select('id, type, title, status, has_unread_user, created_at, updated_at')
    .eq('user_id', userId)

  const ticketIds = (tickets ?? []).map(t => t.id)

  // 2. Récupérer en parallèle les autres tables
  const [
    { data: profile },
    { data: stock },
    { data: favorites },
    { data: customRecipes },
    { data: basket },
    { data: leftovers },
    { data: messages },
    { data: shoppingLists },
    { data: pushSubscriptions },
  ] = await Promise.all([
    // Allow-list délibérée (pas select('*')) : n'exporte que les données
    // fournies/générées par l'usage de l'utilisateur (RGPD Art. 20). Exclut
    // l'état interne admin/sécurité/modération (role, banned, special_role,
    // restore_token, stripe_customer_id, community_muted_until,
    // inactive_warned_at, deleted_at, username_confirmed,
    // push_last_variant_index) — fail-safe pour toute future colonne
    // sensible ajoutée à `profiles` (elle n'apparaît pas ici par défaut).
    supabase.from('profiles')
      .select('username, avatar_id, created_at, updated_at, password_changed_at, ' +
        'allergen_prefs, language, last_login_at, consent_terms_accepted_at, ' +
        'consent_privacy_accepted_at, community_terms_accepted_at, ' +
        'subscription_status, trial_ends_at, subscription_ends_at, subscription_plan, ' +
        'monthly_budget, per_trip_budget, community_bio, profiling_opted_out, ' +
        'banner_id, unlocked_banners, country_code, push_preferences')
      .eq('id', userId).maybeSingle(),
    supabase.from('user_stock')
      .select('ingredient_id, added_at, expires_at')
      .eq('user_id', userId),
    supabase.from('user_favorites')
      .select('recipe_id')
      .eq('user_id', userId),
    supabase.from('custom_recipes')
      .select('id, title, data, moderation_status, is_public, admin_modified, created_at, updated_at, deleted_at')
      .eq('user_id', userId),
    supabase.from('basket_items')
      .select('id, recipe_id, recipe_name, recipe_emoji, ingredient_id, label, amount, unit, price, checked, added_at')
      .eq('user_id', userId),
    supabase.from('user_leftovers')
      .select('id, name, emoji, ingredient_id, dlc_days, created_at, expires_at, deleted_at')
      .eq('user_id', userId),
    ticketIds.length > 0
      ? supabase.from('support_messages')
          .select('id, ticket_id, sender_id, is_admin, content, created_at')
          .in('ticket_id', ticketIds)
      : Promise.resolve({ data: [] }),
    // Listes de courses sauvegardées (RGPD Art. 20 — portabilité)
    supabase.from('shopping_lists')
      .select('id, name, items, created_at, updated_at')
      .eq('user_id', userId),
    // Abonnements push : endpoint = identifiant d'appareil (donnée
    // personnelle). p256dh/auth_key exclus : matériel cryptographique
    // sans valeur de portabilité pour l'utilisateur.
    supabase.from('push_subscriptions')
      .select('endpoint, created_at, last_seen_at')
      .eq('user_id', userId),
  ])

  const data = {
    export_metadata: {
      generated_at: new Date().toISOString(),
      schema_version: '1.0',
      app_name: 'Fridge+',
      user_id: userId,
      note: 'Données personnelles exportées conformément à l\'Article 20 du RGPD (droit à la portabilité). Format JSON structuré.',
    },
    profile: profile ?? null,
    stock: (stock ?? []).map(r => r.ingredient_id),
    favorites: (favorites ?? []).map(r => r.recipe_id),
    custom_recipes: customRecipes ?? [],
    basket_items: basket ?? [],
    leftovers: leftovers ?? [],
    support_tickets: tickets ?? [],
    support_messages: messages ?? [],
    shopping_lists: shoppingLists ?? [],
    push_subscriptions: pushSubscriptions ?? [],
  }

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
