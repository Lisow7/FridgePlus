import { test, expect } from '@playwright/test'
import {
  installSupabaseMocks, assertNoUnmockedCalls,
  mockUsernameAvailable, mockUsernameTaken, mockSignupSuccess, signupCalls,
  skipOnboardingOverlays, signedInAs, mockStockUpsert, stockUpserts,
} from './support/supabase-mock.js'

// Funnel d'activation — §6 (P1) de la note d'audit repo.
//
// Ces tests couvrent les PARCOURS D'INTERFACE, pas l'integration backend :
// il n'existe pas de projet Supabase de staging et la CI n'a aucun secret
// Supabase, donc les appels reseau sont mockes. RLS et triggers relevent
// des tests pgTAP (note front §8), distincts par nature.
//
// Spec : la conception « e2e-parcours-critiques » du 2026-08-06

// Mot de passe conforme a la policy partagee (password-policy.js) : longueur,
// minuscule, majuscule, chiffre, caractere special.
const VALID_PWD = 'Fridge+2026!x'

// Les champs n'ont ni `id` ni `htmlFor`, et le <label> englobe aussi le texte
// d'aide : `getByLabel` est inutilisable ici. Les attributs `autocomplete`
// sont l'ancrage stable, et ils ne dependent pas de la langue.
async function fillSignupForm(page, { username, email, password = VALID_PWD }) {
  await page.locator('input[autocomplete="username"]').fill(username)
  await page.locator('input[autocomplete="email"]').fill(email)
  await page.locator('input[autocomplete="new-password"]').fill(password)
}

test.describe('Funnel d\'activation', () => {
  test.beforeEach(async ({ page }) => {
    // Langue forcee : les assertions portent sur des libelles FR, or la langue
    // est detectee depuis le navigateur puis persistee dans localStorage.
    await page.addInitScript(() => window.localStorage.setItem('fridge-lang', 'fr'))
    // Ecran d'accueil + bandeau cookies : les deux interceptent les clics.
    await skipOnboardingOverlays(page)
    // A INSTALLER EN PREMIER : Playwright evalue la DERNIERE route enregistree
    // en premier, donc les mocks de scenario poses ensuite masqueront ce socle.
    await installSupabaseMocks(page)
  })

  // Canari : si un 7e endpoint de demarrage apparait, ce test tombe le premier
  // et les autres ne se mettent pas a mentir pour autant.
  test('le socle couvre tous les appels du chargement', async ({ page }) => {
    await page.goto('/FridgePlus/signup')
    await expect(page.locator('input[autocomplete="username"]')).toBeVisible()
    assertNoUnmockedCalls(page)
  })

  test('sans acceptation des CGU, rien n\'est envoye', async ({ page }) => {
    await mockUsernameAvailable(page)
    await mockSignupSuccess(page)
    await page.goto('/FridgePlus/signup')

    await fillSignupForm(page, { username: 'Foodie_42', email: 'a@b.co' })
    // La case CGU reste volontairement decochee.
    await page.getByRole('button', { name: /Creer mon compte|Créer mon compte/i }).click()

    await expect(page.getByRole('alert')).toBeVisible()
    expect(signupCalls(page), 'aucun signup ne doit partir').toBe(0)
  })

  test('un pseudo deja pris est refuse sans creer de compte', async ({ page }) => {
    await mockUsernameTaken(page)
    await mockSignupSuccess(page)
    await page.goto('/FridgePlus/signup')

    await fillSignupForm(page, { username: 'Foodie_42', email: 'a@b.co' })
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: /Creer mon compte|Créer mon compte/i }).click()

    await expect(page.getByRole('alert')).toContainText(/deja pris|déjà pris/i)
    expect(signupCalls(page), 'le pseudo est verifie AVANT signUp').toBe(0)
  })

  test('une inscription valide invite a confirmer l\'e-mail', async ({ page }) => {
    await mockUsernameAvailable(page)
    await mockSignupSuccess(page)
    await page.goto('/FridgePlus/signup')

    await fillSignupForm(page, { username: 'Foodie_42', email: 'a@b.co' })
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: /Creer mon compte|Créer mon compte/i }).click()

    await expect(page.getByRole('status')).toContainText(/boite de reception|boîte de réception/i)
    expect(signupCalls(page)).toBe(1)
    assertNoUnmockedCalls(page)
  })

  // Test distinct du precedent, et non sa suite : la confirmation par e-mail
  // est active, donc `signUp` ne renvoie PAS de session. Le navigateur ne
  // franchit pas la boite mail — enchainer les deux simulerait un flux qui
  // n'existe pas. On repart donc d'une session deja posee.
  test('une fois connecte, le premier ajout ecrit dans user_stock', async ({ page }) => {
    await signedInAs(page, { username: 'Foodie_42' })
    await mockStockUpsert(page)
    await page.goto('/FridgePlus/')

    // L'overlay « Ouvrir le frigo » (absolute inset-0) recouvre les
    // compartiments : sans ce clic, tout clic sur un compartiment part en
    // timeout sans que le message designe la vraie cause.
    await page.getByRole('button', { name: /Ouvrir le frigo/i }).click()

    // Double rendu mobile/desktop : plusieurs boutons portent le meme nom
    // accessible, dont un masque en CSS. D'ou le filtre de visibilite.
    await page.locator('button:visible', { hasText: /^Frais/ }).first().click()
    await page.locator('button:visible', { hasText: /^Viande/ }).first().click()

    // Chaque ingredient est un <button aria-pressed> (subcategory-modal.jsx:252).
    // Ancrage par role ARIA : independant de la langue et des donnees.
    await page.locator('button[aria-pressed="false"]:visible').first().click()

    await expect.poll(() => stockUpserts(page).length, {
      message: 'un upsert user_stock doit partir',
    }).toBeGreaterThan(0)

    // On asserte la SEMANTIQUE (quel ingredient a ete ajoute) plutot qu'un
    // compteur d'appels : c'est ce qui a du sens fonctionnellement, et ca
    // reste vrai quel que soit le mode de build.
    //
    // Historique : ce test a d'abord revele un DOUBLE upsert par clic —
    // `addToStock()` etait appele dans l'updater de `setStock`, que StrictMode
    // invoque deux fois. Corrige depuis (l'appel est sorti de l'updater), et
    // verrouille par un test unitaire qui compte les appels sous StrictMode
    // (src/test/unit/use-fridge-stock.test.js, « purete des updaters »).
    const ids = new Set(stockUpserts(page).map((row) => row.ingredient_id))
    expect(ids.size, 'un seul ingredient doit avoir ete ajoute').toBe(1)
    // Convention d'ID : `fr-` = produits frais du frigo.
    expect([...ids][0]).toMatch(/^fr-/)

    // Verifie aussi qu'aucun rafraichissement de token n'a ete declenche :
    // c'est ce qui rend la session simulee reellement stable (cf. D6).
    assertNoUnmockedCalls(page)
  })
})
