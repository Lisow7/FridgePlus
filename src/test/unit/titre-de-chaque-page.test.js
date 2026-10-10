import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { titreDeRoute, laPagePoseSonTitre } from '@shared/lib/route-title'
import { ROUTES } from '@routes/routes-config'

// Chaque page principale doit annoncer son titre.
//
// ── Pourquoi ce test existe ───────────────────────────────────────────────
// Balayage des routes au navigateur, le 2026-08-21 : sur neuf routes,
// **trois** affichaient encore « Fridge+ — Gérez votre frigo… » dans l'onglet
// (`/community`, `/profile`, `/cart`). Le pré-rendu ne suffit pas côté
// navigateur — le service worker sert la coquille en cache, et en navigation
// interne aucun HTML n'est rechargé.
//
// Rien ne le signalait : ce n'est ni une erreur, ni un test rouge, juste un
// onglet qui ne dit pas où l'on est. C'est le profil même du défaut qui dure.
//
// ── Pourquoi un test plutôt qu'un poseur central ──────────────────────────
// Un composant unique qui poserait le titre pour toutes les routes aurait été
// plus court, mais il entrerait en concurrence avec `/recipe/:id`, dont le
// titre est le nom du plat. Le gagnant dépendrait de l'ordre des effets entre
// parent et enfant — une dépendance que ce dépôt a déjà payée.
//
// 🥇 **Le garde-fou remplace la centralisation** : chaque page appelle le
// helper explicitement, et ce test refuse celle qui l'oublierait.

// Les routes dont la PAGE doit poser un titre fixe, avec le fichier qui la rend.
// `/recipe/:id` en est absente à dessein : son titre est dynamique (le nom du
// plat) et vient de `recipe-page.jsx`, couvert par `titre-onglet-recette.test.js`.
const PAGES = [
  ['/faq', 'src/features/legal/pages/faq-page.jsx'],
  ['/guide', 'src/features/onboarding/pages/guide-page.jsx'],
  ['/legal', 'src/features/legal/pages/legal-page.jsx'],
  ['/changelog', 'src/features/changelog/pages/changelog-page.jsx'],
  ['/community', 'src/features/community/pages/community-page-route.jsx'],
  ['/profile', 'src/features/profile/pages/profile-page.jsx'],
  ['/cart', 'src/features/cart/pages/cart-page.jsx'],
  ['/login', 'src/features/auth/pages/login-page.jsx'],
  ['/signup', 'src/features/auth/pages/signup-page.jsx'],
  ['/auth/recovery', 'src/features/auth/pages/recovery-page.jsx'],
  ['/cook/:recipeId', 'src/features/cooking-mode/components/cooking-mode-page.jsx'],
]

