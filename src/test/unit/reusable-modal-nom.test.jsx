import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Audit du 2026-10-04, A11Y-23 : sans titre, la fenêtre réutilisable
// s'annonçait « Dialog » — en anglais, quelle que soit la langue — alors que
// le composant a déjà son dictionnaire fr/en.
vi.mock('@shared/contexts/ui-provider', async (importOriginal) => ({
  ...(await importOriginal()),
  useLang: () => ({ lang: 'fr', setLang() {} }),
}))

import ReusableModal from '@shared/ui/reusable-modal'

describe('ReusableModal — nom de la fenêtre sans titre', () => {
  it('se nomme en français quand aucun titre ne la nomme', () => {
    render(<ReusableModal open onClose={() => {}}>contenu</ReusableModal>)
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Fenêtre de dialogue')
  })

  it('avec un titre, c’est le titre qui la nomme (témoin)', () => {
    render(<ReusableModal open title="Réglages" onClose={() => {}}>contenu</ReusableModal>)
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Réglages')
  })
})
