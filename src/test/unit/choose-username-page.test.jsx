import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const updateProfile = vi.hoisted(() => vi.fn())
const recordSignupConsent = vi.hoisted(() => vi.fn())
const rpc = vi.hoisted(() => vi.fn())
const from = vi.hoisted(() => vi.fn())
const state = vi.hoisted(() => ({ profile: null, appels: [] }))

vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'u1', user_metadata: { given_name: 'Jean' } },
    profile: state.profile,
    updateProfile,
    recordSignupConsent,
  }),
}))
vi.mock('@shared/lib/supabase/client', () => ({ supabase: { rpc, from } }))
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>,
}))

import ChooseUsernamePage from '@features/auth/pages/choose-username-page'

// Réponses de la base. `state.appels` garde l'ordre de TOUT ce qui part
// (contrôle du pseudo, preuve d'acceptation, écriture du profil) : l'ordre est
// une règle.
function baseRepond({ libre = { data: true, error: null }, consentement = { error: null } } = {}) {
  rpc.mockImplementation(async (nom) => {
    state.appels.push(nom)
    if (nom === 'username_available') return libre
    return { data: null, error: { message: `fonction inattendue : ${nom}` } }
  })
  recordSignupConsent.mockImplementation(async () => {
    state.appels.push('record_signup_consent')
    return consentement
  })
}

const saisir = (pseudo) => fireEvent.change(screen.getByRole('textbox'), { target: { value: pseudo } })
const continuer = () => fireEvent.click(screen.getByRole('button', { name: /continuer/i }))

describe('ChooseUsernamePage', () => {
  beforeEach(() => {
    state.profile = { username: 'chef_1a2b3c4d', username_confirmed: false, consent_terms_accepted_at: null }
    state.appels = []
    rpc.mockReset()
    from.mockReset()
    recordSignupConsent.mockReset()
    updateProfile.mockReset()
    updateProfile.mockImplementation(async () => { state.appels.push('updateProfile'); return { error: null } })
    baseRepond()
  })

  it('pré-remplit avec la suggestion (prénom Google, pas l\'e-mail)', () => {
    render(<ChooseUsernamePage lang="fr" />)
    expect(screen.getByRole('textbox').value).toBe('Jean')
  })

  it('affiche la case de consentement CGU + âge (A4 OAuth)', () => {
    render(<ChooseUsernamePage lang="fr" />)
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  it('bloque la confirmation sans consentement', async () => {
    render(<ChooseUsernamePage lang="fr" />)
    continuer()
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(updateProfile).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
    expect(recordSignupConsent).not.toHaveBeenCalled()
  })

  it('confirme le pseudo via updateProfile après consentement coché', async () => {
    render(<ChooseUsernamePage lang="fr" />)
    fireEvent.click(screen.getByRole('checkbox'))
    continuer()
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'Jean', username_confirmed: true })
    ))
  })

  // ── Audit du 2026-10-04 ────────────────────────────────────────────────

  it('CPT-06 — date l\'acceptation AVANT de confirmer le pseudo, à la base de le faire', async () => {
    render(<ChooseUsernamePage lang="fr" />)
    fireEvent.click(screen.getByRole('checkbox'))
    continuer()
    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(state.appels).toEqual(['username_available', 'record_signup_consent', 'updateProfile'])
    // La date vient du serveur : le navigateur n'en écrit aucune.
    expect(updateProfile.mock.calls[0][0]).not.toHaveProperty('consent_terms_accepted_at')
    expect(updateProfile.mock.calls[0][0]).not.toHaveProperty('consent_privacy_accepted_at')
  })

  it('CPT-06 — si l\'acceptation n\'a pas pu être datée, le pseudo n\'est pas confirmé', async () => {
    baseRepond({ consentement: { error: { message: 'Failed to fetch' } } })
    render(<ChooseUsernamePage lang="fr" />)
    fireEvent.click(screen.getByRole('checkbox'))
    continuer()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/impossible d'enregistrer/i))
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('CPT-06 — acceptation déjà datée (inscription par e-mail) : la case n\'est pas redemandée', async () => {
    state.profile = { username: 'chef_1a2b3c4d', username_confirmed: false, consent_terms_accepted_at: '2026-10-04T20:00:00Z' }
    render(<ChooseUsernamePage lang="fr" />)
    expect(screen.queryByRole('checkbox')).toBeNull()
    continuer()
    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(state.appels).toEqual(['username_available', 'updateProfile'])
  })

  it('CPT-09 — demande à la base si le pseudo est libre, sans lire la table profiles', async () => {
    render(<ChooseUsernamePage lang="fr" />)
    fireEvent.click(screen.getByRole('checkbox'))
    continuer()
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('username_available', { p_username: 'Jean' }))
    expect(from).not.toHaveBeenCalled()
  })

  it('CPT-09 — pseudo pris ou réservé : le dit, et n\'écrit rien', async () => {
    baseRepond({ libre: { data: false, error: null } })
    render(<ChooseUsernamePage lang="fr" />)
    fireEvent.click(screen.getByRole('checkbox'))
    continuer()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/pas disponible/i))
    expect(state.appels).toEqual(['username_available'])
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('CPT-09 — pseudo pris entre le contrôle et l\'écriture : « pas disponible », pas « réessaie »', async () => {
    updateProfile.mockImplementation(async () => ({ error: { code: '23505', message: 'duplicate key value violates unique constraint "profiles_username_lower_idx"' } }))
    render(<ChooseUsernamePage lang="fr" />)
    fireEvent.click(screen.getByRole('checkbox'))
    continuer()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/pas disponible/i))
    expect(screen.getByRole('alert')).not.toHaveTextContent(/duplicate key/i)
  })

  it('CPT-09 — un pseudo hors règle est refusé ici, avec la règle en clair', async () => {
    render(<ChooseUsernamePage lang="fr" />)
    fireEvent.click(screen.getByRole('checkbox'))
    saisir('Zoé')
    continuer()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/sans accent/i))
    expect(rpc).not.toHaveBeenCalled()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('CPT-09 — contrôle indisponible (réseau) : on laisse passer, l\'écriture tranchera', async () => {
    baseRepond({ libre: { data: null, error: { message: 'Failed to fetch' } } })
    render(<ChooseUsernamePage lang="fr" />)
    fireEvent.click(screen.getByRole('checkbox'))
    continuer()
    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
  })
})

// Audit du 2026-10-04, CPT-10 : l'écran importait leo-profanity lui-même et ne
// reconnaissait le français que si le module partagé (shared/lib/moderation.js)
// avait été chargé avant — « connard » passait.
describe('ChooseUsernamePage — grossièretés en français (CPT-10)', () => {
  beforeEach(() => {
    state.profile = { username: 'chef_1a2b3c4d', username_confirmed: false, consent_terms_accepted_at: null }
    state.appels = []
    rpc.mockReset()
    updateProfile.mockReset()
    baseRepond()
  })

  it('refuse un pseudo injurieux, sans rien demander à la base ni écrire', async () => {
    render(<ChooseUsernamePage lang="fr" />)
    fireEvent.click(screen.getByRole('checkbox'))
    saisir('connard')
    continuer()
    expect(await screen.findByText('Ce pseudo contient des termes non autorisés.')).toBeInTheDocument()
    expect(state.appels).toEqual([])
    expect(updateProfile).not.toHaveBeenCalled()
  })
})
