import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Audit du 2026-10-04, ADM-05 — le côté écran. Les e-mails et dernières
// connexions de TOUS les comptes étaient lus à l'ouverture de l'onglet
// Utilisateurs, la dernière connexion s'affichait en clair, les allergènes à
// l'ouverture d'une fiche, sans trace. Désormais, une seule porte : le rideau
// « Données sensibles », qui demande un motif et passe par la base.

const adminApi = vi.hoisted(() => ({
  adminGetUsers: vi.fn(), adminGetUserCounts: vi.fn(), adminGetAuthUsers: vi.fn(),
  adminGetUserProfile: vi.fn(), adminRevelerCompte: vi.fn(),
  adminGrantSpecialAccess: vi.fn(), adminRevokeSpecialAccess: vi.fn(), adminGetSpecialAccessNote: vi.fn(),
  adminGetLogs: vi.fn(), adminGetRecipesByIds: vi.fn(), adminGetUsersByIds: vi.fn(),
}))
vi.mock('@features/admin/api/admin', () => adminApi)
vi.mock('@features/admin/api/bannissement', () => ({ adminBannir: vi.fn(), adminDebannir: vi.fn(), notifierLeBannissement: vi.fn() }))
vi.mock('@shared/contexts/data-provider', () => ({
  useAllergenTypes: () => ({ peanuts: { icon: '🥜', labels: { fr: 'Arachides' } } }),
}))
vi.mock('@features/admin/providers/admin-provider', () => ({ useAdmin: () => ({}) }))
vi.mock('@shared/ui/avatar-img', () => ({ default: () => null }))
vi.mock('@shared/ui/pagination', () => ({ default: () => null }))
vi.mock('@features/admin/components/shared/reason-selector', () => ({
  default: ({ onChange }) => <button onClick={() => onChange('rgpd-request')}>choisir-motif</button>,
  isReasonValid: ({ value }) => !!value,
  formatReason: ({ value }) => `motif:${value}`,
}))
vi.mock('@shared/ui/reusable-modal', () => ({
  default: ({ children, footer }) => <div role="dialog">{children}{footer}</div>,
}))

import UsersSection from '@features/admin/components/sections/users-section'
import JournalSection from '@features/admin/components/sections/journal-section'

const BOB = { id: 'u-2', username: 'bob', role: 'user', banned: false, created_at: '2026-09-01T10:00:00Z' }
const REVELE = { email: 'bob@exemple.fr', derniereConnexion: '2026-10-01T08:00:00Z', allergenes: ['peanuts'] }

beforeEach(() => {
  Object.values(adminApi).forEach((m) => m.mockReset())
  adminApi.adminGetUsers.mockResolvedValue({ data: [BOB], count: 1, error: null })
  adminApi.adminGetUserCounts.mockResolvedValue({ all: 1, active: 1, banned: 0, admins: 0 })
  // Si l'écran lisait encore tous les e-mails, voici ce qu'il obtiendrait.
  adminApi.adminGetAuthUsers.mockResolvedValue({ 'u-2': { email: 'bob@exemple.fr', lastSignIn: '2026-10-01T08:00:00Z' } })
  adminApi.adminGetUserProfile.mockResolvedValue({ allergens: ['peanuts'], favorites: [], recipes: [] })
})

async function ouvrirLaFicheDeBob() {
  render(<UsersSection lang="fr" />)
  fireEvent.click(await screen.findByRole('button', { name: 'Détails de bob' }))
  await waitFor(() => expect(adminApi.adminGetUserProfile).toHaveBeenCalledWith('u-2'))
}

