// Tests unit — community-theme (thème/helpers partagés extraits de
// community-page.jsx, audit front §2).

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { getC, catColor, CD, CL } from '@features/community/components/community-theme'
import { CategoryIcon } from '@features/community/components/community-category-icon'

describe('community-theme', () => {
  it('getC renvoie la palette dark (true) ou light (false)', () => {
    expect(getC(true)).toBe(CD)
    expect(getC(false)).toBe(CL)
  })

  it('catColor mappe la catégorie sur une couleur, avec fallback orange', () => {
    expect(catColor('questions', true).color).toBe(CD.cyan)
    expect(catColor('pride', false).color).toBe(CL.magenta)
    expect(catColor('categorie-inconnue', true).color).toBe(CD.orange) // fallback
  })

  it('CategoryIcon rend une icône SVG', () => {
    const { container } = render(<CategoryIcon cat="general" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
