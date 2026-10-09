import { BOOT_TABLES, installSupabaseMocks, skipOnboardingOverlays, signedInAs } from './supabase-mock.js'

// Le panneau admin ouvert sur des données simulées, pour les garde-fous qui y
// entrent (`a11y-admin.spec.js`, `admin-au-telephone.spec.js`). Rien ne part
// vers une vraie base.
//
// Trois pièges, vus le 2026-10-08 (lots 12f et 12g) :
//   - le compte simulé (`signedInAs`) sert lui-même `custom_recipes`, vide, et
//     la DERNIÈRE route posée passe la première : les lignes se posent après lui ;
//   - le socle coupe les tables de démarrage, et leurs comptages (HEAD) font
//     réessayer la bibliothèque ~8 s : la Qualité restait sur « Chargement… » ;
//   - le compte sert LE profil de l'admin en objet unique, alors que les listes
//     de l'admin (inscriptions, utilisateurs, pseudos) attendent une LISTE.

export const IL_Y_A = (jours) => new Date(Date.now() - jours * 24 * 3600 * 1000).toISOString()

// Une ligne là où les lots 12f et 12g corrigent des lignes.
export const LIGNES_ADMIN = {
  support_tickets: [{ id: 't-1', user_id: 'u-2', type: 'question', title: 'Question sur le frigo', status: 'open', has_unread_user: false, has_unread_admin: true, created_at: IL_Y_A(2), updated_at: IL_Y_A(1) }],
  activity_logs: [{ id: 'l-1', action: 'recipe_approved', user_id: 'a-1', target_id: 'r-1', target_type: 'recipe', created_at: IL_Y_A(1) }],
  recipe_health_check: [{ id: 'gratin', name_fr: 'Gratin sans étapes', origin: 'official', status: 'published', issues: ['missing_steps'], updated_at: IL_Y_A(3) }],
  custom_recipes: [{ id: 'r-1', user_id: 'u-2', title: 'Tarte aux poireaux', moderation_status: 'pending', created_at: IL_Y_A(1), data: { emoji: '🥧', name: { fr: 'Tarte aux poireaux' }, ingredients: [], steps: [] } }],
}

export const UTILISATEUR = { id: 'u-2', username: 'marie_cuisine', role: 'user', banned: false, special_role: null, created_at: IL_Y_A(40), avatar_id: null }

/**
 * Ouvre le panneau admin depuis le menu du compte. La taille d'écran se règle
 * avant (`test.use` ou `page.setViewportSize`).
 * @param {{ theme?: 'light'|'dark', section?: string, utilisateurs?: object[], lignes?: object }} options
 *   `section` : celle que le panneau a mémorisée (il s'ouvre dessus) ;
 *   `lignes` : remplace des tables de `LIGNES_ADMIN` (une longue liste, par exemple).
 * @returns le dialogue « Fridge+ Admin »
 */
export async function ouvrirLePanneauAdmin(page, { theme = 'light', section, utilisateurs = [UTILISATEUR], lignes: autres = {} } = {}) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ t, s }) => {
    localStorage.setItem('fridge-lang', 'fr')
    if (t === 'dark') localStorage.setItem('fridge-theme', 'dark')
    if (s) localStorage.setItem('fridge-admin-section', s)
  }, { t: theme, s: section })
  await skipOnboardingOverlays(page)
  // À INSTALLER EN PREMIER : les routes posées ensuite sont évaluées avant lui.
  await installSupabaseMocks(page)
  await page.route('**/rest/v1/**', (route) => {
    const methode = route.request().method()
    const table = new URL(route.request().url()).pathname.split('/rest/v1/')[1]?.split('?')[0] ?? ''
    if (BOOT_TABLES.includes(table) || table.startsWith('rpc/')) return route.fallback()
    if (methode === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '*/0' }, body: '[]' })
    if (methode === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': '*/0' }, body: '' })
    return route.fallback()
  })
  await signedInAs(page, { profile: { role: 'admin', language: 'fr', created_at: IL_Y_A(90) } })
  await page.route('**/rest/v1/profiles**', (route) => (
    route.request().url().includes('id=eq.')
      ? route.fallback()
      : route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(utilisateurs.length - 1, 0)}/${utilisateurs.length}` }, body: JSON.stringify(utilisateurs) })
  ))
  for (const table of ['recipes_unified', 'ingredients']) {
    await page.route(`**/rest/v1/${table}**`, (route) => (route.request().method() === 'HEAD'
      ? route.fulfill({ status: 200, headers: { 'content-range': '*/10' }, body: '' })
      : route.fallback()))
  }
  for (const [table, lignes] of Object.entries({ ...LIGNES_ADMIN, ...autres })) {
    await page.route(`**/rest/v1/${table}**`, (route) => {
      const methode = route.request().method()
      if (methode === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${lignes.length - 1}/${lignes.length}` }, body: JSON.stringify(lignes) })
      if (methode === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': `*/${lignes.length}` }, body: '' })
      return route.fallback()
    })
  }
  await page.goto('/FridgePlus/')
  await page.getByRole('button', { name: 'Menu utilisateur' }).click()
  await page.getByText('Panneau admin').click()
  return page.getByRole('dialog', { name: 'Fridge+ Admin' })
}

/**
 * Les cibles du dialogue sous 24 × 24 px (WCAG 2.5.8), visibles à l'écran.
 * Une case ou un champ ENVELOPPÉ dans son `<label>` se mesure au label : c'est
 * lui que le doigt touche (le clic sur le label actionne le contrôle).
 */
export function ciblesTropPetites(page) {
  return page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]')
    return [...dlg.querySelectorAll('button, a[href], input:not([type="hidden"]), select, [role="button"]')]
      .map((el) => {
        const cible = el.matches('input, select') && el.closest('label') ? el.closest('label') : el
        const r = cible.getBoundingClientRect()
        const nom = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40)
        return { nom, l: Math.round(r.width), h: Math.round(r.height), visible: r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight }
      })
      .filter((c) => c.visible && (c.l < 24 || c.h < 24))
      .map(({ nom, l, h }) => `${nom} (${l} × ${h})`)
  })
}
