/**
 * Recherche d'aliment (P1, audit d'intuitivité du 2026-10-02).
 * Constats de départ : « pâtes » ne trouvait rien (« Pâtes » est un parent, non
 * stockable, exclu du catalogue cherchable) et « oeuf » ramenait d'abord trois
 * coupes de bœuf (simple `includes` : « b-oeuf »).
 */
import { describe, it, expect } from 'vitest'
import { searchIngredients } from '@shared/lib/matching/ingredient-search'

const ing = (id, fr, group_id = null, en = null) => ({ id, labels: { fr, en: en ?? fr }, group_id })
const CATALOG = [
  ing('gp-pates', 'Pâtes'),
  ing('gp-spaghetti', 'Spaghetti', 'gp-pates'),
  ing('gp-penne', 'Penne', 'gp-pates'),
  ing('fr-pates-patiss', 'Pâtes pâtissières'),
  ing('fr-pate-brisee', 'Pâte brisée', 'fr-pates-patiss'),
  ing('fr-oeuf', 'Œuf(s)', null, 'Egg(s)'),
  ing('fr-oeufs-bio', 'Œufs bio', 'fr-oeuf', 'Organic eggs'),
  ing('fr-oeufs-standard', 'Œufs standards', 'fr-oeuf', 'Standard eggs'),
  ing('fr-boeuf', 'Bœuf'),
  ing('fr-hache-boeuf', 'Haché bœuf', 'fr-boeuf'),
  ing('fr-filet-boeuf', 'Filet bœuf', 'fr-boeuf'),
  ing('vg-tomate', 'Tomate'),
  ing('vg-tomate-cerise', 'Tomate cerise', 'vg-tomate'),
  ing('vg-tomate-ronde', 'Tomate ronde', 'vg-tomate'),
  ing('sp-sauce-tomate', 'Sauce tomate'),
  ing('vg-pomme-terre', 'Pomme de terre'),
  ing('fr-beurre-doux', 'Beurre doux'),
  ing('gp-pate-tartiner', 'Pâte à tartiner'),
]
const ids = (q, lang = 'fr') => searchIngredients(q, CATALOG, { lang }).map(r => r.id)

describe('searchIngredients', () => {
  it('ne propose jamais un parent (non stockable)', () => {
    expect(ids('pâtes')).not.toContain('gp-pates')
    expect(ids('oeuf')).not.toContain('fr-oeuf')
  })

  it('« pâtes » mène aux pâtes, via leur famille', () => {
    const r = ids('pâtes')
    expect(r).toEqual(expect.arrayContaining(['gp-spaghetti', 'gp-penne']))
  })

  it('une saisie qui NOMME une famille met ses enfants en tête (« pâtes » ≠ pâte à tartiner)', () => {
    const r = ids('pâtes')
    expect(r.slice(0, 2).sort()).toEqual(['gp-penne', 'gp-spaghetti'])
    expect(ids('pâte').slice(0, 2).sort()).toEqual(['gp-penne', 'gp-spaghetti'])
  })

  it('« oeuf » trouve les œufs et plus le bœuf (début de mot, pas milieu)', () => {
    const r = ids('oeuf')
    expect(r).toEqual(expect.arrayContaining(['fr-oeufs-bio', 'fr-oeufs-standard']))
    expect(r.some(id => id.includes('boeuf'))).toBe(false)
  })

  it('accents, majuscules et ligatures ne comptent pas', () => {
    expect(ids('OEUFS BIO')).toEqual(['fr-oeufs-bio'])
    expect(ids('boeuf')).toEqual(expect.arrayContaining(['fr-hache-boeuf', 'fr-filet-boeuf']))
  })

  it('singulier et pluriel se confondent', () => {
    expect(ids('tomates')).toEqual(expect.arrayContaining(['vg-tomate-cerise', 'vg-tomate-ronde']))
  })

  it('classe le début du nom avant un mot plus loin', () => {
    const r = ids('tomate')
    expect(r.indexOf('vg-tomate-cerise')).toBeLessThan(r.indexOf('sp-sauce-tomate'))
  })

  it('tous les mots tapés doivent correspondre', () => {
    expect(ids('tomate cer')).toEqual(['vg-tomate-cerise'])
  })

  it('reprend les alias existants (patate → pomme de terre)', () => {
    expect(ids('patate')).toContain('vg-pomme-terre')
  })

  it('tolère une faute de frappe quand rien ne correspond', () => {
    expect(ids('spagetti')).toEqual(['gp-spaghetti'])
    expect(ids('beure')).toEqual(['fr-beurre-doux'])
  })

  it('cherche dans la langue demandée', () => {
    expect(ids('egg', 'en')).toEqual(expect.arrayContaining(['fr-oeufs-bio', 'fr-oeufs-standard']))
  })

  it('requête vide ou trop courte → rien', () => {
    expect(ids('')).toEqual([])
    expect(ids('   ')).toEqual([])
  })
})
