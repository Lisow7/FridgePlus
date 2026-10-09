import { test, expect } from '@playwright/test'

// La visite guidée reste NAVIGABLE sur un petit écran.
//
// ── Le défaut ────────────────────────────────────────────────────────────
// Mesuré le 2026-09-12 sur le build de production, en 360×640 (un écran
// Android d'entrée de gamme, toujours courant) : à l'étape « Remplis ton
// frigo » — trois façons de remplir depuis la veille — le bouton « Suivant »
// tombait à 685 px de haut pour un écran de 640. Playwright ne pouvait même
// pas cliquer dessus : « element is outside of the viewport ». La carte n'a
// aucun défilement : le contenu chasse simplement la navigation hors de l'écran,
// et la visite devient un cul-de-sac — sur le premier écran d'un nouveau.
//
// 🥇 Même doctrine que le bandeau cookies du 28/08 : quand un contenu peut
// grandir, on ne laisse pas la place des commandes au hasard. Ici le contenu
// défile et la navigation reste posée en bas.
//
// ⚠️ Ce test ne peut PAS être unitaire : jsdom ne calcule aucune hauteur. Seul
// un vrai navigateur mesure une mise en page.
test.use({ viewport: { width: 360, height: 640 } })

test('les cinq étapes de la visite restent cliquables en 360×640', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fridge-lang', 'fr')
    localStorage.setItem('fridge-consent-v1', JSON.stringify({
      version: 2, essential: true, errors: false, usage: false, bannerDismissed: true,
      decidedAt: '2026-09-12T00:00:00.000Z',
    }))
  })
  // ⚠️ Le serveur de dev sert l'app sous `/FridgePlus/` (héritage GitHub Pages) —
  // même préfixe que dans `a11y.spec.js`.
  await page.goto('/FridgePlus/guide')
  await page.getByRole('button', { name: /Lancer la visite guidée/ }).click()

  const dialogue = page.getByRole('dialog')
  await expect(dialogue).toBeVisible()

  for (let etape = 1; etape <= 5; etape++) {
    await expect(page.getByText(`ÉTAPE ${etape} / 5`)).toBeVisible()

    // La commande qui fait avancer doit être DANS l'écran, pas seulement dans le DOM.
    const suivant = etape < 5
      ? page.getByRole('button', { name: /Suivant/ })
      : page.getByRole('button', { name: /Créer un compte/ })
    const cadre = await suivant.boundingBox()
    expect(cadre, `étape ${etape} : commande introuvable`).not.toBeNull()
    expect(
      Math.round(cadre.y + cadre.height),
      `étape ${etape} : la commande déborde sous l'écran`,
    ).toBeLessThanOrEqual(640)

    // Le bouton « Astuce(s) », quand il existe, doit l'être aussi.
    const astuces = page.getByRole('button', { name: /Astuce/ })
    if (await astuces.count()) {
      const c = await astuces.first().boundingBox()
      expect(Math.round(c.y + c.height), `étape ${etape} : « Astuces » déborde`).toBeLessThanOrEqual(640)
    }

    if (etape < 5) await suivant.click()
  }
})

