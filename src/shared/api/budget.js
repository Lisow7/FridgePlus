// Lecture du budget courses dans profiles.
// `monthly_budget` est nullable (NULL = aucune limite). L'écriture passe par
// `updateProfile` (Profil → Préférences), qui valide comme la contrainte
// `chk_profiles_monthly_budget` ; le doublon `setMonthlyBudget`, appelé nulle
// part, a été retiré (lot 14e).

import { supabase } from '@shared/lib/supabase/client'

export async function getMonthlyBudget(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('monthly_budget')
    .eq('id', userId)
    .single()
  return { budget: data?.monthly_budget ?? null, error }
}
