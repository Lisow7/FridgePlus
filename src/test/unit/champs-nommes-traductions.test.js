import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SUPPORT_I18N } from '@features/support/i18n/support-i18n'
import { COMMUNITY_I18N } from '@shared/lib/i18n/community-i18n'
import { LEFTOVERS_I18N } from '@features/fridge/i18n/leftovers-i18n'
import { FORM_I18N } from '@features/recipes/i18n/recipe-form-i18n'

// Audit du 2026-10-04, A11Y-07 (2e partie). Le cliquet `champs-sans-nom` voit
// qu'un `aria-label={t.cle}` est ÉCRIT — pas que `t.cle` EXISTE. Une clé
// absente d'une langue rend `aria-label={undefined}` : le champ redevient sans
// nom, sans qu'aucun compte ne bouge. Ici, chaque nom existe, en fr et en en,
// et c'est un nom (pas de points de suspension, pas d'exemple).

const CAS = [
  ['support', SUPPORT_I18N, ['replyAria', 'titleInputAria']],
  ['communauté', COMMUNITY_I18N, ['searchInputAria', 'replyAria', 'recipePickerAria']],
  ['restes', LEFTOVERS_I18N, ['nameAria', 'searchLeftoverAria', 'searchIngredientAria', 'searchRecipeAria']],
  ['formulaire de recette', FORM_I18N, ['stepAria', 'ingredientSearchAria', 'qtyAria']],
]

describe('les noms des champs existent dans les deux langues', () => {
  for (const [zone, i18n, cles] of CAS) {
    for (const lang of ['fr', 'en']) {
      it(`${zone} — ${lang}`, () => {
        for (const cle of cles) {
          expect(i18n[lang]?.[cle], `${cle} (${lang})`).toEqual(expect.stringMatching(/\S/))
          expect(i18n[lang][cle], `${cle} (${lang}) : un nom, pas un placeholder`).not.toMatch(/…|\.\.\.|ex\s?:/i)
        }
      })
    }
  }

  it('ticket de caisse et saisie vocale : la recherche manuelle est nommée en fr et en en', () => {
    for (const f of ['src/features/receipt-scan/components/receipt-review-panel.jsx', 'src/features/voice/components/voice-confirm-panel.jsx']) {
      const source = readFileSync(resolve(process.cwd(), f), 'utf8')
      expect(source, f).toContain("searchAria: 'Ajouter un ingrédient manuellement',")
      expect(source, f).toContain("searchAria: 'Add an ingredient manually',")
      // Le nom est maintenant un libellé VISIBLE (décision du 2026-10-06).
      expect(source, f).toContain('>{t.searchAria}</label>')
    }
  })
})
