import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { TAGS, REGLES_DIFFEREES, OPTIONS_AXE, sansExemptions, incompletesNonExpliquees, resume } from './support/axe-regles.js'
import { BOOT_TABLES, installSupabaseMocks, skipOnboardingOverlays, signedInAs } from './support/supabase-mock.js'

// axe-core sur les écrans d'un COMPTE CONNECTÉ et sur les FENÊTRES OUVERTES
// (audit du 2026-10-04, A11Y-19).
//
// `a11y.spec.js` ne visite que les pages publiques, fermées : aucun écran
// connecté, aucun dialogue ouvert, aucun menu déplié. Les défauts A11Y-01 à
// A11Y-06 de l'audit vivaient tous là — invisibles pour la CI. 🥇 Un cliquet ne
// protège que ce qu'il VISITE (leçon déjà écrite dans `a11y.spec.js`).
//
// Les règles sont les MÊMES (`support/axe-regles.js`) : tags WCAG 2.2 AA +
// best-practice, exemption du seul logotype, raisons d'indécision tolérées.
//
// Données : la session est simulée (`signedInAs`) ; les lectures renvoient des
// listes VIDES (les écrans s'affichent, vides, plutôt qu'en erreur), sauf les
// tables de démarrage, que le socle coupe exprès pour que l'app retombe sur ses
// données statiques. Rien ne part vers une vraie base.
// Mouvement réduit : axe photographie un instant, une animation en cours
// fausserait le contraste mesuré.

const SCENARIOS = [
  { nom: 'profil — identité', chemin: '/FridgePlus/profile/identite' },
  { nom: 'profil — préférences', chemin: '/FridgePlus/profile/preferences' },
  { nom: 'profil — activité', chemin: '/FridgePlus/profile/activite' },
  { nom: 'profil — récompenses', chemin: '/FridgePlus/profile/recompenses' },
  { nom: 'profil — dépenses', chemin: '/FridgePlus/profile/depenses' },
  { nom: 'profil — compte et sécurité', chemin: '/FridgePlus/profile/compte' },
  { nom: 'panier', chemin: '/FridgePlus/cart' },
  { nom: 'notifications ouvertes', chemin: '/FridgePlus/', ouvrir: (page) => page.getByRole('button', { name: 'Notifications' }).click() },
  { nom: 'menu utilisateur ouvert', chemin: '/FridgePlus/', ouvrir: (page) => page.getByRole('button', { name: 'Menu utilisateur' }).click() },
  { nom: 'actions rapides ouvertes', chemin: '/FridgePlus/', ouvrir: (page) => page.getByRole('button', { name: 'Actions rapides', exact: true }).click() },
  { nom: 'aide et infos ouverte', chemin: '/FridgePlus/', ouvrir: (page) => page.getByRole('button', { name: 'Aide & infos' }).filter({ visible: true }).first().click() },
  { nom: 'cookies — réglages ouverts', chemin: '/FridgePlus/faq', ouvrir: (page) => page.getByRole('button', { name: 'Cookies', exact: true }).filter({ visible: true }).first().click() },
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
]

// ── Contraste : une DETTE MESURÉE, au cran exact ──────────────────────────
// Mesurée le 2026-10-06 : 67 nœuds sur 19 couples écran × combinaison. Ce
// n'est pas un oubli à rattraper en douce : l'essentiel vient de la palette de
// marque (texte blanc sur l'orange `#E07820` à 3,05:1, badges colorés, textes
// « muted »), c'est-à-dire la décision A11Y-03 posée sur la planche d'Antoine.
// Toutes les AUTRES règles sont bloquantes, à zéro. Ici, chaque couple a son
// plafond : il ne monte pas (voir plus bas pourquoi « au plus »).
// Décision du 2026-10-06 (« couleurs = profond ») : la dette mesurée le
// 2026-10-06 (19 combinaisons, 67 nœuds) est soldée. Plus aucun texte sous
// 4,5:1 sur ces écrans connectés, en clair comme en sombre.
const DETTE_CONTRASTE = {}

const COMBINAISONS = [
  { theme: 'light', taille: { width: 1440, height: 900 }, nom: 'clair, bureau' },
  { theme: 'dark', taille: { width: 1440, height: 900 }, nom: 'sombre, bureau' },
  { theme: 'light', taille: { width: 390, height: 844 }, nom: 'clair, mobile' },
]

async function connecter(page, theme) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript((t) => {
    localStorage.setItem('fridge-lang', 'fr')
    if (t === 'dark') localStorage.setItem('fridge-theme', 'dark')
  }, theme)
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
  await signedInAs(page, { profile: { language: 'fr', created_at: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString() } })
}

for (const c of COMBINAISONS) {
  test.describe(`accessibilité connectée — ${c.nom}`, () => {
    for (const s of SCENARIOS) {
      test(`${s.nom} : aucune violation axe-core`, async ({ page }) => {
        await page.setViewportSize(c.taille)
        await connecter(page, c.theme)
        await page.goto(s.chemin)
        await page.waitForLoadState('networkidle')
        if (s.ouvrir) {
          await s.ouvrir(page)
          await page.waitForTimeout(300)
        }

        const resultat = await new AxeBuilder({ page }).options(OPTIONS_AXE).withTags(TAGS).disableRules(REGLES_DIFFEREES).analyze()
        const violations = sansExemptions(resultat.violations)
        const autres = violations.filter((v) => v.id !== 'color-contrast')
        expect(autres, resume(autres)).toEqual([])
        const contraste = violations.find((v) => v.id === 'color-contrast')
        const dette = DETTE_CONTRASTE[`${c.nom}|${s.nom}`] ?? 0
        const mesure = contraste?.nodes.length ?? 0
        // AU PLUS, et non au cran exact : un nœud bascule parfois en
        // « indécidable » quand un élément le recouvre un instant (vu le
        // 2026-10-06 : 1 passage sur 4, en local comme en CI). Une baisse
        // momentanée n'est donc pas une correction ; une HAUSSE est toujours un
        // défaut nouveau. Après une vraie correction, baisser le chiffre ici.
        expect(mesure, `contraste : ${mesure} nœud(s) pour une dette de ${dette} — un défaut NOUVEAU :\n${contraste ? resume([contraste]) : ''}`).toBeLessThanOrEqual(dette)
        const nouvelles = incompletesNonExpliquees(resultat.incomplete)
        expect(nouvelles, `règle(s) « incomplete » nouvelle(s) : ${nouvelles.join(', ')}`).toEqual([])
      })
    }
  })
}
