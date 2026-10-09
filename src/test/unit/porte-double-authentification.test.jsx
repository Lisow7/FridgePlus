import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// La porte « Vérification en 2 étapes » (audit du 2026-10-04, CPT-01, CPT-02 ;
// maquette validée par Antoine le 2026-10-05).
//
// Tant que le code est dû, RIEN d'autre n'est rendu : ni l'accueil, ni le
// formulaire « mot de passe oublié ». Elle ne laisse passer que sur la PREUVE
// que la session est montée en aal2 — la modale existante appelait
// `onChallenged()` après 6 s sans rien vérifier.

const auth = vi.hoisted(() => ({ valeur: {} }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => auth.valeur }))
vi.mock('@shared/contexts/ui-provider', () => ({ useUI: () => ({ lang: 'fr', darkMode: false }) }))
const api = vi.hoisted(() => ({ verifyTOTP: vi.fn(), getAAL: vi.fn() }))
vi.mock('@shared/api/mfa', () => ({
  verifyTOTP: (...a) => api.verifyTOTP(...a),
  getAAL: (...a) => api.getAAL(...a),
}))

import PorteDoubleAuthentification from '@features/auth/components/porte-double-authentification'
import VerificationEnDeuxEtapes from '@features/auth/components/verification-en-deux-etapes'

const signOut = vi.fn()
const APP = <p>L’application</p>

function monter() {
  auth.valeur = { user: { id: 'u-1' }, mfaRequired: true, mfaFactorId: 'f1', signOut }
  return render(<VerificationEnDeuxEtapes />)
}

function monterLaPorte({ requis }) {
  auth.valeur = { user: { id: 'u-1' }, mfaRequired: requis, mfaFactorId: 'f1', signOut }
  return render(<PorteDoubleAuthentification>{APP}</PorteDoubleAuthentification>)
}

const champ = () => screen.getByLabelText('Code à 6 chiffres')
const saisir = (code) => fireEvent.change(champ(), { target: { value: code } })
const verifier = () => fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }))

beforeEach(() => {
  signOut.mockReset()
  api.verifyTOTP.mockReset()
  api.getAAL.mockReset()
})
afterEach(() => { vi.useRealTimers() })

describe('la porte', () => {
  it('code non dû : l’application, sans porte', () => {
    monterLaPorte({ requis: false })
    expect(screen.getByText('L’application')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Vérification en 2 étapes' })).not.toBeInTheDocument()
  })

  it('code dû : la porte, et RIEN de l’application — même pendant le chargement de l’écran', async () => {
    monterLaPorte({ requis: true })
    expect(screen.queryByText('L’application')).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Vérification en 2 étapes' })).toBeInTheDocument()
    expect(screen.queryByText('L’application')).not.toBeInTheDocument()
    expect(champ()).toHaveAttribute('autocomplete', 'one-time-code')
    expect(champ()).toHaveAttribute('inputmode', 'numeric')
  })

  it('n’accepte que des chiffres, six au plus', () => {
    monter()
    saisir('12a3 45678')
    expect(champ()).toHaveValue('123456')
  })

  it('« Vérifier » envoie le code au bon facteur', async () => {
    api.verifyTOTP.mockResolvedValue({ data: {}, error: null })
    monter()
    saisir('123456')
    await act(async () => { verifier() })
    expect(api.verifyTOTP).toHaveBeenCalledWith({ factorId: 'f1', code: '123456' })
  })

  it('Entrée valide aussi le code', async () => {
    api.verifyTOTP.mockResolvedValue({ data: {}, error: null })
    monter()
    saisir('123456')
    await act(async () => { fireEvent.submit(champ().closest('form')) })
    expect(api.verifyTOTP).toHaveBeenCalledTimes(1)
  })

  it('moins de six chiffres : rien n’est envoyé', async () => {
    monter()
    saisir('123')
    await act(async () => { verifier() })
    expect(api.verifyTOTP).not.toHaveBeenCalled()
  })

  it('code faux : dit, le champ est vidé, la porte reste', async () => {
    api.verifyTOTP.mockResolvedValue({ data: null, error: { code: 'mfa_verification_failed', message: 'Invalid TOTP code entered' } })
    monter()
    saisir('000000')
    await act(async () => { verifier() })
    expect(screen.getByRole('alert')).toHaveTextContent('Code incorrect')
    expect(champ()).toHaveValue('')
    expect(screen.getByRole('heading', { name: 'Vérification en 2 étapes' })).toBeInTheDocument()
  })

  it('trop d’essais : dit', async () => {
    api.verifyTOTP.mockResolvedValue({ data: null, error: { status: 429, code: 'over_request_rate_limit', message: 'Too many requests' } })
    monter()
    saisir('000000')
    await act(async () => { verifier() })
    expect(screen.getByRole('alert')).toHaveTextContent('Trop d’essais')
  })

  it('la vérification ne répond pas, et la session est toujours en aal1 : la porte RESTE, et le dit', async () => {
    vi.useFakeTimers()
    api.verifyTOTP.mockReturnValue(new Promise(() => {}))
    api.getAAL.mockResolvedValue({ current: 'aal1', next: 'aal2', error: null })
    monter()
    saisir('123456')
    await act(async () => { verifier() })
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(api.getAAL).toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('La vérification n’a pas abouti')
    expect(screen.queryByText('L’application')).not.toBeInTheDocument()
  })

  it('la vérification ne répond pas mais la session est montée en aal2 : aucun message d’erreur', async () => {
    vi.useFakeTimers()
    api.verifyTOTP.mockReturnValue(new Promise(() => {}))
    api.getAAL.mockResolvedValue({ current: 'aal2', next: 'aal2', error: null })
    monter()
    saisir('123456')
    await act(async () => { verifier() })
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('« Je n’ai plus accès à mon application » : l’adresse du support, et ce qu’on fera', () => {
    monter()
    fireEvent.click(screen.getByRole('button', { name: 'Je n’ai plus accès à mon application' }))
    const lien = screen.getByRole('link', { name: 'support@fridgeplus.app' })
    expect(lien).toHaveAttribute('href', expect.stringMatching(/^mailto:support@fridgeplus\.app/))
    expect(screen.getByText(/adresse e-mail de ton compte/)).toBeInTheDocument()
  })

  // Le module `main.jsx` ne se monte pas sous Vitest : sa forme se lit.
  it('main.jsx : la porte est juste sous AuthProvider, et enveloppe tout le reste (DataProvider compris)', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const main = readFileSync(resolve(process.cwd(), 'src/main.jsx'), 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    // La plus extérieure : juste sous AuthProvider, et refermée juste avant lui ;
    // DataProvider (et tout ce qui lit le compte) est dedans.
    expect(main).toMatch(/<AuthProvider>\s*<PorteDoubleAuthentification>/)
    expect(main).toMatch(/<\/PorteDoubleAuthentification>\s*<\/AuthProvider>/)
    expect(main.indexOf('<PorteDoubleAuthentification>')).toBeLessThan(main.indexOf('<DataProvider>'))
    expect(main.indexOf('</DataProvider>')).toBeLessThan(main.indexOf('</PorteDoubleAuthentification>'))
  })

  it('« Me déconnecter » déconnecte', async () => {
    monter()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Me déconnecter' })) })
    expect(signOut).toHaveBeenCalledTimes(1)
  })
})
