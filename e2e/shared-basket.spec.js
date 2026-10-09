import { test, expect } from '@playwright/test'
import {
  installSupabaseMocks, assertNoUnmockedCalls, skipOnboardingOverlays,
  mockSharedBasket, sharedBasketRequests,
} from './support/supabase-mock.js'

// Panier partage — §6 (P1) point 3 de la note d'audit.
//
// Parcours INVITE : le lien `?shared=<uuid>` est public (RLS ouverte, ni auth
// ni Premium requis pour lire). Ce n'est pas une route mais un effet de bord
// d'URL, comme `?restore-account=` — il ouvre l'overlay shared-basket-page.
//
// Spec : la conception « panier-partage-etats-erreur » du 2026-08-07

const UUID = '11111111-2222-3333-4444-555555555555'

const LISTE = {
  payload: {
    rows: [
      { label: 'Tomates', emoji: '🍅', amount: 3, unit: 'pieces', price: 2.4, aisle: 'produce' },
      { label: 'Baguette', emoji: '🥖', amount: 1, unit: 'piece', price: 1.1, aisle: 'bakery' },
      { label: 'Lait', emoji: '🥛', amount: 2, unit: 'L', price: 2.2, aisle: 'dairy' },
    ],
    total: 5.7,
    lang: 'fr',
    name: 'Courses du week-end',
  },
  expires_at: new Date(Date.now() + 5 * 864e5).toISOString(),
}

test.describe('Panier partage', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('fridge-lang', 'fr'))
    await skipOnboardingOverlays(page)
    await installSupabaseMocks(page)
  })

  test('un lien valide affiche la liste et nettoie l\'URL', async ({ page }) => {
    await mockSharedBasket(page, { outcome: 'ok', payload: LISTE })
    await page.goto(`/FridgePlus/?shared=${UUID}`)

    await expect(page.getByText('Courses du week-end')).toBeVisible()
    await expect(page.getByText(/3 articles/i)).toBeVisible()
    await expect(page.getByText(/Expire dans 5 jours/i)).toBeVisible()
    // Les lignes sont regroupees par rayon : le libelle du rayon prouve que le
    // payload a bien ete interprete, pas seulement affiche brut.
    await expect(page.getByText(/Fruits & L.gumes/i)).toBeVisible()

    // L'identifiant demande est bien celui du lien.
    expect(sharedBasketRequests(page).join(' ')).toContain(UUID)
    assertNoUnmockedCalls(page)
    // Parade anti-boucle, comme pour restore-account : le parametre est
    // nettoye avant le premier paint.
    await expect(page).not.toHaveURL(/shared=/)
  })

  test('un lien inconnu ou expire est signale comme tel', async ({ page }) => {
    await mockSharedBasket(page, { outcome: 'not_found' })
    await page.goto(`/FridgePlus/?shared=${UUID}`)

    await expect(page.getByText(/Ce lien est introuvable ou a expir/i)).toBeVisible()
    assertNoUnmockedCalls(page)
  })

  test('une erreur serveur ne pretend pas que le lien a expire', async ({ page }) => {
    await mockSharedBasket(page, { outcome: 'server_error' })
    await page.goto(`/FridgePlus/?shared=${UUID}`)

    await expect(page.getByText(/Impossible de charger la liste/i)).toBeVisible()
    // Le diagnostic « lien expire » enverrait l'utilisateur sur une fausse
    // piste : il croirait son lien mort et ne reessaierait pas.
    await expect(page.getByText(/Ce lien est introuvable ou a expir/i)).toHaveCount(0)
    assertNoUnmockedCalls(page)
  })

  test('une panne reseau ne laisse pas l\'ecran en chargement', async ({ page }) => {
    await mockSharedBasket(page, { outcome: 'network' })
    await page.goto(`/FridgePlus/?shared=${UUID}`)

    // ⚠️ TIMEOUT ETABLI PAR MESURE, PAS AU JUGE : supabase-js RETENTE la
    // requete avant d'abandonner (4 tentatives observees), ce qui repousse le
    // message a ~9,5 s — delai stable sur 3 runs (9501, 9554, 9535 ms). Le
    // defaut de 5 s d'expect ferait echouer ce test sur un correctif pourtant
    // fonctionnel.
    await expect(page.getByText(/Impossible de charger la liste/i)).toBeVisible({ timeout: 20000 })
    // ⚠️ Sur une requete avortee, supabase-js LEVE au lieu de renseigner
    // `error`. Sans le `.catch()` de shared-basket-page.jsx, le `.then()`
    // n'est jamais execute et l'ecran reste mort sur « Chargement… ».
    await expect(page.getByText(/Chargement de la liste/i)).toHaveCount(0)
    assertNoUnmockedCalls(page)
  })
})
