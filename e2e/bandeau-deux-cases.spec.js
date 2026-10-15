import { test, expect } from '@playwright/test'
import { installSupabaseMocks } from './support/supabase-mock.js'

// Décision du 2026-10-06, choix d'Antoine (« bandeau = deux_cases ») : la
// case « Mesure d'audience » se dédouble en « Rapports d'erreurs » (Sentry) et
// « Statistiques d'usage » ; « Fonctionnels » disparaît ; la question est
// reposée à tous. Prouvé dans le navigateur, sur un vrai chargement de page.

test('un choix de l’ancien bandeau : la question revient, en deux cases séparées', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fridge-welcome-seen-v1', '1')
    localStorage.setItem('fridge-lang', 'fr')
    localStorage.setItem('fridge-consent-v1', JSON.stringify({
      version: 1, timestamp: Date.now(), decisionAt: Date.now(), bannerDismissed: true,
      essential: true, functional: true, audience: true, voice: false, receiptScan: false,
    }))
    localStorage.setItem('fridge-anon-id', 'identifiant-anonyme-d-essai')
  })
  await installSupabaseMocks(page)
  await page.goto('/FridgePlus/faq')

  const bandeau = page.getByRole('dialog', { name: /Cookies et données/ })
  await expect(bandeau).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('fridge-anon-id')), 'l’ancien accord ne vaut plus pour le suivi').toBeNull()

  await bandeau.getByRole('button', { name: 'Personnaliser' }).click()
  const erreurs = page.getByRole('switch', { name: /Rapports d['’]erreurs/ })
  const usage = page.getByRole('switch', { name: /Statistiques d['’]usage/ })
  await expect(erreurs).toHaveAttribute('aria-checked', 'false')
  await expect(usage).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByText(/Fonctionnels|Mesure d['’]audience/)).toHaveCount(0)

  await erreurs.click()
  await page.getByRole('button', { name: 'Enregistrer mes choix' }).click()
  const enregistre = await page.evaluate(() => JSON.parse(localStorage.getItem('fridge-consent-v1')))
  expect(enregistre).toMatchObject({ version: 2, bannerDismissed: true, errors: true, usage: false })
  expect(enregistre).not.toHaveProperty('audience')
  expect(enregistre).not.toHaveProperty('functional')
  await expect(page.getByRole('dialog', { name: /Cookies et données/ })).toHaveCount(0)
})

// La fenêtre se charge au clic (poids de démarrage, 2026-10-06) : les deux
// portes d'entrée l'ouvrent toujours — « Personnaliser » ci-dessus, et le
// bouton « Cookies » du pied de page.
test('le bouton « Cookies » du pied de page ouvre la fenêtre, avec ses deux cases', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fridge-welcome-seen-v1', '1')
    localStorage.setItem('fridge-lang', 'fr')
    localStorage.setItem('fridge-consent-v1', JSON.stringify({
      version: 2, timestamp: Date.now(), decisionAt: Date.now(), bannerDismissed: true,
      essential: true, errors: false, usage: false, voice: false, receiptScan: false,
    }))
  })
  await installSupabaseMocks(page)
  await page.goto('/FridgePlus/faq')
  await page.getByRole('contentinfo').getByRole('button', { name: 'Cookies' }).first().click()
  await expect(page.getByRole('switch', { name: /Rapports d['’]erreurs/ })).toBeVisible()
  await expect(page.getByRole('switch', { name: /Statistiques d['’]usage/ })).toBeVisible()
})
