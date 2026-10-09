import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import TourWizard from '@features/onboarding/components/tour-wizard'

// Refonte « visite courte » : 5 étapes CONSTANTES pour tous les profils
// (4 communes + 1 finale adaptée). L'étape finale porte le CTA du profil.

function advanceToLast() {
  // 5 étapes → cliquer « Suivant » 4 fois pour atteindre la dernière.
  for (let i = 0; i < 4; i++) {
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }))
  }
}

describe('TourWizard — refonte visite courte (5 étapes constantes)', () => {
  it('invité : 5 étapes, CTA final « Créer un compte » branché sur showRegister', () => {
    const showRegister = vi.fn()
    render(<TourWizard lang="fr" user={null} onClose={() => {}} onAction={{ showRegister }} />)

    expect(screen.getByText('ÉTAPE 1 / 5')).toBeInTheDocument()
    advanceToLast()
    expect(screen.getByText('ÉTAPE 5 / 5')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Créer un compte/ }))
    expect(showRegister).toHaveBeenCalledTimes(1)
  })

  // P4 (audit 2026-10-02) : la visite d'un invité finissait sur un seul
  // bouton, « Créer un compte » — rien pour continuer sans, sauf la croix.
  it('invité : « Continuer sans compte » ferme la visite sans rien créer', () => {
    const showRegister = vi.fn()
    const onClose = vi.fn()
    render(<TourWizard lang="fr" user={null} onClose={onClose} onAction={{ showRegister }} />)
    advanceToLast()
    fireEvent.click(screen.getByRole('button', { name: 'Continuer sans compte' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(showRegister).not.toHaveBeenCalled()
  })

  it('connecté : pas de « Continuer sans compte »', () => {
    render(<TourWizard lang="fr" user={{ id: 'u1' }} isPremium={false} onClose={() => {}} onAction={{}} />)
    advanceToLast()
    expect(screen.queryByRole('button', { name: 'Continuer sans compte' })).toBeNull()
  })

  // P3 : la visite disait le bouton orange « sur toutes les pages » et
  // « toujours là » — il ne vit que sur l'accueil.
  it('ne promet pas un bouton orange « sur toutes les pages »', () => {
    render(<TourWizard lang="fr" user={null} onClose={() => {}} onAction={{}} />)
    expect(screen.queryByText(/toutes les pages/i)).toBeNull()
    expect(screen.getAllByText(/accueil/i).length).toBeGreaterThan(0)
  })

  it('connecté : CTA final « Voir la communauté » branché sur showCommunity', () => {
    const showCommunity = vi.fn()
    render(<TourWizard lang="fr" user={{ id: 'u1' }} isPremium={false} onClose={() => {}} onAction={{ showCommunity }} />)

    advanceToLast()
    fireEvent.click(screen.getByRole('button', { name: /Voir la communauté/ }))
    expect(showCommunity).toHaveBeenCalledTimes(1)
  })

  it('premium : CTA final « Lancer Fridge+ » ferme le tour (aucune action tierce)', () => {
    const onClose = vi.fn()
    render(<TourWizard lang="fr" user={{ id: 'u1' }} isPremium onClose={onClose} onAction={{}} />)

    advanceToLast()
    fireEvent.click(screen.getByRole('button', { name: /Lancer Fridge/ }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('le bouton « Astuce(s) » retourne la carte et révèle les astuces', () => {
    render(<TourWizard lang="fr" user={null} onClose={() => {}} />)

    // Étape 1 (fab) : 2 astuces → le libellé est pluralisé.
    const flipBtn = screen.getByRole('button', { name: /Astuces \(2\)/ })
    fireEvent.click(flipBtn)

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Touche le logo Fridge\+/)).toBeInTheDocument()
    // Bouton retour du verso
    expect(within(dialog).getByRole('button', { name: /Revenir/ })).toBeInTheDocument()
  })

  it('anglais : bascule sur les libellés EN (règle fr-sinon-en)', () => {
    render(<TourWizard lang="de" user={null} onClose={() => {}} onAction={{}} />)
    // langue non-fr → anglais
    expect(screen.getByText('STEP 1 / 5')).toBeInTheDocument()
    expect(screen.getByText('The orange button, Quick actions')).toBeInTheDocument()
  })

  it('l’étape 3 est « Vérifier » : inventaire et restes, avant les recettes', () => {
    render(<TourWizard lang="fr" user={null} onClose={() => {}} onAction={{}} />)
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }))
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }))
    expect(screen.getByText('ÉTAPE 3 / 5')).toBeInTheDocument()
    expect(screen.getByText('Vérifier ce que tu as')).toBeInTheDocument()
    expect(screen.getByText('Inventaire')).toBeInTheDocument()
    expect(screen.getByText('Restes')).toBeInTheDocument()
  })
})
