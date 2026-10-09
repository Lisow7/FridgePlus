import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { shouldOpenWelcome, markWelcomeSeen } from '@features/onboarding/lib/welcome-storage'

// L'écran de bienvenue ne doit s'ouvrir QUE sur la page d'accueil.
//
// ── Ce que ce test empêche, et qui s'est produit ───────────────────────────
// Constaté sur la preview le 2026-08-19, stockage vidé, sur `/faq` : l'écran de
// bienvenue s'affichait en plein écran par-dessus la page, avec la bannière
// cookies et un toast PWA au-dessus de lui. Trois couches, aucun contenu
// visible. Quelqu'un arrivant d'un moteur de recherche ne voyait pas une seule
// des réponses qu'il venait chercher.
//
// Le défaut existait depuis toujours — `useAppModals({ welcome: !hasSeenWelcome() })`
// n'a jamais regardé la route. Il était sans conséquence tant qu'aucune URL
// n'était atteignable de l'extérieur. Depuis le pré-rendu, il y en a 520 :
// 5 pages statiques et 515 recettes.
//
// 🥇 **Une condition manquante ne devient un défaut que le jour où le contexte
// change.** Rien n'a été « cassé » ici : c'est le monde autour du code qui a
// bougé, et personne ne relit un code que rien n'a modifié.

describe('écran de bienvenue — sur quelles routes', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('s’ouvre sur la page d’accueil quand il n’a jamais été vu', () => {
    expect(shouldOpenWelcome('/')).toBe(true)
  })

  it('ne s’ouvre PAS sur une page de contenu public', () => {
    // Ce sont exactement les pages que le pré-rendu rend trouvables depuis
    // Google : les y couvrir annule le bénéfice qu'on vient de gagner.
    for (const chemin of ['/faq', '/guide', '/legal', '/changelog', '/community']) {
      expect(shouldOpenWelcome(chemin)).toBe(false)
    }
  })

  it('ne s’ouvre PAS sur une page recette', () => {
    // 515 URLs indexées : c'est la porte d'entrée la plus probable depuis un
    // moteur de recherche.
    expect(shouldOpenWelcome('/recipe/salade-cesar')).toBe(false)
  })

  it('ne s’ouvre nulle part une fois qu’il a été vu', () => {
    markWelcomeSeen()
    expect(shouldOpenWelcome('/')).toBe(false)
    expect(shouldOpenWelcome('/faq')).toBe(false)
  })

  it('traite une route absente comme une non-accueil', () => {
    // Défensif : un appel sans argument ne doit pas ouvrir l'écran par défaut.
    // Se tromper dans ce sens ne coûte qu'un onboarding différé ; se tromper
    // dans l'autre remet un écran plein sur une page de contenu.
    expect(shouldOpenWelcome(undefined)).toBe(false)
    expect(shouldOpenWelcome('')).toBe(false)
  })
})

// ── Le contrôle qui manque toujours : la règle est-elle BRANCHÉE ? ──────────
// Une règle juste que personne n'appelle est invisible aux tests. Ce dépôt l'a
// payé le 2026-08-14 avec le plafond budgétaire : le cliquet passait au vert
// alors que l'appel avait été commenté.
describe('la règle est réellement câblée dans App.jsx', () => {
  const SOURCE = readFileSync(resolve(process.cwd(), 'src/App.jsx'), 'utf8')
  // Les commentaires sont retirés AVANT toute recherche : l'un d'eux nomme
  // justement les deux fonctions cherchées ci-dessous.
  const app = SOURCE
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

  it('passe la route à la décision d’ouverture', () => {
    expect(app).toContain('welcome: shouldOpenWelcome(location.pathname)')
  })

  it('n’ouvre plus l’écran sur le seul drapeau', () => {
    // L'ancienne ligne était : `useAppModals({ welcome: !hasSeenWelcome() })`.
    expect(app).not.toMatch(/welcome:\s*!hasSeenWelcome\(\)/)
  })

  it('lit le pathname de React Router, pas celui du navigateur', () => {
    // `window.location.pathname` inclut le `basename` (`/FridgePlus/` hors
    // Vercel) que React Router retire : la comparaison à '/' serait fausse
    // partout sauf en production, et l'écran ne s'afficherait jamais.
    expect(app).not.toContain('shouldOpenWelcome(window.location')
    expect(app).toMatch(/const location = useLocation\(\)/)
  })
})
