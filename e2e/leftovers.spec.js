import { test, expect } from '@playwright/test'
import { skipOnboardingOverlays } from './support/supabase-mock.js'
import { CURRENT_VERSION } from '../src/shared/lib/version.js'

// Scénario 1 — Restes (mode invité, localStorage).
//
// v0.120 — les deux tests étaient `test.fixme` depuis v3.6.3, au motif
// « flaky en CI (selectors fragiles) ». Diagnostic à la reprise : ils
// n'étaient pas flaky, ils étaient PÉRIMÉS et ne pouvaient plus passer.
//
//   • « compartiment Restes » ciblait `.door-tap-btn`, une classe qui
//     n'existe plus que dans index.css — plus aucun élément ne la porte.
//     Et son assertion finale vérifiait que le texte « Fridge » était
//     visible : le test ne testait pas ce que son nom annonçait.
//   • « footer version » cherchait un <button> correspondant à
//     /^v\d+\.\d+\.\d+/. Or la version est rendue dans un <a>, et
//     CURRENT_VERSION vaut « 0.120 » — DEUX segments. Le motif à trois
//     segments ne pouvait jamais correspondre.
//
// Réécrits pour tester réellement leur objet, avec des ancrages par rôle
// ARIA plutôt que par classe CSS.

test.beforeEach(async ({ page }) => {
  // L'écran d'accueil et le bandeau cookies recouvrent la page et
  // intercepteraient les clics.
  await skipOnboardingOverlays(page)
})

test('le compartiment Restes s\'ouvre depuis le frigo', async ({ page }) => {
  await page.goto('/FridgePlus/')

  // Tant que le frigo est fermé, <div role="button" aria-label="Ouvrir le
  // frigo" class="absolute inset-0"> recouvre les compartiments et intercepte
  // tout clic.
  //
  // Vérifié par mutation le 2026-08-06 : retirer cette ligne fait échouer le
  // test en timeout, avec « subtree intercepts pointer events ». C'est donc
  // bien la cause de la mise en quarantaine d'origine — un timeout dont le
  // message ne désignait pas la cause, pris pour de la flakiness.
  await page.getByRole('button', { name: /Ouvrir le frigo/i }).click()

  // Double rendu mobile/desktop : plusieurs boutons portent le même nom
  // accessible, dont un masqué en CSS.
  await page.locator('button:visible', { hasText: /^Restes/ }).first().click()

  // Le compartiment est réellement ouvert : son bouton de fermeture apparaît.
  await expect(page.getByRole('button', { name: /Fermer le compartiment/i }).first())
    .toBeVisible({ timeout: 10000 })
})

test('le footer affiche la version courante', async ({ page }) => {
  await page.goto('/FridgePlus/')

  // On compare à la SOURCE DE VÉRITÉ (`version.js`) plutôt qu'à un motif
  // générique : le test détecte ainsi un footer désynchronisé de la version
  // réelle, pas seulement l'absence d'un numéro.
  await expect(page.getByRole('link', { name: new RegExp(`v${CURRENT_VERSION}`) }).first())
    .toBeVisible({ timeout: 10000 })
})