describe('Utilisateurs — rien de sensible sans motif', () => {
  it('à l’ouverture de l’onglet, aucun e-mail ni dernière connexion n’est lu', async () => {
    render(<UsersSection lang="fr" />)
    expect(await screen.findByText('bob')).toBeInTheDocument()
    expect(adminApi.adminGetAuthUsers).not.toHaveBeenCalled()
    expect(screen.queryByText(/Connexion/)).toBeNull()
  })

  it('la fiche ne montre ni l’e-mail ni les allergènes avant la révélation', async () => {
    await ouvrirLaFicheDeBob()
    expect(await screen.findByText('Données sensibles')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Masqué/ })).toBeInTheDocument()
    expect(screen.queryByText('bob@exemple.fr')).toBeNull()
    expect(screen.queryByText(/Arachides/)).toBeNull()
    expect(adminApi.adminRevelerCompte).not.toHaveBeenCalled()
  })

  it('révéler passe par la base, avec le motif, et montre l’e-mail, la dernière connexion et les allergènes', async () => {
    adminApi.adminRevelerCompte.mockResolvedValue({ donnee: REVELE, error: null })
    await ouvrirLaFicheDeBob()
    fireEvent.click(await screen.findByRole('button', { name: /Masqué/ }))
    fireEvent.click(screen.getByText('choisir-motif'))
    fireEvent.click(screen.getByRole('button', { name: 'Afficher' }))
    expect(await screen.findByText('bob@exemple.fr')).toBeInTheDocument()
    expect(adminApi.adminRevelerCompte).toHaveBeenCalledWith('u-2', 'motif:rgpd-request')
    expect(screen.getByText(/Dernière connexion/)).toBeInTheDocument()
    expect(screen.getByText(/Arachides/)).toBeInTheDocument()
  })

  it('la base refuse : rien n’est montré, et c’est dit', async () => {
    adminApi.adminRevelerCompte.mockResolvedValue({ donnee: null, error: { code: '42501', message: 'Réservé aux administrateurs' } })
    await ouvrirLaFicheDeBob()
    fireEvent.click(await screen.findByRole('button', { name: /Masqué/ }))
    fireEvent.click(screen.getByText('choisir-motif'))
    fireEvent.click(screen.getByRole('button', { name: 'Afficher' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('bob@exemple.fr')).toBeNull()
    expect(screen.queryByText(/Arachides/)).toBeNull()
  })
})

describe('Journal — qui a été consulté, et pourquoi', () => {
  const CONSULTATION = {
    id: 'l-1', action: 'sensitive_data_accessed', user_id: 'admin-1', username: 'antoine',
    target_id: 'u-2', target_type: 'user', created_at: '2026-10-08T09:00:00Z',
    metadata: { reason: 'Demande RGPD — ticket <42>', champs: ['email', 'last_sign_in_at', 'allergen_prefs'] },
  }

  beforeEach(() => {
    adminApi.adminGetRecipesByIds.mockResolvedValue({ data: [] })
    adminApi.adminGetUsersByIds.mockResolvedValue({ data: [{ id: 'u-2', username: 'bob', avatar_id: null, role: 'user', banned: false }] })
  })

  it('une consultation se déplie : le compte consulté, le motif en texte, les données vues', async () => {
    adminApi.adminGetLogs.mockResolvedValue({ data: [CONSULTATION], count: 1, error: null })
    render(<JournalSection lang="fr" />)
    fireEvent.click(await screen.findByRole('button', { name: /Données sensibles consultées/ }))
    expect(await screen.findByText('bob')).toBeInTheDocument()
    // Le motif est une saisie libre : affiché comme du texte, jamais interprété.
    expect(screen.getByText(/Demande RGPD — ticket <42>/)).toBeInTheDocument()
    expect(screen.getByText(/e-mail, dernière connexion, allergènes/)).toBeInTheDocument()
  })

  it('une ligne sans métadonnées (ancien format) s’affiche sans casser', async () => {
    adminApi.adminGetLogs.mockResolvedValue({ data: [{ ...CONSULTATION, metadata: null }], count: 1, error: null })
    render(<JournalSection lang="fr" />)
    fireEvent.click(await screen.findByRole('button', { name: /Données sensibles consultées/ }))
    expect(await screen.findByText('bob')).toBeInTheDocument()
    expect(screen.queryByText(/Motif/)).toBeNull()
  })
})
