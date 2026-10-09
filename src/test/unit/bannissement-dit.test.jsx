import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Audit du 2026-10-04, CPT-17 et BDD-02 : un compte banni l'est désormais
// AUSSI dans le service d'authentification (sa session est coupée, il ne peut
// plus se reconnecter). Ce que la personne voit alors doit le dire, et dire à
// qui écrire — y compris pour demander l'effacement de ses données, puisqu'elle
// ne peut plus le faire depuis l'application.

const signInWithEmail = vi.hoisted(() => vi.fn())
const deleteAccount = vi.hoisted(() => vi.fn())
vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: () => ({
    signInWithEmail, deleteAccount,
    resetPassword: vi.fn(), resendSignupEmail: vi.fn(), signInWithGoogle: vi.fn(),
  }),
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/login', search: '', state: null }),
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}))

import LoginPage from '@features/auth/pages/login-page'
import BannedScreen from '@features/auth/components/banned-screen'
import AppModalsRoot from '@app/components/app-modals-root'
import { authLinkProblem } from '@shared/lib/auth/auth-link-outcome'
import { EMAIL_LINK_MESSAGES } from '@shared/hooks/use-email-link-banner'
import { estBanni } from '@shared/lib/auth/est-banni'
import { SUPPORT_EMAIL } from '@shared/lib/contact'

beforeEach(() => {
  signInWithEmail.mockReset()
  deleteAccount.mockReset(); deleteAccount.mockResolvedValue({ error: null })
})

describe('Connexion d\'un compte banni', () => {
  it('par e-mail : le refus du service (« user_banned ») est dit, avec l\'adresse du support', async () => {
    signInWithEmail.mockResolvedValue({ error: { code: 'user_banned', message: 'User is banned', status: 400 } })
    const champ = (attribut) => document.querySelector(`input[autocomplete="${attribut}"]`)
    render(<LoginPage lang="fr" />)
    fireEvent.change(champ('email'), { target: { value: 'bob@exemple.test' } })
    fireEvent.change(champ('current-password'), { target: { value: 'un-mot-de-passe' } })
    fireEvent.click(screen.getByRole('button', { name: /^se connecter$/i }))
    const alerte = await screen.findByRole('alert')
    expect(alerte).toHaveTextContent(/suspendu/i)
    expect(alerte).toHaveTextContent(SUPPORT_EMAIL)
  })

  it('par Google : le retour « user_banned » dans l\'adresse devient « banni », pas un échec générique', () => {
    expect(authLinkProblem({ hasCode: false, hasError: true, errorCode: 'user_banned' }, false)).toBe('banned')
  })

  it('le bandeau le dit, et dit où demander l\'effacement des données', () => {
    for (const langue of ['fr', 'en']) {
      expect(EMAIL_LINK_MESSAGES[langue].banned, langue).toContain(SUPPORT_EMAIL)
    }
    expect(EMAIL_LINK_MESSAGES.fr.banned).toMatch(/suspendu/i)
    expect(EMAIL_LINK_MESSAGES.fr.banned).toMatch(/effacement|supprimer/i)
  })
})

describe('Un bannissement daté prend fin', () => {
  const plus = (heures) => new Date(Date.now() + heures * 3600_000).toISOString()

  it('banni sans date de fin : banni', () => {
    expect(estBanni({ banned: true, banned_until: null })).toBe(true)
  })
  it('banni jusqu\'à demain : banni', () => {
    expect(estBanni({ banned: true, banned_until: plus(24) })).toBe(true)
  })
  it('banni jusqu\'à hier : plus banni (la base le lève au plus tard 15 minutes après)', () => {
    expect(estBanni({ banned: true, banned_until: plus(-24) })).toBe(false)
  })
  it('pas banni, ou pas de profil : pas banni', () => {
    expect(estBanni({ banned: false, banned_until: null })).toBe(false)
    expect(estBanni(null)).toBe(false)
  })
})

describe('L\'écran « Compte suspendu » suit la date de fin', () => {
  const modals = { admin: { isOpen: false, close: vi.fn() }, support: { isOpen: false, open: vi.fn(), close: vi.fn() } }
  const plus = (heures) => new Date(Date.now() + heures * 3600_000).toISOString()
  const monter = (profile) => render(
    <AppModalsRoot modals={modals} user={{ id: 'u-1' }} profile={profile} isAdmin={false} lang="fr" darkMode={false} refreshSupportUnread={vi.fn()} />,
  )

  it('banni jusqu\'à demain : l\'écran s\'affiche', async () => {
    monter({ id: 'u-1', banned: true, banned_until: plus(24) })
    expect(await screen.findByText('Compte suspendu')).toBeInTheDocument()
  })

  it('banni jusqu\'à hier : l\'écran ne s\'affiche plus, même si le drapeau n\'est pas encore levé', async () => {
    monter({ id: 'u-1', banned: true, banned_until: plus(-24) })
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText('Compte suspendu')).toBeNull()
  })
})

describe('L\'écran du compte banni', () => {
  it('la suppression du compte part dans la langue de l\'écran (l\'e-mail de confirmation aussi)', async () => {
    const user = userEvent.setup()
    render(<BannedScreen lang="en" darkMode={false} onShowSupport={vi.fn()} />)
    await user.click(screen.getByText('Delete my account'))
    await user.click(screen.getByText('Delete'))
    await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith('en'))
  })
})
