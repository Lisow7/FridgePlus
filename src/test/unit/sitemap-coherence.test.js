import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PAGES_STATIQUES } from '../../../scripts/lib/prerender-page.mjs'

// Garde-fou du sitemap généré par `npm run sitemap`.
//
// CE QU'IL PROTÈGE
// Jusqu'au 2026-08-13, `sitemap.xml` ne déclarait qu'UNE url — l'accueil. Les
// 515 pages recette n'étaient donc jamais annoncées à Google. C'était inerte
// tant que le `canonical` figé les déclarait doublons de l'accueil (corrigé en
// #997) ; ça ne l'est plus.
//
// Le risque désormais n'est plus l'absence, c'est la RÉGRESSION SILENCIEUSE :
// une régénération qui échoue à moitié, ou qui repart sur une seule entrée, ne
// se verrait pas — un sitemap reste un fichier valide même réduit à l'accueil.
// Le script refuse déjà d'écrire sur 0 recette ; ce test garde le fichier
// COMMITÉ.
//
// ⚠️ CE QU'IL NE FAIT PAS
// Il ne peut pas parler à Supabase (la CI n'a aucune clé), donc il ne vérifie
// PAS que le compte correspond à la base. Un sitemap périmé passe : c'est la
// contrepartie assumée du choix « script manuel », documentée dans
// `scripts/generate-sitemap.mjs`.

const SITEMAP = resolve(process.cwd(), 'public/sitemap.xml')

describe('sitemap.xml', () => {
  const xml = readFileSync(SITEMAP, 'utf8')
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])

  it('déclare bien plus que la seule page d’accueil', () => {
    // Le défaut d'origine : 1 seule url. Le seuil est volontairement bas — il
    // attrape l'effondrement, pas la dérive d'une recette près.
    expect(locs.length).toBeGreaterThan(100)
  })

  it('contient l’accueil', () => {
    expect(locs).toContain('https://fridgeplus.app/')
  })

  it('ne contient que des URLs absolues du bon domaine', () => {
    const etrangeres = locs.filter(l => !l.startsWith('https://fridgeplus.app/'))
    expect(etrangeres).toEqual([])
  })

  it('déclare CHAQUE page statique pré-rendue', () => {
    // Cohérence avec `PAGES_STATIQUES`, la liste que lit aussi le pré-rendu.
    // Une page pré-rendue mais absente d'ici se priverait de sa découverte —
    // et le sitemap resterait un fichier parfaitement valide. Lire la liste
    // plutôt que réécrire les 5 chemins : une liste recopiée finit décalée.
    const manquantes = PAGES_STATIQUES
      .map(p => `https://fridgeplus.app${p.chemin}`)
      .filter(u => !locs.includes(u))
    expect(manquantes).toEqual([])
  })

  it('les URLs de recette ont la forme attendue', () => {
    const cheminsStatiques = new Set(PAGES_STATIQUES.map(p => `https://fridgeplus.app${p.chemin}`))
    const recettes = locs.filter(l => l !== 'https://fridgeplus.app/' && !cheminsStatiques.has(l))
    expect(recettes.length).toBeGreaterThan(100)
    const malformees = recettes.filter(l => !/^https:\/\/fridgeplus\.app\/recipe\/[a-z0-9-]+$/.test(l))
    expect(malformees).toEqual([])
  })

  it('aucune URL en double', () => {
    const doublons = locs.filter((l, i) => locs.indexOf(l) !== i)
    expect([...new Set(doublons)]).toEqual([])
  })

  it('la trace de la décision hreflang a survécu à la génération', () => {
    // 3ᵉ endroit où cette décision est écrite (avec index.html et la mémoire
    // projet). Un générateur qui l'efface rouvre une question tranchée deux fois.
    expect(xml).toMatch(/hreflang/i)
  })

  it('chaque url porte un lastmod au format ISO court', () => {
    const lastmods = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(m => m[1])
    expect(lastmods.length).toBe(locs.length)
    const invalides = lastmods.filter(d => !/^\d{4}-\d{2}-\d{2}$/.test(d))
    expect(invalides).toEqual([])
  })
})
