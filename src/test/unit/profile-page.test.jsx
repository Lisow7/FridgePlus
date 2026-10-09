import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AuthGuard from '@routes/guards/auth-guard'

vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: vi.fn(),
}))
import { useAuth } from '@shared/contexts/auth-provider'

function ProtectedContent() {
  return <div data-testid="content">Profile content</div>
}

function HomeStub() {
  return <div data-testid="home">Home</div>
}

function setup({ user, recoveryMode = false }) {
  useAuth.mockReturnValue({ user, recoveryMode })
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <Routes>
        <Route path="/" element={<HomeStub />} />
        <Route
          path="/profile"
          element={
            <AuthGuard>
              <ProtectedContent />
            </AuthGuard>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AuthGuard on /profile (Sprint 11 S11.a.1)', () => {
  beforeEach(() => {
    useAuth.mockReset()
  })

  it('redirige vers / si !user (utilisateur non connecté)', () => {
    setup({ user: null })
    expect(screen.getByTestId('home')).toBeInTheDocument()
    expect(screen.queryByTestId('content')).not.toBeInTheDocument()
  })

  it('rend le contenu si user existe', () => {
    setup({ user: { id: 'u1', email: 'a@b.c' } })
    expect(screen.getByTestId('content')).toBeInTheDocument()
    expect(screen.queryByTestId('home')).not.toBeInTheDocument()
  })

  it('redirige vers / si recoveryMode même avec user (flow password reset)', () => {
    setup({ user: { id: 'u1' }, recoveryMode: true })
    expect(screen.getByTestId('home')).toBeInTheDocument()
    expect(screen.queryByTestId('content')).not.toBeInTheDocument()
  })
})
