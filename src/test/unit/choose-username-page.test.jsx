import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const updateProfile = vi.fn().mockResolvedValue({ error: null })
const maybeSingle = vi.fn().mockResolvedValue({ data: null }) // pseudo libre par défaut

vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'u1', user_metadata: { given_name: 'Jean' } },
    profile: { username: 'jean.dupont', username_confirmed: false },
    updateProfile,
  }),
}))
vi.mock('@shared/lib/supabase/client', () => ({
  supabase: { from: () => ({ select: () => ({ ilike: () => ({ maybeSingle }) }) }) },
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>,
}))

import ChooseUsernamePage from '@features/auth/pages/choose-username-page'

describe('ChooseUsernamePage', () => {
  beforeEach(() => { updateProfile.mockClear() })

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
    fireEvent.click(screen.getByRole('button', { name: /continuer/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('confirme le pseudo via updateProfile après consentement coché', async () => {
    render(<ChooseUsernamePage lang="fr" />)
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /continuer/i }))
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'Jean', username_confirmed: true })
    ))
  })
})
