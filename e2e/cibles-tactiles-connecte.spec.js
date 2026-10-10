import { test, expect } from '@playwright/test'
import { BOOT_TABLES, installSupabaseMocks, skipOnboardingOverlays, signedInAs } from './support/supabase-mock.js'
import { verifierLesCibles } from './support/cibles-tactiles.js'

// WCAG 2.2 — 2.5.8 « Taille de la cible (minimum) », 24 × 24 px, sur les écrans
// d'un COMPTE CONNECTÉ et les fenêtres ouvertes (audit du 2026-10-04, A11Y-13).
//
// `cibles-tactiles.spec.js` ne visite que quatre écrans publics : les boutons
// de 11 × 11 du panneau des notifications, ceux du support, du profil ou du
// panier n'y passaient jamais. 🥇 Un cliquet ne protège que ce qu'il VISITE
// (leçon déjà écrite dans `a11y.spec.js`).
//
// Données : la session est simulée (`signedInAs`) ; les lectures renvoient des
// listes VIDES, sauf les tables de démarrage (le socle les coupe exprès pour
// que l'app retombe sur ses données statiques) et deux notifications — une
// non lue, une lue — sans lesquelles « Marquer comme lu » et « Supprimer »
// n'existeraient pas à l'écran. Rien ne part vers une vraie base.

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

const UID = '00000000-0000-0000-0000-000000000002'
const JOUR = 24 * 3600 * 1000
const ilYA = (ms) => new Date(Date.now() - ms).toISOString()
const dans = (ms) => new Date(Date.now() + ms).toISOString()

const NOTIFICATIONS = [
  {
    id: 'a1b2c3d4-0000-4000-8000-000000000001', recipient_id: UID, type: 'ticket_reply',
    title: 'Réponse du support', body: 'Ta demande a été traitée.',
    read_at: null, created_at: ilYA(3600 * 1000), expires_at: dans(30 * JOUR),
  },
  {
    id: 'a1b2c3d4-0000-4000-8000-000000000002', recipient_id: UID, type: 'recipe_approved',
    title: 'Recette publiée', body: null,
    read_at: ilYA(JOUR), created_at: ilYA(2 * JOUR), expires_at: dans(30 * JOUR),
  },
]

async function connecter(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => { localStorage.setItem('fridge-lang', 'fr') })
  await skipOnboardingOverlays(page)
  // À INSTALLER EN PREMIER : les routes posées ensuite sont évaluées avant lui.
  await installSupabaseMocks(page)
  await page.route('**/rest/v1/**', (route) => {
    const methode = route.request().method()
    const table = new URL(route.request().url()).pathname.split('/rest/v1/')[1]?.split('?')[0] ?? ''
    if (BOOT_TABLES.includes(table)) return route.fallback()
    if (methode === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    if (methode === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': '*/0' }, body: '' })
    return route.fallback()
  })
  // Posée APRÈS l'attrape-tout, donc consultée avant lui.
  await page.route((url) => url.pathname.endsWith('/rest/v1/notifications'), (route) => {
    const methode = route.request().method()
    if (methode === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': '*/1' }, body: '' })
    if (methode === 'GET') {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'content-range': '0-1/2' }, body: JSON.stringify(NOTIFICATIONS),
      })
    }
    return route.fulfill({ status: 204, body: '' })
  })
  await signedInAs(page, { id: UID, profile: { language: 'fr', created_at: ilYA(90 * JOUR) } })
}

const ECRANS = [
  { nom: 'accueil connecté', chemin: '/FridgePlus/' },
  {
    nom: 'notifications ouvertes',
    chemin: '/FridgePlus/',
    ouvrir: async (page) => {
      await page.getByRole('button', { name: 'Notifications' }).click()
      // `exact` : « Tout marquer comme lu » contient aussi ces mots.
      await expect(page.getByRole('button', { name: 'Marquer comme lu', exact: true }).first()).toBeVisible()
      await expect(page.getByRole('button', { name: 'Supprimer', exact: true }).first()).toBeVisible()
    },
  },
  { nom: 'menu utilisateur ouvert', chemin: '/FridgePlus/', ouvrir: (page) => page.getByRole('button', { name: 'Menu utilisateur' }).click() },
  { nom: 'actions rapides ouvertes', chemin: '/FridgePlus/', ouvrir: (page) => page.getByRole('button', { name: 'Actions rapides', exact: true }).click() },
  { nom: 'aide et infos ouverte', chemin: '/FridgePlus/', ouvrir: (page) => page.getByRole('button', { name: 'Aide & infos' }).filter({ visible: true }).first().click() },
  {
    nom: 'support — liste des demandes',
    chemin: '/FridgePlus/',
    ouvrir: async (page) => {
      await page.getByRole('button', { name: 'Aide & infos' }).filter({ visible: true }).first().click()
      await page.getByRole('button', { name: /Contacter le support/ }).click()
      await expect(page.getByRole('button', { name: /Nouvelle demande/ })).toBeVisible()
    },
  },
  {
    nom: 'support — formulaire d’une demande',
    chemin: '/FridgePlus/',
    ouvrir: async (page) => {
      await page.getByRole('button', { name: 'Aide & infos' }).filter({ visible: true }).first().click()
      await page.getByRole('button', { name: /Contacter le support/ }).click()
      await page.getByRole('button', { name: /Nouvelle demande/ }).click()
      await page.getByRole('button', { name: /Question générale/ }).click()
      await page.getByRole('button', { name: /toujours besoin d.aide/ }).click()
    },
  },
  { nom: 'profil — identité', chemin: '/FridgePlus/profile/identite' },
  { nom: 'profil — préférences', chemin: '/FridgePlus/profile/preferences' },
  { nom: 'profil — activité', chemin: '/FridgePlus/profile/activite' },
  { nom: 'profil — compte et sécurité', chemin: '/FridgePlus/profile/compte' },
  // Sans Premium, le panier est sa vitrine « Prochainement » : la saisie
  // manuelle derrière n'est pas atteignable ici (ses boutons sont des
  // <Button>, couverts par button.test.jsx).
  { nom: 'panier', chemin: '/FridgePlus/cart' },
  {
    nom: 'fiche recette connectée',
    chemin: '/FridgePlus/?recettes=1',
    ouvrir: async (page) => {
      await page.locator('[data-recipe-id]').first().click()
      await page.waitForURL(/\/recipe\//)
      await expect(page.getByRole('button', { name: 'Plus de portions' })).toBeVisible()
    },
  },
]

for (const e of ECRANS) {
  test(`${e.nom} : toutes les cibles font au moins 24 × 24 px`, async ({ page }) => {
    await connecter(page)
    await page.goto(e.chemin)
    await page.waitForLoadState('networkidle')
    if (e.ouvrir) {
      await e.ouvrir(page)
      await page.waitForTimeout(300)
    }
    await verifierLesCibles(page, e.nom)
  })
}
