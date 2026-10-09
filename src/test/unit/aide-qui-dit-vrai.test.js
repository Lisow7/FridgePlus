import { describe, it, expect } from 'vitest'
import { SEUIL_PRESQUE, SEUIL_ROULETTE, estPresque, enPourcent } from '@shared/lib/recipes/recipe-thresholds'
import { PANEL_I18N } from '@shared/static/recipe-panel-i18n'
import { TOUR_STEPS_I18N } from '@features/onboarding/i18n/tour-steps-i18n'
import { FAQ_BASICS_I18N } from '@shared/lib/i18n/faq-basics-i18n'
import { GETTING_STARTED_I18N } from '@features/onboarding/i18n/getting-started-i18n'
import { WELCOME_I18N } from '@features/onboarding/i18n/welcome-i18n'
import { FEATURES_I18N } from '@features/onboarding/i18n/help-guide-i18n'
import { SUPPORT_SELF_HELP } from '@features/support/data/support-self-help'

// Audit du 2026-10-04, UX-09 et UX-05 : la visite, le guide, la FAQ, la carte
// « Bien démarrer » et l'aide rapide se contredisaient — « Presque » défini de
// trois façons, les favoris dits « réservés aux comptes », un chemin inexact
// pour relancer la visite, un onglet qui n'existe pas, un hors-ligne promis.

const texte = (objet) => JSON.stringify(objet)

describe('« Presque » et la roulette : un seul seuil, dans le code et dans les textes', () => {
  it('Presque = au moins 60 % des ingrédients, sans les avoir tous', () => {
    expect(SEUIL_PRESQUE).toBe(0.6)
    expect(estPresque(0.6)).toBe(true)
    expect(estPresque(0.59)).toBe(false)
    expect(estPresque(1)).toBe(false)
  })

  it('les textes disent le même seuil, plus « un ou deux ingrédients »', () => {
    const fr = `${enPourcent(SEUIL_PRESQUE)} %`
    const en = `${enPourcent(SEUIL_PRESQUE)}%`
    expect(PANEL_I18N.fr.almostDesc).toContain(fr)
    expect(PANEL_I18N.en.almostDesc).toContain(en)
    for (const [nom, lot] of [['visite', TOUR_STEPS_I18N], ['FAQ', FAQ_BASICS_I18N], ['carte', GETTING_STARTED_I18N]]) {
      expect(texte(lot.fr), nom).not.toMatch(/un ou deux|ingrédient ou deux/i)
      expect(texte(lot.en), nom).not.toMatch(/one or two/i)
    }
    // La visite écrit le seuil en clair (elle part au démarrage) : ce test est
    // le seul garde de l'accord, dans les deux langues.
    expect(texte(TOUR_STEPS_I18N.fr)).toContain(fr)
    expect(texte(TOUR_STEPS_I18N.en)).toContain(en)
    expect(texte(FAQ_BASICS_I18N.fr)).toContain(fr)
  })

  it('la roulette parle des ingrédients de la recette, pas du stock', () => {
    expect(SEUIL_ROULETTE).toBe(0.7)
    expect(PANEL_I18N.fr.rouletteNoMatch).toContain(`${enPourcent(SEUIL_ROULETTE)} %`)
    expect(PANEL_I18N.fr.rouletteNoMatch).not.toMatch(/de ton stock/)
    expect(PANEL_I18N.en.rouletteNoMatch).not.toMatch(/of your stock/)
  })
})

describe('les favoris marchent sans compte', () => {
  it('le catalogue d’aide les classe gratuits, la FAQ et la visite ne les disent plus réservés', () => {
    expect(FEATURES_I18N.fr.find((f) => f.id === 'favorites').tier).toBe('free')
    expect(FEATURES_I18N.en.find((f) => f.id === 'favorites').tier).toBe('free')
    expect(texte(FAQ_BASICS_I18N.fr)).not.toMatch(/un compte ajoute les favoris/)
    expect(texte(FAQ_BASICS_I18N.en)).not.toMatch(/an account adds favorites/)
    expect(texte(TOUR_STEPS_I18N.fr)).not.toMatch(/Un compte garde tes recettes préférées/)
    expect(texte(TOUR_STEPS_I18N.en)).not.toMatch(/An account keeps your favorite recipes/)
  })
})

describe('les chemins décrits existent', () => {
  it('relancer la visite : « ? », puis « Comment ça marche »', () => {
    expect(WELCOME_I18N.fr.skipFootnote).toContain('Comment ça marche')
    expect(WELCOME_I18N.en.skipFootnote).toContain('How it works')
    expect(texte(TOUR_STEPS_I18N.fr)).not.toMatch(/rouvre ce guide/)
    expect(texte(TOUR_STEPS_I18N.en)).not.toMatch(/reopens this guide/)
  })

  it('une recette en relecture se retrouve dans le panneau Recettes, filtre « Mes recettes »', () => {
    expect(texte(SUPPORT_SELF_HELP)).not.toMatch(/onglet « Mes recettes »|in your space, under/)
    expect(texte(SUPPORT_SELF_HELP)).toMatch(/filtre « Mes recettes »/)
  })
})

describe('le hors-ligne promis est le vrai', () => {
  it('la FAQ ne dit plus que l’app se souvient du frigo sans réseau', () => {
    expect(texte(FAQ_BASICS_I18N.fr)).not.toMatch(/se souvient de ton frigo/)
    expect(texte(FAQ_BASICS_I18N.en)).not.toMatch(/remembers your fridge/)
  })
})