const source = (chemin) => readFileSync(resolve(process.cwd(), chemin), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

describe('chaque page principale annonce son titre', () => {
  it('toutes les pages listées existent', () => {
    const manquantes = PAGES.filter(([, f]) => !existsSync(resolve(process.cwd(), f)))
    expect(manquantes.map(([r]) => r)).toEqual([])
  })

  it('chacune appelle useDocumentTitle', () => {
    // 🔴 Chercher l'APPEL, parenthèse comprise : sans elle, la simple
    // ligne d'import suffisait à satisfaire le test. Vérifié par mutation le
    // 2026-08-21 — la première version restait verte alors que /community
    // n'appelait plus rien. Deuxième fois de la soirée que ce piège se referme.
    const sansTitre = PAGES.filter(([, f]) => !source(f).includes('useDocumentTitle('))
    expect(sansTitre.map(([r]) => r)).toEqual([])
  })

  it('chaque route couverte déclare bien un libellé dans les deux langues', () => {
    // Le titre est construit depuis `label` : une route sans libellé rendrait
    // une chaîne vide, et `useDocumentTitle` ne poserait rien — l'onglet
    // resterait générique, sans que rien ne casse.
    const incompletes = PAGES.filter(([chemin]) => {
      const route = ROUTES.find(r => r.path === chemin)
      return !route?.label?.fr || !route?.label?.en
    })
    expect(incompletes.map(([r]) => r)).toEqual([])
  })
})

describe('titreDeRoute', () => {
  it('construit le titre depuis le libellé de la route', () => {
    expect(titreDeRoute('/community', 'fr')).toBe('Communauté — Fridge+')
    expect(titreDeRoute('/cart', 'en')).toBe('My cart — Fridge+')
  })

  it('retombe sur le français pour une langue sans libellé', () => {
    // es/de/ja n'ont pas de libellé de route : mieux vaut un titre français
    // qu'un onglet générique.
    expect(titreDeRoute('/profile', 'ja')).toBe('Mon profil — Fridge+')
  })

  it('rend une chaîne VIDE pour une route inconnue', () => {
    // Et non `undefined — Fridge+`. `useDocumentTitle` ne pose rien sur une
    // valeur vide : le titre du HTML servi reste en place, ce qui est le bon
    // repli.
    expect(titreDeRoute('/route-qui-nexiste-pas', 'fr')).toBe('')
  })

  it('utilise le même suffixe que les pages pré-rendues', () => {
    // Un onglet doit se lire pareil qu'on arrive par un lien externe (HTML
    // servi) ou par une navigation interne (ce helper).
    expect(titreDeRoute('/faq', 'fr')).toMatch(/ — Fridge\+$/)
  })
})

describe('useSeoMeta s’abstient là où la page pose son titre', () => {
  // 🔴 Le contrat qui a demandé une MESURE pour être compris.
  //
  // `useSeoMeta` vit dans `App` (parent), `useDocumentTitle` dans la page
  // (enfant). Les effets enfants s'exécutent AVANT ceux du parent : sur une
  // route qui redirige (`/profile` → `/profile/identite`), le parent reposait
  // le titre générique en dernier et gagnait toujours.
  //
  // 🥇 Une première correction par les dépendances de l'effet a échoué — elle
  // ne pouvait pas réussir. **L'ordre des effets se mesure, il ne se raisonne
  // pas.**

  it('reconnaît les routes dont la page pose son titre', () => {
    for (const chemin of ['/faq', '/guide', '/legal', '/changelog', '/community', '/profile', '/cart']) {
      expect(laPagePoseSonTitre(chemin), chemin).toBe(true)
    }
  })

  it('couvre les SOUS-routes, pas seulement le préfixe exact', () => {
    // C'est tout l'enjeu : `/profile` redirige vers `/profile/identite`, et
    // c'est le layout `/profile` qui pose le titre pour ses sous-routes.
    expect(laPagePoseSonTitre('/profile/identite')).toBe(true)
    expect(laPagePoseSonTitre('/profile/preferences')).toBe(true)
    expect(laPagePoseSonTitre('/recipe/carbonara')).toBe(true)
  })

  it('laisse l’accueil au titre générique', () => {
    // L'accueil n'a pas de titre propre : `useSeoMeta` doit continuer d'y
    // Seul l'accueil garde le titre générique : toutes les autres routes
    // posent désormais le leur, /login et /signup compris.
    expect(laPagePoseSonTitre('/une-route-inconnue')).toBe(false)
  })

  it('ne se laisse pas piéger par un préfixe qui n’en est pas un', () => {
    // `/cartes` commence par `/cart` sans être une sous-route.
    expect(laPagePoseSonTitre('/cartes')).toBe(false)
    expect(laPagePoseSonTitre('/faquette')).toBe(false)
  })

  it('résiste à une valeur absente', () => {
    expect(laPagePoseSonTitre(undefined)).toBe(false)
    expect(laPagePoseSonTitre(null)).toBe(false)
  })

  it('est réellement BRANCHÉ dans useSeoMeta', () => {
    // Une règle juste que personne n'appelle ne protège rien — et ce test-ci
    // s'est déjà fait piéger deux fois aujourd'hui : on cherche l'APPEL.
    const source = readFileSync(resolve(process.cwd(), 'src/shared/hooks/use-seo-meta.js'), 'utf8')
      .replace(/^\s*\/\/.*$/gm, '')
    expect(source).toContain('laPagePoseSonTitre(pathname)')
    expect(source).toMatch(/if \(!laPagePoseSonTitre\(pathname\)\) document\.title/)
  })
})
