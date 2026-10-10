import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: vi.fn(),
}))
import { useAuth } from '@shared/contexts/auth-provider'

import RedirectIfAuthGuard from '@routes/guards/redirect-if-auth-guard'
import RecoveryGuard from '@routes/guards/recovery-guard'
import AuthGuard from '@routes/guards/auth-guard'

function Protected() {
  return <div data-testid="protected">Protected content</div>
}
function HomeStub() {
  return <div data-testid="home">Home</div>
}
function LoginStub() {
  return <div data-testid="login">Login</div>
}

function setupRedirect({ user, recoveryMode = false }) {
  useAuth.mockReturnValue({ user, recoveryMode })
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/" element={<HomeStub />} />
        <Route path="/login" element={<RedirectIfAuthGuard><Protected /></RedirectIfAuthGuard>} />
      </Routes>
    </MemoryRouter>,
  )
}

function setupRecovery({ recoveryMode }) {
  useAuth.mockReturnValue({ user: null, recoveryMode })
  return render(
    <MemoryRouter initialEntries={['/auth/recovery']}>
      <Routes>
        <Route path="/" element={<HomeStub />} />
        <Route path="/auth/recovery" element={<RecoveryGuard><Protected /></RecoveryGuard>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RedirectIfAuthGuard (Sprint 11 S11.b.1)', () => {
  beforeEach(() => { useAuth.mockReset() })

  it('rend les enfants si pas de user', () => {
    setupRedirect({ user: null })
    expect(screen.getByTestId('protected')).toBeInTheDocument()
  })

  it('redirige vers / si user déjà loggé', () => {
    setupRedirect({ user: { id: 'u1' } })
    expect(screen.getByTestId('home')).toBeInTheDocument()
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument()
  })

  it('rend les enfants si recoveryMode même avec user (flow reset password)', () => {
    setupRedirect({ user: { id: 'u1' }, recoveryMode: true })
    expect(screen.getByTestId('protected')).toBeInTheDocument()
  })
})

function setupAuth({ user, loading = false, recoveryMode = false }) {
  useAuth.mockReturnValue({ user, loading, recoveryMode })
  return render(
    <MemoryRouter initialEntries={['/cook/x']}>
      <Routes>
        <Route path="/" element={<HomeStub />} />
        <Route path="/login" element={<LoginStub />} />
        <Route path="/cook/:recipeId" element={<AuthGuard><Protected /></AuthGuard>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AuthGuard — loading (fix accès URL directe)', () => {
  beforeEach(() => { useAuth.mockReset() })

  it('pendant loading : ne redirige PAS et ne rend PAS les enfants', () => {
    setupAuth({ user: null, loading: true })
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument()
    expect(screen.queryByTestId('home')).not.toBeInTheDocument()
    expect(screen.queryByTestId('login')).not.toBeInTheDocument()
  })

  it('chargé + user connecté → rend les enfants', () => {
    setupAuth({ user: { id: 'u1' }, loading: false })
    expect(screen.getByTestId('protected')).toBeInTheDocument()
  })

  // CPT-18 : la page de connexion, plus l'accueil — la configuration des routes
  // l'annonçait, et la page d'origine suit (`state.from`).
  it('chargé + pas de user → invite à se connecter (/login)', () => {
    setupAuth({ user: null, loading: false })
    expect(screen.getByTestId('login')).toBeInTheDocument()
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument()
  })

  it('chargé + recoveryMode → redirige vers /', () => {
    setupAuth({ user: { id: 'u1' }, loading: false, recoveryMode: true })
    expect(screen.getByTestId('home')).toBeInTheDocument()
  })
})

describe('RecoveryGuard (Sprint 11 S11.b.1)', () => {
  beforeEach(() => { useAuth.mockReset() })

  it('redirige vers / si recoveryMode false', () => {
    setupRecovery({ recoveryMode: false })
    expect(screen.getByTestId('home')).toBeInTheDocument()
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument()
  })

  it('rend les enfants si recoveryMode true', () => {
    setupRecovery({ recoveryMode: true })
    expect(screen.getByTestId('protected')).toBeInTheDocument()
  })
})
