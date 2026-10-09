import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import RecipeFormDetailsSection from '@features/recipes/components/recipe-form-details-section'

// Audit du 2026-10-04, A11Y-07 : la durée de la recette était nommée par un
// `<span>` voisin — un lecteur d'écran annonçait « champ numérique » sans dire
// lequel, et son erreur n'était ni reliée ni marquée.

const t = {
  sectionDetails: 'Détails', fieldCountry: 'Pays', fieldTime: 'Temps', fieldDifficulty: 'Difficulté',
  fieldType: 'Type', fieldServings: 'Portions', fieldDiets: 'Régimes', fieldAllergens: 'Allergènes',
}

function monter(errors = {}) {
  return render(
    <RecipeFormDetailsSection
      form={{ time: '20', difficulty: 'easy', type: 'Plat principal', servings: 2, country: '', diet: [], allergens: [] }}
      update={vi.fn()} errors={errors} t={t} lang="fr" darkMode={false}
      inputBase={() => ({})} label={{}} allergenTypes={[]} dietTypes={[]} allergenKeys={[]}
      countryOptions={[]} toggleDiet={vi.fn()}
    />,
  )
}

describe('formulaire de recette — la durée', () => {
  it('est nommée par son libellé', () => {
    monter()
    expect(screen.getByRole('spinbutton', { name: 'Temps' })).toHaveValue(20)
  })

  it('en erreur : marquée invalide, et décrite par son erreur', () => {
    monter({ time: 'Indique une durée.' })
    const champ = screen.getByRole('spinbutton', { name: 'Temps' })
    expect(champ).toHaveAttribute('aria-invalid', 'true')
    expect(champ).toHaveAccessibleDescription('Indique une durée.')
  })

  it('sans erreur : ni invalide, ni description', () => {
    monter()
    const champ = screen.getByRole('spinbutton', { name: 'Temps' })
    expect(champ).not.toHaveAttribute('aria-invalid')
    expect(champ).not.toHaveAttribute('aria-describedby')
  })
})
