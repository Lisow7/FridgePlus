import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { TAGS, REGLES_DIFFEREES, OPTIONS_AXE, sansExemptions, incompletesNonExpliquees, resume } from './support/axe-regles.js'
import { ouvrirLePanneauAdmin } from './support/admin-mock.js'

// axe-core dans le PANNEAU ADMIN, section par section, guide compris (audit du
// 2026-10-04, ADM-19 et A11Y-10).
//
// Aucun garde-fou n'y entrait : `a11y-connecte.spec.js` s'arrête aux écrans
// d'un compte ordinaire. Le panneau portait 14 `role="tab"` sans liste, un
// bouton dans un bouton (ligne de ticket), une suppression en `<span onClick>`,
// une croix « Close »… 🥇 Un cliquet ne protège que ce qu'il VISITE.
//
// Données : `support/admin-mock.js` — une ligne là où les lots 12f et 12g
// corrigent des lignes (Support, Journal, Qualité, Recettes +, Utilisateurs),
// des listes vides ailleurs. Rien ne part vers une vraie base.
//
// Une seule visite par thème, toutes les sections à la suite, en `expect.soft` :
// le panneau s'ouvre une fois (30 visites séparées coûtaient ~2 min de plus à la CI).

// La ligne que chaque section DOIT afficher avant qu'axe regarde : sans elle,
// le garde-fou passerait sur un écran vide et se croirait vert.
const LIGNE_ATTENDUE = {
  'Recettes +': (p) => p.getByRole('checkbox', { name: 'Sélectionner cette recette' }),
  'Qualité': (p) => p.getByRole('button', { name: /Gratin sans étapes/ }),
  'Support': (p) => p.getByRole('button', { name: 'Supprimer le ticket « Question sur le frigo »' }),
  'Journal': (p) => p.getByRole('button', { name: /Recette approuvée/ }),
  'Utilisateurs': (p) => p.getByRole('button', { name: 'Détails de marie_cuisine' }),
}

const SECTIONS = ['Tableau de bord', 'Recettes +', 'Signalements', 'Avis', 'Communauté', 'Ingrédients', 'Recettes base', 'Tarifs', 'Qualité', 'Utilisateurs', 'Support', 'Journal', 'Notifications', 'Fonctionnalités']

// ── Contraste : à zéro, comme toutes les autres règles (lot 12j, 2026-10-08) ──
// Le panneau admin avait ses PROPRES couleurs en dur : la décision du
// 2026-10-06 (« couleurs = profond ») avait soldé l'app, pas lui. Première
// mesure (lot 12f) : 244 nœuds ; puis une dette chiffrée par section, 126 au
// plus — pastilles, cellules du Pricing, badges, « Accorder ». Le lot 12j l'a
// soldée : le jeton atténué commun, et `texteLisible` pour toute couleur
// d'accent employée comme texte (src/shared/lib/couleurs/texte-lisible.js).
// Les écarts de mesure entre la CI et le poste venaient de transitions
// mesurées à leur valeur de départ : voir l'attente de l'écran posé, plus bas.

// Les graduations du graphique du tableau de bord sont du texte SVG : axe ne
// sait pas quel fond retenir (raison `imgNode`, vue le 2026-10-08 sur
// `<tspan>09/09</tspan>`…). Retirées ICI seulement, et seulement elles : un
// texte HTML posé sur une image resterait bloquant.
const sansTexteDeGraphique = (incomplete) => incomplete
  .map((i) => (i.id !== 'color-contrast' ? i : { ...i, nodes: i.nodes.filter((n) => !/^<(tspan|text)\b/.test(n.html)) }))
  .filter((i) => i.nodes.length > 0)

async function verifier(page, ecran) {
  // Les fenêtres ouvertes seules (panneau, guide, confirmations) : l’app derrière
  // est l’affaire de `a11y.spec.js` et `a11y-connecte.spec.js` — et l’analyse
  // complète doublait la durée.
  // Mesurer l'écran POSÉ. Quand un chargement finit, un bouton repasse de
  // désactivé (`disabled:opacity-50`) à actif : sa transition d'opacité démarre,
  // et une transition n'avance qu'à l'image suivante — même raccourcie à 10 µs
  // par « moins de mouvement ». axe, synchrone, mesurait donc la valeur de
  // DÉPART (0,5) : « Rafraîchir », « Exporter » en défaut de contraste selon
  // l'instant de la mesure, d'où les dettes « au plus » qui variaient de la CI
  // au poste (lot 12j, 2026-10-08, sondé : CSSTransition opacity, currentTime 0).
  // On attend la fin des chargements, puis celle des animations FINIES (les
  // toupies tournent sans fin : on ne les attend pas).
  await expect(page.locator('[role="dialog"] .animate-spin')).toHaveCount(0)
  await page.evaluate(() => Promise.all(
    [...document.querySelectorAll('[role="dialog"]')]
      .flatMap((d) => d.getAnimations({ subtree: true }))
      .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
      .map((a) => a.finished.catch(() => {})),
  ))
  const resultat = await new AxeBuilder({ page }).include('[role="dialog"]').options(OPTIONS_AXE).withTags(TAGS).disableRules(REGLES_DIFFEREES).analyze()
  const violations = sansExemptions(resultat.violations)
  expect.soft(violations, `${ecran} :\n${resume(violations)}`).toEqual([])
  const nouvelles = incompletesNonExpliquees(sansTexteDeGraphique(resultat.incomplete))
  expect.soft(nouvelles, `${ecran} — règle(s) « incomplete » nouvelle(s) : ${nouvelles.join(', ')}`).toEqual([])
}

for (const theme of ['light', 'dark']) {
  test(`panneau admin (${theme === 'light' ? 'clair' : 'sombre'}) : aucune violation axe-core, section par section`, async ({ page }) => {
    test.setTimeout(120000)
    await page.setViewportSize({ width: 1440, height: 900 })
    const panneau = await ouvrirLePanneauAdmin(page, { theme })
    const sections = panneau.getByRole('navigation', { name: 'Sections du panneau admin' })
    for (const s of SECTIONS) {
      await sections.getByRole('button', { name: new RegExp('^' + s.replace('+', '\\+')) }).click()
      await expect(sections.getByRole('button', { name: new RegExp('^' + s.replace('+', '\\+')) })).toHaveAttribute('aria-current', 'page')
      await page.waitForLoadState('networkidle')
      if (LIGNE_ATTENDUE[s]) await expect(LIGNE_ATTENDUE[s](panneau), `${s} : la ligne de données doit être affichée`).toBeVisible()
      await verifier(page, s)
    }
    await panneau.getByRole('button', { name: /Guide/ }).click()
    await expect(page.getByRole('navigation', { name: 'Sujets du guide' })).toBeVisible()
    await verifier(page, 'Guide')
  })
}
