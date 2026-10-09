import { test, expect } from '@playwright/test'

// Scénario — Photo de ticket de caisse (mode invité, localStorage)
//
// Cette suite E2E tourne en mode invité (pas de compte réel disponible dans
// cet environnement de test). Le scan de ticket nécessite un compte (l'Edge
// Function scan-receipt exige un JWT) : un invité qui clique sur "Photo du
// ticket" voit donc un écran "connecte-toi" immédiat, PAS l'écran de
// consentement/capture (décision produit : informer tôt plutôt que laisser
// l'invité traverser tout le parcours pour se faire bloquer à la fin).
// Le parcours complet (consentement -> capture -> quota) nécessiterait un
// compte connecté et n'est donc pas couvert ici.

// Évite l'écran d'accueil "Bienvenue en cuisine !" ET la bannière cookies
// (1er lancement), qui intercepteraient sinon les clics sur le FAB.
async function skipOnboardingOverlays(page) {
  await page.addInitScript(() => {
    localStorage.setItem('fridge-welcome-seen-v1', '1')
    localStorage.setItem('fridge-consent-v1', JSON.stringify({
      version: 2, timestamp: Date.now(), bannerDismissed: true,
      essential: true, errors: false, usage: false, voice: false, receiptScan: false,
    }))
  })
}

// Le bouton "Photo du ticket" est gaté par le flag `receipt_scan` (désactivé
// par défaut le 2026-07-08 : le chemin de succès avec un vrai ticket n'a
// jamais été validé). On force le flag à `true` uniquement dans la réponse
// vue par cette suite E2E, pour continuer à couvrir le comportement du FAB
// sans dépendre de l'état réel (partagé prod) du flag. Réponse entièrement
// simulée (pas de route.fetch()) : en CI, le build tourne avec une URL
// Supabase placeholder qui ne résout vers aucun vrai réseau.
async function forceReceiptScanFlagOn(page) {
  await page.route('**/rest/v1/feature_flags*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { key: 'receipt_scan', enabled: true, label: 'Scan de ticket de caisse', description: '' },
      ]),
    })
  })
}

test.describe('Photo de ticket de caisse (invité)', () => {
  test('FAB -> Photo du ticket affiche immédiatement "connecte-toi" (pas de consentement pour un invité)', async ({ page }) => {
    await skipOnboardingOverlays(page)
    await forceReceiptScanFlagOn(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Actions rapides' }).click()
    // FAB 2026-08-27 : plus de sous-menu — « Photo du ticket » est directement
    // visible sous le titre de section « Remplir » (2026-09-11 ; « Ajouter des ingrédients » avant).
    await page.getByText('Photo du ticket').click()

    await expect(page.getByText('Connecte-toi pour photographier ton ticket de caisse.')).toBeVisible()
    await expect(page.getByText('On identifie tes ingrédients')).not.toBeVisible()
  })

  test('le bouton Fermer de l\'écran "connecte-toi" referme l\'overlay sans naviguer', async ({ page }) => {
    await skipOnboardingOverlays(page)
    await forceReceiptScanFlagOn(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Actions rapides' }).click()
    // FAB 2026-08-27 : plus de sous-menu — « Photo du ticket » est directement
    // visible sous le titre de section « Remplir » (2026-09-11 ; « Ajouter des ingrédients » avant).
    await page.getByText('Photo du ticket').click()

    await expect(page.getByText('Connecte-toi pour photographier ton ticket de caisse.')).toBeVisible()
    await page.getByRole('button', { name: 'Fermer' }).click()
    await expect(page.getByText('Connecte-toi pour photographier ton ticket de caisse.')).not.toBeVisible()
  })
})
