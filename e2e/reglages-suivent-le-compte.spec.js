import { test, expect } from '@playwright/test'
import {
  installSupabaseMocks, assertNoUnmockedCalls, signedInAs, profileWrites, metadataWrites,
} from './support/supabase-mock.js'

// Audit du 2026-10-04 (P-08), vu en direct : en se connectant dans un
// navigateur neuf, un compte créé en juin retrouvait le français du navigateur,
// l'écran « Bienvenue en cuisine ! » et la carte du débutant. Tout ce qui était
// réglé ne vivait que dans le navigateur.
//
// La base est simulée (un seul projet Supabase, celui de production).

const TROIS_MOIS = 90 * 24 * 60 * 60 * 1000
const ilYA = (ms) => new Date(Date.now() - ms).toISOString()

// Un navigateur NEUF : le choix de cookies est fait (sinon son bandeau passe
// avant tout), mais rien d'autre n'est mémorisé — ni « bienvenue déjà vue »,
// ni langue.
async function navigateurNeuf(page, { langue = null } = {}) {
  await page.addInitScript((lang) => {
    if (lang) localStorage.setItem('fridge-lang', lang)
    localStorage.setItem('fridge-consent-v1', JSON.stringify({
      version: 2, timestamp: Date.now(), bannerDismissed: true,
      essential: true, errors: false, usage: false, voice: false, receiptScan: false,
    }))
  }, langue)
  // À INSTALLER EN PREMIER : les mocks de scénario posés ensuite le masquent.
  await installSupabaseMocks(page)
}

const activerLaCarteDuDebutant = (page) => page.route('**/rest/v1/feature_flags*', (route) => route.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify([{ key: 'onboarding_activation', enabled: true, label: 'Carte coach', description: '' }]),
}))

// HEAD rest/v1/cooking_logs — « a-t-il déjà cuisiné ? » : la réponse est un
// décompte dans l'en-tête Content-Range.
// ⚠️ L'appel est inter-origines : sans `access-control-expose-headers`, le
// navigateur cache cet en-tête au script, le décompte vaut `null` et l'app
// conclut « jamais cuisiné » — le test passerait à côté de ce qu'il vérifie
// (la vraie API l'expose).
const aDejaCuisine = (page, combien) => page.route('**/rest/v1/cooking_logs*', (route) => {
  if (route.request().method() !== 'HEAD') return route.abort()
  return route.fulfill({
    status: 200,
    headers: {
      'content-range': combien > 0 ? `0-0/${combien}` : '*/0',
      'access-control-allow-origin': '*',
      'access-control-expose-headers': 'content-range',
    },
  })
})

const ecrituresDeLangue = (page) => profileWrites(page).filter((corps) => 'language' in corps)

