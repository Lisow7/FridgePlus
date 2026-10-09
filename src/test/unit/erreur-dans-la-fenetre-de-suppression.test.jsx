import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

// L'erreur de la suppression s'affiche DANS la fenêtre (audit du 2026-10-04,
// CPT-04).
//
// « Mot de passe incorrect » s'écrivait sous le fond sombre et flouté de la
// fenêtre : la personne ne voyait rien se passer. Et le champ du mot de passe
// n'avait pas de nom, seulement un texte d'exemple.

vi.mock('@shared/hooks/use-dialogue', () => ({
  useDialogue: () => ({ titreId: 'titre', proprietes: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'titre' } }),
}))

import DangerZone from '@features/profile/components/danger-zone'

const T = {
  dangerTitle: 'Zone de danger', dangerText: 'Texte', dangerBtn: 'Supprimer mon compte',
  dangerConfirm: 'Mot de passe actuel (confirmation)', cancelBtn: 'Annuler', tabDanger: 'Danger',
}

function monter(props = {}) {
  return render(
    <DangerZone isDialogOpen onOpenDialog={() => {}} onCloseDialog={() => {}} password="x" onPasswordChange={() => {}}
      showPassword={false} onTogglePasswordVisibility={() => {}} isLoading={false} onSubmit={(e) => e.preventDefault()}
      t={T} lang="fr" isMobile={false} darkMode={false} border="#ccc" textColor="#000" mutedColor="#555" modalBg="#fff"
      iconStyle={{}} inputStyle={{}} pwdToggleLabel={() => 'Afficher'} {...props} />,
  )
}

describe('la fenêtre de suppression', () => {
  it('l’erreur s’affiche DANS la fenêtre, annoncée', () => {
    monter({ error: 'Mot de passe incorrect.' })
    const fenetre = screen.getByRole('dialog')
    expect(within(fenetre).getByRole('alert')).toHaveTextContent('Mot de passe incorrect.')
  })

  it('sans erreur : rien d’annoncé', () => {
    monter()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('le champ du mot de passe a un nom', () => {
    monter()
    expect(screen.getByLabelText('Mot de passe actuel (confirmation)')).toHaveAttribute('type', 'password')
  })
})
