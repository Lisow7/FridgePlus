import { describe, it, expect } from 'vitest'
import { extractProductLabels } from '../../features/receipt-scan/lib/receipt-line-parser'

// Construit un mot avec un rectangle de position simple (une seule ligne = une
// bande Y de hauteur ~30, les mots d'une même ligne partagent y0/y1 ; x0/x1
// espace les mots horizontalement dans l'ordre où ils doivent apparaître).
function word(text, { x0, y0, height = 30 } = {}) {
  return { boundingBox: { x0, y0, x1: x0 + text.length * 12, y1: y0 + height }, text }
}

// Regroupe une liste de mots en UN SEUL block avec UN SEUL paragraph (assez
// pour la plupart des tests : le clustering en lignes se fait au niveau mot,
// pas paragraph — cf. Step 3 du plan).
function oneBlockOneParagraph(words) {
  return { blocks: [{ boundingBox: {}, paragraphs: [{ boundingBox: {}, text: words.map(w => w.text).join(' '), words }] }] }
}

describe('extractProductLabels', () => {
  it('filtre les lignes non-produits (en-tête magasin, total, date, prix seul)', () => {
    const visionResponse = {
      blocks: [
        { boundingBox: {}, paragraphs: [
          { boundingBox: {}, text: 'MARKET MERIGNAC', words: [word('MARKET', { x0: 0, y0: 0 }), word('MERIGNAC', { x0: 80, y0: 0 })] },
          { boundingBox: {}, paragraphs: [] }, // ignoré : pas de words utile ici, structure minimale
        ] },
        { boundingBox: {}, paragraphs: [
          { boundingBox: {}, text: '100G MIX GRAN MIST', words: [word('100G', { x0: 0, y0: 300 }), word('MIX', { x0: 60, y0: 300 }), word('GRAN', { x0: 100, y0: 300 }), word('MIST', { x0: 150, y0: 300 })] },
          { boundingBox: {}, text: '125G MOZZARELLA', words: [word('125G', { x0: 0, y0: 340 }), word('MOZZARELLA', { x0: 60, y0: 340 })] },
        ] },
        { boundingBox: {}, paragraphs: [
          { boundingBox: {}, text: 'TOTAL A PAYER', words: [word('TOTAL', { x0: 0, y0: 900 }), word('A', { x0: 70, y0: 900 }), word('PAYER', { x0: 90, y0: 900 })] },
          { boundingBox: {}, text: '03/05/2025', words: [word('03/05/2025', { x0: 0, y0: 950 })] },
          { boundingBox: {}, text: '4.99€', words: [word('4.99€', { x0: 0, y0: 990 })] },
        ] },
      ],
    }
    expect(extractProductLabels(visionResponse)).toEqual([
      '100G MIX GRAN MIST',
      '125G MOZZARELLA',
    ])
  })

  it('reconstruit 2 lignes de produits regroupées dans un seul paragraph (Y différents)', () => {
    const visionResponse = oneBlockOneParagraph([
      word('160G', { x0: 0, y0: 100 }), word('JAMB', { x0: 60, y0: 100 }), word('PARIS', { x0: 110, y0: 100 }),
      word('200G', { x0: 0, y0: 140 }), word('EMMENTAL', { x0: 60, y0: 140 }), word('RAPE', { x0: 160, y0: 140 }),
    ])
    expect(extractProductLabels(visionResponse)).toEqual([
      '160G JAMB PARIS',
      '200G EMMENTAL RAPE',
    ])
  })

  it('trie les mots par X au sein d\'une même ligne, même si fournis dans le désordre', () => {
    const visionResponse = oneBlockOneParagraph([
      word('FARFALLE', { x0: 120, y0: 200 }),
      word('1KG', { x0: 0, y0: 200 }),
      word('PATES', { x0: 60, y0: 200 }),
    ])
    expect(extractProductLabels(visionResponse)).toEqual(['1KG PATES FARFALLE'])
  })

  it('exclut un block majoritairement numérique (colonne prix/quantité)', () => {
    const visionResponse = {
      blocks: [
        { boundingBox: {}, paragraphs: [
          { boundingBox: {}, text: 'TOMATES CERISES', words: [word('TOMATES', { x0: 0, y0: 100 }), word('CERISES', { x0: 80, y0: 100 })] },
        ] },
        { boundingBox: {}, paragraphs: [
          { boundingBox: {}, text: '4 x 1.49€', words: [word('4', { x0: 0, y0: 100 }), word('x', { x0: 20, y0: 100 }), word('1.49€', { x0: 40, y0: 100 })] },
          { boundingBox: {}, text: '2 x 0.83€', words: [word('2', { x0: 0, y0: 140 }), word('x', { x0: 20, y0: 140 }), word('0.83€', { x0: 40, y0: 140 })] },
        ] },
      ],
    }
    expect(extractProductLabels(visionResponse)).toEqual(['TOMATES CERISES'])
  })

  it('ne filtre pas un libellé produit contenant la sous-chaîne "total" (faux positif substring), mais filtre bien la ligne de total réelle', () => {
    const visionResponse = {
      blocks: [
        { boundingBox: {}, paragraphs: [
          { boundingBox: {}, text: 'PATE TOTALE MAISON', words: [word('PATE', { x0: 0, y0: 100 }), word('TOTALE', { x0: 50, y0: 100 }), word('MAISON', { x0: 120, y0: 100 })] },
        ] },
        { boundingBox: {}, paragraphs: [
          { boundingBox: {}, text: 'TOTAL A PAYER', words: [word('TOTAL', { x0: 0, y0: 900 }), word('A', { x0: 70, y0: 900 }), word('PAYER', { x0: 90, y0: 900 })] },
        ] },
      ],
    }
    expect(extractProductLabels(visionResponse)).toEqual(['PATE TOTALE MAISON'])
  })

  it('page sans texte détecté (blocks vide) renvoie une liste vide sans erreur', () => {
    expect(extractProductLabels({ blocks: [] })).toEqual([])
  })

  it('visionResponse undefined/malformé renvoie une liste vide sans erreur', () => {
    expect(extractProductLabels({})).toEqual([])
    expect(extractProductLabels(undefined)).toEqual([])
  })
})
