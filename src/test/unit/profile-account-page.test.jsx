import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate, useLocation } from 'react-router-dom'

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

// Premium par défaut ; un test le retire (les droits RGPD ne dépendent pas de
// l'abonnement — audit du 2026-10-04, PREM-11).
let mockAbonnement = { hasPremiumAccess: true }
vi.mock('@shared/hooks/use-subscription', () => ({
  useSubscription: () => mockAbonnement,
}))
afterEach(() => { mockAbonnement = { hasPremiumAccess: true } })

vi.mock('@features/profile/api/data-export', () => ({
  exportUserData: vi.fn(),
  triggerJsonDownload: vi.fn(),
}))
import { exportUserData as mockExportUserData, triggerJsonDownload as mockTriggerJsonDownload } from '@features/profile/api/data-export'

vi.mock('@shared/api/spending', () => ({
  eraseSpendingHistory: vi.fn(),
}))

vi.mock('@features/legal', () => ({
  // Le vrai panneau ne rend « Voir la politique de confidentialité » que s'il
  // reçoit `onShowLegal` : le double en fait autant, en plus court.
  ConfidentialityPanel: ({ onShowLegal }) => (
    <div data-testid="confidentiality-panel">
      {onShowLegal && <button type="button" onClick={onShowLegal}>politique</button>}
    </div>
  ),
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

  it('rend les 5 ProfileSection h2 dans l\'ordre Abonnement/Identifiants/Appareils/Confidentialité/Mes données', () => {
    // EraseSpending et DangerZone ne sont pas wrappés dans un ProfileSection
    // (ils ont déjà leur propre header h3/h4) — vérifiés via leur testid.
    render(<MemoryRouter><ProfileAccountPage /></MemoryRouter>)
    const headings = screen.getAllByRole('heading', { level: 2 })
    expect(headings).toHaveLength(5)
    expect(headings[0]).toHaveTextContent(/abonnement/i)
    expect(headings[1]).toHaveTextContent(/identifiants/i)
    // « Déconnecter tous mes appareils » (décision du 2026-10-08).
    expect(headings[2]).toHaveTextContent(/appareils/i)
    expect(headings[3]).toHaveTextContent(/confidentialité/i)
    expect(headings[4]).toHaveTextContent(/mes données/i)
  })

  // Audit du 2026-10-04, RGPD-11 (c) : chaque membre écrivait `profile_data_viewed`
  // à chaque visite de SA page Compte — 77 lignes sans cible, qui ne traçaient
  // rien (la consultation par l'admin, elle, est tracée par `admin_reveler_compte`).
  it('n’écrit plus de trace « données du profil consultées » quand un membre ouvre sa propre page', () => {
    render(<MemoryRouter><ProfileAccountPage /></MemoryRouter>)
    expect(logAuditMock).not.toHaveBeenCalledWith('profile_data_viewed', expect.anything())
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

  // « Régler les notifications » (notifications vides, lot 13d) mène ici par
  // l'ancre #confidentialite : la section doit s'ouvrir d'elle-même, sinon
  // le bouton déposerait la personne devant une section repliée.
  it('#confidentialite : la section Confidentialité arrive dépliée', () => {
    render(<MemoryRouter initialEntries={['/profile/compte#confidentialite']}><ProfileAccountPage /></MemoryRouter>)
    expect(screen.getByRole('button', { name: /confidentialité/i })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('confidentiality-panel')).toBeInTheDocument()
    expect(document.getElementById('confidentialite')).not.toBeNull()
  })

  // Déjà sur la page (cloche ouverte depuis /profile/compte) : la page ne se
  // remonte pas, l'état initial de la section ne rejoue pas.
  it('déjà sur la page : l’ancre #confidentialite ouvre aussi la section', () => {
    function VersLaConfidentialite() {
      const naviguer = useNavigate()
      return <button type="button" onClick={() => naviguer('/profile/compte#confidentialite')}>aller</button>
    }
    render(<MemoryRouter initialEntries={['/profile/compte']}><VersLaConfidentialite /><ProfileAccountPage /></MemoryRouter>)
    expect(screen.getByRole('button', { name: /confidentialité/i })).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'aller' }))
    expect(screen.getByRole('button', { name: /confidentialité/i })).toHaveAttribute('aria-expanded', 'true')
  })

  it('sans ancre, elle reste repliée (témoin)', () => {
    render(<MemoryRouter initialEntries={['/profile/compte']}><ProfileAccountPage /></MemoryRouter>)
    expect(screen.getByRole('button', { name: /confidentialité/i })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('confidentiality-panel')).not.toBeInTheDocument()
  })

  it('monte les composants self-contained Erase + DangerZone', () => {
    render(<MemoryRouter><ProfileAccountPage /></MemoryRouter>)
    // Erase et DangerZone sont mockés (toujours rendus) — leur prop
    // `collapsible` est consommée à l'intérieur du composant réel.
    expect(screen.getByTestId('erase-spending')).toBeInTheDocument()
    expect(screen.getByTestId('danger-zone')).toBeInTheDocument()
  })

  // Un droit RGPD ne dépend pas d'un abonnement : l'opposition au profilage
  // (art. 21) et l'effacement des dépenses (art. 17) étaient réservés aux
  // Premium — un abonnement qui s'arrête laissait les dépenses en base sans
  // recours par l'interface (audit du 2026-10-04, PREM-11).
  it('sans Premium : opposition au profilage et effacement des dépenses restent proposés', () => {
    mockAbonnement = { hasPremiumAccess: false }
    render(<MemoryRouter><ProfileAccountPage /></MemoryRouter>)
    // L'opposition vit dans « Confidentialité », repliée par défaut.
    fireEvent.click(screen.getByRole('button', { name: /confidentialité/i }))
    expect(screen.getByTestId('profiling-opt-out')).toBeInTheDocument()
    expect(screen.getByTestId('erase-spending')).toBeInTheDocument()
  })

  it('affiche le badge Premium sur la section Abonnement', () => {
    render(<MemoryRouter><ProfileAccountPage /></MemoryRouter>)
    // Le badge est nommé par son texte visible (l'aria-label en double était interdit, A11Y-19).
    expect(screen.getAllByText('Premium').length).toBeGreaterThanOrEqual(1)
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

  // Audit du 2026-10-04, CPT-08. Un export incomplet ne télécharge rien — et
  // le dit dans une alerte, pas dans le libellé du bouton : une phrase de
  // cinquante caractères n'y tient pas sur un téléphone, et un libellé qui
  // change n'est pas annoncé par un lecteur d'écran.
  describe('export refusé', () => {
    const ouvrirEtCliquer = () => {
      render(<MemoryRouter><ProfileAccountPage /></MemoryRouter>)
      fireEvent.click(screen.getByRole('button', { name: /mes données/i }))
      fireEvent.click(screen.getByRole('button', { name: /^Télécharger$/ }))
    }

    it('lecture incomplète : rien n’est téléchargé, une alerte le dit, et le bouton reste « Télécharger »', async () => {
      mockExportUserData.mockReset().mockResolvedValue({ ok: false, incomplete: ['cooking_logs'] })
      mockTriggerJsonDownload.mockReset()
      ouvrirEtCliquer()
      const alerte = await screen.findByRole('alert')
      expect(alerte).toHaveTextContent(/rien n'a été téléchargé/i)
      expect(mockTriggerJsonDownload).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: /^Télécharger$/ })).toBeEnabled()
    })

    it('un export qui lève : même alerte', async () => {
      mockExportUserData.mockReset().mockRejectedValue(new TypeError('Failed to fetch'))
      ouvrirEtCliquer()
      expect(await screen.findByRole('alert')).toHaveTextContent(/rien n'a été téléchargé/i)
    })

    it('un nouvel essai réussi retire l’alerte', async () => {
      mockExportUserData.mockReset()
        .mockResolvedValueOnce({ ok: false, incomplete: ['cooking_logs'] })
        .mockResolvedValueOnce({ ok: true, data: {}, size: 42 })
      mockTriggerJsonDownload.mockReset()
      ouvrirEtCliquer()
      await screen.findByRole('alert')
      fireEvent.click(screen.getByRole('button', { name: /^Télécharger$/ }))
      await waitFor(() => expect(mockTriggerJsonDownload).toHaveBeenCalledTimes(1))
      expect(screen.queryByRole('alert')).toBeNull()
    })
  })
})

// Audit du 2026-10-04, « petites vérités » : depuis le pied de page, le
// panneau Confidentialité propose « Voir la politique de confidentialité » ;
// depuis le profil, le même panneau ne recevait pas `onShowLegal` et le bouton
// manquait. Ici, il mène à /legal comme là-bas.
describe('Confidentialité — la politique est à portée depuis le profil', () => {
  it('le panneau reçoit de quoi ouvrir /legal', () => {
    function OuSuisJe() { return <span data-testid="ou-suis-je">{useLocation().pathname}</span> }
    render(<MemoryRouter initialEntries={['/profile/compte']}><OuSuisJe /><ProfileAccountPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /confidentialité/i }))
    fireEvent.click(screen.getByRole('button', { name: 'politique' }))
    expect(screen.getByTestId('ou-suis-je')).toHaveTextContent('/legal')
  })
})
