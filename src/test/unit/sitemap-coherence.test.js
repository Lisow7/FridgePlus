import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PAGES_STATIQUES, pagesAuPlanDuSite } from '../../../scripts/lib/prerender-page.mjs'

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

  it('déclare chaque page statique pré-rendue — `/community` seulement si son fil a des messages', () => {
    // Cohérence avec `PAGES_STATIQUES`, la liste que lit aussi le pré-rendu.
    // Une page pré-rendue mais absente d'ici se priverait de sa découverte —
    // et le sitemap resterait un fichier parfaitement valide. Lire la liste
    // plutôt que réécrire les chemins : une liste recopiée finit décalée.
    //
    // Le test ne parle pas à la base : il encadre. Fil vide → le MINIMUM doit
    // y être ; fil non vide → rien au-delà du MAXIMUM.
    const url = p => `https://fridgeplus.app${p.chemin}`
    const minimum = pagesAuPlanDuSite({ messagesCommunaute: 0 }).map(url)
    const maximum = new Set(pagesAuPlanDuSite({ messagesCommunaute: 1 }).map(url))
    expect(minimum.filter(u => !locs.includes(u))).toEqual([])
    const statiques = new Set(PAGES_STATIQUES.map(url))
    expect(locs.filter(u => statiques.has(u) && !maximum.has(u))).toEqual([])
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

  // Audit du 2026-10-04, SEO-10 : l'accueil et les pages statiques portaient la
  // date du jour de GÉNÉRATION, pas celle d'une modification. Google ignore un
  // `lastmod` qu'il juge peu fiable — sur tout le fichier. Pas de date vaut
  // mieux qu'une fausse.
  const blocs = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(m => m[1])
  const estRecette = bloc => /<loc>https:\/\/fridgeplus\.app\/recipe\//.test(bloc)

  it('seules les recettes portent un lastmod (leur `updated_at`), au format ISO court', () => {
    const recettes = blocs.filter(estRecette)
    expect(recettes.length).toBeGreaterThan(100)
    const sansDate = recettes.filter(b => !/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(b))
    expect(sansDate).toEqual([])
    const autresDatees = blocs.filter(b => !estRecette(b) && /<lastmod>/.test(b))
    expect(autresDatees).toEqual([])
  })

  it('ni changefreq ni priority : Google les ignore, ils ne disaient rien de vrai', () => {
    expect(xml).not.toMatch(/<changefreq>|<priority>/)
  })
})

describe('pagesAuPlanDuSite — ce que le générateur annonce', () => {
  it('fil de la communauté vide → `/community` n’est pas annoncée', () => {
    expect(pagesAuPlanDuSite({ messagesCommunaute: 0 }).map(p => p.chemin)).not.toContain('/community')
  })

  it('comptage en échec → pas annoncée non plus (on n’annonce que ce qu’on a vu)', () => {
    expect(pagesAuPlanDuSite({ messagesCommunaute: null }).map(p => p.chemin)).not.toContain('/community')
  })

  it('un message visible suffit à l’annoncer', () => {
    expect(pagesAuPlanDuSite({ messagesCommunaute: 1 }).map(p => p.chemin)).toContain('/community')
  })

  it('les autres pages statiques sont toujours annoncées', () => {
    const autres = PAGES_STATIQUES.filter(p => p.chemin !== '/community').map(p => p.chemin)
    expect(pagesAuPlanDuSite({ messagesCommunaute: 0 }).map(p => p.chemin)).toEqual(autres)
  })
})
