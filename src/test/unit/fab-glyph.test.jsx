// Le glyphe du bouton orange, partagé entre le menu et toute l'aide.
// Il est décoratif (aria-hidden) : le mot « bouton orange » écrit à côté
// porte le sens — un lecteur d'écran n'a rien à faire d'un carré orange.
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { LuGrid2X2 } from 'react-icons/lu'
import FabGlyph from '@shared/ui/fab-glyph'

describe('FabGlyph', () => {
  it('est décoratif et porte la même icône que le déclencheur du menu', () => {
    const { container } = render(<FabGlyph />)
    const glyphe = container.querySelector('[data-fab-glyph]')
    expect(glyphe).not.toBeNull()
    expect(glyphe.getAttribute('aria-hidden')).toBe('true')
    // Le tracé est celui de LuGrid2X2, l'icône du déclencheur dans fridge-fab.jsx —
    // comparé au rendu de l'icône elle-même, pas à une description de mémoire.
    const reference = render(<LuGrid2X2 size={11} />).container.querySelector('svg')
    expect(glyphe.querySelector('svg')?.innerHTML).toBe(reference.innerHTML)
  })

  it('se dimensionne : 16 px inline par défaut, 28 px en tête d’étape', () => {
    const { container, rerender } = render(<FabGlyph />)
    expect(container.querySelector('[data-fab-glyph]').style.width).toBe('16px')
    rerender(<FabGlyph size={28} />)
    expect(container.querySelector('[data-fab-glyph]').style.width).toBe('28px')
  })

  // Le bouton flottant est passé en orange profond (décision du 2026-10-06,
  // « couleurs = profond ») : le glyphe qui le représente dans l'aide le suit.
  it('est orange profond sur fond dégradé, comme le bouton lui-même', () => {
    const { container } = render(<FabGlyph />)
    expect(container.querySelector('[data-fab-glyph]').style.background).toContain('--gradient-deep')
  })
})
