import { test, expect } from '@playwright/test'
import { skipOnboardingOverlays } from './support/supabase-mock.js'

// P2 — audit d'intuitivité du 2026-10-02 : la porte fermée était un panneau
// blanc muet. Première réponse : « Touche pour ouvrir », sur UNE porte et
// seulement frigo vide. Retour d'Antoine du 2026-10-04 : pas assez intuitif,
// et le frigo comme le garde-manger s'ouvrent partout. Variante retenue (C,
// essayée en vrai parmi quatre) : toutes les poignées des portes fermées et
// des placards luisent doucement, frigo vide ou rempli, sans texte.
// Depuis l'audit du 2026-10-04 (PERF-09), la lueur est un pseudo-élément
// (::after) dont seule l'opacité s'anime : on la lit là.

const lueur = (locator) => locator.evaluate((el) => {
  const pseudo = getComputedStyle(el, '::after')
  return { anim: pseudo.animationName, ombre: pseudo.boxShadow, propre: getComputedStyle(el).animationName }
})

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

// L'accueil monte le frigo mobile ET le frigo bureau (l'un caché).
const poigneesVisibles = (page) => page.locator('.fp-poignee').filter({ visible: true })

for (const [cas, stock] of [['frigo vide', []], ['frigo rempli', ['fr-beurre-doux']]]) {
  test(`${cas} : la poignée de la porte luit, et la porte s'ouvre`, async ({ page }) => {
    await skipOnboardingOverlays(page)
    await page.addInitScript((s) => localStorage.setItem('fridge-stock', JSON.stringify(s)), stock)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Touche pour ouvrir')).toHaveCount(0)
    const poignee = poigneesVisibles(page).first()
    await expect(poignee).toBeVisible()
    const halo = await lueur(poignee)
    expect(halo.anim).toBe('fp-luit')
    // L'élément lui-même n'anime plus rien (ni son ombre).
    expect(halo.propre).toBe('none')
    const porte = page.getByRole('button', { name: 'Ouvrir le frigo' }).filter({ visible: true })
    await porte.click()
    // Porte ouverte : elle glisse (clip-path, invisible pour Playwright) et sort
    // de l'ordre de tabulation
    await expect(porte).toHaveAttribute('tabindex', '-1')
  })
}

test('garde-manger : chaque placard fermé a sa poignée qui luit', async ({ page }) => {
  await skipOnboardingOverlays(page)
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Garde-manger' }).filter({ visible: true }).first().click()
  const poignees = poigneesVisibles(page)
  await expect(poignees.first()).toBeVisible()
  const n = await poignees.count()
  expect(n).toBeGreaterThanOrEqual(2)
  for (let i = 0; i < n; i++) {
    expect((await lueur(poignees.nth(i))).anim).toBe('fp-luit')
  }
})

test('mouvement réduit : le halo reste, mais ne pulse pas', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await skipOnboardingOverlays(page)
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const poignee = poigneesVisibles(page).first()
  await expect(poignee).toBeVisible()
  const halo = await lueur(poignee)
  expect(halo.anim).toBe('none')
  expect(halo.ombre).toContain('rgba(224, 120, 32, 0.45)')
})

test("le bouton orange de l'en-tête luit comme les poignées, menu fermé seulement", async ({ page }) => {
  await skipOnboardingOverlays(page)
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const bouton = page.locator('button[aria-haspopup="menu"].fp-luit-bouton').filter({ visible: true })
  await expect(bouton).toHaveCount(1)
  expect((await lueur(bouton)).anim).toBe('fp-luit-bouton')
  await bouton.click()
  const ouvert = page.locator('button[aria-haspopup="menu"][aria-expanded="true"]').filter({ visible: true })
  await expect(ouvert).toHaveCount(1)
  expect((await lueur(ouvert)).anim).toBe('none')
})
