import { test, expect } from '@playwright/test'
import { skipOnboardingOverlays } from './support/supabase-mock.js'

// Au retour d'une page recette, la liste doit revenir sur la même carte
// (signalé le 2026-10-02 : 1 512 px avant, 20 033 px au retour, aussi en prod).
// Une position en pixels ne tient pas : la liste se reconstruit, se retrie et
// les cartes changent de hauteur quand les notes arrivent.
//
// 2026-10-07 : sans base (la CI, un réseau coupé), aucune note n'arrive pour
// relancer la restauration. Or elle se jouait pendant que le panneau glisse
// depuis le bas : la liste hors écran, ses cartes (`content-visibility: auto`)
// n'ont pas leur vraie hauteur, et la carte retrouvée était la mauvaise
// (« Salade Niçoise » au lieu de « Quiche Lorraine », 5 fois sur 5).

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
  // Le repère du panneau : la recherche des recettes, par son libellé visible.
  // On le voit présent ici, pour que son absence plus bas prouve quelque chose
  // (le 07/10, repéré par un texte grisé qui avait changé, il ne trouvait plus
  // rien et la garde passait d'office — le retour arrière partait trop tôt).
  const recherche = page.getByLabel('Chercher une recette')
  await expect(recherche).toBeVisible()
  await liste.locator('button[aria-pressed]').nth(20).waitFor({ timeout: 15000 })
  // Au milieu de la liste, une carte coupée à mi-hauteur en haut : aucune
  // frontière de carte près du seuil de lecture (10 px), et loin du bas de la
  // liste déjà rendue, où le navigateur rabote le défilement.
  await liste.evaluate(el => {
    el.scrollTop = 800
    const top = el.getBoundingClientRect().top
    const carte = [...el.children].find(c => c.getBoundingClientRect().bottom > top + 10)
    const r = carte.getBoundingClientRect()
    el.scrollTop += (r.top - top) + r.height / 2
  })
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
  await expect(recherche).toHaveCount(0)
  await page.goBack()
  await liste.waitFor()

  await expect.poll(() => premiereCarteVisible(liste), { timeout: 5000 }).toBe(avant)
  // La liste ne doit pas avoir chargé toutes les recettes d'un coup
  expect(await liste.locator('button[aria-pressed]').count()).toBeLessThanOrEqual(150)
})
