// Hook React pour récupérer des suggestions de substituts d'ingrédient : l'état
// d'écran (chargement, erreur, résultats). L'appel à la fonction edge
// `suggest-substitutes` vit dans `@shared/api/substituts`.

import { useState } from 'react'
import { fetchSubstitutes } from '@shared/api/substituts'

/**
 * @returns {{
 *   suggest: (args: { ingredient_label: string, recipe_context?: string, lang?: string }) => Promise<{ substitutes: Substitute[] }>,
 *   substitutes: Substitute[] | null,
 *   loading: boolean,
 *   error: string | null,
 *   reset: () => void
 * }}
 *
 * Substitute = { label: string, reason: string, ratio: string }
 */
export function useSubstitutes() {
  const [substitutes, setSubstitutes] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function suggest({ ingredient_label, recipe_context, lang = 'fr' }) {
    setLoading(true)
    setError(null)
    setSubstitutes(null)
    try {
      const data = await fetchSubstitutes({ ingredient_label, recipe_context, lang })
      setSubstitutes(data?.substitutes ?? [])
      return data
    } catch (err) {
      setError(err?.message ?? 'error')
      throw err
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setSubstitutes(null)
    setError(null)
  }

  return { suggest, substitutes, loading, error, reset }
}
