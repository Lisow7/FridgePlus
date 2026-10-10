import { supabase } from '@shared/lib/supabase/client'
import { auMoinsUneLigne } from '@shared/lib/supabase/rows-affected'

// Charge tous les flags (lecture publique via RLS) : `{ data, error }`.
// Le panneau admin s'en sert pour dire qu'ils n'ont pas pu être lus — il
// affichait « Aucune fonctionnalité configurée » (audit ADM-08).
export async function loadFeatureFlags() {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('key, enabled, label, description')
    .order('key')
  return { data: data ?? [], error: error ?? null }
}

// Pour le démarrage de l'app (`FeatureFlagsProvider`) : silencieux sur erreur —
// une panne des drapeaux ne doit pas casser l'accueil ; les fonctionnalités
// gardent leur valeur par défaut.
export async function fetchFeatureFlags() {
  const { data, error } = await loadFeatureFlags()
  if (error) console.error('[feature-flags] fetchFeatureFlags:', error.message)
  return data
}

// Bascule un flag (admin seul — garanti côté RLS). L'heure et l'auteur de la
// bascule sont posés par la base (déclencheur `trg_horodater_la_bascule`, lot
// 12l de l'audit du 2026-10-04, ADM-28) : le navigateur les fournissait.
export async function setFeatureFlag(key, enabled) {
  // Les lignes touchées (clé `key` : la table n'a pas d'`id`) — 0 ligne est un
  // échec, pas « fonctionnalité basculée » (audit ADM-26).
  const { error } = auMoinsUneLigne(await supabase
    .from('feature_flags')
    .update({ enabled })
    .eq('key', key)
    .select('key'))
  if (error) console.error('[feature-flags] setFeatureFlag:', error.message)
  return { error }
}
