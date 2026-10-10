import { test, expect } from '@playwright/test'
import { skipOnboardingOverlays } from './support/supabase-mock.js'

// WCAG 2.2 — 1.4.13 « Contenu au survol ou au focus » : une bulle d'aide doit
// pouvoir être survolée sans disparaître (audit du 2026-10-04, A11Y-22).
// La bulle est un portail posé à 8 px de son ancre : le pointeur traverse cet
// espace, et c'est là qu'elle se fermait. Le test unitaire prouve la logique
// (`infobulle-survolable.test.jsx`) ; ici, la vraie géométrie, pas à pas.
// Bureau seulement : sur tactile, il n'y a pas de bulle du tout (choix du
// 2026-07-11, cf. `shared/ui/tooltip.jsx`).

test('la bulle d’aide reste quand le pointeur passe du bouton à la bulle', async ({ page }) => {
  await skipOnboardingOverlays(page)
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const bouton = page.getByRole('button', { name: 'Aide & infos' }).filter({ visible: true }).first()
  await bouton.hover()
  const bulle = page.getByRole('tooltip')
  await expect(bulle).toBeVisible()

  // Du centre du bouton au centre de la bulle, en dix pas : le pointeur
  // traverse l'espace entre les deux.
  const b = await bulle.boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 })
  await page.waitForTimeout(400)
  await expect(bulle).toBeVisible()

  // Loin de tout : la bulle se ferme.
  await page.mouse.move(8, Math.round(page.viewportSize().height / 2), { steps: 5 })
  await expect(bulle).toBeHidden()
})
