import { test, expect } from '@playwright/test'

// Aucun contrôle interactif ne doit être rendu INATTEIGNABLE par une surface
// flottante — quel que soit l'état de consentement, quelle que soit la taille.
//
// ── Pourquoi ce fichier existe ────────────────────────────────────────────
// Ce défaut a frappé la production DEUX FOIS en deux jours, et aucun test ne
// l'a vu :
//   • 27/08 — le bandeau cookies (`fixed`, z-index 9998) recouvrait le bouton
//     de l'écran de bienvenue : 81 px masqués en 390×844, 211 px en 360×640,
//     bouton mort au tap.
//   • 28/08 — le même bandeau recouvrait le sélecteur de langue et la bascule
//     de thème du menu (5 points sur 5 bloqués, mesuré sur fridgeplus.app).
//     Un testeur anglophone ne pouvait pas passer l'app en anglais.
//
// 🥇 Ni la revue de code, ni les tests unitaires, ni le cliquet a11y ne
// pouvaient l'attraper : il n'apparaît qu'une fois le CSS appliqué, sur un
// viewport donné, dans un état de montage donné. Seul `elementFromPoint` le
// voit — c'est la seule question qui compte : « si l'utilisateur tape ICI,
// est-ce que MON élément reçoit l'événement ? »
//
// ⛔ Un classement de z-index ne prouve rien. Deux surfaces peuvent avoir des
// z cohérents et se recouvrir quand même : c'est la GÉOMÉTRIE qui décide.
// C'est pourquoi ce test parcourt la MATRICE des états qui coexistent, et non
// la liste des constantes.

const CONSENTEMENT = JSON.stringify({
  version: 1, timestamp: 1, bannerDismissed: true,
  essential: true, functional: false, audience: false, voice: false, receiptScan: false,
})

const TAILLES = [
  { nom: '390x844', width: 390, height: 844 },  // iPhone courant
  { nom: '360x640', width: 360, height: 640 },  // le plus contraint
]

/**
 * Cinq points par contrôle (centre + 4 coins) : un recouvrement partiel est
 * déjà un défaut — l'utilisateur ne vise pas le pixel central.
 */
async function pointsBloques(page, texteOuLabel) {
  return page.evaluate((motif) => {
    const re = new RegExp(motif, 'i')
    const el = [...document.querySelectorAll('button,[role="button"],a')]
      .find(x => re.test((x.textContent || '') + ' ' + (x.getAttribute('aria-label') || '')))
    if (!el) return { trouve: false }
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return { trouve: false }
    const points = [
      [r.left + r.width / 2, r.top + r.height / 2],
      [r.left + 3, r.top + 3], [r.right - 3, r.top + 3],
      [r.left + 3, r.bottom - 3], [r.right - 3, r.bottom - 3],
    ]
    let bloques = 0
    let recouvreur = null
    for (const [x, y] of points) {
      const dessus = document.elementFromPoint(x, y)
      const atteint = dessus && (dessus === el || el.contains(dessus))
      if (!atteint) {
        bloques++
        recouvreur = recouvreur ?? (dessus?.getAttribute('aria-label') || dessus?.className || dessus?.tagName || '?')
      }
    }
    return { trouve: true, bloques, recouvreur: String(recouvreur ?? '').slice(0, 60) }
  }, texteOuLabel)
}

