import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const etat = vi.hoisted(() => ({ auth: null }))
const signaler = vi.hoisted(() => vi.fn())

vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => etat.auth }))
vi.mock('@shared/hooks/use-save-error-toast', () => ({ useSaveErrorToast: () => signaler }))
// La case de l'accord (décision du 2026-10-06) a ses propres tests (allergenes-avec-accord).
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({ useConfirm: () => vi.fn() }))
vi.mock('@shared/contexts/data-provider', () => ({
  useAllergenTypes: () => ({
    gluten: { icon: '🌾', labels: { fr: 'Gluten', en: 'Gluten' } },
    lait: { icon: '🥛', labels: { fr: 'Lait', en: 'Milk' } },
  }),
}))

import AllergenPrefsChips from '@features/recipes/components/filters/allergen-prefs-chips'

// Audit du 2026-10-04, CPT-11 : dans le tiroir des filtres, le résultat de
// l'écriture d'un allergène était ignoré. Le fournisseur annule maintenant
// l'affichage ; ici, on le dit.
describe('AllergenPrefsChips — écriture refusée', () => {
  beforeEach(() => { signaler.mockReset() })

  it('allergène refusé par la base : « Pas enregistré »', async () => {
    const updateAllergenPrefs = vi.fn().mockResolvedValue({ error: { message: 'Failed to fetch' } })
    etat.auth = { user: { id: 'u1' }, allergenConsentAt: '2026-10-06T12:00:00Z', allergenPrefs: [], updateAllergenPrefs }
    render(<AllergenPrefsChips lang="fr" />)
    fireEvent.click(screen.getByRole('button', { name: /Gluten/ }))
    await waitFor(() => expect(signaler).toHaveBeenCalledWith('setting'))
    expect(updateAllergenPrefs).toHaveBeenCalledWith(['gluten'])
  })

  it('allergène accepté : rien n’est dit', async () => {
    const updateAllergenPrefs = vi.fn().mockResolvedValue({ error: null })
    etat.auth = { user: { id: 'u1' }, allergenConsentAt: '2026-10-06T12:00:00Z', allergenPrefs: ['gluten'], updateAllergenPrefs }
    render(<AllergenPrefsChips lang="fr" />)
    fireEvent.click(screen.getByRole('button', { name: /Gluten/ }))
    await waitFor(() => expect(updateAllergenPrefs).toHaveBeenCalledWith([]))
    expect(signaler).not.toHaveBeenCalled()
  })
})
