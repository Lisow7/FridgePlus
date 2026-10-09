import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { formatPrix } from '@shared/lib/i18n/prix'
import { formatPrice } from '@shared/lib/recipes/recipe-utils'

// Langue et typographie (audit du 2026-10-04, UX-15). Les dictionnaires FR et
// EN sont à parité de clés, mais les règles de langue étaient refaites à la
// main à chaque endroit : 21 pluriels anglais en `n > 1 ? 's' : ''` (« 0 recipe »),
// des guillemets « » dans dix textes anglais (et une espace avant « ? »), dix
// prix en `.toFixed(2).replace('.', ',')` (« 4,99 € » aussi en anglais), deux
// coquilles, deux textes restés en français côté anglais. Ces garde-fous
// lisent le source : ils tiennent ce que la relecture ne tient pas.
// Hors de ce lot : les espaces insécables (lot à part) et les apostrophes
// (question de la décision du 2026-10-09).

const racine = resolve(process.cwd(), 'src')
function fichiers(dossier, acc = []) {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) { if (nom !== 'test') fichiers(chemin, acc) }
    else if (/\.(js|jsx)$/.test(nom)) acc.push(chemin)
  }
  return acc
}
const SOURCES = fichiers(racine).map((f) => [f.slice(racine.length + 1).split('\\').join('/'), readFileSync(f, 'utf8')])
const lignes = (texte) => texte.split('\n')

describe('pluriels', () => {
  it('aucun pluriel anglais écrit à la main (« 0 recipe » : la règle anglaise est `=== 1`)', () => {
    // (« post » n'y est pas : c'est aussi le mot français des textes de l'admin.)
    const noms = '(item|recipe|ingredient|day|review|time|entry|list|swap)'
    const fautes = []
    for (const [chemin, texte] of SOURCES) {
      lignes(texte).forEach((l, i) => {
        if (new RegExp(`\\b${noms}\\$\\{[^}]*> 1 \\? 's' : ''\\}`).test(l)) fautes.push(`${chemin}:${i + 1}`)
      })
    }
    expect(fautes).toEqual([])
  })

  it('aucun pluriel français en `!== 1` (« 0 entrées » : la règle française est `> 1`)', () => {
    const fautes = []
    for (const [chemin, texte] of SOURCES) {
      lignes(texte).forEach((l, i) => {
        if (/(entrée|recette|ingrédient|article|aliment)\{[^}]*!== 1 \? 's' : ''\}/.test(l)) fautes.push(`${chemin}:${i + 1}`)
      })
    }
    expect(fautes).toEqual([])
  })
})

describe('guillemets', () => {
  // Les dictionnaires ont la forme `  en: { … }` (deux espaces) ; les entrées
  // du journal des versions, `en: '…'`.
  // Les commentaires d'un bloc (`// …`, en français) ne sont pas des textes.
  const blocsEn = (texte) => [...texte.matchAll(/\n {2}en: \{([\s\S]*?)\n {2}\}/g)]
    .map((m) => m[1].split('\n').filter((l) => !l.trim().startsWith('//')).join('\n'))

  it('aucun guillemet français dans un texte anglais', () => {
    const fautes = []
    for (const [chemin, texte] of SOURCES) {
      if (blocsEn(texte).some((b) => b.includes('«') || b.includes('»'))) fautes.push(chemin)
      if (chemin.endsWith('changelog/data/changelog.js') && /\ben: '[^'\n]*«/.test(texte)) fautes.push(`${chemin} (journal)`)
    }
    expect(fautes).toEqual([])
  })

  it('aucune espace avant « ? » dans un texte anglais', () => {
    const fautes = []
    for (const [chemin, texte] of SOURCES) {
      // Le « ? » d'un texte est suivi d'une fin de chaîne ; celui d'un ternaire, d'une espace.
      if (blocsEn(texte).some((b) => /[\w»"'] \?(?=['"`\\]|$)/m.test(b))) fautes.push(chemin)
    }
    expect(fautes).toEqual([])
  })
})

describe('prix', () => {
  it('formatPrix suit la langue : « 4,99 € » en français, « €4.99 » en anglais', () => {
    expect(formatPrix(4.99, 'fr')).toBe('4,99 €')
    expect(formatPrix(4.99, 'en')).toBe('€4.99')
    expect(formatPrix(1234.5, 'fr')).toBe('1 234,50 €')
    expect(formatPrix(1234.5, 'en')).toBe('€1,234.50')
  })

  it('« ~ » pour une estimation ; rien pour ce qui n’est pas un nombre', () => {
    expect(formatPrix(2.916, 'fr', { approx: true })).toBe('~2,92 €')
    expect(formatPrix(NaN, 'fr')).toBeNull()
    expect(formatPrix(undefined, 'en')).toBeNull()
  })

  it('formatPrice (coût d’une recette) passe par la même aide', () => {
    expect(formatPrice(4.99, 'fr')).toBe('~4,99 €')
    expect(formatPrice(4.99, 'en')).toBe('~€4.99')
    expect(formatPrice(-1, 'fr')).toBeNull()
  })

  it('plus aucun prix écrit à la main (`toFixed(2).replace`)', () => {
    const fautes = SOURCES.filter(([, texte]) => texte.includes(".toFixed(2).replace('.', ',')")).map(([c]) => c)
    expect(fautes).toEqual([])
  })
})

describe('coquilles et textes restés en français', () => {
  const source = (chemin) => readFileSync(resolve(racine, chemin), 'utf8')

  it('« apparaît », avec son accent', () => {
    const activite = source('features/profile/pages/profile-activity-page.jsx')
    expect(activite).toContain('apparaît')
    expect(activite).not.toMatch(/apparait\b/)
  })

  it('les points de suspension du reste sont un seul caractère', () => {
    expect(source('features/fridge/i18n/leftovers-i18n.js')).not.toContain('reste...')
  })

  it('le compteur de résultats de l’ajout au panier est traduit', () => {
    expect(source('features/cart/components/cart-manual-add.jsx')).not.toContain("'résultat' : 'résultats'")
  })

  it('le courriel du filet d’erreur parle la langue du visiteur', () => {
    const filet = source('app/error/error-boundary.jsx')
    expect(filet).not.toContain('subject=Erreur')
    expect(filet).toMatch(/mailSubject|sujetDuCourriel/)
  })
})