for (const taille of TAILLES) {
  // Les deux états de consentement sont testés : c'est leur DIFFÉRENCE qui a
  // révélé le défaut. Le bandeau n'existe que dans l'un des deux.
  for (const consentement of ['en attente', 'donné']) {
    test(`${taille.nom} · consentement ${consentement} — les contrôles du menu restent atteignables`, async ({ page }) => {
      await page.setViewportSize({ width: taille.width, height: taille.height })
      await page.addInitScript((c) => {
        localStorage.setItem('fridge-welcome-seen-v1', '1')
        localStorage.setItem('fridge-getting-started-v1:guest', JSON.stringify({ dismissed: true }))
        if (c) localStorage.setItem('fridge-consent-v1', c)
      }, consentement === 'donné' ? CONSENTEMENT : null)

      await page.goto('/FridgePlus/')
      await page.waitForLoadState('networkidle')

      await page.getByRole('button', { name: 'Menu' }).click()
      await page.waitForTimeout(600)

      // Le sélecteur de langue est le cas réel du 28/08 : sans lui, un
      // visiteur non francophone n'a aucun moyen de changer de langue.
      let examines = 0
      for (const controle of ['^EN$', '^FR$', 'Mode sombre|Mode clair']) {
        const r = await pointsBloques(page, controle)
        if (!r.trouve) continue // contrôle absent de cette variante : rien à prouver
        examines++
        expect(
          r.bloques,
          `« ${controle} » est recouvert sur ${r.bloques}/5 points par « ${r.recouvreur} » ` +
          `(${taille.nom}, consentement ${consentement}). Une surface flottante masque un contrôle : ` +
          'réserver l\'espace via --fp-bottom-inset plutôt que de jouer sur les z-index.',
        ).toBe(0)
      }

      // 🔴 Sans cette ligne, le test PASSE en n'ayant rien prouvé : que le menu
      // ne s'ouvre pas, que les libellés soient renommés, ou que la page servie
      // ne soit pas l'application, et la boucle ci-dessus fait trois `continue`
      // puis rend la main en vert. C'est le mode d'échec que ce dépôt a déjà
      // documenté ailleurs (« un cliquet ne protège que ce qu'il VISITE ») —
      // et un cliquet qui ne visite rien est pire qu'aucun cliquet, parce qu'il
      // se lit comme une preuve.
      expect(
        examines,
        `Aucun des trois contrôles n'a été trouvé (${taille.nom}, consentement ${consentement}). ` +
        'Le menu ne s\'est pas ouvert, les libellés ont changé, ou la page servie n\'est pas ' +
        'l\'application. Ce test ne prouve rien tant qu\'il n\'en examine pas au moins un.',
      ).toBeGreaterThan(0)
    })
  }

  test(`${taille.nom} — le bandeau cookies réserve son espace au lieu de recouvrir`, async ({ page }) => {
    await page.setViewportSize({ width: taille.width, height: taille.height })
    await page.addInitScript(() => {
      localStorage.setItem('fridge-welcome-seen-v1', '1')
      localStorage.setItem('fridge-getting-started-v1:guest', JSON.stringify({ dismissed: true }))
    })
    await page.goto('/FridgePlus/')
    await page.waitForLoadState('networkidle')

    // Le contrat : tant que le bandeau est affiché, il publie sa hauteur.
    const inset = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--fp-bottom-inset').trim())
    const bandeauVisible = await page.locator('div[role="dialog"][aria-label*="Cookies"]').isVisible()

    if (bandeauVisible) {
      expect(
        inset,
        'Le bandeau cookies est affiché mais ne publie pas sa hauteur : les surfaces ' +
        'du bas ne peuvent pas réserver l\'espace, et elles passeront dessous.',
      ).toMatch(/^\d+px$/)
      expect(parseInt(inset, 10)).toBeGreaterThan(0)
    }
  })
  test(`${taille.nom} — le pied de page n'est recouvert par AUCUNE surface flottante`, async ({ page }) => {
    // Troisième occurrence de la même classe de défaut, mesurée le 2026-09-12
    // sur le build de production : la fusée « Bien démarrer » (`fixed`, z 60)
    // se posait SUR « © 2026 », et la carte coach mordait 21 px sur la bande du
    // pied de page. Remède identique aux deux précédentes : le footer publie sa
    // hauteur (`--fp-footer-height`), les surfaces flottantes la réservent.
    await page.setViewportSize({ width: taille.width, height: taille.height })
    await page.addInitScript(() => {
      localStorage.setItem('fridge-lang', 'fr')
      localStorage.setItem('fridge-consent-v1', JSON.stringify({
        version: 1, essential: true, audience: false, bannerDismissed: true,
        decidedAt: '2026-09-12T00:00:00.000Z',
      }))
      localStorage.setItem('fridge-welcome-seen-v1', '1')
    })
    await page.goto('/FridgePlus/')
    await page.waitForLoadState('networkidle')

    const resultat = await page.evaluate(() => {
      const ft = document.querySelector('footer')
      if (!ft) return { erreur: 'pied de page introuvable' }
      const libelles = [...ft.querySelectorAll('a, button, span')]
        .filter(e => !e.children.length && e.textContent.trim() && e.getBoundingClientRect().width > 2)
      const recouverts = []
      for (const el of libelles) {
        const b = el.getBoundingClientRect()
        // Centre + deux coins : un recouvrement partiel est déjà un défaut.
        for (const [x, y] of [[b.left + b.width / 2, b.top + b.height / 2], [b.left + 2, b.top + 2], [b.right - 2, b.bottom - 2]]) {
          const dessus = document.elementFromPoint(x, y)
          if (dessus && !ft.contains(dessus)) {
            recouverts.push(`« ${el.textContent.trim().slice(0, 28)} » recouvert par ${dessus.tagName.toLowerCase()}`)
            break
          }
        }
      }
      return { examines: libelles.length, recouverts: [...new Set(recouverts)] }
    })

    expect(resultat.erreur, resultat.erreur ?? '').toBeUndefined()
    // Même garde-fou que plus haut : un test qui n'examine rien passe pour rien.
    expect(resultat.examines, 'Aucun libellé de pied de page examiné — le test ne prouve rien.').toBeGreaterThan(2)
    expect(resultat.recouverts, 'Des libellés du pied de page sont recouverts par une surface flottante.').toEqual([])
  })
}

