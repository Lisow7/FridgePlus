import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  partitionnerPourUpsert,
  COLONNES_POSSEDEES_PAR_LA_BASE,
} from '../../../scripts/lib/ingredients-ownership.mjs'

// `labels`, `price`, `pack_size` et `nutrition` sont editables depuis l'admin EN
// PRODUCTION. Les reconstruire depuis les fichiers statiques a chaque `migrate`
// effacerait les saisies humaines — et sans rien casser : l'upsert reussirait,
// la perte ne se verrait qu'a l'usage.
//
// Mesure du 2026-08-15 : la base est plus riche sur labels (522 lignes),
// pack_size (203), nutrition (2) et price (2), avec ZERO conflit de valeurs —
// uniquement des langues en plus.
// Cf. la note interne sur la propriété des données d’ingrédients.
//
// ⚠️ `labels` a failli etre oublie : la proposition n'en citait que trois. C'est
// pourtant LUI qui faisait avorter `npm run migrate` (522 lignes), et le seul
// qui avait deja un garde dedie — ecrit par quelqu'un qui avait vu le probleme
// sans le generaliser aux trois autres.

const ligne = (id, extra = {}) => ({
  id,
  labels: { fr: id, en: id },
  subcategory: 'meat',
  storage: 'fr',
  emoji: '🥩',
  price: { fr: [{ size: 500, unit: 'g', price: 5 }] },
  pack_size: { fr: [{ size: 500, unit: 'g', price: 5 }] },
  nutrition: { cal: 100 },
  ...extra,
})

describe('propriete des colonnes — partition', () => {
  it('🔴 les QUATRE colonnes editables en admin sont declarees, nommement', () => {
    // Sans cette assertion en dur, tout le reste du fichier est TAUTOLOGIQUE :
    // les autres tests bouclent sur `COLONNES_POSSEDEES_PAR_LA_BASE`, donc en
    // retirer une les ferait passer au vert tout en cessant de la proteger.
    // Eprouve par mutation le 2026-08-15 : retirer `pack_size` de la liste
    // laissait 6 tests sur 6 au vert.
    expect([...COLONNES_POSSEDEES_PAR_LA_BASE].sort()).toEqual(['labels', 'nutrition', 'pack_size', 'price'])
  })

  it('🔴 une ligne existante perd nommement labels, price, pack_size ET nutrition', () => {
    // Meme raison : on nomme, on ne boucle pas.
    // `labels` a failli etre oublie — c'est pourtant LUI qui faisait avorter le
    // migrate sur 522 lignes, et le seul qui avait deja un garde dedie.
    const { existants } = partitionnerPourUpsert([ligne('fr-boeuf')], new Set(['fr-boeuf']))
    expect(existants[0]).not.toHaveProperty('labels')
    expect(existants[0]).not.toHaveProperty('price')
    expect(existants[0]).not.toHaveProperty('pack_size')
    expect(existants[0]).not.toHaveProperty('nutrition')
  })

  it('un ingredient NOUVEAU recoit toutes les colonnes (amorcage)', () => {
    const { nouveaux, existants } = partitionnerPourUpsert([ligne('fr-boeuf')], new Set())
    expect(existants).toHaveLength(0)
    expect(nouveaux).toHaveLength(1)
    for (const col of COLONNES_POSSEDEES_PAR_LA_BASE) {
      expect(nouveaux[0], `${col} doit amorcer un nouvel ingredient`).toHaveProperty(col)
    }
  })

  it('🔴 un ingredient EXISTANT est envoye SANS les colonnes possedees par la base', () => {
    const { nouveaux, existants } = partitionnerPourUpsert([ligne('fr-boeuf')], new Set(['fr-boeuf']))
    expect(nouveaux).toHaveLength(0)
    expect(existants).toHaveLength(1)
    for (const col of COLONNES_POSSEDEES_PAR_LA_BASE) {
      expect(existants[0], `${col} ecraserait une saisie admin`).not.toHaveProperty(col)
    }
    // …mais les colonnes structurelles restent pilotees par les statiques.
    expect(existants[0]).toMatchObject({ id: 'fr-boeuf', subcategory: 'meat', storage: 'fr', emoji: '🥩' })
    expect(existants[0]).not.toHaveProperty('labels')
  })

  it('ne modifie pas les lignes d’origine (pas d’effet de bord)', () => {
    const source = ligne('fr-boeuf')
    partitionnerPourUpsert([source], new Set(['fr-boeuf']))
    expect(source).toHaveProperty('pack_size')
  })

  it('🔴 chaque lot est HOMOGENE — PostgREST refuse « All object keys must match »', () => {
    // L'invariant qui rend les deux lots necessaires : melanger des lignes
    // completes et allegees dans un seul upsert echouerait, ou ecrirait des
    // NULL avec `defaultToNull` — la destruction meme qu'on evite.
    const rows = [ligne('a'), ligne('b'), ligne('c'), ligne('d')]
    const { nouveaux, existants } = partitionnerPourUpsert(rows, new Set(['a', 'c']))
    for (const lot of [nouveaux, existants]) {
      const signatures = new Set(lot.map(r => Object.keys(r).sort().join('|')))
      expect(signatures.size, 'toutes les lignes d’un lot doivent avoir les memes cles').toBe(1)
    }
    expect(existants.map(r => r.id)).toEqual(['a', 'c'])
    expect(nouveaux.map(r => r.id)).toEqual(['b', 'd'])
  })
})

describe('propriete des colonnes — le garde est BRANCHE dans le script', () => {
  // Un garde-fou qu'on n'appelle pas est invisible a tous les tests : le
  // plafond IA a passe trois mois debranche pour cette raison exacte.
  const code = readFileSync(resolve(process.cwd(), 'scripts/sync-ingredients.mjs'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

  it('sync-ingredients importe ET appelle la partition', () => {
    expect(code, "l'import manque").toMatch(/import\s*\{[^}]*partitionnerPourUpsert[^}]*\}\s*from\s*'\.\/lib\/ingredients-ownership\.mjs'/)
    expect(code, "l'appel manque — c'est exactement le defaut d'origine").toMatch(/partitionnerPourUpsert\s*\(/)
  })

  it('🔴 n’upserte plus le tableau complet en un seul lot', () => {
    // La regression a craindre : revenir a `upsertBatch(..., deduplicatedRows)`,
    // qui reecrirait les trois colonnes pour TOUTES les lignes.
    expect(code).not.toMatch(/upsertBatch\(\s*'ingredients'\s*,\s*deduplicatedRows/)
    expect(code).toMatch(/upsertBatch\(\s*'ingredients'\s*,\s*nouveaux/)
    expect(code).toMatch(/upsertBatch\(\s*'ingredients'\s*,\s*existants/)
  })
})
