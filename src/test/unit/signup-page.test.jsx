import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const signUpWithEmail = vi.hoisted(() => vi.fn())
const signInWithGoogle = vi.hoisted(() => vi.fn())
const resendSignupEmail = vi.hoisted(() => vi.fn())
const rpc = vi.hoisted(() => vi.fn())
const from = vi.hoisted(() => vi.fn())

vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: () => ({ signUpWithEmail, signInWithGoogle, resendSignupEmail }),
}))
vi.mock('@shared/lib/supabase/client', () => ({ supabase: { rpc, from } }))
vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>,
}))

import SignupPage from '@features/auth/pages/signup-page'

const MOT_DE_PASSE = 'Fridge+2026!x'

function remplir({ pseudo = 'Foodie_42', email = 'bob@test.com', motDePasse = MOT_DE_PASSE, accepter = true } = {}) {
  const champ = (attribut) => document.querySelector(`input[autocomplete="${attribut}"]`)
  fireEvent.change(champ('username'), { target: { value: pseudo } })
  fireEvent.change(champ('email'), { target: { value: email } })
  fireEvent.change(champ('new-password'), { target: { value: motDePasse } })
  if (accepter) fireEvent.click(screen.getByRole('checkbox'))
}
const creer = () => fireEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

describe('SignupPage', () => {
  beforeEach(() => {
    signUpWithEmail.mockReset()
    signUpWithEmail.mockResolvedValue({ error: null })
    signInWithGoogle.mockReset()
    resendSignupEmail.mockReset()
    resendSignupEmail.mockResolvedValue({ error: null })
    rpc.mockReset()
    rpc.mockResolvedValue({ data: true, error: null })
    from.mockReset()
  })

  // ── CPT-06 : la preuve d'acceptation ───────────────────────────────────
  it('transmet l\'acceptation des conditions avec l\'inscription', async () => {
    render(<SignupPage lang="fr" />)
    remplir()
    creer()
    await waitFor(() => expect(signUpWithEmail).toHaveBeenCalled())
    expect(signUpWithEmail).toHaveBeenCalledWith('bob@test.com', MOT_DE_PASSE, 'Foodie_42', 'fr', { consentAccepted: true })
  })

  it('sans la case, rien ne part', async () => {
    render(<SignupPage lang="fr" />)
    remplir({ accepter: false })
    creer()
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(rpc).not.toHaveBeenCalled()
    expect(signUpWithEmail).not.toHaveBeenCalled()
  })

  // ── CPT-09 : « ce pseudo est-il libre ? » ──────────────────────────────
  it('demande à la base si le pseudo est libre, sans lire la table profiles', async () => {
    render(<SignupPage lang="fr" />)
    remplir()
    creer()
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('username_available', { p_username: 'Foodie_42' }))
    expect(from).not.toHaveBeenCalled()
  })

  it('pseudo pris ou réservé : le dit, et ne crée pas le compte', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    render(<SignupPage lang="fr" />)
    remplir({ pseudo: 'Admin_42' })
    creer()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/pas disponible/i))
    expect(signUpWithEmail).not.toHaveBeenCalled()
  })

  it('contrôle indisponible (réseau) : l\'inscription part quand même, la base tranchera', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } })
    render(<SignupPage lang="fr" />)
    remplir()
    creer()
    await waitFor(() => expect(signUpWithEmail).toHaveBeenCalled())
  })

  it('pseudo hors règle : refusé ici, avec la règle en clair', async () => {
    render(<SignupPage lang="fr" />)
    remplir({ pseudo: 'Zoé' })
    creer()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/sans accent/i))
    expect(rpc).not.toHaveBeenCalled()
    expect(signUpWithEmail).not.toHaveBeenCalled()
  })

  it('la règle est dite sous le champ, avant toute erreur', () => {
    render(<SignupPage lang="fr" />)
    expect(screen.getByText(/3 à 20 caractères : lettres sans accent/i)).toBeInTheDocument()
  })

  // ── CPT-13 : ce qui est dit après l'inscription ────────────────────────
  it('après l\'inscription, ne prétend pas « compte créé » : une adresse déjà inscrite reçoit la même réponse du service', async () => {
    render(<SignupPage lang="fr" />)
    remplir()
    creer()
    const message = await screen.findByRole('status')
    expect(message).not.toHaveTextContent(/compte créé/i)
    expect(message).toHaveTextContent(/ouvre l'e-mail/i)
    // La personne qui a déjà un compte doit pouvoir le comprendre, et quoi faire.
    expect(message).toHaveTextContent(/déjà un compte/i)
    expect(screen.getByRole('link', { name: /connecte-toi/i })).toHaveAttribute('href', '/login')
  })

  it('après l\'inscription, propose de renvoyer l\'e-mail — après le délai d\'une minute', async () => {
    render(<SignupPage lang="fr" />)
    remplir()
    creer()
    await screen.findByRole('status')
    // Un e-mail vient de partir : le bouton attend.
    expect(screen.getByRole('button', { name: /renvoi possible dans/i })).toBeDisabled()
  })

  it('adresse corrigée après l’envoi : le formulaire redevient utilisable', async () => {
    render(<SignupPage lang="fr" />)
    remplir()
    creer()
    await screen.findByRole('status')
    expect(screen.getByRole('button', { name: /créer mon compte/i })).toBeDisabled()
    fireEvent.change(document.querySelector('input[autocomplete="email"]'), { target: { value: 'bob@test.fr' } })
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('button', { name: /créer mon compte/i })).toBeEnabled()
  })

  it('adresse refusée par le service comme déjà utilisée (confirmation désactivée) : message dédié', async () => {
    signUpWithEmail.mockResolvedValue({ error: { message: 'User already registered' } })
    render(<SignupPage lang="fr" />)
    remplir()
    creer()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/déjà utilisée/i))
    expect(screen.queryByRole('status')).toBeNull()
  })

  // Lot 3c-3b : une adresse effacée pendant un bannissement est refusée par la
  // base, et le service ne rend qu'un échec générique. « Réessaie plus tard »
  // ferait réessayer sans fin : le message mène au support, qui saura dire.
  it('inscription refusée par le serveur (« Database error saving new user ») : le dit, et donne l’adresse du support', async () => {
    signUpWithEmail.mockResolvedValue({ error: { message: 'Database error saving new user', status: 500, code: 'unexpected_failure' } })
    render(<SignupPage lang="fr" />)
    remplir()
    creer()
    const alerte = await screen.findByRole('alert')
    expect(alerte).toHaveTextContent('Ce compte n’a pas pu être créé.')
    expect(alerte).toHaveTextContent('support@fridgeplus.app')
    expect(alerte).not.toHaveTextContent(/plus tard/i)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('… et en anglais', async () => {
    signUpWithEmail.mockResolvedValue({ error: { message: 'Database error saving new user', status: 500, code: 'unexpected_failure' } })
    render(<SignupPage lang="en" />)
    remplir()
    fireEvent.click(screen.getByRole('button', { name: /create my account/i }))
    const alerte = await screen.findByRole('alert')
    expect(alerte).toHaveTextContent('This account could not be created.')
    expect(alerte).toHaveTextContent('support@fridgeplus.app')
  })
})
