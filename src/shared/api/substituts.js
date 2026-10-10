import { supabase } from '@shared/lib/supabase/client'

// Les substituts d'un ingrédient, par la fonction edge `suggest-substitutes`.
// Sortie du hook `useSubstitutes` au lot « accès à la base rangés » (audit du
// 2026-10-04, ARCH-13 (6)) : le hook garde l'état d'écran, ce module l'appel.
//
// Substitute = { label: string, reason: string, ratio: string }

/** Lève l'erreur de la fonction ; rend `{ substitutes: Substitute[] }`. */
export async function fetchSubstitutes({ ingredient_label, recipe_context, lang = 'fr' }) {
  const { data, error } = await supabase.functions.invoke('suggest-substitutes', {
    body: { ingredient_label, recipe_context, lang },
  })
  if (error) throw error
  return data
}
