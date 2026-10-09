import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, sep } from 'node:path'

// Tout chemin de dépôt cité dans la documentation VIVANTE doit exister.
//
// ── Pourquoi ce garde-fou ────────────────────────────────────────────────
// Un document de monitoring a passé presque quatre mois à envoyer le lecteur vers
// `src/lib/sentry.js` et `src/components/error/ErrorBoundary.jsx` — deux
// chemins effacés par la migration par couches → par fonctionnalités. Sur un
// document de monitoring, ce n'est pas anodin : le 2026-08-26, une alerte
// « Sentry mort en prod » s'est révélée fausse, et une doc qui envoie chercher
// le câblage à un endroit inexistant ne peut qu'allonger ce genre de
// diagnostic. Un document de livraison pointait, lui, vers deux spécifications
// jamais fusionnées dans `dev`.
//
// C'est la même leçon que le plafond de lint (lot 9) : **un document ne se
// vérifie pas tout seul**. Une note « penser à mettre à jour les chemins » ne
// bloque rien ; ce test, si.
//
// ── Ce qui n'est PAS vérifié, et pourquoi ────────────────────────────────
// Les plans et spécifications ARCHIVÉS décrivent l'état de leur époque : leurs
// chemins périmés sont un fait historique, pas une dérive. Idem pour un audit
// qui s'annonce lui-même comme historique. Les corriger reviendrait à réécrire
// le passé.
//
// ⚠️ La mesure brute sur-signale, largement : le premier passage a rendu 150
// références « cassées », dont 140 dans les archives, et sur les 10 restantes
// SEPT étaient délibérées — un ADR qui nomme un script pour dire qu'il est
// obsolète, une roadmap qui cite un fichier pour dire qu'il n'a jamais existé.
// D'où la liste ci-dessous, où chaque exception porte sa raison.

const RACINE_DOCS = 'docs'
const FICHIERS_RACINE = ['CONTRIBUTING.md', 'README.md', 'SECURITY.md']

// Documents exclus : ils décrivent un état passé, par construction.
const DOSSIERS_EXCLUS = /\/archive\//

// Fichiers ABSENTS DU DÉPÔT PAR CONSTRUCTION : `.gitignore` les exclut, mais ils
// existent sur la machine du développeur. Les citer n'est pas une dérive : c'est
// le seul moyen d'y envoyer le lecteur.
//
// ⚠️ Liste SÉPARÉE d'EXCEPTIONS, et pas par coquetterie : un chemin ignoré est
// PRÉSENT en local et ABSENT en intégration continue. Le ranger dans EXCEPTIONS
// ferait passer la CI et échouer la troisième vérification sur la machine du
// développeur — un test qui n'échoue qu'ailleurs est pire qu'aucun test. D'où
// l'exclusion des DEUX vérifications, et la quatrième plus bas qui exige que
// `.gitignore` confirme chaque entrée.
const NON_VERSIONNES = new Map([
  ['supabase/SCHEMA.md',
   'Export du schéma de la base, régénéré en local et volontairement ignoré : il '
   + 'porte la forme de la base de production. Six documents de sauvegarde et de '
   + 'restauration y renvoient, et le disent gitignored à côté du lien.'],
])

// Références délibérées vers quelque chose qui n'existe pas. Chacune doit
// porter sa raison — sans quoi cette liste devient un tapis sous lequel on
// balaie les vraies dérives.
const EXCEPTIONS = new Map([
  ['scripts/migrate-to-db.mjs',
   'ADR 0004 le nomme précisément pour dire qu\'il est OBSOLÈTE.'],
  ['src/shared/lib/ai/budget-guard.js',
   'Le chantier budget-IA décrit l\'état AU MOMENT du diagnostic ; il enregistre '
   + 'vingt lignes plus bas le portage vers supabase/functions/_shared/budget-guard.ts.'],
])

function documentsVivants() {
  const out = []
  const parcourir = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      const norm = p.split(sep).join('/')
      if (e.isDirectory()) {
        if (!DOSSIERS_EXCLUS.test(norm)) parcourir(p)
      } else if (e.name.endsWith('.md')) out.push(norm)
    }
  }
  parcourir(RACINE_DOCS)
  for (const f of FICHIERS_RACINE) if (existsSync(f)) out.push(f)
  return out
}

