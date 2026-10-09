// Tests pour le composant <Emoji>.
// Icons Overhaul P1 — extension prop `imageUrl` rétro-compat.

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import Emoji from '../../shared/ui/emoji'

describe('<Emoji>', () => {
  it('rend une img Fluent Emoji par défaut pour les emojis mappés', () => {
    render(<Emoji char="🍅" />)
    const img = document.querySelector('img')
    expect(img).toBeTruthy()
    // Tomate est mappé dans FLUENT_EMOJI_MAP → image hébergée par le site
    // (Iconify, avant le 2026-10-06 : voir emoji-sur-le-site.test.jsx)
    expect(img.src).toContain('/emoji/fluent/tomato.svg')
  })

  it('fallback Twemoji pour les emojis non mappés dans Fluent', () => {
    // Codepoint U+1F954 (🥔 patate) non mappé volontairement
    render(<Emoji char="🪨" />)
    const img = document.querySelector('img')
    expect(img.src).toContain('twemoji')
  })

  it('prop imageUrl prioritaire sur Fluent et Twemoji', () => {
    // L'image doit venir du stockage public du projet : un autre hôte est
    // ignoré (voir trusted-image-url.test.jsx). Ce test utilisait
    // `https://example.com/…` et figeait donc le défaut SEC-15.
    vi.stubEnv('VITE_SUPABASE_URL', 'https://projet.supabase.co')
    const customUrl = 'https://projet.supabase.co/storage/v1/object/public/avatars/custom-tomato.webp'
    render(<Emoji char="🍅" imageUrl={customUrl} />)
    const img = document.querySelector('img')
    expect(img.src).toBe(customUrl)
    expect(img.src).not.toContain('twemoji')
    expect(img.src).not.toContain('iconify')
    vi.unstubAllEnvs()
  })

  it('lazy loading attribute présent pour perf', () => {
    render(<Emoji char="🍅" />)
    const img = document.querySelector('img')
    expect(img.getAttribute('loading')).toBe('lazy')
  })

  it('a11y : aria-hidden par défaut (emoji décoratif)', () => {
    render(<Emoji char="🍅" />)
    const img = document.querySelector('img')
    expect(img.getAttribute('aria-hidden')).toBe('true')
    expect(img.alt).toBe('')
  })

  it('a11y : aria-label + role img quand label fourni (emoji informatif)', () => {
    render(<Emoji char="🇫🇷" label="France" />)
    const img = document.querySelector('img')
    expect(img.getAttribute('aria-label')).toBe('France')
    expect(img.getAttribute('role')).toBe('img')
    expect(img.alt).toBe('France')
  })

  it('respecte la prop size pour width/height', () => {
    render(<Emoji char="🍅" size={48} />)
    const img = document.querySelector('img')
    expect(img.width).toBe(48)
    expect(img.height).toBe(48)
  })

  it('applique className et style', () => {
    render(<Emoji char="🍅" className="my-emoji" style={{ marginLeft: 4 }} />)
    const img = document.querySelector('img')
    expect(img.className).toBe('my-emoji')
    expect(img.style.marginLeft).toBe('4px')
  })

  it('emoji multi-codepoint (drapeau) résolu correctement vers Twemoji', () => {
    render(<Emoji char="🇫🇷" />)
    const img = document.querySelector('img')
    expect(img.src).toContain('1f1eb-1f1f7')  // FR flag = 2 codepoints
  })

  it('rétro-compat : pas de imageUrl prop = comportement identique', () => {
    const { container: c1 } = render(<Emoji char="🍅" size={24} />)
    const { container: c2 } = render(<Emoji char="🍅" size={24} imageUrl={null} />)
    // Les deux doivent rendre Twemoji
    expect(c1.querySelector('img').src).toBe(c2.querySelector('img').src)
  })
})
