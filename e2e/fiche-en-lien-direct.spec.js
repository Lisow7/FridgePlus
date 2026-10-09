import { test, expect } from '@playwright/test'
import { installSupabaseMocks, skipOnboardingOverlays } from './support/supabase-mock.js'

// Une fiche ouverte par un lien direct n'attend plus le catalogue
// (audit du 2026-10-04, PERF-02).
//
// Le parcours de l'audit : un visiteur arrive de Google sur `/recipe/affogato`,
// une recette absente des 100 embarquées. Avant, la fiche cherchait dans le
// catalogue en mémoire, puis dans `custom_recipes`, et affichait « Recette
// introuvable » le temps que le catalogue arrive (626 Ko, au repos) — ou pour
// toujours s'il n'arrivait pas. Ici le catalogue ne répond JAMAIS (tenu), ou
// répond toujours non (en panne) : seule la ligne de la fiche est servie.

const AFFOGATO = {
  id: 'affogato',
  name: { fr: 'Affogato', en: 'Affogato' },
  description: { fr: 'Une boule de glace noyée sous un espresso brûlant.', en: 'Ice cream drowned in hot espresso.' },
  emoji: '🍨',
  time_min: 5,
  prep_time_min: 5,
  cook_time_min: 0,
  difficulty: 'very-easy',
  type: 'dessert',
  servings: 2,
  country: 'it',
  diet: ['vegetarian'],
  allergens: ['milk'],
  ingredients: [
    { ids: ['frz-glace-fraise'], labels: { fr: '2 boules de glace', en: '2 scoops of ice cream' }, required: true },
    { ids: ['gp-cafe'], labels: { fr: '2 espressos', en: '2 espressos' }, required: true },
  ],
  steps: {
    fr: ['Déposer la glace dans deux verres.', 'Verser l’espresso brûlant sur la glace et servir aussitôt.'],
    en: ['Put the ice cream in two glasses.', 'Pour the hot espresso over and serve at once.'],
  },
  image_url: null,
  status: 'published',
  promoted_from_id: null,
  promoted_at: null,
  original_author_id: null,
  original_author_name: null,
  created_at: '2026-06-01T00:00:00Z',
  functional_tags: [],
}

async function servirLaFicheSeule(page, catalogue) {
  await page.route('**/rest/v1/recipes_unified**', (route) => {
    if (route.request().url().includes('id=eq.affogato')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([AFFOGATO]) })
    }
    if (catalogue === 'en panne') {
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'boom' }) })
    }
    // Tenu : le catalogue ne répond jamais.
    return undefined
  })
  // Rien à ce nom parmi les recettes d'utilisateurs.
  await page.route('**/rest/v1/custom_recipes**', (route) => {
    if (route.request().url().includes('id=eq.affogato')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    }
    return route.abort()
  })
}

for (const [nom, largeur] of [['360', 360], ['1280', 1280]]) {
  for (const catalogue of ['tenu', 'en panne']) {
    test(`lien direct, catalogue ${catalogue} (${nom} px) : la fiche s'ouvre, sans « introuvable »`, async ({ page }) => {
      test.setTimeout(60000)
      await page.setViewportSize({ width: largeur, height: 860 })
      await page.addInitScript(() => {
        window.localStorage.setItem('fridge-lang', 'fr')
        // « Recette introuvable » ne doit JAMAIS s'afficher, même un instant.
        window.__introuvableVu = false
        new MutationObserver(() => {
          if (document.body?.innerText.includes('Recette introuvable')) window.__introuvableVu = true
        }).observe(document, { childList: true, subtree: true, characterData: true })
      })
      await skipOnboardingOverlays(page)
      await installSupabaseMocks(page)
      await servirLaFicheSeule(page, catalogue)

      await page.goto('/FridgePlus/recipe/affogato')

      await expect(page.getByText('Verser l’espresso brûlant sur la glace et servir aussitôt.')).toBeVisible({ timeout: 15000 })
      await expect(page.getByText('Affogato').first()).toBeVisible()
      await expect(page).toHaveTitle(/Affogato/)
      expect(await page.evaluate(() => window.__introuvableVu)).toBe(false)
    })
  }
}

// Une recette embarquée (carbonara) est montrée TOUT DE SUITE, sans attendre :
// la lecture de sa fiche complète peut prendre jusqu'à 7 s sur un réseau qui
// flanche (supabase-js relance trois fois). Ses étapes arrivent ensuite.
test('recette embarquée : montrée tout de suite, ses étapes arrivent avec la fiche complète', async ({ page }) => {
  test.setTimeout(60000)
  await page.setViewportSize({ width: 360, height: 860 })
  await page.addInitScript(() => window.localStorage.setItem('fridge-lang', 'fr'))
  await skipOnboardingOverlays(page)
  await installSupabaseMocks(page)
  let liberer
  const ficheRetenue = new Promise((resolve) => { liberer = resolve })
  await page.route('**/rest/v1/recipes_unified**', async (route) => {
    if (!route.request().url().includes('id=eq.carbonara')) return undefined // catalogue tenu
    await ficheRetenue
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        ...AFFOGATO,
        id: 'carbonara',
        name: { fr: 'Pasta Carbonara', en: 'Pasta Carbonara' },
        steps: { fr: ['Cuire les spaghetti al dente.'], en: ['Cook the spaghetti al dente.'] },
      }]),
    })
  })

  await page.goto('/FridgePlus/recipe/carbonara')

  // La fiche complète n'est pas encore arrivée : la version embarquée est là.
  await expect(page).toHaveTitle(/Pasta Carbonara/, { timeout: 15000 })
  await expect(page.getByText('Cuire les spaghetti al dente.')).toHaveCount(0)

  liberer()
  await expect(page.getByText('Cuire les spaghetti al dente.')).toBeVisible({ timeout: 15000 })
})

// Le catalogue n'a plus les étapes ni les descriptions (audit du 2026-10-04,
// PERF-01) : ici il ARRIVE, mince, et la fiche lit quand même ses étapes.
test('catalogue arrivé sans les étapes : la fiche les lit à part', async ({ page }) => {
  test.setTimeout(60000)
  await page.setViewportSize({ width: 360, height: 860 })
  await page.addInitScript(() => window.localStorage.setItem('fridge-lang', 'fr'))
  await skipOnboardingOverlays(page)
  await installSupabaseMocks(page)
  const { steps: _etapes, description: _description, ...affogatoMince } = AFFOGATO
  // La fiche n'est servie qu'APRÈS le catalogue : c'est le cas où la mémoire,
  // arrivée mince, aurait fait foi et caché les étapes.
  let catalogueServi
  const catalogueArrive = new Promise((resolve) => { catalogueServi = resolve })
  await page.route('**/rest/v1/recipes_unified**', async (route) => {
    if (route.request().url().includes('id=eq.affogato')) {
      await catalogueArrive
      await new Promise((r) => setTimeout(r, 500))
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([AFFOGATO]) })
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([affogatoMince]) })
    catalogueServi()
  })
  await page.route('**/rest/v1/custom_recipes**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  // Les trois autres lectures du démarrage répondent (vides) : coupées, supabase-js
  // les relancerait 7 s, et le catalogue — appliqué avec elles — n'arriverait
  // qu'après la fiche, sans rien prouver.
  for (const table of ['ingredients', 'taxonomies', 'fridge_layouts']) {
    await page.route(`**/rest/v1/${table}**`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  }

  await page.goto('/FridgePlus/recipe/affogato')

  await expect(page.getByText('Verser l’espresso brûlant sur la glace et servir aussitôt.')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Une boule de glace noyée sous un espresso brûlant.')).toBeVisible()
})
