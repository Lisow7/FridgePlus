// Audit du 2026-10-04, P-08 — vu en direct : en se connectant dans un
// navigateur neuf, un compte créé en juin retrouvait « Bienvenue en cuisine ! »
// par-dessus son frigo. Le drapeau « déjà vu » ne vit que dans le navigateur.
//
// Un compte qui existe depuis plus d'un jour n'est pas un nouveau venu. Un
// compte créé à l'instant (inscription Google arrivée directement sur
// /signup), lui, n'a jamais vu cet écran : il le garde.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { welcomeAudience, hasSeenWelcome } from '@features/onboarding/lib/welcome-storage'

vi.mock('@shared/hooks/use-consent', () => ({
  useConsent: () => ({
    hasDecided: true,
    consent: { essential: true },
    accept: vi.fn(), refuse: vi.fn(), save: vi.fn(),
    setVoiceConsent: vi.fn(), setReceiptScanConsent: vi.fn(), reset: vi.fn(),
  }),
}))
vi.mock('@features/onboarding/components/welcome-screen', () => ({
  default: () => <div data-testid="welcome">Bienvenue en cuisine !</div>,
}))
vi.mock('@features/pwa/components/update-prompt', () => ({ default: () => null }))
vi.mock('@features/premium/components/upgrade-modal', () => ({ default: () => null }))

import GlobalOverlays from '@app/components/global-overlays'

const MAINTENANT = Date.parse('2026-10-05T10:00:00Z')
const ilYA = (ms) => new Date(MAINTENANT - ms).toISOString()
const MINUTE = 60 * 1000
const JOUR = 24 * 60 * MINUTE
const BOB = { id: 'u-bob' }
// La bienvenue est chargée à la demande (React.lazy) : on laisse ce chargement
// se résoudre avant chaque vérification, présence comme absence.
const laisserCharger = () => act(() => new Promise((r) => setTimeout(r, 0)))

describe('à qui montrer l’écran de bienvenue', () => {
  const decider = (cas) => welcomeAudience({ now: MAINTENANT, ...cas })

  it('un visiteur : oui', () => {
    expect(decider({ authLoading: false, user: null, profile: null })).toBe('show')
  })

  it('tant qu’on ne sait pas qui est là : on attend', () => {
    expect(decider({ authLoading: true, user: null, profile: null })).toBe('wait')
    expect(decider({ authLoading: false, user: BOB, profile: null })).toBe('wait')
  })

  it('un compte créé il y a cinq minutes : oui', () => {
    expect(decider({ authLoading: false, user: BOB, profile: { created_at: ilYA(5 * MINUTE) } })).toBe('show')
  })

  it('un compte créé il y a trois mois : non', () => {
    expect(decider({ authLoading: false, user: BOB, profile: { created_at: ilYA(90 * JOUR) } })).toBe('skip')
  })

  it('la limite est d’un jour', () => {
    expect(decider({ authLoading: false, user: BOB, profile: { created_at: ilYA(JOUR - MINUTE) } })).toBe('show')
    expect(decider({ authLoading: false, user: BOB, profile: { created_at: ilYA(JOUR + MINUTE) } })).toBe('skip')
  })

  it('une date de création illisible ne prive pas de l’écran', () => {
    expect(decider({ authLoading: false, user: BOB, profile: { created_at: null } })).toBe('show')
  })
})

describe('GlobalOverlays — l’écran de bienvenue selon le compte', () => {
  const fermer = vi.fn()
  const props = { welcomeOpen: true, onWelcomeClose: fermer, lang: 'fr', darkMode: false }

  beforeEach(() => {
    localStorage.clear()
    fermer.mockReset()
  })

  it('visiteur : l’écran s’affiche', async () => {
    render(<GlobalOverlays {...props} authLoading={false} user={null} profile={null} />)
    expect(await screen.findByTestId('welcome')).toBeInTheDocument()
    expect(fermer).not.toHaveBeenCalled()
  })

  it('session en cours de chargement : rien encore, et rien n’est décidé', async () => {
    render(<GlobalOverlays {...props} authLoading user={null} profile={null} />)
    await laisserCharger()
    expect(screen.queryByTestId('welcome')).toBeNull()
    expect(fermer).not.toHaveBeenCalled()
    expect(hasSeenWelcome()).toBe(false)
  })

  it('compte ancien dans un navigateur neuf : pas d’écran, et il est noté « vu »', async () => {
    const ancien = { id: 'u-bob', created_at: new Date(Date.now() - 90 * JOUR).toISOString() }
    render(<GlobalOverlays {...props} authLoading={false} user={BOB} profile={ancien} />)
    await laisserCharger()
    expect(screen.queryByTestId('welcome')).toBeNull()
    expect(fermer).toHaveBeenCalledTimes(1)
    // Noté « vu » : le reste de l'accueil (guide, fusée) cesse de traiter ce
    // compte comme un premier venu.
    expect(hasSeenWelcome()).toBe(true)
  })

  it('compte créé à l’instant : l’écran s’affiche', async () => {
    const neuf = { id: 'u-bob', created_at: new Date(Date.now() - 2 * MINUTE).toISOString() }
    render(<GlobalOverlays {...props} authLoading={false} user={BOB} profile={neuf} />)
    expect(await screen.findByTestId('welcome')).toBeInTheDocument()
    expect(fermer).not.toHaveBeenCalled()
  })

  it('le profil arrive après coup : l’écran attend, puis la décision tombe', async () => {
    const ancien = { id: 'u-bob', created_at: new Date(Date.now() - 90 * JOUR).toISOString() }
    const { rerender } = render(<GlobalOverlays {...props} authLoading={false} user={BOB} profile={null} />)
    await laisserCharger()
    expect(screen.queryByTestId('welcome')).toBeNull()
    expect(fermer).not.toHaveBeenCalled()
    rerender(<GlobalOverlays {...props} authLoading={false} user={BOB} profile={ancien} />)
    await laisserCharger()
    expect(screen.queryByTestId('welcome')).toBeNull()
    expect(fermer).toHaveBeenCalledTimes(1)
  })
})
