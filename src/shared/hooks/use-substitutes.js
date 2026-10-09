// Hook React pour récupérer des suggestions de substituts d'ingrédient.
// Wraps l'appel à l'Edge Function `suggest-substitutes`.

import { useState } from 'react'
import { supabase } from '@shared/lib/supabase/client'

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
      const { data, error: invokeErr } = await supabase.functions.invoke('suggest-substitutes', {
        body: { ingredient_label, recipe_context, lang },
      })
      if (invokeErr) {
        setError(invokeErr.message)
        throw invokeErr
      }
      setSubstitutes(data?.substitutes ?? [])
      return data
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

/**
 * Helper pur (non-hook) pour caller depuis du code non-React.
 */
export async function fetchSubstitutes({ ingredient_label, recipe_context, lang = 'fr' }) {
  const { data, error } = await supabase.functions.invoke('suggest-substitutes', {
    body: { ingredient_label, recipe_context, lang },
  })
  if (error) throw error
  return data
}
