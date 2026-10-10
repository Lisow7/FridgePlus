import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const resendSignupEmail = vi.hoisted(() => vi.fn())

vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: () => ({ resendSignupEmail }),
}))

import ResendConfirmation, { RESEND_COOLDOWN_S } from '@features/auth/components/resend-confirmation'

// Audit du 2026-10-04, CPT-13 : aucun moyen de redemander l'e-mail de
// confirmation — ni après l'inscription, ni devant « E-mail non confirmé ».
// Une adresse mal lue ou un lien expiré laissait le compte inutilisable.
describe('ResendConfirmation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resendSignupEmail.mockReset()
    resendSignupEmail.mockResolvedValue({ error: null })
  })
  afterEach(() => { vi.useRealTimers() })

  const bouton = () => screen.getByRole('button')
  const avancer = async (secondes) => { await act(async () => { vi.advanceTimersByTime(secondes * 1000) }) }
  const cliquer = async () => { await act(async () => { fireEvent.click(bouton()) }) }

  it('le service refuse plus d’une demande par minute : le délai est de 60 s', () => {
    expect(RESEND_COOLDOWN_S).toBe(60)
  })

  it('sans délai de départ, le bouton est disponible tout de suite', () => {
    render(<ChampDeTest />)
    expect(bouton()).toBeEnabled()
    expect(bouton()).toHaveTextContent(/renvoyer l['’]e-mail de confirmation/i)
  })

  it('avec un délai de départ (un e-mail vient de partir), il attend en comptant', async () => {
    render(<ChampDeTest startCoolingDown />)
    expect(bouton()).toBeDisabled()
    expect(bouton()).toHaveTextContent(/60 s/)
    await avancer(1)
    expect(bouton()).toHaveTextContent(/59 s/)
    await avancer(59)
    expect(bouton()).toBeEnabled()
  })

  it('au clic, redemande l’e-mail pour cette adresse et le dit', async () => {
    render(<ChampDeTest />)
    await cliquer()
    expect(resendSignupEmail).toHaveBeenCalledWith('bob@test.com')
    expect(screen.getByRole('status')).toHaveTextContent(/e-mail renvoyé/i)
  })

  it('après un envoi, le délai repart : pas de rafale', async () => {
    render(<ChampDeTest />)
    await cliquer()
    expect(bouton()).toBeDisabled()
    await cliquer()
    expect(resendSignupEmail).toHaveBeenCalledTimes(1)
    await avancer(60)
    expect(bouton()).toBeEnabled()
  })

  it('si le service refuse, le dit sans prétendre que c’est parti', async () => {
    resendSignupEmail.mockResolvedValue({ error: { status: 429, message: 'For security purposes, you can only request this after 60 seconds.' } })
    render(<ChampDeTest />)
    await cliquer()
    expect(screen.getByRole('alert')).toHaveTextContent(/impossible de renvoyer/i)
    expect(screen.queryByRole('status')).toBeNull()
    // Le message du service n'est pas recopié tel quel.
    expect(screen.getByRole('alert')).not.toHaveTextContent(/security purposes/i)
  })

  it('en anglais aussi', () => {
    render(<ChampDeTest lang="en" />)
    expect(bouton()).toHaveTextContent(/resend the confirmation e-mail/i)
  })
})

function ChampDeTest(props) {
  return <ResendConfirmation email="bob@test.com" lang="fr" {...props} />
}
