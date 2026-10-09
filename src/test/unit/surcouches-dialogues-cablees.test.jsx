import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Les surcouches équipées par useDialogue sont BRANCHÉES (audit du 2026-10-04,
// A11Y-01) : le relevé `surcouches-sont-des-dialogues` vérifie que le hook est
// appelé, ces tests qu'il l'est sur la bonne fenêtre, nommée par son titre, et
// qu'Échap ferme — pour les plus sensibles : la suppression de compte, le
// signalement d'un avis, l'abandon et la publication d'une recette.

vi.mock('@features/recipes/api/recipe-reviews', () => ({ reportReview: vi.fn() }))

import DangerZone from '@features/profile/components/danger-zone'
import ReviewReportModal from '@features/recipes/components/recipe-review-report-modal'
import RecipeFormCancelDialog from '@features/recipes/components/recipe-form-cancel-dialog'
import RecipeFormPublishDialog from '@features/recipes/components/recipe-form-publish-dialog'

describe('surcouches câblées en boîtes de dialogue', () => {
  it('suppression de compte : dialogue nommé, Échap ferme', () => {
    const onCloseDialog = vi.fn()
    render(<DangerZone isDialogOpen onOpenDialog={() => {}} onCloseDialog={onCloseDialog} password="" onPasswordChange={() => {}}
      showPassword={false} onTogglePasswordVisibility={() => {}} isLoading={false} onSubmit={(e) => e.preventDefault()}
      t={{ dangerTitle: 'Supprimer mon compte', dangerText: 'Irréversible.', dangerBtn: 'Supprimer', dangerConfirm: 'Mot de passe', cancelBtn: 'Annuler', tabDanger: 'Zone de danger' }}
      lang="fr" isMobile={false} darkMode={false} border="#ddd" textColor="#000" mutedColor="#666" modalBg="#fff"
      iconStyle={{}} inputStyle={{}} pwdToggleLabel={() => 'Afficher'} />)

    expect(screen.getByRole('dialog', { name: 'Supprimer mon compte' })).toHaveAttribute('aria-modal', 'true')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCloseDialog).toHaveBeenCalled()
  })

  it('signalement d’un avis : dialogue nommé, Échap ferme', () => {
    const onClose = vi.fn()
    render(<ReviewReportModal reviewId="r1" userId="u1" darkMode={false} onClose={onClose}
      t={{ reportTitle: 'Signaler cet avis', reportSent: 'Envoyé', reportSend: 'Envoyer', cancel: 'Annuler', reportReasons: {} }} />)

    expect(screen.getByRole('dialog', { name: 'Signaler cet avis' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('abandon d’une recette : Échap = « Continuer l’édition »', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    render(<RecipeFormCancelDialog isOpen onCancel={onCancel} onConfirm={onConfirm} darkMode={false}
      t={{ confirmCancelTitle: 'Quitter sans enregistrer ?', confirmCancelBody: 'Tes modifications seront perdues.', confirmCancelBack: 'Continuer', confirmCancelOk: 'Quitter' }} />)

    expect(screen.getByRole('dialog', { name: 'Quitter sans enregistrer ?' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('publication d’une recette : dialogue nommé, Échap annule', () => {
    const onCancel = vi.fn()
    render(<RecipeFormPublishDialog isOpen onCancel={onCancel} onConfirm={() => {}} acknowledged={false} onToggleAcknowledged={() => {}}
      consent={false} onToggleConsent={() => {}} submitting={false} darkMode={false}
      t={{ publishTitle: 'Publier ta recette', publishCriteria: [], publishNote: '', publishAck: 'J’ai relu', publishAckHint: '', publishConsent: 'J’accepte', publishConsentHint: '', publishModerationNotice: '', cancel: 'Annuler', publishConfirm: 'Publier' }} />)

    expect(screen.getByRole('dialog', { name: 'Publier ta recette' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })
})
