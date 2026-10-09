import { test, expect } from '@playwright/test'
import {
  installSupabaseMocks, skipOnboardingOverlays, signedInAs, mockAuthUser, mockRpc, rpcCalls,
} from './support/supabase-mock.js'

// Audit du 2026-10-04, BDD-13 : la table `profiles` ne se lit que pour SA
// ligne (ou en admin). Les posts joignaient le profil de leur auteur : pour
// tout lecteur non admin, la base rendait un auteur vide — « Utilisateur
// supprimé » sous chaque post, « Profil introuvable » sur chaque fiche. L'admin,
// qui voit tout, ne pouvait pas le remarquer.
//
// Ici, le post est servi COMME LA VRAIE BASE LE SERT à un compte ordinaire
// (auteur vide), et le nom arrive par la fonction `get_public_profiles` — celle
// que la sonde `supabase/probes/20261005_profils_publics_et_compteurs.sql` a
// jouée sur la vraie base.

const TROIS_MOIS = 90 * 24 * 60 * 60 * 1000
const AUTEUR = '00000000-0000-0000-0000-00000000000a'
const POST = {
  id: 'post-1', user_id: AUTEUR, category: 'general',
  title: 'Mon astuce anti-gaspi', body: 'Congeler le pain tranché.', recipe_id: null,
  likes_count: 0, replies_count: 0, created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z',
  profile: null,
}
const ALICE = {
  id: AUTEUR, username: 'Alice', avatar_id: 'chef', banner_id: null,
  community_bio: 'Cuisine du marché, zéro gaspi.', created_at: '2026-05-01T10:00:00Z',
}

async function ouvrirLaCommunaute(page, { panne = false } = {}) {
  await page.addInitScript(() => window.localStorage.setItem('fridge-lang', 'fr'))
  await skipOnboardingOverlays(page)
  // À INSTALLER EN PREMIER : les mocks de scénario posés ensuite le masquent.
  await installSupabaseMocks(page)
  await signedInAs(page, {
    profile: { language: 'fr', created_at: new Date(Date.now() - TROIS_MOIS).toISOString(), community_terms_accepted_at: '2026-07-01T10:00:00Z', community_muted_until: null },
  })
  await mockAuthUser(page)
  const json = (corps) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) })
  await page.route('**/rest/v1/community_posts**', (route) => route.fulfill(json([POST])))
  await page.route('**/rest/v1/engagement**', (route) => route.fulfill(json([])))
  await page.route('**/rest/v1/community_blocks**', (route) => route.fulfill(json([])))
  await mockRpc(page, 'get_public_profiles', panne ? { message: 'internal error' } : [ALICE], { status: panne ? 500 : 200 })
  await page.goto('/FridgePlus/community')
  await expect(page.getByText('Mon astuce anti-gaspi')).toBeVisible()
}

test.describe('Les auteurs de la communauté ont un nom', () => {
  // La carte entière est un bouton dont le nom contient celui de l'auteur : on vise le bouton exact.
  test('un compte ordinaire voit le nom de l’auteur d’un post', async ({ page }) => {
    await ouvrirLaCommunaute(page)

    await expect(page.getByRole('button', { name: 'Voir le profil de Alice', exact: true })).toBeVisible()
    await expect(page.getByText('Utilisateur supprimé')).toHaveCount(0)
    expect(rpcCalls(page, 'get_public_profiles')[0].args).toEqual({ p_ids: [AUTEUR] })
  })

  test('la fiche de l’auteur s’ouvre, avec sa bio — pas « Profil introuvable »', async ({ page }) => {
    await ouvrirLaCommunaute(page)
    await page.getByRole('button', { name: 'Voir le profil de Alice', exact: true }).click()

    const fiche = page.getByRole('dialog', { name: 'Alice' })
    await expect(fiche.getByText('Cuisine du marché, zéro gaspi.')).toBeVisible()
    await expect(page.getByText('Profil introuvable.')).toHaveCount(0)
  })

  test('les noms n’ont pas pu être lus : « Auteur non chargé », pas « Utilisateur supprimé »', async ({ page }) => {
    await ouvrirLaCommunaute(page, { panne: true })

    await expect(page.getByText('Auteur non chargé')).toBeVisible()
    await expect(page.getByText('Utilisateur supprimé')).toHaveCount(0)
  })
})
