import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// L'opposition au profilage (RGPD, art. 21) n'était tenue que par le client :
// si la RPC `is_profiling_opted_out` échouait, `recordSpendingEvent` insérait
// quand même, et aucune règle de la base ne lisait `profiling_opted_out`
// (audit du 2026-10-04, RGPD-18 (a)). La migration fait refuser l'insertion
// par la base elle-même. Elle attend la confirmation d'Antoine (essai à blanc
// puis `apply_migration`) ; d'ici là, ce test tient le texte et le registre.

const racine = process.cwd()
// Version provisoire (l'heure d'écriture) : le garde-fou `migrations-alignees`
// veut 14 chiffres pour tout nom postérieur au 2026-10-08 ; à l'application,
// le fichier prend la version qu'inscrit `apply_migration`.
const MIGRATION = 'supabase/migrations/20261009130000_opposition_au_profilage_en_base.sql'
const SONDE = 'supabase/probes/20261009_opposition_au_profilage_en_base.sql'
const lire = (chemin) => readFileSync(resolve(racine, chemin), 'utf8')

describe('la base refuse une dépense enregistrée contre l’opposition au profilage', () => {
  it('la migration recrée la règle d’insertion avec le refus', () => {
    expect(existsSync(resolve(racine, MIGRATION))).toBe(true)
    const sql = lire(MIGRATION)
    expect(sql).toMatch(/DROP POLICY IF EXISTS spending_events_insert_own ON public\.spending_events/)
    expect(sql).toMatch(/CREATE POLICY spending_events_insert_own ON public\.spending_events[\s\S]*FOR INSERT[\s\S]*WITH CHECK/)
    // Le compte reste le sien, ET il ne s'est pas opposé — `auth.uid()` sous
    // `(select …)` comme toutes les règles du dépôt (initplan, 2026-05-17).
    expect(sql).toMatch(/user_id = \(select auth\.uid\(\)\)/)
    expect(sql).toMatch(/NOT public\.is_profiling_opted_out\(\(select auth\.uid\(\)\)\)/)
  })

  it('sa sonde existe et n’écrit rien (un seul bloc DO, terminé par RAISE EXCEPTION)', () => {
    expect(existsSync(resolve(racine, SONDE))).toBe(true)
    const sonde = lire(SONDE)
    expect(sonde.match(/DO \$probe\$/g)).toHaveLength(1)
    expect(sonde).toMatch(/RAISE EXCEPTION 'SONDE opposition_au_profilage_en_base/)
  })

  it('le registre des migrations la liste comme en attente de la confirmation d’Antoine', () => {
    const readme = lire('supabase/migrations/README.md')
    expect(readme).toContain('20261009130000_opposition_au_profilage_en_base.sql')
    expect(readme).toMatch(/opposition_au_profilage_en_base[\s\S]{0,400}confirmation d'Antoine|confirmation d'Antoine[\s\S]{0,400}opposition_au_profilage_en_base/)
  })
})
