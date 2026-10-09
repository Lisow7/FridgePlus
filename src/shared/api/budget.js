// Lecture et mise à jour du budget courses dans profiles.
// `monthly_budget` est nullable (NULL = aucune limite).

import { supabase } from '@shared/lib/supabase/client'

export async function getMonthlyBudget(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('monthly_budget')
    .eq('id', userId)
    .single()
  return { budget: data?.monthly_budget ?? null, error }
}

export async function setMonthlyBudget(userId, budget) {
  const value = budget === null || budget === '' ? null : Number(budget)
  if (value !== null && (isNaN(value) || value <= 0)) return { error: new Error('invalid') }
  const { error } = await supabase
    .from('profiles')
    .update({ monthly_budget: value })
    .eq('id', userId)
  return { error }
}
