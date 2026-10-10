import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

// Décision du 2026-10-08 (audit du 2026-10-04) : quand le réseau tombe, rien ne
// le disait — un compte ne l'apprenait qu'en touchant à son frigo, un invité en
// voyant la voix et la photo du ticket ne plus marcher. Un bandeau tant que le
// réseau manque, qui part seul à son retour. Textes de la maquette validée.

const etat = vi.hoisted(() => ({ user: null, lang: 'fr' }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: etat.user }) }))
vi.mock('@shared/contexts/ui-provider', () => ({ useLang: () => ({ lang: etat.lang }) }))

import BandeauHorsLigne from '@app/components/bandeau-hors-ligne'

let enLigne = true
beforeEach(() => {
  etat.user = null
  etat.lang = 'fr'
  enLigne = true
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => enLigne)
})
afterEach(() => { vi.restoreAllMocks() })

function couperLeReseau() { act(() => { enLigne = false; window.dispatchEvent(new Event('offline')) }) }
function rendreLeReseau() { act(() => { enLigne = true; window.dispatchEvent(new Event('online')) }) }

describe('le bandeau « Pas de réseau »', () => {
  it('réseau là : rien', () => {
    render(<BandeauHorsLigne />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('pour un compte : ce qu’on change ne sera pas enregistré', () => {
    etat.user = { id: 'u1' }
    render(<BandeauHorsLigne />)
    couperLeReseau()
    expect(screen.getByRole('status')).toHaveTextContent('Pas de réseau. Ce que tu changes ne sera pas enregistré tant qu’il n’est pas revenu.')
  })

  it('pour un invité : la voix et la photo du ticket attendront', () => {
    render(<BandeauHorsLigne />)
    couperLeReseau()
    expect(screen.getByRole('status')).toHaveTextContent('Pas de réseau. La voix et la photo du ticket attendront son retour.')
  })

  it('part seul quand le réseau revient', () => {
    render(<BandeauHorsLigne />)
    couperLeReseau()
    expect(screen.getByRole('status')).toBeInTheDocument()
    rendreLeReseau()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('déjà hors ligne à l’ouverture : affiché d’emblée', () => {
    enLigne = false
    render(<BandeauHorsLigne />)
    expect(screen.getByRole('status')).toHaveTextContent('Pas de réseau.')
  })

  it('en anglais aussi', () => {
    etat.lang = 'en'
    etat.user = { id: 'u1' }
    render(<BandeauHorsLigne />)
    couperLeReseau()
    expect(screen.getByRole('status')).toHaveTextContent('No network. What you change won’t be saved until it’s back.')
  })
})