// Un chemin de dépôt commence par l'un de ces dossiers.
const RACINES = ['src/', 'scripts/', 'supabase/', 'e2e/', 'public/', 'docs/', '.github/', 'api/']

function referencesCassees() {
  const cassees = []
  for (const doc of documentsVivants()) {
    const lignes = readFileSync(doc, 'utf8').split('\n')
    lignes.forEach((ligne, i) => {
      for (const m of ligne.matchAll(/`([^`\s]+?\.(?:jsx?|mjs|ts|tsx|sql|json|css|md|yml|yaml))`/g)) {
        const ref = m[1].replace(/^\.\//, '')
        if (!RACINES.some(r => ref.startsWith(r))) continue
        if (/[*<>{}]/.test(ref)) continue          // gabarits et jokers
        if (EXCEPTIONS.has(ref) || NON_VERSIONNES.has(ref)) continue
        if (!existsSync(ref)) cassees.push(`${doc}:${i + 1} → ${ref}`)
      }
    })
  }
  return [...new Set(cassees)]
}

describe('Documentation — les chemins cités doivent exister', () => {
  it('aucun document vivant ne renvoie vers un fichier disparu', () => {
    expect(
      referencesCassees(),
      'Ces documents envoient le lecteur vers des fichiers qui n\'existent pas. '
      + 'Soit le chemin a changé (le corriger), soit la référence est délibérée '
      + '(l\'ajouter à EXCEPTIONS ci-dessus AVEC sa raison).',
    ).toEqual([])
  })

  it('aucun `npm run` cité ne désigne un script absent', () => {
    const scripts = new Set(Object.keys(JSON.parse(readFileSync('package.json', 'utf8')).scripts ?? {}))
    const inconnus = []
    for (const doc of documentsVivants()) {
      readFileSync(doc, 'utf8').split('\n').forEach((ligne, i) => {
        for (const m of ligne.matchAll(/npm run ([a-z0-9:_-]+)/g)) {
          if (!scripts.has(m[1])) inconnus.push(`${doc}:${i + 1} → npm run ${m[1]}`)
        }
      })
    }
    expect([...new Set(inconnus)]).toEqual([])
  })

  it('la liste d\'exceptions ne garde pas de références devenues valides', () => {
    // Symétrique de la règle (3) du cliquet de taille des composants : une
    // dérogation qui ne sert plus doit sortir, sinon la liste ment.
    // NON_VERSIONNES est hors sujet ici : ces chemins EXISTENT en local, c'est
    // leur nature même. Les inclure ferait échouer ce test sur toute machine de
    // développement tout en le laissant vert en intégration continue.
    const perimees = [...EXCEPTIONS.keys()].filter(ref => existsSync(ref))
    expect(
      perimees,
      'Ces chemins existent désormais : retirer leur exception, elle masque '
      + 'maintenant une vraie vérification.',
    ).toEqual([])
  })

  it('chaque chemin dit non versionné est bien exclu par .gitignore', () => {
    // Sans cette vérification, NON_VERSIONNES deviendrait le tapis qu'EXCEPTIONS
    // refuse d'être : il suffirait d'y écrire n'importe quel chemin mort.
    // Comparaison ligne à ligne et À L'IDENTIQUE : un motif (`*.md`, une règle de
    // dossier) ne serait pas reconnu et ce test échouerait. C'est voulu — mieux
    // vaut relire la règle d'exclusion que la deviner.
    const regles = new Set(
      readFileSync('.gitignore', 'utf8')
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#')),
    )
    const nonConfirmes = [...NON_VERSIONNES.keys()].filter(ref => !regles.has(ref))
    expect(
      nonConfirmes,
      'Ces chemins sont déclarés non versionnés mais aucune ligne de .gitignore '
      + 'ne les exclut à l\'identique : soit la règle a changé, soit le chemin est '
      + 'simplement mort et n\'a rien à faire dans NON_VERSIONNES.',
    ).toEqual([])
  })
})