// Les cinq panneaux ont la MÊME taille, la commande est TOUJOURS au même endroit,
// et AUCUNE barre de défilement n'apparaît.
//
// ── Pourquoi ce test existe ───────────────────────────────────────────────
// Le 2026-09-12, pour empêcher « Suivant » de tomber sous l'écran, on avait
// rendu la zone de contenu défilante. Le remède était pire que le mal, et
// l'utilisateur l'a vu tout de suite : une barre native BLANCHE sur une carte
// brun foncé, et à l'étape 3 le titre « Vérifier ce que tu as » COUPÉ EN HAUT
// parce que la zone était défilée.
//
// La mesure a tranché : l'étape la plus haute (« Remplis ton frigo », trois
// options) réclame 586 px en 360 px de large. La carte était bloquée à 408 px
// par un `minHeight` écrit en dur. 586 px TIENT dans un écran de 640. La barre
// ne compensait donc pas un manque de place — elle compensait une carte trop
// petite.
//
// 🥇 La carte se règle désormais sur l'étape la plus haute, TOUTE SEULE : un
// gabarit invisible empile les cinq contenus dans la même cellule de grille, et
// la hauteur de la grille est celle du plus grand. Ajouter une astuce ou une
// option fait grandir les cinq panneaux ensemble — aucun nombre à tenir à jour,
// donc aucun nombre qui puisse mentir.
for (const taille of [
  // 320 px : le pire cas, et celui qui a démasqué le défaut de la rangée de
  // navigation. Le gabarit n'impose la hauteur que du CONTENU ; la navigation
  // vit en dehors, et à l'étape finale son libellé change (« Créer un compte »
  // au lieu de « Suivant »). Assez large, il écrase « ‹ Précédent » qui passe
  // alors à la ligne : +10 px sur cette seule étape. Invisible sur le poste du
  // mainteneur, reproduit trois fois de suite par la CI — les polices de Linux
  // ne mesurent pas comme celles de Windows.
  // ⚠️ `barreToleree` : à 320×568, l'étape la plus haute réclame 586 px et
  // l'écran n'en offre que 544 une fois les marges retirées. Aucune mise en page
  // ne fait tenir 586 dans 544 : le défilement de repli EST le bon comportement
  // là, et exiger son absence serait exiger l'impossible. Ce qui doit tenir
  // quand même, et que ce test vérifie : les panneaux restent de taille égale,
  // la commande reste au même endroit, et elle reste dans l'écran.
  { nom: '320×568 (iPhone SE — le pire cas)', width: 320, height: 568, barreToleree: true },
  { nom: '360×640 (Android d’entrée de gamme)', width: 360, height: 640 },
  { nom: '390×844 (iPhone 14)', width: 390, height: 844 },
  { nom: '1280×900 (bureau)', width: 1280, height: 900 },
]) {
  const titre = taille.barreToleree
    ? `${taille.nom} — les cinq panneaux gardent la même taille, repli de défilement compris`
    : `${taille.nom} — les cinq panneaux ont la même taille, sans barre de défilement`
  test(titre, async ({ page }) => {
    await page.setViewportSize({ width: taille.width, height: taille.height })
    await page.addInitScript(() => {
      localStorage.setItem('fridge-lang', 'fr')
      localStorage.setItem('fridge-consent-v1', JSON.stringify({
        version: 2, essential: true, errors: false, usage: false, bannerDismissed: true,
        decidedAt: '2026-09-12T00:00:00.000Z',
      }))
      localStorage.setItem('fridge-welcome-seen-v1', '1')
    })
    await page.goto('/FridgePlus/guide')
    await page.getByRole('button', { name: /Lancer la visite guidée/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    const releves = []
    for (let etape = 1; etape <= 5; etape++) {
      await expect(page.getByText(`ÉTAPE ${etape} / 5`)).toBeVisible()
      const commande = etape < 5
        ? page.getByRole('button', { name: /Suivant/ })
        : page.getByRole('button', { name: /Créer un compte/ })
      const cadre = await commande.boundingBox()
      expect(cadre, `étape ${etape} : commande introuvable`).not.toBeNull()

      // ⚠️ On mesure la MISE EN PAGE (`offsetHeight` / `offsetTop`), pas la
      //    géométrie à l'écran. L'animation d'ouverture de la carte porte un
      //    `scale(.96)` : un `getBoundingClientRect()` pris pendant ces 280 ms
      //    rend une carte de 576 px là où la mise en page en fait 586 — un écart
      //    qui n'existe que dans la transformation, jamais dans la structure.
      //    Ces deux propriétés-là sont insensibles aux transformations.
      const carte = await page.evaluate(() => {
        const c = document.querySelector('.tw-flip-in')
        const z = document.querySelector('.tw-face.front .tw-zone')
        const b = document.querySelector('.tw-face.front .tw-next')
        return {
          hauteur: c.offsetHeight,
          // `offsetTop` du bouton dans la carte : c'est « toujours au même endroit ».
          hautCommande: b ? b.offsetTop : null,
          // Un débordement de plus d'1 px signifie une barre de défilement.
          deborde: z ? z.scrollHeight - z.clientHeight : 0,
        }
      })
      expect(carte.hautCommande, `étape ${etape} : commande introuvable dans la carte`).not.toBeNull()
      releves.push({ etape, hautCommande: carte.hautCommande, hauteurCarte: carte.hauteur, deborde: carte.deborde, ecran: Math.round(cadre.y + cadre.height) })

      if (etape < 5) await commande.click()
    }

    // 1. AUCUNE barre de défilement. C'est la demande, et c'est ce qui coupait
    //    le titre de l'étape 3.
    const qui_defile = releves.filter(r => r.deborde > 1)
    if (!taille.barreToleree) {
      expect(
        qui_defile.map(r => `étape ${r.etape} déborde de ${r.deborde}px`),
        'Une zone de contenu déborde : une barre de défilement apparaît, et le haut ' +
        'du contenu — le titre de l’étape — se retrouve coupé.',
      ).toEqual([])
    } else {
      // Là où le repli est légitime, il doit rester UNIFORME : si une seule étape
      // défilait, les panneaux ne seraient plus de la même taille — et on serait
      // revenu au défaut d'origine.
      expect(
        [...new Set(releves.map(r => r.deborde > 1))],
        `Le défilement de repli ne s'applique pas à toutes les étapes : ${releves.map(r => `${r.etape}→${r.deborde}px`).join(', ')}.`,
      ).toHaveLength(1)
    }

    // 2. Les cinq panneaux font la MÊME hauteur.
    const hauteurs = [...new Set(releves.map(r => r.hauteurCarte))]
    expect(
      hauteurs,
      `Les panneaux changent de taille d’une étape à l’autre : ${releves.map(r => `${r.etape}→${r.hauteurCarte}px`).join(', ')}. ` +
      'La carte doit se régler sur l’étape la plus haute, pour les cinq.',
    ).toHaveLength(1)

    // 3. La commande est TOUJOURS au même endroit — c'est ce qu'on voit bouger.
    const positions = [...new Set(releves.map(r => r.hautCommande))]
    expect(
      positions,
      `La commande saute d’une étape à l’autre : ${releves.map(r => `${r.etape}→${r.hautCommande}px`).join(', ')}.`,
    ).toHaveLength(1)

    // 4. Et elle reste dans l'écran — la garantie d'origine, qui ne bouge pas.
    for (const r of releves) {
      expect(r.ecran, `étape ${r.etape} : commande hors écran`).toBeLessThanOrEqual(taille.height)
    }
  })
}
