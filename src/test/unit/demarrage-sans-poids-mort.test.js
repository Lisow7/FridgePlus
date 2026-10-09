import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'

// Ce que le démarrage n'a pas à charger (audit du 2026-10-04, PERF-03, PERF-04,
// PERF-07).
//
// Tout ce qu'atteignent les `import` STATIQUES depuis `src/main.jsx` part dans
// le fichier de démarrage, lu par chaque visiteur avant le premier affichage.
// Mesuré par l'audit : ≈ 120 Ko compressés n'y avaient rien à faire — le
// journal des versions complet (85 Ko) pour afficher « v0.145 », les textes
// légaux (59 Ko) pour un lien, la liste de gros mots de l'écran du premier
// pseudo.
//
// Ce test parcourt le graphe des imports statiques (les `import()` dynamiques
// sont des coupures voulues) et refuse d'y trouver ces modules. Le poids réel,
// dépendances comprises, est tenu par `scripts/verifier-poids-demarrage.mjs`
// sur le build.

const RACINE = resolve(__dirname, '../../..')
const ALIAS = {
  '@shared': 'src/shared',
  '@features': 'src/features',
  '@app': 'src/app',
  '@routes': 'src/routes',
  '@': 'src',
}

function resoudre(depuis, cible) {
  let base
  if (cible.startsWith('.')) base = resolve(dirname(depuis), cible)
  else {
    const alias = Object.keys(ALIAS).sort((a, b) => b.length - a.length)
      .find((a) => cible === a || cible.startsWith(a + '/'))
    if (!alias) return null // paquet de node_modules : hors de ce test
    base = join(RACINE, ALIAS[alias], cible.slice(alias.length))
  }
  for (const essai of [base, `${base}.js`, `${base}.jsx`, join(base, 'index.js'), join(base, 'index.jsx')]) {
    if (existsSync(essai) && !essai.endsWith('/') && /\.(js|jsx)$/.test(essai)) return essai
  }
  return null
}

// Imports statiques : `import … from '…'`, `import '…'`, `export … from '…'`.
const IMPORT_STATIQUE = /(?:^|\n)\s*(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g

function grapheDuDemarrage() {
  const vus = new Set()
  const pile = [join(RACINE, 'src/main.jsx')]
  while (pile.length) {
    const f = pile.pop()
    if (vus.has(f)) continue
    vus.add(f)
    const source = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const m of source.matchAll(IMPORT_STATIQUE)) {
      const suivant = resoudre(f, m[1])
      if (suivant) pile.push(suivant)
    }
  }
  return [...vus].map((f) => f.slice(RACINE.length + 1).replace(/\\/g, '/'))
}

const INTERDITS = [
  ['src/features/changelog/data/changelog.js', 'le journal complet — le badge lit version.js'],
  ['src/features/changelog/data/changelog-i18n.js', 'les traductions du journal'],
  ['src/features/legal/data/legal-content.js', 'les textes légaux — servis par /legal'],
  ['src/features/legal/components/confidentiality-panel.jsx', 'un panneau de la page Compte'],
  ['src/features/auth/pages/choose-username-page.jsx', 'l’écran du premier pseudo (et sa liste de gros mots)'],
  // Entrés par le baril `@features/auth`, que main.jsx importait pour le seul
  // AuthProvider (mesuré le 2026-10-06 : ~4 Ko compressés).
  ['src/shared/ui/mfa-challenge-modal.jsx', 'la modale de défi de la carte « double authentification »'],
  ['src/shared/ui/mfa-enroll-modal.jsx', 'l’activation de la double authentification'],
  ['src/shared/hooks/use-mfa.js', 'l’état MFA de la carte du profil'],
  ['src/features/auth/components/verification-en-deux-etapes.jsx', 'l’écran de la porte, chargé à la demande'],
  // L'écran de bienvenue ne sert qu'au premier passage ; il entraînait la visite
  // guidée et ses textes (2026-10-08 : le démarrage touchait son plafond).
  ['src/features/onboarding/components/welcome-screen.jsx', 'l’écran de bienvenue — premier passage, chargé à la demande'],
  ['src/features/onboarding/components/tour-wizard.jsx', 'la visite guidée — depuis la bienvenue ou /guide'],
  ['src/features/onboarding/i18n/tour-steps-i18n.js', 'les textes de la visite'],
]

describe('le démarrage ne charge pas ce qui ne sert pas au premier affichage', () => {
  const graphe = grapheDuDemarrage()

  it('le parcours trouve bien le démarrage (témoin)', () => {
    expect(graphe).toContain('src/App.jsx')
    expect(graphe).toContain('src/app/layout/footer.jsx')
    expect(graphe.length).toBeGreaterThan(100)
  })

  for (const [module, raison] of INTERDITS) {
    it(`${module} n’est pas dans le démarrage (${raison})`, () => {
      expect(graphe).not.toContain(module)
    })
  }
})
