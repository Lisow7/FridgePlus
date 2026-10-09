import { test, expect } from '@playwright/test'
import { installSupabaseMocks, skipOnboardingOverlays } from './support/supabase-mock.js'

// Une adresse morte n'est pas référencée (audit du 2026-10-04, SEO-03).
//
// Le serveur répond 200 et la coquille de l'accueil à TOUTE adresse : c'est le
// JavaScript qui sait qu'elle est morte. Ici le chemin réel, celui que les
// tests unitaires ne voient pas : la balise `robots` servie par `index.html`
// (« index, follow ») passe à `noindex` sur une page morte, sans qu'une
// seconde balise la contredise, et retrouve sa valeur en revenant à l'accueil.

const robots = (page) => page.evaluate(() => [...document.querySelectorAll('meta[name="robots"]')].map((m) => m.content))

async function preparer(page) {
  await page.addInitScript(() => window.localStorage.setItem('fridge-lang', 'fr'))
  await skipOnboardingOverlays(page)
  await installSupabaseMocks(page)
}

// La fiche demandée : absente de la base (`[]`) ou en panne (500). Le
// catalogue, lui, ne répond jamais : la fiche ne doit pas l'attendre.
async function servirLaFiche(page, id, reponse) {
  const servir = (route) => (reponse === 'absente'
    ? route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    : route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'boom' }) }))
  await page.route('**/rest/v1/recipes_unified**', (route) => (route.request().url().includes(`id=eq.${id}`) ? servir(route) : undefined))
  await page.route('**/rest/v1/custom_recipes**', (route) => (route.request().url().includes(`id=eq.${id}`) ? servir(route) : route.abort()))
}

test('adresse inconnue : noindex et titre « introuvable », rendus en revenant à l’accueil', async ({ page }) => {
  test.setTimeout(60000)
  await preparer(page)

  await page.goto('/FridgePlus/cette-page-n-existe-pas')
  await expect(page.getByRole('heading', { name: /Page introuvable/ })).toBeVisible({ timeout: 15000 })
  await expect(page).toHaveTitle('Page introuvable — Fridge+')
  expect(await robots(page)).toEqual(['noindex'])

  await page.getByRole('link', { name: /Retour à l.accueil/ }).click()
  await expect(page).toHaveURL(/\/FridgePlus\/?$/)
  await expect.poll(() => robots(page)).toEqual(['index, follow'])
  await expect(page).not.toHaveTitle(/introuvable/)
})

test('fiche qui n’existe pas : noindex', async ({ page }) => {
  test.setTimeout(60000)
  await preparer(page)
  await servirLaFiche(page, 'zzz-plat-fantome', 'absente')

  await page.goto('/FridgePlus/recipe/zzz-plat-fantome')
  await expect(page.getByText('Recette introuvable')).toBeVisible({ timeout: 20000 })
  expect(await robots(page)).toEqual(['noindex'])
})

// Audit du 2026-10-04, P-09 : l'onglet gardait le titre de l'accueil, en
// français même pour un visiteur anglophone.
test('fiche qui n’existe pas : l’onglet le dit, dans la langue du visiteur', async ({ page }) => {
  test.setTimeout(60000)
  await page.addInitScript(() => window.localStorage.setItem('fridge-lang', 'en'))
  await skipOnboardingOverlays(page)
  await installSupabaseMocks(page)
  await servirLaFiche(page, 'zzz-plat-fantome', 'absente')

  await page.goto('/FridgePlus/recipe/zzz-plat-fantome')
  await expect(page.getByText('Recipe not found')).toBeVisible({ timeout: 20000 })
  await expect(page).toHaveTitle('Recipe not found — Fridge+')
})

// Une panne n'est pas une absence : on ne déréférence pas une vraie fiche
// parce que la base a flanché pendant le passage du robot.
test('fiche en panne : PAS de noindex', async ({ page }) => {
  test.setTimeout(60000)
  await preparer(page)
  await servirLaFiche(page, 'zzz-plat-fantome', 'en panne')

  await page.goto('/FridgePlus/recipe/zzz-plat-fantome')
  await expect(page.getByText('Recette momentanément indisponible')).toBeVisible({ timeout: 20000 })
  expect(await robots(page)).toEqual(['index, follow'])
})
