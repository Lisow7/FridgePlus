import { test, expect } from '@playwright/test'
import { skipOnboardingOverlays } from './support/supabase-mock.js'

// Audit d'intuitivité du 2026-10-02 : Échap dans le tiroir des filtres fermait
// AUSSI le panneau Recettes. Les deux écoutaient `window` en dehors de la pile
// des pièges de focus (`activeTraps`), faite pour que seul le dessus réagisse.

test('Échap ferme le tiroir des filtres, puis seulement ensuite le panneau', async ({ page }) => {
  await skipOnboardingOverlays(page)
  await page.goto('/?recettes=1')
  await page.waitForLoadState('networkidle')

  const recherche = page.getByLabel('Chercher une recette')
  await expect(recherche).toBeVisible()
  // L'entrée d'historique du panneau (`useCloseOnBackButton`), pour savoir
  // quand le tiroir aura fini de dépiler la sienne.
  const entreeDuPanneau = await page.evaluate(() => window.history.state?.fpModalBack ?? null)
  expect(entreeDuPanneau).not.toBeNull()
  await page.getByRole('button', { name: /Filtres/ }).first().click()
  const tiroir = page.getByRole('dialog', { name: /Filtres/ })
  await expect(tiroir).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(tiroir).toBeHidden()
  await expect(recherche).toBeVisible()
  await expect(page).toHaveURL(/recettes=1/)

  // Le tiroir fermé dépile son entrée d'historique par un `history.back()`
  // DIFFÉRÉ (`setTimeout`, puis retour asynchrone). Un second Échap tapé dans
  // ces quelques millisecondes — aucun humain n'en est capable, Playwright si —
  // s'est perdu une fois en CI (PR #1299, le 2026-10-08 : panneau resté
  // ouvert ; passé au second essai, jamais vu sur les 40 fumées précédentes).
  // On attend donc que l'application soit posée, comme le serait une
  // personne : de retour sur l'entrée du panneau.
  await page.waitForFunction((entree) => window.history.state?.fpModalBack === entree, entreeDuPanneau)

  await page.keyboard.press('Escape')
  await expect(recherche).toBeHidden()
})
