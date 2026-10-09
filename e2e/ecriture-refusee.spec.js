import { test, expect } from '@playwright/test'
import { installSupabaseMocks, skipOnboardingOverlays, signedInAs } from './support/supabase-mock.js'

// Audit du 2026-10-04 (UX-02). Un ajout au frigo que la base refusait restait
// coché à l'écran, puis disparaissait au rechargement, sans un mot. Et un frigo
// qui n'avait pas pu être chargé à la connexion s'affichait vide, sans
// explication.
//
// La base est simulée : on lui fait refuser ce qu'on veut voir refuser.

const TROIS_MOIS = 90 * 24 * 60 * 60 * 1000

async function compteConnecte(page) {
  await page.addInitScript(() => window.localStorage.setItem('fridge-lang', 'fr'))
  await skipOnboardingOverlays(page)
  // À INSTALLER EN PREMIER : les mocks de scénario posés ensuite le masquent.
  await installSupabaseMocks(page)
  await signedInAs(page, { profile: { language: 'fr', created_at: new Date(Date.now() - TROIS_MOIS).toISOString() } })
}

// `user_stock` : lecture du frigo (GET) et écritures (POST pour un ajout, DELETE
// pour un retrait). `etat` se modifie en cours de test.
async function frigoEnBase(page, etat) {
  await page.route('**/rest/v1/user_stock**', (route) => {
    const methode = route.request().method()
    if (methode === 'GET') {
      etat.lectures += 1
      return etat.lectureRefusee
        ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'internal error' }) })
        : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(etat.lignes) })
    }
    etat.ecritures += 1
    return etat.ecritureRefusee
      ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'internal error' }) })
      : route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
  })
}

async function ouvrirLesViandes(page) {
  await page.getByRole('button', { name: /Ouvrir le frigo/i }).click()
  await page.locator('button:visible', { hasText: /^Frais/ }).first().click()
  await page.locator('button:visible', { hasText: /^Viande/ }).first().click()
}

test.describe('Une écriture refusée se voit et se lit', () => {
  test('ajout au frigo refusé : l’aliment est décoché, et un message le dit', async ({ page }) => {
    const etat = { lignes: [], lectures: 0, ecritures: 0, lectureRefusee: false, ecritureRefusee: true }
    await compteConnecte(page)
    await frigoEnBase(page, etat)
    await page.goto('/FridgePlus/')
    await ouvrirLesViandes(page)

    const aliment = page.locator('button[aria-pressed]:visible').first()
    await expect(aliment).toHaveAttribute('aria-pressed', 'false')
    await aliment.click()

    // L'écriture est partie, la base l'a refusée : l'aliment revient décoché…
    await expect.poll(() => etat.ecritures).toBeGreaterThan(0)
    await expect(aliment).toHaveAttribute('aria-pressed', 'false')
    // …et c'est dit, dans une région annoncée aux lecteurs d'écran.
    const message = page.getByText('Pas enregistré : ton frigo n\'a pas pu être mis à jour. Réessaie.')
    await expect(message).toBeVisible()
    expect(await message.evaluate((el) => !!el.closest('[aria-live="assertive"]'))).toBe(true)
  })

  test('ajout accepté : l’aliment reste coché, aucun message (témoin)', async ({ page }) => {
    const etat = { lignes: [], lectures: 0, ecritures: 0, lectureRefusee: false, ecritureRefusee: false }
    await compteConnecte(page)
    await frigoEnBase(page, etat)
    await page.goto('/FridgePlus/')
    await ouvrirLesViandes(page)

    const aliment = page.locator('button[aria-pressed]:visible').first()
    await aliment.click()
    await expect.poll(() => etat.ecritures).toBeGreaterThan(0)
    await expect(aliment).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText(/Pas enregistré/)).toHaveCount(0)
  })

  test('frigo pas chargé à la connexion : le dit, et « Réessayer » le charge', async ({ page }) => {
    const etat = { lignes: [{ ingredient_id: 'fr-beurre-doux', added_at: '2026-10-01T10:00:00Z', expires_at: null }], lectures: 0, ecritures: 0, lectureRefusee: true, ecritureRefusee: false }
    await compteConnecte(page)
    await frigoEnBase(page, etat)
    // Les favoris et les recettes du compte, eux, se chargent (`signedInAs`
    // les sert vides) : seul le frigo échoue.
    await page.goto('/FridgePlus/')

    const message = page.getByText('Ton frigo n\'a pas pu être chargé.')
    await expect(message).toBeVisible()
    // Il reste tant que la personne n'a rien fait.
    await page.waitForTimeout(7000)
    await expect(message).toBeVisible()

    // La base répond de nouveau : « Réessayer » charge le frigo et retire le message.
    etat.lectureRefusee = false
    const avant = etat.lectures
    await page.getByRole('button', { name: 'Réessayer' }).click()
    await expect.poll(() => etat.lectures).toBeGreaterThan(avant)
    await expect(message).toHaveCount(0)
  })
})

// Le conteneur des messages était centré par `left: 50%` + `translateX(-50%)` :
// son contenu ne disposait alors que d'une DEMI-fenêtre. Sans conséquence pour
// les messages courts d'avant ; sur un téléphone, « Ton frigo n'a pas pu être
// chargé… » s'écrivait dans une colonne de 60 px, un mot par ligne.
test.describe('Sur téléphone, les messages ont toute la largeur utile', () => {
  test.use({ viewport: { width: 360, height: 740 } })

  test('« Pas enregistré » n’est pas écrasé dans une demi-fenêtre', async ({ page }) => {
    const etat = { lignes: [], lectures: 0, ecritures: 0, lectureRefusee: false, ecritureRefusee: true }
    await compteConnecte(page)
    await frigoEnBase(page, etat)
    await page.goto('/FridgePlus/')
    await ouvrirLesViandes(page)
    await page.locator('button[aria-pressed]:visible').first().click()

    const message = page.getByText('Pas enregistré : ton frigo n\'a pas pu être mis à jour. Réessaie.')
    await expect(message).toBeVisible()
    expect((await message.boundingBox()).width).toBeGreaterThan(250)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })

  test('le message de chargement raté se lit, et ses boutons se touchent au doigt', async ({ page }) => {
    const etat = { lignes: [], lectures: 0, ecritures: 0, lectureRefusee: true, ecritureRefusee: false }
    await compteConnecte(page)
    await frigoEnBase(page, etat)
    await page.goto('/FridgePlus/')

    const message = page.getByText('Ton frigo n\'a pas pu être chargé.')
    await expect(message).toBeVisible()
    // Le paragraphe (le message et sa précision), pas une colonne d'un mot.
    const paragraphe = await message.locator('xpath=..').boundingBox()
    expect(paragraphe.width).toBeGreaterThan(250)
    for (const nom of ['Réessayer', 'Fermer']) {
      const bouton = await page.getByRole('button', { name: nom }).boundingBox()
      expect(bouton.height, `« ${nom} » : hauteur`).toBeGreaterThanOrEqual(44)
      expect(bouton.width, `« ${nom} » : largeur`).toBeGreaterThanOrEqual(44)
      expect(bouton.x + bouton.width, `« ${nom} » tient dans la fenêtre`).toBeLessThanOrEqual(360)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
})
