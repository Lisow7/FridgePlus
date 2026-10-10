import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { UIProvider } from '@shared/contexts/ui-provider'
import { ConfirmProvider, useConfirm } from '@shared/ui/confirm-dialog/confirm-provider'

function TestHarness({ onConfirm }) {
  const confirm = useConfirm()
  // Harnais de test : `onConfirm` est un ref-objet passé en prop pour extraire
  // la valeur du hook hors du composant (pattern standard RTL). La règle
  // Compiler suppose toute prop immuable ; ici c'est un ref sciemment
  // détourné, sans risque de rendu (le composant retourne toujours null).
  // eslint-disable-next-line react-hooks/immutability
  onConfirm.current = confirm
  return null
}

function setup() {
  // UIProvider.detectLang() lit d'abord localStorage('fridge-lang') avant de
  // retomber sur navigator.language (qui vaut 'en-US' par défaut sous jsdom).
  // On fixe la langue ici pour que ce fichier reste déterministe en FR sans
  // muter le fixture global de test/setup.js (portée = ce fichier seul).
  localStorage.setItem('fridge-lang', 'fr')
  const confirmRef = { current: null }
  render(
    <UIProvider>
      <ConfirmProvider>
        <TestHarness onConfirm={confirmRef} />
      </ConfirmProvider>
    </UIProvider>
  )
  return confirmRef
}

describe('ConfirmProvider / useConfirm', () => {
  it('affiche ConfirmDeleteModal (danger) avec le title fourni', () => {
    const confirmRef = setup()
    act(() => { confirmRef.current({ title: 'Vider la liste ?', confirmLabel: 'Vider la liste', danger: true }) })
    expect(screen.getByText('Vider la liste ?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vider la liste' })).toBeInTheDocument()
    expect(screen.getByText('Annuler')).toBeInTheDocument()
  })

  it('affiche ConfirmActionModal (neutre) par défaut (danger omis)', () => {
    const confirmRef = setup()
    act(() => { confirmRef.current({ title: 'Débannir cet utilisateur ?', body: 'Marie_92 pourra se reconnecter.', confirmLabel: 'Débannir' }) })
    expect(screen.getByText('Débannir cet utilisateur ?')).toBeInTheDocument()
    expect(screen.getByText('Marie_92 pourra se reconnecter.')).toBeInTheDocument()
  })

  it('résout à true quand on clique confirmLabel', async () => {
    const confirmRef = setup()
    let result
    act(() => { confirmRef.current({ title: 'T', confirmLabel: 'Oui' }).then(r => { result = r }) })
    screen.getByText('Oui').click()
    await act(async () => {})
    expect(result).toBe(true)
  })

  it('résout à false quand on clique cancelLabel', async () => {
    const confirmRef = setup()
    let result
    act(() => { confirmRef.current({ title: 'T', confirmLabel: 'Oui', cancelLabel: 'Non' }).then(r => { result = r }) })
    screen.getByText('Non').click()
    await act(async () => {})
    expect(result).toBe(false)
  })

  it('un second confirm() avant résolution du premier résout le premier à false', async () => {
    const confirmRef = setup()
    let firstResult, secondResult
    act(() => {
      confirmRef.current({ title: 'Premier', confirmLabel: 'Oui' }).then(r => { firstResult = r })
    })
    act(() => {
      confirmRef.current({ title: 'Second', confirmLabel: 'Oui' }).then(r => { secondResult = r })
    })
    await act(async () => {})
    expect(firstResult).toBe(false)
    expect(screen.getByText('Second')).toBeInTheDocument()
    expect(screen.queryByText('Premier')).not.toBeInTheDocument()
    expect(secondResult).toBeUndefined()
  })

  // Décision du 2026-10-08 : plus de « Confirmer » par défaut. Sans nom
  // d'action, rien ne s'ouvre et rien ne se fait (le geste est souvent sans
  // retour) — le garde-fou confirmations-nommees l'empêche d'arriver ici.
  it('sans confirmLabel : aucune fenêtre, et la réponse est non', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const confirmRef = setup()
    let result
    await act(async () => { result = await confirmRef.current({ title: 'Sans nom ?' }) })
    expect(result).toBe(false)
    expect(screen.queryByText('Sans nom ?')).toBeNull()
    expect(screen.queryByText('Confirmer')).toBeNull()
    spy.mockRestore()
  })

  it('useConfirm hors Provider → throw', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestHarness onConfirm={{ current: null }} />)).toThrow(/useConfirm/)
    spy.mockRestore()
  })
})
