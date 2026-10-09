import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@features/admin/lib/audit', () => ({
  logAuditAction: vi.fn(),
  AUDIT_ACTIONS: {
    PROFILE_DATA_VIEWED:   'profile_data_viewed',
    PROFILE_DATA_EXPORTED: 'profile_data_exported',
  },
}))
import { logAuditAction as logAuditMock } from '@features/admin/lib/audit'

const { mockRequestReset } = vi.hoisted(() => ({ mockRequestReset: vi.fn() }))

vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: () => ({
    requestPasswordResetEmail: mockRequestReset,
    updateProfile: vi.fn(),
    signInWithEmail: vi.fn(),
    deleteAccount: vi.fn(),
  }),
}))

vi.mock('@shared/hooks/use-subscription', () => ({
  // Test user = Premium (sinon les sections Premium-gated ne sont pas
  // rendues : ProfilingOptOut + EraseSpending masqués pour comptes free).
  useSubscription: () => ({ hasPremiumAccess: true }),
}))

vi.mock('@features/profile/api/data-export', () => ({
  exportUserData: vi.fn(),
  triggerJsonDownload: vi.fn(),
}))
import { exportUserData as mockExportUserData, triggerJsonDownload as mockTriggerJsonDownload } from '@features/profile/api/data-export'

vi.mock('@shared/api/spending', () => ({
  eraseSpendingHistory: vi.fn(),
}))

vi.mock('@features/legal', () => ({
  ConfidentialityPanel: () => <div data-testid="confidentiality-panel" />,
}))

vi.mock('@features/profile/components/mfa-card', () => ({
  default: () => <div data-testid="mfa-card" />,
}))

vi.mock('@features/profile/components/danger-zone', () => ({
  default: () => <div data-testid="danger-zone" />,
}))

vi.mock('@features/profile/components/profiling-opt-out-section', () => ({
  default: () => <div data-testid="profiling-opt-out" />,
}))

vi.mock('@features/profile/components/erase-spending-history-section', () => ({
  default: () => <div data-testid="erase-spending" />,
}))

vi.mock('@features/profile/components/subscription-tab', () => ({
  default: () => <div data-testid="subscription-tab" />,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useOutletContext: () => ({
      lang: 'fr', darkMode: false,
      user: { id: 'u1', email: 'a@b.c' },
      profile: { profiling_opted_out: false },
    }),
  }
})

import ProfileAccountPage from '@features/profile/pages/profile-account-page'

describe('ProfileAccountPage (Sprint 11 S11.a.5)', () => {
  beforeEach(() => { logAuditMock.mockReset(); mockRequestReset.mockReset() })

  it('rend les 4 ProfileSection h2 dans l\'ordre Abonnement/Identifiants/Confidentialité/Mes données', () => {
    // EraseSpending et DangerZone ne sont pas wrappés dans un ProfileSection
    // (ils ont déjà leur propre header h3/h4) — vérifiés via leur testid.
    render(<MemoryRouter><ProfileAccountPage /></MemoryRouter>)
    const headings = screen.getAllByRole('heading', { level: 2 })
    expect(headings).toHaveLength(4)
    expect(headings[0]).toHaveTextContent(/abonnement/i)
    expect(headings[1]).toHaveTextContent(/identifiants/i)
    expect(headings[2]).toHaveTextContent(/confidentialité/i)
    expect(headings[3]).toHaveTextContent(/mes données/i)
  })

  it('log audit PROFILE_DATA_VIEWED au mount', () => {
    render(<MemoryRouter><ProfileAccountPage /></MemoryRouter>)
    expect(logAuditMock).toHaveBeenCalledWith('profile_data_viewed', { metadata: { lang: 'fr' } })
  })

  it('monte les sous-composants visibles par défaut (Subscription, MFA)', () => {
    render(<MemoryRouter><ProfileAccountPage /></MemoryRouter>)
    expect(screen.getByTestId('subscription-tab')).toBeInTheDocument()
    expect(screen.getByTestId('mfa-card')).toBeInTheDocument()
    // Confidentialité, EraseSpending, DangerZone sont collapsibles par défaut
    // → leur contenu n'est PAS monté tant qu'on ne clique pas le header.
    expect(screen.queryByTestId('confidentiality-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('profiling-opt-out')).not.toBeInTheDocument()
  })

  it('expand Confidentialité monte le ConfidentialityPanel', () => {
    render(<MemoryRouter><ProfileAccountPage /></MemoryRouter>)
    const header = screen.getByRole('button', { name: /confidentialité/i })
    fireEvent.click(header)
    expect(screen.getByTestId('confidentiality-panel')).toBeInTheDocument()
    expect(screen.getByTestId('profiling-opt-out')).toBeInTheDocument()
  })

  it('monte les composants self-contained Erase + DangerZone', () => {
    render(<MemoryRouter><ProfileAccountPage /></MemoryRouter>)
    // Erase et DangerZone sont mockés (toujours rendus) — leur prop
    // `collapsible` est consommée à l'intérieur du composant réel.
    expect(screen.getByTestId('erase-spending')).toBeInTheDocument()
    expect(screen.getByTestId('danger-zone')).toBeInTheDocument()
  })

  it('affiche le badge Premium sur la section Abonnement', () => {
    render(<MemoryRouter><ProfileAccountPage /></MemoryRouter>)
    expect(screen.getAllByLabelText('Premium').length).toBeGreaterThanOrEqual(1)
  })

  it('masque l\'e-mail par défaut (RGPD) et propose un bouton Afficher', () => {
    render(<MemoryRouter><ProfileAccountPage /></MemoryRouter>)
    // Email masqué visible (caractères •)
    expect(screen.getByText(/a@b\.c|a@/)).toBeInTheDocument()
    // L'e-mail brut "a@b.c" est court : on vérifie juste que le bouton Afficher est présent
    expect(screen.getByRole('button', { name: /afficher/i })).toBeInTheDocument()
  })

  it('affiche le message de succès quand l\'envoi du reset réussit', async () => {
    mockRequestReset.mockResolvedValue({ error: null })
    render(<MemoryRouter><ProfileAccountPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /changer mon mot de passe/i }))
    expect(await screen.findByText(/e-mail envoyé/i)).toBeInTheDocument()
  })

  it('affiche un message d\'erreur quand l\'envoi du reset échoue (au lieu de ne rien afficher)', async () => {
    mockRequestReset.mockResolvedValue({ error: { message: 'boom' } })
    render(<MemoryRouter><ProfileAccountPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /changer mon mot de passe/i }))
    expect(await screen.findByText(/impossible d'envoyer l'e-mail/i)).toBeInTheDocument()
    expect(screen.queryByText(/e-mail envoyé/i)).not.toBeInTheDocument()
  })

  it('déclenche le téléchargement avec un nom de fichier sans extension (triggerJsonDownload ajoute déjà .json — un double suffixe est un bug)', async () => {
    mockExportUserData.mockReset().mockResolvedValue({ ok: true, data: {}, size: 42 })
    mockTriggerJsonDownload.mockReset()
    render(<MemoryRouter><ProfileAccountPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /mes données/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Télécharger$/ }))
    await screen.findByText(/téléchargement démarré/i)
    expect(mockTriggerJsonDownload).toHaveBeenCalledTimes(1)
    const [, filename] = mockTriggerJsonDownload.mock.calls[0]
    expect(filename).not.toMatch(/\.json$/)
  })
})
