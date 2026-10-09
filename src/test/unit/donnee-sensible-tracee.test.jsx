import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@features/admin/components/shared/reason-selector', () => ({
  default: ({ onChange }) => <button onClick={() => onChange('support_request')}>choisir-motif</button>,
  isReasonValid: ({ value }) => !!value,
  formatReason: ({ value }) => value,
}))
vi.mock('@shared/ui/reusable-modal', () => ({
  default: ({ children, footer }) => <div role="dialog">{children}{footer}</div>,
}))

import SensitiveDataToggle from '@features/admin/components/shared/sensitive-data-toggle'

// Audit du 2026-10-04, ADM-02 / ADM-05 : la consultation tracée d'une donnée
// sensible est la CONDITION de son affichage. Depuis le 2026-10-08, la donnée
// n'est même plus dans la page avant : `charger(motif)` la demande à la base,
// qui écrit la trace avant de la rendre.
function rendre(charger) {
  render(
    <SensitiveDataToggle charger={charger} lang="fr">
      {(donnee) => <span>{donnee}</span>}
    </SensitiveDataToggle>,
  )
}
function demanderAAfficher() {
  fireEvent.click(screen.getByRole('button', { name: /Masqué/ }))
  fireEvent.click(screen.getByText('choisir-motif'))
  fireEvent.click(screen.getByRole('button', { name: 'Afficher' }))
}

describe('une donnée sensible ne s’affiche qu’une fois sa consultation tracée', () => {
  // Pas de `mockReset()` / `mockClear()` ici : sous Vitest 5, après l'un ou
  // l'autre, la promesse rejetée du test « l'appel lève » est comptée comme non
  // gérée alors que le composant l'attrape (constaté le 2026-10-05, variantes à
  // l'appui). Chaque test crée sa propre fonction.

  it('rien n’est demandé à la base avant le motif', () => {
    const charger = vi.fn()
    rendre(charger)
    fireEvent.click(screen.getByRole('button', { name: /Masqué/ }))
    expect(charger).not.toHaveBeenCalled()
    expect(screen.queryByText('alice@exemple.fr')).toBeNull()
  })

  it('la base a tracé et rendu la donnée : elle s’affiche (témoin)', async () => {
    const charger = vi.fn().mockResolvedValue({ donnee: 'alice@exemple.fr', error: null })
    rendre(charger)
    demanderAAfficher()
    expect(await screen.findByText('alice@exemple.fr')).toBeInTheDocument()
    expect(charger).toHaveBeenCalledWith('support_request')
  })

  it('la base refuse : rien n’est révélé, et c’est dit', async () => {
    rendre(vi.fn().mockResolvedValue({ donnee: null, error: { message: 'boom' } }))
    demanderAAfficher()
    expect(await screen.findByRole('alert')).toHaveTextContent('La consultation n\'a pas pu être enregistrée au journal : la donnée reste masquée.')
    expect(screen.queryByText('alice@exemple.fr')).toBeNull()
  })

  it('l’appel lève : même chose', async () => {
    rendre(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    demanderAAfficher()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('alice@exemple.fr')).toBeNull())
  })

  it('masquer oublie la donnée : la revoir redemande un motif, donc une nouvelle trace', async () => {
    const charger = vi.fn().mockResolvedValue({ donnee: 'alice@exemple.fr', error: null })
    rendre(charger)
    demanderAAfficher()
    expect(await screen.findByText('alice@exemple.fr')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Masquer' }))
    expect(screen.queryByText('alice@exemple.fr')).toBeNull()
    demanderAAfficher()
    expect(await screen.findByText('alice@exemple.fr')).toBeInTheDocument()
    expect(charger).toHaveBeenCalledTimes(2)
  })
})
