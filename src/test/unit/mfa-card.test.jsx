import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const confirmMock = vi.fn()
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({
  useConfirm: () => confirmMock,
}))
let mockMfa
vi.mock('@shared/hooks/use-mfa', () => ({
  useMFA: () => mockMfa,
}))

import MfaCard from '@features/profile/components/mfa-card'

const PROTEGE = {
  factors: [{ id: 'f1', friendly_name: 'TOTP' }],
  hasVerifiedFactor: true,
  isAAL2: true,
  pret: true,
  startEnroll: vi.fn(),
  unenroll: vi.fn().mockResolvedValue({ error: null }),
  refresh: vi.fn(),
}

beforeEach(() => { mockMfa = PROTEGE })

function monter() {
  return render(<MfaCard lang="fr" darkMode={false} isMobile={false} border="#ccc" textColor="#000" mutedColor="#666" />)
}

describe('MfaCard — désactiver un facteur', () => {
  it('appelle useConfirm() (danger) avant de désactiver', async () => {
    confirmMock.mockResolvedValue(false)
    monter()
    fireEvent.click(screen.getByText('Désactiver'))
    await Promise.resolve()
    await Promise.resolve()
    expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Désactiver la double authentification ? Ton compte sera moins sécurisé.',
      danger: true,
    }))
  })
})

// La carte disait « Inactive / Activer la 2FA » le temps de lister les
// facteurs, même pour un compte protégé (audit du 2026-10-04, comptes et
// authentification). Tant qu'elle ne sait pas, elle le dit.
describe('MfaCard — tant que les facteurs ne sont pas lus', () => {
  it('« Vérification… », ni « Inactive » ni « Activer la 2FA »', () => {
    mockMfa = { ...PROTEGE, factors: [], hasVerifiedFactor: false, pret: false }
    monter()
    expect(screen.getByText('Vérification…')).toBeInTheDocument()
    expect(screen.queryByText('Inactive')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Activer la 2FA' })).toBeNull()
  })

  it('une fois lus, un compte sans facteur voit « Inactive » et « Activer la 2FA »', () => {
    mockMfa = { ...PROTEGE, factors: [], hasVerifiedFactor: false, pret: true }
    monter()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Activer la 2FA' })).toBeInTheDocument()
  })
})
