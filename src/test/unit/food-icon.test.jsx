// Tests pour le composant <FoodIcon>.
// Icons Overhaul P5 — extension fallback image Supabase Storage → icône Lucide.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

// Mock l'env var avant l'import (utilisé par food-icon.jsx au top-level)
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')

const FoodIcon = (await import('../../shared/ui/food-icon')).default

describe('<FoodIcon>', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  it('tente d\'abord l\'image custom Supabase Storage (vignette pré-générée)', () => {
    render(<FoodIcon id="freezer" size={32} />)
    const img = document.querySelector('img')
    expect(img).toBeTruthy()
    expect(img.src).toContain('test.supabase.co')
    // Perf : vignette pré-générée servie via l'endpoint OBJET (0 transformation).
    expect(img.src).toContain('/storage/v1/object/public/ingredient-icons/thumb/fridge-freezer.webp')
    expect(img.src).not.toContain('/render/image/')
  })

  it('respecte la prop size', () => {
    render(<FoodIcon id="fresh" size={48} />)
    const img = document.querySelector('img')
    expect(img.width).toBe(48)
    expect(img.height).toBe(48)
  })

  it('a11y : aria-hidden sur l\'image (décorative)', () => {
    render(<FoodIcon id="meat" size={24} />)
    const img = document.querySelector('img')
    expect(img.getAttribute('aria-hidden')).toBe('true')
    expect(img.alt).toBe('')
  })

  it('attribute loading=lazy pour perf', () => {
    render(<FoodIcon id="vegetables" size={24} />)
    const img = document.querySelector('img')
    expect(img.getAttribute('loading')).toBe('lazy')
  })

  it('ne crash pas si id inconnu', () => {
    const { container } = render(<FoodIcon id="totally-unknown-id-xyz" size={24} />)
    expect(container).toBeTruthy()
  })

  it('applique style custom', () => {
    render(<FoodIcon id="freezer" size={24} style={{ marginLeft: 8 }} />)
    const img = document.querySelector('img')
    expect(img.style.marginLeft).toBe('8px')
  })
})
