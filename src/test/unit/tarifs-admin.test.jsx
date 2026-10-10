import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { INGREDIENTS } from '@shared/static/ingredients'
import { SUPPORTED_LANGS } from '@shared/lib/i18n/langues'

// Audit du 2026-10-04, l'onglet Tarifs de l'admin en un passage (PERF-16,
// A11Y-23 (+), ADM-24) : ≈ 650 lignes rendues d'un bloc, cinq pastilles de
// langue par ligne (ES/DE/JA ne sont plus proposées) nommées « ok » et
// « missing » en anglais, « fallback subcat » et « edited » dans les cellules.
// Le vrai catalogue sert de données : la liste se construit à partir des
// ingrédients statiques et du fichier des prix.
vi.mock('@shared/contexts/data-provider', () => ({ useIngredients: () => INGREDIENTS }))
// La pagination partagée lit la langue du fournisseur d'interface.
vi.mock('@shared/contexts/ui-provider', async (importOriginal) => ({
  ...(await importOriginal()),
  useLang: () => ({ lang: 'fr', setLang() {} }),
}))

import PricingSection from '@features/admin/components/sections/pricing-section'

describe('onglet Tarifs — ce que la liste dit', () => {
  it('une pastille par langue proposée (FR, EN), nommée en français et par langue — ni « ok » ni « missing »', () => {
    render(<PricingSection lang="fr" />)
    const [, premiereLigne] = screen.getAllByRole('row')
    const pastilles = within(premiereLigne).getAllByRole('img')
    expect(pastilles).toHaveLength(SUPPORTED_LANGS.size)
    expect(pastilles.map((p) => p.getAttribute('aria-label'))).toEqual([
      expect.stringMatching(/^FR : /),
      expect.stringMatching(/^EN : /),
    ])
    expect(document.querySelector('[aria-label="ok"], [aria-label="missing"]')).toBeNull()
  })

  it('cent lignes par page, et « Page suivante » montre les cent d’après', () => {
    render(<PricingSection lang="fr" />)
    expect(screen.getAllByRole('row')).toHaveLength(1 + 100)
    const premiere = screen.getAllByRole('row')[1].textContent
    fireEvent.click(screen.getByRole('button', { name: 'Page suivante' }))
    expect(screen.getAllByRole('row')).toHaveLength(1 + 100)
    expect(screen.getAllByRole('row')[1].textContent).not.toBe(premiere)
    expect(screen.getByText(/Page 2 \/ \d+/)).toBeInTheDocument()
  })

  it('la recherche ramène à la première page (pas une page vide au-delà des résultats)', async () => {
    render(<PricingSection lang="fr" />)
    fireEvent.click(screen.getByRole('button', { name: 'Page suivante' }))
    fireEvent.change(screen.getByLabelText('Rechercher un ingrédient'), { target: { value: 'beurre' } })
    expect(await screen.findByText('fr-beurre')).toBeInTheDocument()
    expect(screen.queryByText('Aucun ingrédient correspondant.')).toBeNull()
  })

  it('en français : « prix de la sous-catégorie », pas « fallback subcat »', async () => {
    render(<PricingSection lang="fr" />)
    fireEvent.change(screen.getByLabelText('Rechercher un ingrédient'), { target: { value: 'beurre-doux' } })
    expect(await screen.findByText('prix de la sous-catégorie')).toBeInTheDocument()
    expect(screen.queryByText('fallback subcat')).toBeNull()
  })
})
