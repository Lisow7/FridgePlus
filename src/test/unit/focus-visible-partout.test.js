import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// On voit toujours où l'on est au clavier (audit du 2026-10-04, A11Y-02 et
// A11Y-18).
//
// Avant : aucune règle `:focus-visible` dans `index.css`, et 63 `outline: none`
// en ligne — un utilisateur au clavier ne savait pas dans quel champ il
// écrivait, connexion et inscription comprises. Et les anneaux de Tailwind
// (`focus-visible:ring`) sont des ombres, que le mode « contraste élevé » de
// Windows efface : un contour (`outline`) y reste visible.

const CSS = readFileSync(resolve(__dirname, '../../index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

describe('focus visible partout', () => {
  it('une règle :focus-visible couvre champs, boutons, liens et éléments focalisables', () => {
    const regle = CSS.match(/:where\(([\s\S]*?)\):focus-visible\s*\{([^}]*)\}/)
    expect(regle).toBeTruthy()
    const cibles = regle[1]
    for (const c of ['a', 'button', 'input', 'select', 'textarea', 'summary', '[tabindex]', '[role="button"]', '[role="switch"]']) {
      expect(cibles, c).toContain(c)
    }
  })

  // `outline: none` en ligne bat toute règle sans !important : la règle doit
  // gagner tant que les 63 sites ne sont pas nettoyés.
  it('le contour l’emporte sur un outline: none posé en ligne', () => {
    const corps = CSS.match(/:where\([\s\S]*?\):focus-visible\s*\{([^}]*)\}/)[1]
    expect(corps).toMatch(/outline:\s*2px solid [^;]+!important/)
    expect(corps).toMatch(/outline-offset:\s*2px/)
  })
})
