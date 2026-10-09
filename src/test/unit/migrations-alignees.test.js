import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

// Le dépôt et le registre des migrations de la base (audit du 2026-10-04,
// ARCH-10 et BDD-19).
//
// L'audit comptait 9 entrées du registre sans fichier et des noms à la date
// seule (jusqu'à 21 fichiers pour un même jour). Le 2026-10-08, les 9 fichiers
// manquants ont été RECONSTITUÉS depuis `supabase_migrations.schema_migrations`
// (colonne `statements`) : chacun recopie le SQL du registre à l'octet près,
// sous une ligne-repère qui porte son empreinte md5. Ce test garde deux choses :
//   1. une nouvelle migration porte la version complète que `apply_migration`
//      inscrit (AAAAMMJJHHMMSS, 14 chiffres) — les noms à 8 chiffres sont gelés ;
//   2. une migration reconstituée ne bouge plus d'un octet.
// Le rapprochement fichiers ↔ registre se rejoue à la main : voir le README de
// supabase/migrations (« Registre et dépôt »).

const DOSSIER = path.resolve(process.cwd(), 'supabase/migrations')
const FICHIERS = fs.readdirSync(DOSSIER).filter((f) => f.endsWith('.sql'))
const DERNIER_NOM_A_LA_DATE = '20261008'
const REPERE = /^-- ── SQL du registre, recopié tel quel \(md5 ([0-9a-f]{32})\) ──\n/m

export function ecartDEmpreinte(texte) {
  const t = texte.replace(/\r\n/g, '\n')
  const repere = t.match(REPERE)
  if (!repere) return null
  const corps = t.slice(repere.index + repere[0].length).replace(/\n$/, '')
  const md5 = crypto.createHash('md5').update(corps, 'utf8').digest('hex')
  return md5 === repere[1] ? '' : `${md5} au lieu de ${repere[1]}`
}

describe('migrations : le dépôt suit le registre de la base', () => {
  it('chaque fichier s’appelle <version>_<nom>.sql (8 chiffres gelés, ou 14)', () => {
    expect(FICHIERS.filter((f) => !/^(\d{8}|\d{14})_[a-z0-9_]+\.sql$/.test(f))).toEqual([])
  })

  it('une nouvelle migration porte la version complète (14 chiffres), plus la date seule', () => {
    const fautes = FICHIERS.filter((f) => /^\d{8}_/.test(f) && f.slice(0, 8) > DERNIER_NOM_A_LA_DATE)
    expect(fautes).toEqual([])
  })

  it('les migrations reconstituées depuis le registre n’ont pas bougé d’un octet', () => {
    const reconstituees = FICHIERS.map((f) => [f, ecartDEmpreinte(fs.readFileSync(path.join(DOSSIER, f), 'utf8'))])
      .filter(([, ecart]) => ecart !== null)
    expect(reconstituees.length).toBe(9)
    expect(reconstituees.filter(([, ecart]) => ecart)).toEqual([])
  })

  it('le témoin : un octet changé se voit', () => {
    const sql = 'drop table if exists public.t;'
    const md5 = crypto.createHash('md5').update(sql, 'utf8').digest('hex')
    const fichier = `-- en-tête\n-- ── SQL du registre, recopié tel quel (md5 ${md5}) ──\n${sql}\n`
    expect(ecartDEmpreinte(fichier)).toBe('')
    expect(ecartDEmpreinte(fichier.replace('public.t', 'public.u'))).not.toBe('')
    expect(ecartDEmpreinte('-- sans repère\nselect 1;')).toBeNull()
  })
})
