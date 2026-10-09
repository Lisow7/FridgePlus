import { test, expect } from '@playwright/test'
import {
  installSupabaseMocks, skipOnboardingOverlays, signedInAs, mockAuthUser, mockRpc, rpcCalls,
} from './support/supabase-mock.js'

// Hors audit, trouvé et prouvé le 2026-10-05 : AUCUN signalement de la
// communauté n'avait jamais abouti — la fonction du navigateur écrivait une
// colonne qui n'existe pas, et la fenêtre affichait le texte brut de la base.
// Ici, dans un vrai navigateur : le signalement part vers la fonction
// `ouvrir_ticket` de la base, avec exactement les arguments qu'elle attend
// (ceux que la sonde `supabase/probes/20261005_signalements_et_tickets.sql`
// a joués sur la vraie base), et l'écran dit vrai dans les deux cas.

const TROIS_MOIS = 90 * 24 * 60 * 60 * 1000
const POST = {
  id: 'post-1', user_id: '00000000-0000-0000-0000-00000000000a', category: 'general',
  title: 'Mon astuce anti-gaspi', body: 'Congeler le pain tranché.', recipe_id: null,
  likes_count: 0, replies_count: 0, created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z',
  // Comme la vraie base le sert : sans l'auteur, qui arrive par
  // `get_public_profiles` (audit BDD-13, voir auteurs-lisibles.spec.js).
}

async function ouvrirLaCommunaute(page, { refus = false } = {}) {
  await page.addInitScript(() => window.localStorage.setItem('fridge-lang', 'fr'))
  await skipOnboardingOverlays(page)
  // À INSTALLER EN PREMIER : les mocks de scénario posés ensuite le masquent.
  await installSupabaseMocks(page)
  await signedInAs(page, {
    profile: { language: 'fr', created_at: new Date(Date.now() - TROIS_MOIS).toISOString(), community_terms_accepted_at: '2026-07-01T10:00:00Z', community_muted_until: null },
  })
  await mockAuthUser(page)
  const json = (corps, entetes = {}) => ({ status: 200, contentType: 'application/json', headers: { 'access-control-expose-headers': 'content-range', ...entetes }, body: JSON.stringify(corps) })
  await page.route('**/rest/v1/community_posts**', (route) => route.fulfill(json([POST])))
  await page.route('**/rest/v1/engagement**', (route) => route.fulfill(json([])))
  await page.route('**/rest/v1/community_blocks**', (route) => route.fulfill(json([])))
  // Le compte de demandes ouvertes (createReport vérifie le plafond avant l'envoi) : aucune.
  await page.route('**/rest/v1/support_tickets**', (route) => route.fulfill(json([], { 'content-range': '*/0' })))
  await mockRpc(page, 'get_public_profiles', [{ id: POST.user_id, username: 'Alice', avatar_id: null, banner_id: null, community_bio: null, created_at: '2026-05-01T10:00:00Z' }])
  await mockRpc(page, 'ouvrir_ticket', refus ? { message: 'internal error' } : 'ticket-1', { status: refus ? 500 : 200 })
  await page.goto('/FridgePlus/community')
  await expect(page.getByText('Mon astuce anti-gaspi')).toBeVisible()
}

async function signalerLePost(page) {
  // La carte entière est un bouton dont le nom contient « Signaler » : on vise le bouton exact.
  await page.getByRole('button', { name: 'Signaler', exact: true }).click()
  await page.getByRole('radio', { name: 'Harcèlement' }).check()
  await page.getByPlaceholder('Détails utiles à la modération…').fill('  Insultes répétées  ')
  await page.getByRole('button', { name: 'Envoyer' }).click()
}

test.describe('Un signalement de la communauté aboutit', () => {
  test('le signalement part vers ouvrir_ticket, avec exactement ce qu’il faut, et l’écran le confirme', async ({ page }) => {
    await ouvrirLaCommunaute(page)
    await signalerLePost(page)

    await expect(page.getByText(/Signalement envoyé/)).toBeVisible()
    const appels = rpcCalls(page, 'ouvrir_ticket')
    expect(appels).toHaveLength(1)
    expect(appels[0].args).toEqual({
      p_type: 'report',
      p_title: 'Signalement : post de la communauté (harassment)',
      p_message: 'Insultes répétées',
      p_target_type: 'community_post',
      p_target_id: 'post-1',
      p_reason_key: 'harassment',
    })
  })

  test('la base refuse : un message lisible, pas « Signalement envoyé », pas le texte de la base', async ({ page }) => {
    await ouvrirLaCommunaute(page, { refus: true })
    await signalerLePost(page)

    await expect(page.getByRole('alert').filter({ hasText: 'Le signalement n\'a pas pu être envoyé. Réessaie.' })).toBeVisible()
    await expect(page.getByText(/Signalement envoyé/)).toHaveCount(0)
    await expect(page.getByText(/internal error/)).toHaveCount(0)
  })
})
