import { test, expect } from '@playwright/test'

// L'écran de BIENVENUE reste entièrement utilisable quand l'écran est court.
//
// ── Les deux défauts, mesurés le 2026-09-12 sur le build de production ─────
// Le fond de la modale est un `position:fixed; inset:0; display:flex;
// align-items:center` SANS `overflow`, et le panneau n'a ni `max-height` ni
// défilement. Deux conséquences distinctes :
//
//   A. DÉBORD INATTEIGNABLE. Le panneau mesure 730 à 770 px. Plus haut que
//      l'écran, `align-items:center` répartit le débord EN HAUT ET EN BAS à la
//      fois — 101 px coupés en 320×568, 85 px en 390×560 — et rien ne défile
//      pour y accéder. Pire : l'action principale « Entrer directement » était
//      ENTIÈREMENT hors écran en 320×568 et en 390×560. Un nouveau venu sur un
//      iPhone SE ne pouvait pas entrer dans l'app sans faire la visite.
//
//   B. « PASSER » RECOUVERT. Le bouton est `position:absolute` en haut à droite
//      du FOND ; le panneau est un frère PLUS TARDIF dans le DOM et sans
//      z-index sur le bouton, il gagne l'ordre de peinture. Dès que le haut du
//      panneau remonte au-dessus de y=54, il AVALE le clic. Mesuré non
//      atteignable en 320×568, 360×640, 390×560 — et aussi en 414×736, où le
//      panneau tient pourtant dans l'écran : B est indépendant de A.
//
// 🥇 Quatrième occurrence de la classe de défaut du 27/08, sur LE MÊME bouton
// de ce MÊME écran (cf. l'en-tête de `surfaces-atteignables.spec.js`). La
// doctrine du dépôt : deux surfaces se SÉQUENCENT, elles ne s'empilent pas.
//
// ⚠️ Ce test ne peut PAS être unitaire : jsdom ne calcule aucune hauteur et
// n'implémente pas `elementFromPoint`.

const CONSENTEMENT = JSON.stringify({
  version: 2, essential: true, errors: false, usage: false, bannerDismissed: true,
  decidedAt: '2026-09-12T00:00:00.000Z',
})

// Quatre tailles CHOISIES, pas prises au hasard : les trois premières coupent le
// panneau, la quatrième ne le coupe pas et isole donc le défaut B.
const TAILLES = [
  { nom: '320x568 (iPhone SE 1re génération)', width: 320, height: 568 },
  { nom: '360x640 (Android d\'entrée de gamme)', width: 360, height: 640 },
  { nom: '390x560 (iPhone 14, navigateur avec barres)', width: 390, height: 560 },
  { nom: '414x736 (le panneau tient — isole le défaut B)', width: 414, height: 736 },
]

for (const taille of TAILLES) {
  test(`${taille.nom} — l'écran de bienvenue reste entièrement utilisable`, async ({ page }) => {
    await page.setViewportSize({ width: taille.width, height: taille.height })
    // Le consentement est RÉPONDU : l'écran de bienvenue ne s'affiche qu'après le
    // bandeau cookies (séquencement des surfaces globales). Sans cette ligne la
    // modale n'apparaît pas et le test passerait sans rien prouver.
    await page.addInitScript((c) => {
      localStorage.setItem('fridge-lang', 'fr')
      localStorage.setItem('fridge-consent-v1', c)
    }, CONSENTEMENT)
    await page.goto('/FridgePlus/')
    await page.waitForLoadState('networkidle')

    const fond = page.locator('.fp-modal-backdrop')
    await expect(fond, "L'écran de bienvenue ne s'est pas affiché — le test ne prouverait rien.").toBeVisible()

    const mesure = await page.evaluate(() => {
      const f = document.querySelector('.fp-modal-backdrop')
      const p = f.querySelector('.fp-modal-panel')
      f.scrollTop = 0
      const sf = getComputedStyle(f)
      const deborde = f.scrollHeight > f.clientHeight + 1
      const commandes = [...f.querySelectorAll('button, a[href]')].map(b => {
        b.scrollIntoView({ block: 'nearest' })
        const r = b.getBoundingClientRect()
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2
        const dessus = document.elementFromPoint(cx, cy)
        return {
          nom: (b.getAttribute('aria-label') || b.innerText || '?').trim().replace(/\s+/g, ' ').slice(0, 34),
          dansEcran: r.top >= -1 && r.bottom <= innerHeight + 1,
          atteignable: !!dessus && (b === dessus || b.contains(dessus)),
          recouvreur: dessus ? (dessus.className || dessus.tagName).toString().slice(0, 40) : 'rien',
        }
      })
      f.scrollTop = 0
      return {
        hautDuPanneau: Math.round(p.getBoundingClientRect().top),
        deborde,
        peutDefiler: ['auto', 'scroll'].includes(sf.overflowY),
        commandes,
      }
    })

    // A1 — rien n'est coupé AU-DESSUS de la zone défilable : ce contenu-là
    //      serait définitivement hors d'atteinte, même en faisant défiler.
    expect(
      mesure.hautDuPanneau,
      `Le haut du panneau est à ${mesure.hautDuPanneau}px : ${-mesure.hautDuPanneau}px de contenu ` +
      'sont coupés au-dessus de la zone défilable, donc inatteignables. `align-items:center` ' +
      'répartit le débord des deux côtés — centrer par marges automatiques dans un conteneur ' +
      'qui défile.',
    ).toBeGreaterThanOrEqual(-1)

    // A2 — s'il y a un débord, quelque chose doit défiler. Sinon le contenu est perdu.
    if (mesure.deborde) {
      expect(
        mesure.peutDefiler,
        'Le contenu de la modale dépasse son fond, mais le fond ne défile pas : ' +
        'ce qui dépasse est inatteignable.',
      ).toBe(true)
    }

    // B — chaque commande doit être atteignable. Pas « présente dans le DOM » :
    //     ATTEIGNABLE au doigt, une fois amenée dans l'écran.
    const fautives = mesure.commandes.filter(c => !c.dansEcran || !c.atteignable)
    expect(
      fautives.map(c => `« ${c.nom} »${c.dansEcran ? '' : ' hors écran'}${c.atteignable ? '' : ` recouvert par ${c.recouvreur}`}`),
      'Des commandes de l\'écran de bienvenue sont inatteignables.',
    ).toEqual([])


    // B-bis — PLUS DE « PASSER » (décision du 2026-10-08, `bienvenue_sortie =
    // entrer`) : il faisait la même chose qu'« Entrer directement → ». Le bouton
    // épinglé, et la bande de 62 px qu'il réservait en haut, ont disparu.
    expect(
      mesure.commandes.map(c => c.nom).filter(n => /Passer/i.test(n)),
      '« Passer » est revenu : la bienvenue n’a qu’une sortie, « Entrer directement → ».',
    ).toEqual([])

    // Garde-fou : un cliquet qui n'examine rien se lit comme une preuve et n'en est pas.
    expect(
      mesure.commandes.length,
      'Aucune commande examinée dans l\'écran de bienvenue — le test ne prouve rien.',
    ).toBeGreaterThanOrEqual(2) // « Faire la visite guidée » et « Entrer directement → »
  })
}