test.describe('La langue suit le compte', () => {
  test('un compte en anglais ouvert dans un navigateur en français : l’app passe en anglais', async ({ page }) => {
    await navigateurNeuf(page, { langue: 'fr' })
    await signedInAs(page, { profile: { language: 'en', created_at: ilYA(TROIS_MOIS) } })
    await page.goto('/FridgePlus/')

    await expect(page.getByRole('button', { name: 'Open the fridge' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    // Le compte faisait foi : rien n'est réécrit.
    expect(ecrituresDeLangue(page)).toEqual([])
    // Les e-mails de connexion la lisent dans user_metadata (CPT-18) : elle y
    // est recopiée, une fois (les effets sont joués deux fois en développement).
    await expect.poll(() => metadataWrites(page)).toEqual([{ lang: 'en' }])
    assertNoUnmockedCalls(page)
  })

  test('un compte sans langue enregistrée prend celle de l’appareil, une fois', async ({ page }) => {
    await navigateurNeuf(page, { langue: 'fr' })
    await signedInAs(page, { profile: { language: null, created_at: ilYA(TROIS_MOIS) } })
    await page.goto('/FridgePlus/')

    await expect(page.getByRole('button', { name: 'Ouvrir le frigo' })).toBeVisible()
    await expect.poll(() => ecrituresDeLangue(page).length).toBeGreaterThan(0)
    // Une seule valeur écrite : celle de l'appareil. (En développement les
    // effets sont joués deux fois ; le crochet n'écrit pourtant qu'une fois.)
    expect(ecrituresDeLangue(page)).toEqual([{ language: 'fr' }])
    await expect.poll(() => metadataWrites(page)).toEqual([{ lang: 'fr' }])
  })

  test('sans compte, rien n’est écrit', async ({ page }) => {
    await navigateurNeuf(page, { langue: 'fr' })
    await page.addInitScript(() => localStorage.setItem('fridge-welcome-seen-v1', '1'))
    await page.goto('/FridgePlus/')
    await expect(page.getByRole('button', { name: 'Ouvrir le frigo' })).toBeVisible()
    expect(metadataWrites(page)).toEqual([])
    assertNoUnmockedCalls(page)
  })
})

test.describe('L’accueil du débutant ne revient pas pour un compte ancien', () => {
  test('visiteur dans un navigateur neuf : « Bienvenue en cuisine ! » (témoin)', async ({ page }) => {
    await navigateurNeuf(page, { langue: 'fr' })
    await page.goto('/FridgePlus/')
    await expect(page.getByRole('dialog', { name: 'Bienvenue en cuisine !' })).toBeVisible()
  })

  test('compte créé il y a trois mois, navigateur neuf : pas d’écran de bienvenue', async ({ page }) => {
    await navigateurNeuf(page, { langue: 'fr' })
    await signedInAs(page, { profile: { language: 'fr', created_at: ilYA(TROIS_MOIS) } })
    await page.goto('/FridgePlus/')

    await expect(page.getByRole('button', { name: 'Ouvrir le frigo' })).toBeVisible()
    // Il est noté « vu » dès que le profil est arrivé (la décision attend de
    // savoir qui est là) : un rechargement ne le ramène pas non plus.
    await expect.poll(() => page.evaluate(() => localStorage.getItem('fridge-welcome-seen-v1'))).toBe('1')
    await expect(page.getByRole('dialog', { name: 'Bienvenue en cuisine !' })).toHaveCount(0)
  })

  test('compte créé à l’instant (inscription arrivée sur /signup) : il a droit à l’écran', async ({ page }) => {
    await navigateurNeuf(page, { langue: 'fr' })
    await signedInAs(page, { profile: { language: 'fr', created_at: ilYA(2 * 60 * 1000) } })
    await page.goto('/FridgePlus/')
    await expect(page.getByRole('dialog', { name: 'Bienvenue en cuisine !' })).toBeVisible()
  })

  test('compte qui a déjà cuisiné, navigateur neuf : pas de carte du débutant, pas de « Bravo »', async ({ page }) => {
    await navigateurNeuf(page, { langue: 'fr' })
    await activerLaCarteDuDebutant(page)
    await signedInAs(page, { profile: { language: 'fr', created_at: ilYA(TROIS_MOIS) } })
    await aDejaCuisine(page, 12)
    await page.goto('/FridgePlus/')

    await expect(page.getByRole('button', { name: 'Ouvrir le frigo' })).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('region', { name: /Bien démarrer|Getting started/i })).toHaveCount(0)
    await expect(page.getByText('🎉 Bravo !')).toHaveCount(0)
    await expect(page.getByText('On cuisine ?')).toHaveCount(0)
  })

  test('compte qui n’a jamais cuisiné : la carte du débutant est bien là (témoin)', async ({ page }) => {
    await navigateurNeuf(page, { langue: 'fr' })
    await page.addInitScript(() => localStorage.setItem('fridge-welcome-seen-v1', '1'))
    await activerLaCarteDuDebutant(page)
    await signedInAs(page, { profile: { language: 'fr', created_at: ilYA(TROIS_MOIS) } })
    await aDejaCuisine(page, 0)
    await page.goto('/FridgePlus/')

    await expect(page.getByText('On cuisine ?')).toBeVisible()
  })
})
