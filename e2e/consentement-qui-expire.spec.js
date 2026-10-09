import { test, expect } from '@playwright/test'
import { installSupabaseMocks } from './support/supabase-mock.js'

// Audit du 2026-10-04, RGPD-05 : le choix des cookies n'expirait jamais. Il
// expire maintenant au bout de 6 mois (recommandation de la CNIL) : le bandeau
// revient. Prouvé dans le navigateur, sur un vrai chargement de page.

const MOIS = 30 * 24 * 3600 * 1000

async function avecUnChoixVieuxDe(page, mois) {
  await page.addInitScript(([age, idAnonyme]) => {
    const quand = Date.now() - age
    localStorage.setItem('fridge-welcome-seen-v1', '1')
    localStorage.setItem('fridge-lang', 'fr')
    localStorage.setItem('fridge-consent-v1', JSON.stringify({
      version: 2, timestamp: quand, decisionAt: quand, bannerDismissed: true,
      essential: true, errors: true, usage: true, voice: false, receiptScan: false,
    }))
    localStorage.setItem('fridge-anon-id', idAnonyme)
  }, [mois * MOIS, 'identifiant-anonyme-d-essai'])
  await installSupabaseMocks(page)
  await page.goto('/FridgePlus/faq')
}

test('un choix de plus de 6 mois : le bandeau revient, et l’identifiant anonyme du suivi est effacé', async ({ page }) => {
  await avecUnChoixVieuxDe(page, 7)
  await expect(page.getByRole('dialog', { name: /Cookies et données/ })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('fridge-anon-id'))).toBeNull()
})

test('un choix de 5 mois : le bandeau reste fermé (témoin)', async ({ page }) => {
  await avecUnChoixVieuxDe(page, 5)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('dialog', { name: /Cookies et données/ })).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('fridge-anon-id'))).toBe('identifiant-anonyme-d-essai')
})
