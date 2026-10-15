import { test, expect } from '@playwright/test'
import { installSupabaseMocks, skipOnboardingOverlays, signedInAs } from './support/supabase-mock.js'

// Hors audit, trouvé le 2026-10-05 en corrigeant le lot 7. Une recette tapée en
// entier puis refusée par la base à l'enregistrement (réseau, session expirée) :
// le formulaire se fermait ET le brouillon était purgé. Rien ne le disait.
//
// La base est simulée : on lui fait refuser, puis accepter, l'enregistrement.

const TROIS_MOIS = 90 * 24 * 60 * 60 * 1000
const CLE_BROUILLON = 'fridge-recipe-draft'

// Un brouillon complet (il passe la validation du formulaire) : on évite de
// rejouer ici la saisie champ par champ, ce n'est pas le sujet.
const BROUILLON = {
  name: 'Gratin du dimanche', emoji: '🥘', country: 'fr', time: '45', difficulty: 'Facile',
  type: 'Plat principal', servings: 4, diet: [], allergens: [],
  ingredients: [{ _key: 'ing-1', ingredientId: 'fr-beurre-doux', labels: { fr: 'Beurre doux' }, qty: { amount: 40, unit: 'g' }, required: true }],
  steps: [{ id: 's-1', text: 'Beurrer le plat, puis enfourner 40 minutes.' }],
}

async function ouvrirLeFormulaireAvecSonBrouillon(page, etat) {
  await page.addInitScript(([cle, payload]) => {
    window.localStorage.setItem('fridge-lang', 'fr')
    // Posé une seule fois : après la purge, un rechargement ne doit pas le faire renaître.
    if (!window.sessionStorage.getItem('brouillon-pose')) {
      window.localStorage.setItem(cle, JSON.stringify({ version: 1, savedAt: Date.now(), payload }))
      window.sessionStorage.setItem('brouillon-pose', '1')
    }
  }, [CLE_BROUILLON, BROUILLON])
  await skipOnboardingOverlays(page)
  // À INSTALLER EN PREMIER : les mocks de scénario posés ensuite le masquent.
  await installSupabaseMocks(page)
  await signedInAs(page, { profile: { language: 'fr', created_at: new Date(Date.now() - TROIS_MOIS).toISOString() } })
  // `custom_recipes` : lecture des recettes du compte (GET) et enregistrement (POST).
  await page.route('**/rest/v1/custom_recipes**', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(etat.enBase) })
    }
    etat.envois += 1
    if (etat.refuse) {
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'internal error' }) })
    }
    const corps = JSON.parse(route.request().postData() ?? '{}')
    etat.enBase = [{ id: corps.id, data: corps.data, moderation_status: 'private', is_public: false, admin_modified: false, consent_to_promote: false }]
    return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
  })
  await page.goto('/FridgePlus/?recettes=1')
  // « Créer une recette » vit dans le menu « Plus d’actions » de l’en-tête du panneau
  // (décision du 2026-10-08).
  await page.getByRole('button', { name: /Plus d.actions/ }).click()
  await page.getByRole('menuitem', { name: 'Créer une recette' }).click()
  await expect(page.getByRole('dialog').getByText('Brouillon restauré')).toBeVisible()
}

const brouillonSurLAppareil = (page) => page.evaluate((cle) => window.localStorage.getItem(cle), CLE_BROUILLON)

test.describe('Une recette refusée à l’enregistrement n’est pas perdue', () => {
  test('refusée : le formulaire reste ouvert avec ce qui est tapé, le brouillon reste, et c’est dit', async ({ page }) => {
    const etat = { refuse: true, envois: 0, enBase: [] }
    await ouvrirLeFormulaireAvecSonBrouillon(page, etat)

    await page.getByRole('button', { name: 'Enregistrer' }).click()

    const alerte = page.getByRole('dialog').getByRole('alert')
    await expect(alerte).toContainText('Pas enregistrée')
    expect(etat.envois).toBe(1)
    // Rien de ce qui est tapé n'est perdu : ni à l'écran, ni sur l'appareil.
    await expect(page.getByRole('dialog').locator('input[value="Gratin du dimanche"]')).toBeVisible()
    expect(await brouillonSurLAppareil(page)).not.toBeNull()

    // La base répond de nouveau : un second essai enregistre, ferme, et purge le brouillon.
    etat.refuse = false
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByRole('dialog').getByText('Brouillon restauré')).toHaveCount(0)
    expect(etat.envois).toBe(2)
    await expect.poll(() => brouillonSurLAppareil(page)).toBeNull()
  })

  // Audit du 2026-10-04, A11Y-07 : la durée était nommée par un <span> voisin,
  // jamais relié — un lecteur d'écran annonçait « champ numérique », sans plus.
  test('la durée est un champ nommé par son libellé', async ({ page }) => {
    await ouvrirLeFormulaireAvecSonBrouillon(page, { refuse: false, envois: 0, enBase: [] })
    await expect(page.getByRole('dialog').getByRole('spinbutton', { name: 'Temps (minutes)' })).toHaveValue('45')
  })

  test('acceptée du premier coup : le formulaire se ferme, aucune alerte (témoin)', async ({ page }) => {
    const etat = { refuse: false, envois: 0, enBase: [] }
    await ouvrirLeFormulaireAvecSonBrouillon(page, etat)

    await page.getByRole('button', { name: 'Enregistrer' }).click()

    await expect(page.getByText('Brouillon restauré')).toHaveCount(0)
    expect(etat.envois).toBe(1)
    await expect.poll(() => brouillonSurLAppareil(page)).toBeNull()
    await expect(page.getByText(/Pas enregistrée/)).toHaveCount(0)
  })
})