// Le bandeau COOKIES ne recouvre pas le pied de page — consentement EN ATTENTE.
//
// 🔴 Pourquoi ce test manquait, et c'est la leçon : les trois tests ci-dessus
// posent `fridge-consent-v1` dans le `localStorage` pour arriver sur une page
// propre. Le bandeau n'y est donc JAMAIS affiché. Ils gardaient fidèlement le
// pied de page contre la fusée et la carte coach, et laissaient passer la
// surface la plus grande de toutes.
//
// Mesuré le 2026-09-12, avant correctif : à 1400 px le bandeau recouvrait
// « Questions fréquentes », « Aide & Mentions légales » et « Cookies » ; à
// 360 px, des bacs du frigo en plus. Il était posé à `bottom: 16px`, donc
// par-dessus le pied de page. Il se cale désormais sur `--fp-footer-height` :
// c'est la géométrie qui l'en empêche, pas un z-index.
for (const taille of [
  { nom: '2560×1300 (large)', width: 2560, height: 1300 },
  { nom: '1400×900 (portable)', width: 1400, height: 900 },
  { nom: '390×844 (iPhone 14)', width: 390, height: 844 },
  { nom: '360×640 (Android)', width: 360, height: 640 },
]) {
  test(`${taille.nom} — le bandeau cookies ne recouvre pas le pied de page`, async ({ page }) => {
    await page.setViewportSize({ width: taille.width, height: taille.height })
    // ⚠️ On ne pose PAS le consentement : c'est tout l'objet du test.
    await page.addInitScript(() => {
      localStorage.setItem('fridge-lang', 'fr')
      localStorage.setItem('fridge-welcome-seen-v1', '1')
    })
    await page.goto('/FridgePlus/')
    await page.waitForLoadState('networkidle')

    const bandeau = page.locator('div[role="dialog"][aria-label*="Cookies"]')
    await expect(
      bandeau,
      'Le bandeau cookies ne s’affiche pas : sans lui ce test ne prouve rien.',
    ).toBeVisible()

    const resultat = await page.evaluate(() => {
      const b = document.querySelector('div[role="dialog"][aria-label*="Cookies"]')
      const ft = document.querySelector('footer')
      if (!ft) return { erreur: 'pied de page introuvable' }
      const libelles = [...ft.querySelectorAll('a, button, span')]
        .filter(e => !e.children.length && e.textContent.trim() && e.getBoundingClientRect().width > 2)
      const recouverts = []
      for (const el of libelles) {
        const r = el.getBoundingClientRect()
        for (const [x, y] of [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 2, r.top + 2], [r.right - 2, r.bottom - 2]]) {
          const dessus = document.elementFromPoint(x, y)
          if (dessus && b.contains(dessus)) {
            recouverts.push(`« ${el.textContent.trim().slice(0, 28)} »`)
            break
          }
        }
      }
      const cb = b.getBoundingClientRect()
      const cf = ft.getBoundingClientRect()
      return {
        examines: libelles.length,
        recouverts: [...new Set(recouverts)],
        // La bande doit s'arrêter là où le pied de page commence.
        basBandeau: Math.round(cb.bottom),
        hautFooter: Math.round(cf.top),
        pleineLargeur: Math.round(cb.width) >= window.innerWidth - 1,
      }
    })

    expect(resultat.erreur, resultat.erreur ?? '').toBeUndefined()
    expect(resultat.examines, 'Aucun libellé de pied de page examiné — le test ne prouve rien.').toBeGreaterThan(2)
    expect(
      resultat.recouverts,
      'Le bandeau cookies recouvre des libellés du pied de page. Il doit se caler ' +
      'AU-DESSUS de lui (`bottom: var(--fp-footer-height)`), pas flotter par-dessus.',
    ).toEqual([])
    expect(
      resultat.basBandeau,
      `Le bas du bandeau est à ${resultat.basBandeau}px et le pied de page commence à ` +
      `${resultat.hautFooter}px : la bande ne se cale pas sur lui.`,
    ).toBeLessThanOrEqual(resultat.hautFooter + 1)
    expect(resultat.pleineLargeur, 'La bande doit courir d’un bord à l’autre.').toBe(true)
  })
}

