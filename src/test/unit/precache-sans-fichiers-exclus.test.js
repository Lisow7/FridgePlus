import { describe, it, expect } from 'vitest'
import { entreesDuPrecache, entreesExclues } from '../../../scripts/verifier-precache.mjs'

// Le garde-fou du précache (`scripts/verifier-precache.mjs`, audit du
// 2026-10-04, SEO-11) lit le VRAI `dist/sw.js` après le build, en CI. Ce test
// vérifie sa lecture sur un `sw.js` au format de Workbox : un garde-fou qui ne
// trouve aucune entrée ne signalerait jamais rien.

const SW = 'importScripts("push-handler.js"),self.skipWaiting(),s.precacheAndRoute(['
  + '{url:"push-handler.js",revision:"1"},'
  + '{url:"og-image.svg",revision:"2"},'
  + '{url:"og-app-capture.png",revision:"3"},'
  + '{url:"assets/index-abc.js",revision:null},'
  + '{url:"favicon.svg",revision:"4"},'
  + '{url:"og-image.svg",revision:"2"},'
  + '{url:"icons/push-icon-192.png",revision:"5"},'
  + '{url:"404.html",revision:"6"},'
  + '{url:"icons.svg",revision:"7"},'
  + '{url:"icon-192.png",revision:"8"},'
  + '{url:"assets/admin-panel-xyz.js",revision:null},'
  + '{url:"manifest.webmanifest",revision:"9"}'
  + '],{})'

describe('garde-fou du précache — lecture de dist/sw.js', () => {
  it('lit chaque adresse une seule fois (`includeAssets` et les motifs se recouvrent)', () => {
    const urls = entreesDuPrecache(SW)
    expect(urls).toHaveLength(11)
    expect(urls.filter(u => u === 'og-image.svg')).toHaveLength(1)
  })

  it('désigne chaque fichier exclu, avec sa raison', () => {
    const exclues = entreesExclues(entreesDuPrecache(SW))
    expect(exclues.map(e => e.url)).toEqual([
      'og-image.svg', 'og-app-capture.png', 'icons/push-icon-192.png', '404.html', 'icons.svg', 'assets/admin-panel-xyz.js',
    ])
    for (const { raison } of exclues) expect(raison).toBeTruthy()
  })

  it('écarte aussi l’icône tactile d’iOS et favicon.ico, demandées en ligne (SEO-12)', () => {
    expect(entreesExclues(['apple-touch-icon.png', 'favicon.ico']).map(e => e.url)).toEqual(['apple-touch-icon.png', 'favicon.ico'])
  })

  it('écarte les pages de texte publiques (Accessibilité, Sécurité) : lues en ligne, rarement', () => {
    // Décision du 2026-10-08 : 7,1 Ko compressés de texte bilingue, que chaque
    // nouvel installé téléchargerait pour deux pages qu’il n’ouvrira sans doute
    // jamais — même compromis que le panneau admin, indisponibles hors ligne.
    const pages = ['assets/accessibility-page-VtUC5xdU.js', 'assets/security-page-Bu8V3XpR.js', 'assets/page-publique-de-texte-CdLcP4yz.js']
    expect(entreesExclues(pages).map(e => e.url)).toEqual(pages)
  })

  it('laisse passer ce dont l’application a besoin hors ligne', () => {
    const gardees = ['push-handler.js', 'assets/index-abc.js', 'favicon.svg', 'icon-192.png', 'manifest.webmanifest']
    expect(entreesExclues(gardees)).toEqual([])
  })

  it('rend null si le format du build change, au lieu d’une liste vide qui passerait', () => {
    expect(entreesDuPrecache('self.addEventListener("fetch", () => {})')).toBeNull()
  })
})
