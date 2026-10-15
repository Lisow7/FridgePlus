import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'

// Trouvé en écrivant l'e2e du réseau absent (2026-10-10) : le bandeau de mise à
// jour (`UpdatePrompt`, chargé à la demande au démarrage) dont le morceau ne
// charge pas — réseau coupé pendant une première visite — faisait tomber TOUTE
// l'application sur l'écran « Une erreur est survenue ». Un élément facultatif
// absent ne doit rien emporter : il ne s'affiche pas, l'échec va au journal.

const m = vi.hoisted(() => ({ logError: vi.fn() }))
vi.mock('@shared/lib/observability/sentry', () => ({ logError: m.logError }))

import SiIndisponibleRien from '@app/error/si-indisponible-rien'

beforeEach(() => {
  m.logError.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('un élément facultatif qui ne se charge pas', () => {
  it('ne s’affiche pas, n’emporte rien, et l’échec va au journal', () => {
    function MorceauAbsent() { throw new TypeError('Failed to fetch dynamically imported module') }
    render(
      <main>
        <p>le reste de l’application</p>
        <SiIndisponibleRien nom="update-prompt"><MorceauAbsent /></SiIndisponibleRien>
      </main>,
    )
    expect(screen.getByText('le reste de l’application')).toBeInTheDocument()
    expect(m.logError).toHaveBeenCalledWith(expect.any(TypeError), expect.objectContaining({ tag: 'error-boundary.facultatif', nom: 'update-prompt' }))
  })

  it('sans erreur, il s’affiche (témoin)', () => {
    render(<SiIndisponibleRien nom="x"><p>présent</p></SiIndisponibleRien>)
    expect(screen.getByText('présent')).toBeInTheDocument()
  })

  it('le bandeau de mise à jour en est entouré', () => {
    const source = readFileSync('src/app/components/global-overlays.jsx', 'utf8')
    expect(source).toMatch(/<SiIndisponibleRien nom="update-prompt">\s*<Suspense fallback=\{null\}>\s*<UpdatePrompt/)
  })
})
