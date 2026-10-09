import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { UIProvider } from '@shared/contexts/ui-provider'
import { ToastProvider, useToast } from '@shared/ui/toast/toast-provider'

function TestHarness({ onShow }) {
  const { show, dismiss } = useToast()
  // Harnais de test : `onShow` est un ref-objet passé en prop pour extraire
  // la valeur du hook hors du composant (pattern standard RTL). La règle
  // Compiler suppose toute prop immuable ; ici c'est un ref sciemment
  // détourné, sans risque de rendu.
  // eslint-disable-next-line react-hooks/immutability
  onShow.current = show
  return <button onClick={() => dismiss('manual')}>dismiss</button>
}

describe('ToastProvider (v3.232.0)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('show rend un toast dans le portal', () => {
    const showRef = { current: null }
    render(
      <UIProvider>
        <ToastProvider>
          <TestHarness onShow={showRef} />
        </ToastProvider>
      </UIProvider>
    )
    act(() => { showRef.current(<span>Hello</span>) })
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('auto-dismiss après duration (default 5000ms)', () => {
    const showRef = { current: null }
    render(
      <UIProvider>
        <ToastProvider>
          <TestHarness onShow={showRef} />
        </ToastProvider>
      </UIProvider>
    )
    act(() => { showRef.current(<span>Bye</span>, { duration: 3000 }) })
    expect(screen.getByText('Bye')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(3001) })
    expect(screen.queryByText('Bye')).not.toBeInTheDocument()
  })

  it('show avec même id remplace le précédent', () => {
    const showRef = { current: null }
    render(
      <UIProvider>
        <ToastProvider>
          <TestHarness onShow={showRef} />
        </ToastProvider>
      </UIProvider>
    )
    act(() => { showRef.current(<span>First</span>, { id: 'unique', duration: 10000 }) })
    expect(screen.getByText('First')).toBeInTheDocument()
    act(() => { showRef.current(<span>Second</span>, { id: 'unique', duration: 10000 }) })
    expect(screen.queryByText('First')).not.toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
  })

  it('duration=0 désactive l\'auto-dismiss', () => {
    const showRef = { current: null }
    render(
      <UIProvider>
        <ToastProvider>
          <TestHarness onShow={showRef} />
        </ToastProvider>
      </UIProvider>
    )
    act(() => { showRef.current(<span>Persistent</span>, { duration: 0 }) })
    act(() => { vi.advanceTimersByTime(20000) })
    expect(screen.getByText('Persistent')).toBeInTheDocument()
  })

  // Contrat revu le 2026-08-25 (audit clavier/focus) : les régions vives sont
  // PERMANENTES et portent `aria-live` SANS rôle. Deux raisons, toutes deux
  // constatées : (1) un lecteur d'écran n'annonce fiablement qu'une région
  // DÉJÀ présente au moment où son contenu change — créer le aria-live dans le
  // même tick que le premier toast rendait les feedbacks muets ; (2) un
  // `role="alert"` permanent entrait en collision avec les alertes des
  // formulaires — `getByRole('alert')` résolvait 2 éléments (attrapé par les
  // smoke tests du funnel d'inscription).
  it('les régions vives existent AVANT tout toast, et chaque toast tombe dans la bonne', () => {
    const showRef = { current: null }
    render(
      <UIProvider>
        <ToastProvider>
          <TestHarness onShow={showRef} />
        </ToastProvider>
      </UIProvider>
    )
    // Permanence : les deux régions sont montées alors qu'aucun toast n'existe.
    expect(document.querySelector('[aria-live="polite"]')).toBeInTheDocument()
    expect(document.querySelector('[aria-live="assertive"]')).toBeInTheDocument()
    // Aucune ne porte de rôle : pas de collision avec les role="alert" des formulaires.
    expect(document.querySelector('[aria-live="polite"]').getAttribute('role')).toBeNull()
    expect(document.querySelector('[aria-live="assertive"]').getAttribute('role')).toBeNull()

    act(() => { showRef.current(<span>Info</span>, { id: 'i', duration: 10000 }) })
    expect(screen.getByText('Info').closest('[aria-live="polite"]')).toBeInTheDocument()
    act(() => { showRef.current(<span>Alert</span>, { id: 'a', role: 'alert', duration: 10000 }) })
    expect(screen.getByText('Alert').closest('[aria-live="assertive"]')).toBeInTheDocument()
  })

  it('useToast hors Provider → throw', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestHarness onShow={{ current: null }} />)).toThrow(/useToast/)
    spy.mockRestore()
  })
})
