import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const confirmMock = vi.fn()
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({
  useConfirm: () => confirmMock,
}))
vi.mock('@shared/hooks/use-mfa', () => ({
  useMFA: () => ({
    factors: [{ id: 'f1', friendly_name: 'TOTP' }],
    hasVerifiedFactor: true,
    isAAL2: true,
    startEnroll: vi.fn(),
    unenroll: vi.fn().mockResolvedValue({ error: null }),
    refresh: vi.fn(),
  }),
}))

import MfaCard from '@features/profile/components/mfa-card'

describe('MfaCard — désactiver un facteur', () => {
  it('appelle useConfirm() (danger) avant de désactiver', async () => {
    confirmMock.mockResolvedValue(false)
    render(<MfaCard lang="fr" darkMode={false} isMobile={false} border="#ccc" textColor="#000" mutedColor="#666" />)
    fireEvent.click(screen.getByText('Désactiver'))
    await Promise.resolve()
    await Promise.resolve()
    expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Désactiver la double authentification ? Ton compte sera moins sécurisé.',
      danger: true,
    }))
  })
})
