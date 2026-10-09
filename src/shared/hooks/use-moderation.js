// Hook React pour vérifier la modération d'un contenu UGC avant soumission.
// Wraps l'appel à l'Edge Function `moderate-content`.
// Textes PUBLICS seulement : une demande au support ne passe plus ici (RGPD-02).

import { useState } from 'react'
import { supabase } from '@shared/lib/supabase/client'

/**
 * @returns {{
 *   moderate: (content: string, feature: 'recipe' | 'profile-bio' | 'review' | 'community-post') => Promise<ModerationResult>,
 *   loading: boolean,
 *   error: string | null
 * }}
 *
 * Résultat :
 *   { flagged: boolean, categories: {hate, sexual, ...}, category_scores: {...} }
 *
 * Sur error réseau / 5xx : la fonction throw. Convention recommandée côté caller :
 * fail-open en cas d'erreur (ne pas bloquer une soumission user pour une panne IA).
 */
export function useModeration() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function moderate(content, feature) {
    setLoading(true)
    setError(null)
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('moderate-content', {
        body: { content, feature },
      })
      if (invokeErr) {
        setError(invokeErr.message)
        throw invokeErr
      }
      return data
    } finally {
      setLoading(false)
    }
  }

  return { moderate, loading, error }
}

/**
 * Helper pur (non-hook) pour caller la modération depuis du code non-React.
 * Utilise le client Supabase global.
 */
export async function moderateContent(content, feature) {
  const { data, error } = await supabase.functions.invoke('moderate-content', {
    body: { content, feature },
  })
  if (error) throw error
  return data
}

/**
 * Soumet un avis avec photo pour partage communauté. L'Edge Function
 * modère texte + image, strip l'EXIF, upload et CRÉE elle-même le post
 * (le client ne fournit jamais photo_url — verrouillé côté RLS aussi).
 * @returns {Promise<{flagged: boolean, categories?: object, category_scores?: object, post?: object}>}
 */
export async function submitPhotoPost({ content, imageBase64, recipeId, title }) {
  const { data, error } = await supabase.functions.invoke('moderate-content', {
    body: { content, feature: 'community-post', image_base64: imageBase64, recipe_id: recipeId, title },
  })
  if (error) throw error
  return data
}
