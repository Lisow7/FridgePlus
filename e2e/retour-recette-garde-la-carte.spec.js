import { test, expect } from '@playwright/test'
import { skipOnboardingOverlays } from './support/supabase-mock.js'

// Au retour d'une page recette, la liste doit revenir sur la même carte
// (signalé le 2026-10-02 : 1 512 px avant, 20 033 px au retour, aussi en prod).
// Une position en pixels ne tient pas : la liste se reconstruit, se retrie et
// les cartes changent de hauteur quand les notes arrivent.

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

const premiereCarteVisible = liste => liste.evaluate(el => {
  const top = el.getBoundingClientRect().top
  const carte = [...el.children].find(c => c.getBoundingClientRect().bottom > top + 10)
  return (carte?.innerText || '').split(String.fromCharCode(10))[0]
})

test('revenir d\'une recette retrouve la même carte en haut de la liste', async ({ page }) => {
  await skipOnboardingOverlays(page)
  await page.goto('/?recettes=1')
  await page.waitForLoadState('networkidle')

  const liste = page.locator('div.absolute.inset-0.overflow-y-auto').first()
  await liste.locator('button[aria-pressed]').nth(20).waitFor({ timeout: 15000 })
  await liste.evaluate(el => { el.scrollTop = 1500 })
  await page.waitForTimeout(500)
  const avant = await premiereCarteVisible(liste)

  // Ouvre une carte un peu plus bas dans l'écran, par son titre
  const cible = await liste.evaluate(el => {
    const top = el.getBoundingClientRect().top
    const c = [...el.children].find(c => c.getBoundingClientRect().top > top + 100)
    const r = c.getBoundingClientRect()
    return { x: r.left + 120, y: r.top + 25, titre: c.innerText.split(String.fromCharCode(10))[0].trim() }
  })
  await page.mouse.click(cible.x, cible.y)
  // La fiche est vraiment affichée : son titre est là ET le panneau est parti
  // (l'URL /recipe/ et le h1 de l'accueil existent avant que la route ne bascule).
  await expect(page.getByRole('heading', { name: cible.titre }).first()).toBeVisible({ timeout: 10000 })
  await expect(page.locator('input[placeholder*="recette" i]')).toHaveCount(0)
  await page.goBack()
  await liste.waitFor()

  await expect.poll(() => premiereCarteVisible(liste), { timeout: 5000 }).toBe(avant)
  // La liste ne doit pas avoir chargé toutes les recettes d'un coup
  expect(await liste.locator('button[aria-pressed]').count()).toBeLessThanOrEqual(150)
})
