import { test, expect } from '@playwright/test'
import { skipOnboardingOverlays, installSupabaseMocks } from './support/supabase-mock.js'

// Audit du 2026-10-04, SEO-02 : aucun lien ne menait aux fiches, une carte de
// recette était un `<div role="button">`. Le nom est maintenant un vrai lien,
// étiré sur toute la carte par un `::after`. Les tests unitaires prouvent le
// lien ; ceux-ci prouvent ce que jsdom ne voit pas : la couche étirée prend le
// clic sans voler celui du favori, et son contour de focus n'est pas rogné.

async function ouvrirLesRecettes(page) {
  await skipOnboardingOverlays(page)
  await installSupabaseMocks(page)
  await page.goto('/?recettes=1')
  await page.waitForLoadState('networkidle')
  const carte = page.locator('[data-recipe-id]').first()
  await carte.waitFor()
  const id = await carte.getAttribute('data-recipe-id')
  return { carte, id, lien: carte.locator('a[href]') }
}

test('le nom d’une carte est un lien vers sa fiche, et un clic sur la carte l’ouvre sans recharger la page', async ({ page }) => {
  const { carte, id, lien } = await ouvrirLesRecettes(page)
  await expect(lien).toHaveCount(1)
  await expect(lien).toHaveAttribute('href', `/FridgePlus/recipe/${encodeURIComponent(id)}`)

  await page.evaluate(() => { window.__memePage = true })
  await carte.click()
  await page.waitForURL(new RegExp(`/recipe/${id}$`))
  expect(await page.evaluate(() => window.__memePage), 'la fiche s’ouvre dans l’app').toBe(true)
})

test('le favori reste cliquable au-dessus du lien étiré', async ({ page }) => {
  const { carte } = await ouvrirLesRecettes(page)
  // Sans `force`, Playwright refuse un clic qu'un autre élément intercepterait.
  await carte.getByRole('button', { name: 'Ajouter aux favoris' }).click()
  await expect(carte.getByRole('button', { name: 'Retirer des favoris' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page).not.toHaveURL(/\/recipe\//)
})

test('au clavier, le contour de focus se voit en entier, et Entrée ouvre la fiche', async ({ page }) => {
  const { carte, id, lien } = await ouvrirLesRecettes(page)
  await page.keyboard.press('Shift')
  await lien.focus()
  expect(await lien.evaluate(el => el.matches(':focus-visible'))).toBe(true)

  // La carte porte `content-visibility: auto`, donc un confinement de peinture :
  // ce qui déborde de sa boîte est rogné. Un contour tracé DEHORS (décalage
  // positif) serait invisible ; il doit tenir entre le bord et l'intérieur.
  expect(await carte.evaluate(el => getComputedStyle(el).contentVisibility)).toBe('auto')
  const anneau = await lien.evaluate(el => {
    const s = getComputedStyle(el, '::after')
    return { style: s.outlineStyle, largeur: parseFloat(s.outlineWidth), decalage: parseFloat(s.outlineOffset) }
  })
  expect(anneau.style).not.toBe('none')
  expect(anneau.largeur).toBeGreaterThanOrEqual(2)
  expect(anneau.decalage + anneau.largeur, 'contour entièrement dans la carte').toBeLessThanOrEqual(0)

  await page.keyboard.press('Enter')
  await page.waitForURL(new RegExp(`/recipe/${id}$`))
})
