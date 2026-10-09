import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { compterEnStock } from '@features/fridge/lib/compter-en-stock'

// Audit du 2026-10-04, ARCH-07 : une garantie présente à un endroit, perdue
// dans sa copie — la classe de défaut dominante de ce dépôt.
//
// 1. Le panier était écrit DEUX fois : `app/hooks/use-basket-actions.js`
//    (l'accueil) et `features/cart/hooks/use-cart-actions.js` (panier, fiche
//    recette). Chaque copie avait déjà perdu un correctif de l'autre — le
//    filtre du stock côté panier, le prix stable côté accueil —, rattrapé à la
//    main et en retard. L'accueil DÉLÈGUE désormais au panier : il ne garde
//    que ce qui lui est propre (le nom de la liste chargée).
// 2. La formule « combien d'aliments de cette sous-catégorie sont au frigo »
//    était recopiée 13 fois dans les composants du frigo : `compterEnStock`.

const SRC = path.resolve(process.cwd(), 'src')
const lire = (f) => fs.readFileSync(path.join(SRC, f), 'utf8')

describe('le panier n’a qu’une implémentation', () => {
  const accueil = lire('app/hooks/use-basket-actions.js')

  it('le panier de l’accueil délègue à useCartActions', () => {
    expect(accueil).toMatch(/useCartActions\(/)
  })

  it('il n’écrit plus lui-même dans le panier (aucun appel à l’API du panier)', () => {
    expect(accueil).not.toMatch(/\b(addBasketItems|updateBasketItemsBatch|clearBasket|removeBasketItemsByIds)\(/)
  })
})

describe('la formule du frigo n’est écrite qu’une fois', () => {
  it('compterEnStock compte les aliments d’une sous-catégorie qui sont au frigo', () => {
    const catalogue = { lait: [{ id: 'fr-lait' }, { id: 'fr-lait-soja' }], oeufs: [{ id: 'fr-oeufs' }] }
    const stock = new Set(['fr-lait', 'fr-oeufs', 'gp-riz'])
    expect(compterEnStock(catalogue, 'lait', stock)).toBe(1)
    expect(compterEnStock(catalogue, 'oeufs', stock)).toBe(1)
    expect(compterEnStock(catalogue, 'inconnue', stock)).toBe(0)
  })

  it('aucun composant ne recopie la formule', () => {
    const dossier = path.join(SRC, 'features/fridge/components')
    const copies = fs.readdirSync(dossier).filter((f) => f.endsWith('.jsx')).flatMap((f) => {
      const lignes = fs.readFileSync(path.join(dossier, f), 'utf8').split('\n')
      return lignes.map((l, i) => (/\[sub\.id\]\s*\?\?\s*\[\]\)\.filter\(\s*\(?i\)?\s*=>\s*stock\.has\(i\.id\)\)\.length/.test(l) ? `${f}:${i + 1}` : null)).filter(Boolean)
    })
    expect(copies).toEqual([])
  })
})
