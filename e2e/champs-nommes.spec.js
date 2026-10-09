import { test, expect } from '@playwright/test'
import { installSupabaseMocks, skipOnboardingOverlays, signedInAs } from './support/supabase-mock.js'

// Audit du 2026-10-04, A11Y-07 : des champs nommés par leur seul placeholder,
// ou par un libellé posé à côté sans lien. Le cliquet `champs-sans-nom` les
// compte dans le code ; ici, la preuve dans le navigateur, sur le formulaire
// du support d'un compte connecté : « Objet » et « Message » nomment leurs
// champs (un clic sur le libellé y mène aussi).

test('formulaire du support : chaque champ a un nom, et le libellé mène au champ', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('fridge-lang', 'fr'))
  await skipOnboardingOverlays(page)
  // À INSTALLER EN PREMIER : les mocks de scénario posés ensuite le masquent.
  await installSupabaseMocks(page)
  await signedInAs(page, { profile: { language: 'fr' } })
  await page.route('**/rest/v1/support_tickets**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

  await page.goto('/FridgePlus/')
  await page.getByRole('button', { name: 'Aide & infos' }).filter({ visible: true }).first().click()
  await page.getByRole('button', { name: /Contacter le support/ }).click()
  await page.getByRole('button', { name: /Nouvelle demande/ }).click()
  await page.getByRole('button', { name: /Question générale/ }).click()
  // L'aide en libre-service passe d'abord : « J'ai toujours besoin d'aide » mène au formulaire.
  await page.getByRole('button', { name: /toujours besoin d.aide/ }).click()

  const objet = page.getByRole('textbox', { name: 'Objet' })
  const message = page.getByRole('textbox', { name: 'Message' })
  await expect(objet).toBeVisible()
  await expect(message).toBeVisible()
  await page.getByText('Message', { exact: true }).click()
  await expect(message).toBeFocused()
})
