import { describe, it, expect } from 'vitest'
import {
  trouverLeMorceau, dependancesDirectes, balisesDePrechargement, MORCEAUX_PAR_CHEMIN,
} from '../../../scripts/lib/prerender-page.mjs'

// Une page pré-rendue annonce le fichier de sa page (audit du 2026-10-04,
// PERF-05). Avant, le navigateur ne découvrait `faq-page-*.js` qu'après avoir
// exécuté le fichier d'entrée : un aller-retour de plus sur le chemin critique
// (demandé à 593 ms dans la trace, 280 ms après la fin de l'entrée).

const FICHIERS = [
  'index-g_7Plsdl.js', 'faq-page-Dc1E8JHA.js', 'recipe-page-CL37vgLA.js',
  'recipe-page-i18n-AbCdEfGh.js', 'recipe-modal-DKWg_6Cj.js', 'legal-content-DKrpq0ub.js',
]

describe('préchargement des pages pré-rendues', () => {
  it('trouve le fichier d’une page par son nom, sans confondre ses voisins', () => {
    expect(trouverLeMorceau(FICHIERS, 'faq-page')).toBe('faq-page-Dc1E8JHA.js')
    expect(trouverLeMorceau(FICHIERS, 'recipe-page')).toBe('recipe-page-CL37vgLA.js')
  })

  // Échec BRUYANT : un renommage casserait le préchargement en silence.
  it('lève si le fichier est introuvable', () => {
    expect(() => trouverLeMorceau(FICHIERS, 'guide-page')).toThrow(/guide-page/)
  })

  it('lève aussi s’il y en a plusieurs (lequel serait le bon ?)', () => {
    expect(() => trouverLeMorceau([...FICHIERS, 'faq-page-ZZZZZZZZ.js'], 'faq-page')).toThrow(/2 trouvé/)
  })

  it('lit les imports directs d’un fichier minifié', () => {
    const contenu = 'import{a as b}from"./legal-content-DKrpq0ub.js";import"./vendor-DW1pLsU-.js";const c=1'
    expect(dependancesDirectes(contenu)).toEqual(['legal-content-DKrpq0ub.js', 'vendor-DW1pLsU-.js'])
  })

  it('écrit les balises, sans répéter ce que le gabarit précharge déjà', () => {
    const gabarit = '<link rel="modulepreload" crossorigin href="/FridgePlus/assets/vendor-DW1pLsU-.js">'
    const balises = balisesDePrechargement('/FridgePlus/assets/', ['faq-page-Dc1E8JHA.js', 'vendor-DW1pLsU-.js', 'faq-page-Dc1E8JHA.js'], gabarit)
    expect(balises).toBe('<link rel="modulepreload" crossorigin href="/FridgePlus/assets/faq-page-Dc1E8JHA.js">')
  })

  it('les fiches recette préchargent leur page (la modale vient avec ses imports)', () => {
    expect(MORCEAUX_PAR_CHEMIN['/recipe']).toEqual(['recipe-page'])
  })

  it('chaque page statique pré-rendue a son fichier', () => {
    for (const chemin of ['/faq', '/guide', '/legal', '/changelog', '/suppression-compte', '/community', '/accessibilite', '/securite']) {
      expect(MORCEAUX_PAR_CHEMIN[chemin], chemin).toBeTruthy()
    }
  })
})
