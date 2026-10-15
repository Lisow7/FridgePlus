import { supabase } from '@shared/lib/supabase/client'

// L'accord d'enregistrement des allergènes d'un compte (décision du
// 2026-10-06, « allergenes = case ») : donné et retiré par deux fonctions de
// la base, qui datent l'accord elles-mêmes. Appelées par `useAllergenPrefs` —
// le hook les appelait en direct jusqu'au lot « accès à la base rangés »
// (audit du 2026-10-04, ARCH-13 (6)).

/** Donne l'accord : rend `{ data: <date de l'accord>, error }`. */
export async function accepterLAccordAllergenes() {
  return supabase.rpc('accepter_l_enregistrement_des_allergenes')
}

/** Retire l'accord (la base efface aussi les allergènes) : rend `{ error }`. */
export async function retirerLAccordAllergenes() {
  const { error } = await supabase.rpc('retirer_l_accord_allergenes')
  return { error: error ?? null }
}
