import { test, expect } from '@playwright/test'
import { skipOnboardingOverlays } from './support/supabase-mock.js'

// Audit d'intuitivité du 2026-10-02 : la carte d'accueil (« Presque ! »,
// « On cuisine ? »…) restait PAR-DESSUS le panneau Recettes plein écran et en
// cachait le bas (≈ un quart de la liste, et le bouton « remonter »). Elle
// accompagne l'accueil : elle s'efface quand un panneau le recouvre, et revient
// à sa fermeture.

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

test('la carte d’accueil s’efface sous le panneau Recettes et revient après', async ({ page }) => {
  await skipOnboardingOverlays(page)
  await page.addInitScript(() => {
    localStorage.setItem('fridge-stock', JSON.stringify(['fr-beurre-doux', 'fr-oeufs-plein-air']))
  })
  // La carte dépend du drapeau `onboarding_activation` (Supabase) : on le fixe
  // ici pour ne pas dépendre de la base de l'environnement (rouge en CI sinon).
  await page.route('**/rest/v1/feature_flags*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ key: 'onboarding_activation', enabled: true, label: 'Carte coach', description: '' }]),
  }))
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const carte = page.getByRole('button', { name: 'Masquer' })
  await expect(carte).toBeVisible()

  await page.goto('/?recettes=1')
  await page.waitForLoadState('networkidle')
  await expect(page.getByLabel('Chercher une recette')).toBeVisible()
  await expect(carte).toBeHidden()

  await page.getByRole('button', { name: 'Fermer' }).first().click()
  await expect(page.getByLabel('Chercher une recette')).toBeHidden()
  await expect(carte).toBeVisible()
})
