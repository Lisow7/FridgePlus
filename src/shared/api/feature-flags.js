import { supabase } from '@shared/lib/supabase/client'

// Charge tous les flags (lecture publique via RLS).
export async function fetchFeatureFlags() {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('key, enabled, label, description')
    .order('key')
  if (error) {
    console.error('[feature-flags] fetchFeatureFlags:', error.message)
    return []
  }
  return data ?? []
}

// Bascule un flag (admin seul — garanti côté RLS).
export async function setFeatureFlag(key, enabled) {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('feature_flags')
    .update({ enabled, updated_at: new Date().toISOString(), updated_by: user?.id ?? null })
    .eq('key', key)
  if (error) console.error('[feature-flags] setFeatureFlag:', error.message)
  return { error }
}