// …et pas seulement sur l'accueil. Le bandeau est GLOBAL : il s'affiche aussi sur
// les pages de contenu, qui DÉFILENT — et `position:fixed; bottom:var(--fp-footer-height)`
// ne tombe juste que si le pied de page est réellement au bas de la fenêtre.
// Le test ci-dessus ne visitait que `/`, et ce fichier écrit lui-même qu'« un
// cliquet ne protège que ce qu'il visite ». Celui-ci balaie les pages publiques.
test('le bandeau cookies se cale sur le pied de page de TOUTES les pages publiques', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.addInitScript(() => {
    localStorage.setItem('fridge-lang', 'fr')
    localStorage.setItem('fridge-welcome-seen-v1', '1')
  })

  const fautives = []
  const PAGES = ['/FridgePlus/', '/FridgePlus/faq', '/FridgePlus/guide', '/FridgePlus/legal', '/FridgePlus/changelog', '/FridgePlus/community']
  for (const chemin of PAGES) {
    await page.goto(chemin)
    await page.waitForLoadState('networkidle')
    const r = await page.evaluate(() => {
      const b = document.querySelector('div[role="dialog"][aria-label*="Cookies"]')
      const ft = document.querySelector('footer')
      if (!b) return { absent: true }
      if (!ft) return { sansFooter: true }
      return {
        ecart: Math.round(ft.getBoundingClientRect().top) - Math.round(b.getBoundingClientRect().bottom),
      }
    })
    if (r.absent) { fautives.push(`${chemin} : bandeau absent`); continue }
    if (r.sansFooter) { fautives.push(`${chemin} : pas de pied de page`); continue }
    if (Math.abs(r.ecart) > 1) fautives.push(`${chemin} : ${r.ecart}px d'écart entre le bas de la bande et le pied de page`)
  }

  expect(
    fautives,
    'La bande ne se cale pas sur le pied de page partout. Sur une page qui défile, ' +
    'un pied de page qui n’est pas au bas de la fenêtre laisserait la bande flotter ' +
    'au milieu — ou par-dessus lui.',
  ).toEqual([])
})

// ── Un titre ne DÉBORDE pas de la place qu'on lui donne ───────────────────
// Trouvé le 2026-09-12 par le cliquet a11y, le jour où il s'est mis à balayer
// aussi une largeur mobile : sur `/community` en 390 px, « COMMUNAUTÉ » sortait
// de son conteneur et se posait SOUS les boutons et sous « Connecte-toi pour
// publier ». Le conteneur avait pourtant bien rétréci (87 px) — mais un
// `inline-block` ne descend jamais sous la largeur de son contenu, et le titre
// gardait ses 168 px.
//
// 🔴 Pourquoi ce test EN PLUS du cliquet a11y, qui l'a déjà attrapé : axe ne
// voit ce défaut que sous LINUX. Il ne signale `color-contrast` que sur du
// texte, et sous Windows le titre n'empiétait que d'1 px sur le texte voisin —
// assez pour recouvrir les boutons, pas assez pour qu'axe s'en plaigne. Le
// mainteneur poussait donc du vert et découvrait le rouge en CI. Une mesure de
// GÉOMÉTRIE, elle, voit les 73 px de recouvrement sur les deux systèmes.
//
// 🥇 Le seuil n'est pas un nombre écrit ici : on compare le titre à SON PROPRE
// conteneur et au bloc de commandes. Changer la police, la langue ou la taille
// de l'écran ne périme rien.
test('le titre de /community ne déborde pas de son conteneur en 390 px', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fridge-lang', 'fr')
    localStorage.setItem('fridge-welcome-seen-v1', '1')
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/FridgePlus/community')
  await page.waitForLoadState('networkidle')

  const mesure = await page.evaluate(() => {
    const h1 = document.querySelector('h1')
    if (!h1) return null
    const rangee = h1.parentElement.parentElement
    const bord = (e) => { const b = e.getBoundingClientRect(); return { gauche: Math.round(b.left), droite: Math.round(b.right) } }
    return {
      titre: { ...bord(h1), texte: h1.textContent },
      conteneur: bord(h1.parentElement),
      commandes: bord(rangee.lastElementChild),
    }
  })
  expect(mesure, 'aucun <h1> sur /community').not.toBeNull()

  // 1. Le titre reste DANS son conteneur. C'est la garantie structurelle : elle
  //    tient quel que soit ce qu'on ajoute à droite.
  expect(
    mesure.titre.droite,
    `« ${mesure.titre.texte} » déborde de ${mesure.titre.droite - mesure.conteneur.droite} px ` +
    'hors de son conteneur : il va se poser sur ce qui suit.',
  ).toBeLessThanOrEqual(mesure.conteneur.droite)

  // 2. Et il ne touche pas le bloc de commandes — la conséquence visible.
  expect(
    mesure.titre.droite,
    `Le titre recouvre les commandes de ${mesure.titre.droite - mesure.commandes.gauche} px.`,
  ).toBeLessThanOrEqual(mesure.commandes.gauche)
})
