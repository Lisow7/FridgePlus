import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RecipeFormPublishDialog from '@features/recipes/components/recipe-form-publish-dialog'

// Spec sources :
//  - 2026-06-10-recipe-publish-benefits-design.md (R-01, encart bénéfices)
//  - 2026-06-13-recipe-publish-consent-design.md (R-03, 2e case consentement + mention modération)
//
// Couverture :
//  1. encart bénéfices rendu en tête si t.publishBenefits non vide
//  2. pas d'encart si t.publishBenefits absent (rétro-compat)
//  3. bouton Soumettre exige les DEUX cases (acquittement + consentement)
//  4. mention de modération in-flow visible
//  5. ne rend rien si isOpen false

const T_FULL = {
  publishBenefitsTitle: 'Ce que tu gagnes en publiant',
  publishBenefits: [
    { emoji: '📣', label: 'Visibilité', detail: 'Vue par la communauté.' },
    { emoji: '🥗', label: 'Nutrition auto', detail: 'Calories calculées.' },
    { emoji: '⭐', label: 'Avis & réactions', detail: 'Likes et commentaires.' },
    { emoji: '🤝', label: 'Contribuer', detail: 'Enrichis le catalogue.' },
  ],
  publishTitle: 'Critères de publication',
  publishCriteria: ['Tous les champs sont renseignés.', 'Pas de fautes.', 'Étapes claires.', 'Pas de contenu offensant.', 'Pas un doublon.'],
  publishNote: 'Sera examinée par un administrateur.',
  publishAck: 'J\'ai pris connaissance des critères.',
  publishAckHint: 'Coche la case ci-dessus.',
  publishConsent: 'J\'autorise Fridge+ à publier cette recette.',
  publishConsentHint: 'Coche aussi cette case pour autoriser la publication.',
  publishModerationNotice: 'Le contenu est analysé automatiquement par notre prestataire OpenAI pour la modération.',
  publishConfirm: 'Soumettre',
  cancel: 'Annuler',
}

// t sans encart — comme avant la PR R-01
const T_LEGACY = {
  publishTitle: T_FULL.publishTitle,
  publishCriteria: T_FULL.publishCriteria,
  publishNote: T_FULL.publishNote,
  publishAck: T_FULL.publishAck,
  publishAckHint: T_FULL.publishAckHint,
  publishConsent: T_FULL.publishConsent,
  publishConsentHint: T_FULL.publishConsentHint,
  publishModerationNotice: T_FULL.publishModerationNotice,
  publishConfirm: T_FULL.publishConfirm,
  cancel: T_FULL.cancel,
}

function renderDialog(props) {
  return render(
    <RecipeFormPublishDialog
      isOpen
      onCancel={() => {}}
      onConfirm={() => {}}
      acknowledged={false}
      onToggleAcknowledged={() => {}}
      consent={false}
      onToggleConsent={() => {}}
      submitting={false}
      darkMode={false}
      t={T_FULL}
      {...props}
    />,
  )
}

describe('RecipeFormPublishDialog', () => {
  it('rend l\'encart bénéfices en tête quand t.publishBenefits est fourni', () => {
    renderDialog()
    expect(screen.getByText('Ce que tu gagnes en publiant')).toBeTruthy()
    expect(screen.getByText('Visibilité')).toBeTruthy()
    expect(screen.getByText('Nutrition auto')).toBeTruthy()
    expect(screen.getByText('Avis & réactions')).toBeTruthy()
    expect(screen.getByText('Contribuer')).toBeTruthy()
    const aside = screen.getByRole('complementary', { name: 'Ce que tu gagnes en publiant' })
    expect(aside).toBeTruthy()
  })

  it('ne rend pas d\'encart si t.publishBenefits est absent (rétro-compat)', () => {
    renderDialog({ t: T_LEGACY })
    expect(screen.queryByRole('complementary')).toBeNull()
    expect(screen.getByText('Critères de publication')).toBeTruthy()
    expect(screen.getByText('J\'ai pris connaissance des critères.')).toBeTruthy()
  })

  it('affiche la mention de modération in-flow (R-03 / F5)', () => {
    renderDialog()
    expect(screen.getByText(/analysé automatiquement par notre prestataire OpenAI/i)).toBeTruthy()
  })

  it('garde Soumettre désactivé tant que les DEUX cases ne sont pas cochées (R-03)', () => {
    const { rerender } = renderDialog()
    const getBtn = () => screen.getByText('Soumettre').closest('button')

    // Aucune cochée → désactivé
    expect(getBtn()?.disabled).toBe(true)

    // Acquittement seul → toujours désactivé (consentement manquant)
    rerender(
      <RecipeFormPublishDialog isOpen onCancel={() => {}} onConfirm={() => {}}
        acknowledged={true} onToggleAcknowledged={() => {}}
        consent={false} onToggleConsent={() => {}}
        submitting={false} darkMode={false} t={T_FULL} />,
    )
    expect(getBtn()?.disabled).toBe(true)

    // Consentement seul → toujours désactivé (acquittement manquant)
    rerender(
      <RecipeFormPublishDialog isOpen onCancel={() => {}} onConfirm={() => {}}
        acknowledged={false} onToggleAcknowledged={() => {}}
        consent={true} onToggleConsent={() => {}}
        submitting={false} darkMode={false} t={T_FULL} />,
    )
    expect(getBtn()?.disabled).toBe(true)
  })

  it('active Soumettre et déclenche onConfirm quand les deux cases sont cochées (R-03)', () => {
    const onConfirm = vi.fn()
    renderDialog({ acknowledged: true, consent: true, onConfirm })
    const btn = screen.getByText('Soumettre').closest('button')
    expect(btn?.disabled).toBe(false)
    fireEvent.click(btn)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('ne rend rien quand isOpen est false', () => {
    const { container } = render(
      <RecipeFormPublishDialog isOpen={false} onCancel={() => {}} onConfirm={() => {}}
        acknowledged={false} onToggleAcknowledged={() => {}}
        consent={false} onToggleConsent={() => {}}
        submitting={false} darkMode={false} t={T_FULL} />,
    )
    expect(container.firstChild).toBeNull()
    expect(document.body.querySelector('[aria-label="Ce que tu gagnes en publiant"]')).toBeNull()
  })
})
