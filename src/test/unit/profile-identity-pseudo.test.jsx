import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const updateProfile = vi.hoisted(() => vi.fn())
const rpc = vi.hoisted(() => vi.fn())
const from = vi.hoisted(() => vi.fn())

vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({ useConfirm: () => vi.fn() }))
vi.mock('react-router-dom', () => ({
  useOutletContext: () => ({
    lang: 'fr', darkMode: false,
    profile: { id: 'u1', username: 'alice', avatar_id: 'a1', community_bio: '' },
    setAvatarModalOpen: vi.fn(),
  }),
}))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ updateProfile }) }))
vi.mock('@shared/lib/supabase/client', () => ({ supabase: { rpc, from } }))
vi.mock('@features/profile/hooks/use-profile-state', () => ({
  useProfileState: () => ({ communityTermsAt: null, setCommunityTermsAt: vi.fn() }),
}))
vi.mock('@shared/api/community', () => ({
  acceptCommunityTerms: vi.fn(),
  revokeCommunityTerms: vi.fn(),
  updateCommunityBio: vi.fn(),
}))

import ProfileIdentityPage from '@features/profile/pages/profile-identity-page'

const champ = () => screen.getByRole('textbox', { name: /pseudo/i })
const saisir = (pseudo) => fireEvent.change(champ(), { target: { value: pseudo } })
// Le premier « Enregistrer » de la page est celui du pseudo (la bio a le sien plus bas).
const enregistrer = () => fireEvent.click(screen.getAllByRole('button', { name: /^enregistrer$/i })[0])

// Audit du 2026-10-04, CPT-09 : au renommage, l'erreur de la base s'affichait
// telle quelle (« duplicate key value violates unique constraint… »).
describe('Page Identité — changer de pseudo', () => {
  beforeEach(() => {
    updateProfile.mockReset()
    updateProfile.mockResolvedValue({ error: null })
    rpc.mockReset()
    rpc.mockResolvedValue({ data: true, error: null })
    from.mockReset()
  })

  it('demande à la base si le pseudo est libre, puis l’enregistre', async () => {
    render(<ProfileIdentityPage />)
    saisir('Alice_2')
    enregistrer()
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ username: 'Alice_2' }))
    expect(rpc).toHaveBeenCalledWith('username_available', { p_username: 'Alice_2' })
    expect(from).not.toHaveBeenCalled()
  })

  it('pseudo pris ou réservé : le dit, et n’écrit rien', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    render(<ProfileIdentityPage />)
    saisir('Admin')
    enregistrer()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/pas disponible/i))
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('pseudo pris entre le contrôle et l’écriture : jamais le message SQL', async () => {
    updateProfile.mockResolvedValue({ error: { code: '23505', message: 'duplicate key value violates unique constraint "profiles_username_lower_idx"' } })
    render(<ProfileIdentityPage />)
    saisir('Alice_2')
    enregistrer()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/pas disponible/i))
    expect(screen.getByRole('alert')).not.toHaveTextContent(/duplicate key|constraint/i)
  })

  it('refus inconnu de la base : un message à nous, pas celui de la base', async () => {
    updateProfile.mockResolvedValue({ error: { code: '42501', message: 'new row violates row-level security policy for table "profiles"' } })
    render(<ProfileIdentityPage />)
    saisir('Alice_2')
    enregistrer()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/n['’]a pas pu être enregistré/i))
    expect(screen.getByRole('alert')).not.toHaveTextContent(/row-level security|policy/i)
  })

  it('pseudo hors règle : refusé ici, avec la règle en clair', async () => {
    render(<ProfileIdentityPage />)
    saisir('Zoé')
    enregistrer()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/sans accent/i))
    expect(rpc).not.toHaveBeenCalled()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('les espaces autour du pseudo ne comptent pas', async () => {
    render(<ProfileIdentityPage />)
    saisir('  Alice_2 ')
    enregistrer()
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ username: 'Alice_2' }))
  })

  it('la règle est dite dans la description, avec les mêmes mots qu’ailleurs', () => {
    render(<ProfileIdentityPage />)
    expect(screen.getByText(/3 à 20 caractères : lettres sans accent/i)).toBeInTheDocument()
  })
})

// Audit du 2026-10-04, CPT-10 : l'écran importait leo-profanity lui-même et ne
// reconnaissait le français que si le module partagé (shared/lib/moderation.js)
// avait été chargé avant — « connard » passait.
describe('Page Identité — pseudo injurieux en français (CPT-10)', () => {
  beforeEach(() => {
    updateProfile.mockReset()
    rpc.mockReset()
    rpc.mockResolvedValue({ data: true, error: null })
  })

  it('refusé, sans rien demander à la base ni écrire', async () => {
    render(<ProfileIdentityPage />)
    saisir('connard')
    enregistrer()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Ce pseudo contient des termes inappropriés.'))
    expect(rpc).not.toHaveBeenCalled()
    expect(updateProfile).not.toHaveBeenCalled()
  })
})
