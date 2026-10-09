import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Garde-fou du manifeste produit par `npm run prerender:data`.
//
// CE QU'IL PROTÈGE
// `scripts/prerender.mjs` écrit une page par entrée de ce fichier. Un manifeste
// à moitié régénéré ne casserait rien de visible : le build passerait, le site
// marcherait, et seules les recettes manquantes retomberaient silencieusement
// sur les métadonnées génériques — exactement le défaut que le pré-rendu
// corrige. Le script refuse déjà d'écrire sur 0 recette ; ce test garde le
// fichier COMMITÉ.
//
// ⚠️ CE QU'IL NE FAIT PAS
// Il ne parle pas à Supabase (la CI n'a aucune clé), donc il ne vérifie pas que
// le manifeste correspond à la base. Un manifeste périmé sur le CONTENU (un
// titre corrigé) passe : contrepartie assumée du choix « script manuel »,
// documentée dans `scripts/generate-prerender-manifest.mjs`.
// Il attrape en revanche la dérive de PÉRIMÈTRE, en confrontant le manifeste au
// sitemap — les deux viennent du même filtre, donc leur désaccord signale
// qu'une des deux régénérations a été oubliée.

const MANIFESTE = resolve(process.cwd(), 'scripts/data/prerender-manifest.json')
const SITEMAP = resolve(process.cwd(), 'public/sitemap.xml')

const manifeste = JSON.parse(readFileSync(MANIFESTE, 'utf8'))
const recettes = manifeste.recettes

describe('prerender-manifest.json', () => {
  it('déclare tout le catalogue, pas une poignée de recettes', () => {
    // Seuil volontairement bas : il attrape l'effondrement, pas la dérive
    // d'une recette près.
    expect(recettes.length).toBeGreaterThan(100)
  })

  it('annonce la langue du pré-rendu', () => {
    // Une URL unique dessert 5 langues : le HTML servi n'en porte qu'une, et ce
    // choix doit rester lisible dans le fichier produit.
    expect(manifeste.lang).toBe('fr')
  })

  it('chaque id est un slug — un id devient un CHEMIN de fichier', () => {
    const invalides = recettes.filter(r => !/^[a-z0-9][a-z0-9-]*$/.test(r.id ?? ''))
    expect(invalides.map(r => r.id)).toEqual([])
  })

  it('aucun id en double', () => {
    const ids = recettes.map(r => r.id)
    const doublons = ids.filter((id, i) => ids.indexOf(id) !== i)
    expect([...new Set(doublons)]).toEqual([])
  })

  it('chaque recette a un nom non vide', () => {
    const sansNom = recettes.filter(r => !r.nom || !String(r.nom).trim())
    expect(sansNom.map(r => r.id)).toEqual([])
  })

  it('toute image déclarée est une URL ABSOLUE', () => {
    // Une og:image relative est ignorée par la plupart des crawlers : elle
    // produirait une balise présente et inerte, le pire des deux mondes.
    const relatives = recettes.filter(r => r.image && !/^https?:\/\//.test(r.image))
    expect(relatives.map(r => r.id)).toEqual([])
  })

  it('la majorité des recettes a une description à partager', () => {
    const avecDesc = recettes.filter(r => r.description && r.description.trim()).length
    expect(avecDesc / recettes.length).toBeGreaterThan(0.9)
  })
})

describe('prerender-manifest.json ↔ sitemap.xml — même périmètre', () => {
  // Les deux fichiers sont produits par deux scripts manuels distincts,
  // à partir du MÊME filtre (`deleted_at is null` + `status='published'`).
  // Régénérer l'un sans l'autre est l'erreur naturelle ; c'est ce que ce bloc
  // attrape, sans avoir besoin de la moindre clé Supabase.
  const xml = readFileSync(SITEMAP, 'utf8')
  const idsSitemap = [...xml.matchAll(/<loc>https:\/\/fridgeplus\.app\/recipe\/([^<]+)<\/loc>/g)]
    .map(m => m[1])
    .sort()
  const idsManifeste = recettes.map(r => r.id).sort()

  it('le sitemap déclare bien des pages recette (sinon ce bloc serait aveugle)', () => {
    expect(idsSitemap.length).toBeGreaterThan(100)
  })

  it('aucune recette pré-rendue qui manque au sitemap', () => {
    const orphelines = idsManifeste.filter(id => !idsSitemap.includes(id))
    expect(orphelines, 'relancer `npm run sitemap`').toEqual([])
  })

  it('aucune recette du sitemap qui manque au pré-rendu', () => {
    const oubliees = idsSitemap.filter(id => !idsManifeste.includes(id))
    expect(oubliees, 'relancer `npm run prerender:data`').toEqual([])
  })
})
