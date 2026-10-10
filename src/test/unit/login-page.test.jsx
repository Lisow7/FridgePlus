import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const signInWithEmail = vi.hoisted(() => vi.fn())
const resetPassword = vi.hoisted(() => vi.fn())
const resendSignupEmail = vi.hoisted(() => vi.fn())

vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: () => ({ signInWithEmail, resetPassword, resendSignupEmail, signInWithGoogle: vi.fn() }),
}))
vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>,
}))

import LoginPage from '@features/auth/pages/login-page'

const champ = (attribut) => document.querySelector(`input[autocomplete="${attribut}"]`)

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear()
    signInWithEmail.mockReset()
    signInWithEmail.mockResolvedValue({ error: null })
    resetPassword.mockReset()
    resetPassword.mockResolvedValue({ error: null })
    resendSignupEmail.mockReset()
    resendSignupEmail.mockResolvedValue({ error: null })
  })

  // ── CPT-03 : la durée annoncée ─────────────────────────────────────────
  // L'écran disait « valide environ 24 h », l'e-mail « expire dans 1 heure ».
  // Les conseils de sécurité de Supabase confirment que le réglage ne dépasse
  // pas une heure (aucune alerte « expiration longue » le 2026-10-04).
  it('mot de passe oublié : annonce la même durée que l’e-mail, et où ouvrir le lien', async () => {
    render(<LoginPage lang="fr" />)
    fireEvent.click(screen.getByRole('button', { name: /mot de passe oublié/i }))
    fireEvent.change(champ('email'), { target: { value: 'bob@test.com' } })
    fireEvent.click(screen.getByRole('button', { name: /envoyer le lien/i }))
    const message = await screen.findByRole('status')
    expect(message).toHaveTextContent(/une heure/i)
    expect(message).toHaveTextContent(/une seule fois/i)
    // Le lien ne fonctionne que dans le navigateur de la demande : autant le dire avant.
    expect(message).toHaveTextContent(/dans ce navigateur/i)
    expect(message).not.toHaveTextContent(/24/)
  })

  it('l’écran et l’e-mail annoncent la même durée', () => {
    const gabarit = readFileSync(resolve(process.cwd(), 'supabase/email-templates/reset-password.html'), 'utf8')
    const page = readFileSync(resolve(process.cwd(), 'src/features/auth/pages/login-page.jsx'), 'utf8')
    expect(gabarit.includes('expire dans 1 heure'), 'l’e-mail annonce une heure').toBe(true)
    expect(/24 ?h/.test(page), 'la page ne parle plus de 24 h').toBe(false)
    expect(page.includes('une heure'), 'la page annonce une heure').toBe(true)
  })

  // ── « Se souvenir de moi » retirée (décision du 2026-10-08) ───────────
  // La case ne gardait que l'adresse, en clair sur l'appareil ; la session
  // restait ouverte cochée ou non. Le navigateur retient déjà l'adresse.
  it('plus de case « Se souvenir de moi », et l’adresse n’est plus écrite sur l’appareil', async () => {
    render(<LoginPage lang="fr" />)
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByText(/se souvenir de moi/i)).toBeNull()
    fireEvent.change(champ('email'), { target: { value: 'bob@test.com' } })
    fireEvent.change(champ('current-password'), { target: { value: 'secret-de-test' } })
    fireEvent.click(screen.getByRole('button', { name: /^se connecter$/i }))
    await waitFor(() => expect(signInWithEmail).toHaveBeenCalled())
    expect(localStorage.getItem('fridge-remember-email')).toBeNull()
  })

  it('une adresse retenue autrefois ne pré-remplit plus le champ', () => {
    localStorage.setItem('fridge-remember-email', 'ancienne@test.com')
    render(<LoginPage lang="fr" />)
    expect(champ('email').value).toBe('')
  })

  // ── CPT-13 : redemander l'e-mail de confirmation ───────────────────────
  it('e-mail non confirmé : propose de renvoyer l’e-mail, pour l’adresse saisie', async () => {
    signInWithEmail.mockResolvedValue({ error: { message: 'Email not confirmed' } })
    render(<LoginPage lang="fr" />)
    fireEvent.change(champ('email'), { target: { value: 'bob@test.com' } })
    fireEvent.change(champ('current-password'), { target: { value: 'peu importe' } })
    fireEvent.click(screen.getByRole('button', { name: /^se connecter$/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/non confirmé/i))
    fireEvent.click(screen.getByRole('button', { name: /renvoyer l['’]e-mail de confirmation/i }))
    await waitFor(() => expect(resendSignupEmail).toHaveBeenCalledWith('bob@test.com'))
  })

  it('identifiants refusés : pas de bouton de renvoi', async () => {
    signInWithEmail.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    render(<LoginPage lang="fr" />)
    fireEvent.change(champ('email'), { target: { value: 'bob@test.com' } })
    fireEvent.change(champ('current-password'), { target: { value: 'faux' } })
    fireEvent.click(screen.getByRole('button', { name: /^se connecter$/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /renvoyer l['’]e-mail/i })).toBeNull()
  })

  it('le bouton de renvoi disparaît dès qu’on retente de se connecter', async () => {
    signInWithEmail.mockResolvedValueOnce({ error: { message: 'Email not confirmed' } })
    render(<LoginPage lang="fr" />)
    fireEvent.change(champ('email'), { target: { value: 'bob@test.com' } })
    fireEvent.change(champ('current-password'), { target: { value: 'peu importe' } })
    fireEvent.click(screen.getByRole('button', { name: /^se connecter$/i }))
    await screen.findByRole('button', { name: /renvoyer l['’]e-mail de confirmation/i })
    signInWithEmail.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } })
    fireEvent.click(screen.getByRole('button', { name: /^se connecter$/i }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /renvoyer l['’]e-mail/i })).toBeNull())
  })
})
