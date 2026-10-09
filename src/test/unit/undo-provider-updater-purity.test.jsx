import { describe, it, expect, vi } from 'vitest'
import { StrictMode } from 'react'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { UndoProvider, useUndo } from '@shared/contexts/undo-provider'

// Pureté des updaters de UndoProvider.
//
// POURQUOI CE TEST — c'est la MÊME classe de défaut que la régression corrigée
// le 2026-08-06 sur `useFridgeStock` (un seul clic envoyait deux upserts) :
// un appel de callback métier placé DANS l'updater de `setState`, or React
// invoque les updaters DEUX fois en StrictMode (actif en dev, cf. main.jsx)
// précisément pour débusquer ce genre d'effet de bord impur.
//
// Ici l'enjeu est plus large : `UndoProvider` est le mécanisme d'annulation
// universel de l'application (suppression de recette personnelle, de ticket,
// de message de support, de reste…). `onConfirm` déclenche la suppression
// RÉELLE en base, `onUndo` la restauration. Les exécuter deux fois, c'est
// rejouer une écriture destructive.
//
// Le fichier portait déjà le commentaire « onUndo en async dehors du setState
// pour ne pas bloquer le render » — l'intention était juste, l'appel était
// resté dans l'updater. Ces tests verrouillent l'intention.

function Harnais({ onReady }) {
  const undo = useUndo()
  onReady(undo)
  return null
}

function monter(onReady) {
  return render(
    <StrictMode>
      <UndoProvider>
        <Harnais onReady={onReady} />
      </UndoProvider>
    </StrictMode>,
  )
}

describe('UndoProvider — pureté des updaters (StrictMode)', () => {
  it('le flush du 4e toast ne confirme le plus ancien qu\'UNE fois', () => {
    // La pile est plafonnée à 3 toasts : en déclencher un 4e confirme le plus
    // ancien, c'est-à-dire exécute sa suppression en base.
    let api = null
    monter((u) => { api = u })

    const confirmerLePlusAncien = vi.fn()
    act(() => {
      api.trigger({ label: 'a', onConfirm: confirmerLePlusAncien })
      api.trigger({ label: 'b', onConfirm: vi.fn() })
      api.trigger({ label: 'c', onConfirm: vi.fn() })
      api.trigger({ label: 'd', onConfirm: vi.fn() })
    })

    expect(confirmerLePlusAncien, 'une suppression ne se rejoue pas').toHaveBeenCalledTimes(1)
  })

  it('flushAll ne confirme chaque toast qu\'UNE fois', () => {
    let api = null
    monter((u) => { api = u })

    const premier = vi.fn()
    const second = vi.fn()
    act(() => {
      api.trigger({ label: 'a', onConfirm: premier })
      api.trigger({ label: 'b', onConfirm: second })
    })
    act(() => { api.flushAll() })

    expect(premier).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('un clic sur « Annuler » ne restaure qu\'UNE fois', () => {
    let api = null
    monter((u) => { api = u })

    const restaurer = vi.fn()
    act(() => { api.trigger({ label: 'a', onConfirm: vi.fn(), onUndo: restaurer }) })

    // On passe par le vrai bouton du toast plutôt que par `undo(id)` : c'est
    // le chemin qu'emprunte l'utilisateur, et l'id est interne au provider.
    act(() => { fireEvent.click(screen.getByLabelText('Annuler la suppression')) })

    expect(restaurer, 'une restauration ne se rejoue pas').toHaveBeenCalledTimes(1)
  })
})
