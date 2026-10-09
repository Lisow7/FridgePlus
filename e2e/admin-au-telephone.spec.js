import { test, expect } from '@playwright/test'
import { ouvrirLePanneauAdmin, ciblesTropPetites, LIGNES_ADMIN } from './support/admin-mock.js'

// Le panneau admin sur un téléphone (audit du 2026-10-04, ADM-20 et ADM-19 a).
//
// L'audit donnait ces défauts « à confirmer » : de l'arithmétique sur les
// styles. Mesurés le 2026-10-08 (lot 12g), à 360 et 390 px, ils étaient tous là :
//   - l'onglet mémorisé (Journal) s'ouvrait hors de la barre (782 px pour 353) ;
//   - les six libellés des compteurs débordaient leur carte (82 px pour 29) ;
//   - le pseudo d'une ligne utilisateur tenait dans 17 px, le titre d'une
//     recette à modérer dans ZÉRO : on modérait sans voir quoi ;
//   - les actions de modération n'étaient que des icônes (libellé au survol) ;
//   - cocher une recette faisait sauter la liste de 143 px ;
//   - des cibles à 18, 22 et 23 px.

const TELEPHONE = { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true }

test.describe('téléphone (360 × 640)', () => {
  test.use(TELEPHONE)

  test('l’émulation est bien celle d’un écran tactile (sinon tout le reste est vert pour rien)', async ({ page }) => {
    await page.goto('/FridgePlus/')
    expect(await page.evaluate(() => matchMedia('(hover: none)').matches)).toBe(true)
  })

  test('la section mémorisée est amenée en vue dans la barre des sections', async ({ page }) => {
    const panneau = await ouvrirLePanneauAdmin(page, { section: 'journal' })
    const sections = panneau.getByRole('navigation', { name: 'Sections du panneau admin' })
    const journal = sections.getByRole('button', { name: /^Journal/ })
    await expect(journal).toHaveAttribute('aria-current', 'page')
    await expect.poll(async () => {
      const [b, n] = await Promise.all([journal.boundingBox(), sections.boundingBox()])
      return b.x >= n.x - 1 && b.x + b.width <= n.x + n.width + 1
    }, { message: 'l’onglet « Journal » doit être entièrement visible dans la barre' }).toBe(true)
  })

  test('les libellés des compteurs tiennent dans leur carte', async ({ page }) => {
    const panneau = await ouvrirLePanneauAdmin(page, { section: 'dashboard' })
    await expect(panneau.getByRole('button', { name: /Utilisateurs/ }).first()).toBeVisible()
    // Deux façons de déborder : le texte sort de son libellé, ou le libellé
    // (qui ne rétrécit pas sous son mot le plus long) sort de sa carte.
    const debordements = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] [data-libelle-compteur]')]
      .filter((l) => {
        const carte = l.closest('[data-carte-compteur]').getBoundingClientRect()
        const r = l.getBoundingClientRect()
        return l.scrollWidth > l.clientWidth + 1 || r.right > carte.right - 8 || r.left < carte.left
      })
      .map((l) => `${l.textContent} (${Math.round(l.getBoundingClientRect().width)} px)`))
    expect(await page.locator('[role="dialog"] [data-libelle-compteur]').count()).toBe(6)
    expect(debordements).toEqual([])
  })

  test('une ligne utilisateur garde le pseudo lisible, les actions passent dessous', async ({ page }) => {
    const panneau = await ouvrirLePanneauAdmin(page, { section: 'users' })
    const pseudo = panneau.getByText('marie_cuisine', { exact: true })
    await expect(pseudo).toBeVisible()
    const rogne = await pseudo.evaluate((e) => {
      const bloc = e.parentElement.parentElement.getBoundingClientRect()
      return bloc.width < e.getBoundingClientRect().width
    })
    expect(rogne, 'le bloc du pseudo est plus étroit que le pseudo').toBe(false)
    await expect(panneau.getByRole('button', { name: 'Détails de marie_cuisine' })).toBeVisible()
  })

  test('une recette à modérer montre son titre, et des actions qui disent ce qu’elles font', async ({ page }) => {
    const panneau = await ouvrirLePanneauAdmin(page, { section: 'recipes' })
    const titre = panneau.getByText('Tarte aux poireaux', { exact: true })
    await expect(titre).toBeVisible()
    expect(await titre.evaluate((e) => e.getBoundingClientRect().width), 'largeur du titre').toBeGreaterThan(100)
    for (const action of ['Modifier', 'Approuver', 'Rejeter', 'Supprimer']) {
      const libelle = panneau.getByRole('button', { name: new RegExp(`^${action}`) }).last().getByText(action, { exact: true })
      await expect(libelle, `le libellé « ${action} » est visible au toucher`).toBeVisible()
    }
  })

  test('cocher une recette ne fait pas sauter la liste', async ({ page }) => {
    const panneau = await ouvrirLePanneauAdmin(page, { section: 'recipes' })
    const titre = panneau.getByText('Tarte aux poireaux', { exact: true })
    await expect(titre).toBeVisible()
    // La case d'abord amenée en vue : sinon Playwright fait défiler pour cocher,
    // et c'est CE défilement qu'on mesurait (12 px en CI, polices Linux).
    const caseRecette = panneau.getByRole('checkbox', { name: 'Sélectionner cette recette' })
    await caseRecette.scrollIntoViewIfNeeded()
    const avant = (await titre.boundingBox()).y
    await caseRecette.check()
    await expect(panneau.getByRole('toolbar', { name: 'Actions groupées' })).toBeVisible()
    expect(Math.abs((await titre.boundingBox()).y - avant), 'déplacement de la ligne (px)').toBeLessThanOrEqual(1)
  })

  test('dans une longue file, la barre groupée reste à l’écran dès la première case cochée', async ({ page }) => {
    const recette = LIGNES_ADMIN.custom_recipes[0]
    const douze = Array.from({ length: 12 }, (_, i) => ({ ...recette, id: `r-${i}`, title: `Recette n° ${i + 1}` }))
    const panneau = await ouvrirLePanneauAdmin(page, { section: 'recipes', lignes: { custom_recipes: douze } })
    await panneau.getByRole('checkbox', { name: 'Sélectionner cette recette' }).first().check()
    // Après la liste, et non collée, elle serait sous la douzième recette.
    await expect(panneau.getByRole('toolbar', { name: 'Actions groupées' })).toBeInViewport()
  })

  for (const [section, nom] of [['journal', 'Journal'], ['dashboard', 'Tableau de bord'], ['users', 'Utilisateurs'], ['recipes', 'Recettes +'], ['support', 'Support']]) {
    test(`${nom} : les cibles font au moins 24 × 24 px`, async ({ page }) => {
      await ouvrirLePanneauAdmin(page, { section })
      await page.waitForLoadState('networkidle')
      expect(await ciblesTropPetites(page)).toEqual([])
    })
  }
})

test.describe('bureau, au clavier', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('une action de modération dit son nom quand le clavier la sélectionne', async ({ page }) => {
    const panneau = await ouvrirLePanneauAdmin(page, { section: 'recipes' })
    const approuver = panneau.getByRole('button', { name: /^Approuver/ })
    const libelle = approuver.getByText('Approuver', { exact: true })
    await expect(approuver).toBeVisible()
    // Sans survol ni clavier, l'icône seule (le choix du bureau, inchangé).
    await expect(libelle).toBeHidden()
    await approuver.focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(libelle).toBeVisible()
  })
})
