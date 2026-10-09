// Vérifier la modération d'un contenu UGC avant soumission : appels à l'Edge
// Function `moderate-content`.
// Textes PUBLICS seulement : une demande au support ne passe plus ici (RGPD-02).
// Le fichier garde son nom, mais ne contient plus de hook : `useModeration`,
// appelé nulle part, a été retiré (lot 14e).

import { supabase } from '@shared/lib/supabase/client'

/**
 * @param {string} content
 * @param {'recipe' | 'profile-bio' | 'review' | 'community-post'} feature
 * @returns {Promise<{ flagged: boolean, categories: object, category_scores: object }>}
 *
 * Sur erreur réseau / 5xx : la fonction lève, et chaque appelant tranche : un
 * avis ou un post public est refusé (aucune file ne le relira), une bio ou une
 * recette passe (une recette repasse par la file de l'admin).
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
