// L'aide désigne les fonctionnalités avec LES MÊMES icônes que le menu du
// bouton orange (heuristique de cohérence) : un utilisateur qui lit
// « Scan du ticket » avec une caméra retrouve une caméra dans le menu.
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { FEATURE_ICONS } from '@features/onboarding/lib/feature-icons'
import { FeatureIcon } from '@features/onboarding/lib/feature-icon'
import { FEATURES_I18N } from '@features/onboarding/i18n/help-guide-i18n'
import { LuMic, LuCamera, LuChefHat, LuClipboardList, LuCookingPot } from 'react-icons/lu'

describe('icônes des fonctionnalités dans l’aide', () => {
  it('couvre chaque fonctionnalité listée dans la modale, dans les deux langues', () => {
    for (const lang of ['fr', 'en']) {
      for (const f of FEATURES_I18N[lang]) {
        expect(FEATURE_ICONS[f.id], `icône manquante pour « ${f.id} »`).toBeTypeOf('function')
      }
    }
  })

  it('reprend les icônes du menu du bouton orange pour les actions qu’il contient', () => {
    expect(FEATURE_ICONS.voice).toBe(LuMic)
    expect(FEATURE_ICONS.receipt).toBe(LuCamera)
    expect(FEATURE_ICONS.recipes).toBe(LuChefHat)
    expect(FEATURE_ICONS.inventory).toBe(LuClipboardList)
    expect(FEATURE_ICONS.leftovers).toBe(LuCookingPot)
  })

  it('rend un svg décoratif, et ne casse pas sur un id inconnu', () => {
    const { container, rerender } = render(<FeatureIcon id="voice" />)
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    rerender(<FeatureIcon id="inconnu" />)
    expect(container.querySelector('svg')).not.toBeNull()
  })
})
