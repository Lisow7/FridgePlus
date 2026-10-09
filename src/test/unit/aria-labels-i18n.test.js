// Garde-fou : aucun `aria-label` en dur dans le code vu par les utilisateurs.
//
// Généralise le test introduit sur la feature recettes le 2026-07-27, après y
// avoir trouvé 13 libellés écrits en dur mêlant les deux langues — un anglophone
// s'entendait annoncer « Moins de portions », un francophone « Close ».
//
// Ces libellés ne se VOIENT pas : seuls les lecteurs d'écran les restituent.
// Ni relecture visuelle, ni test de rendu, ni QA manuelle ne les rattrapent.
// D'où ce test structurel, qui les attrape à l'écriture.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RACINE = join(process.cwd(), 'src')

// Attributs porteurs de texte destiné à l'utilisateur. `aria-label` et `alt`
// sont lus par les lecteurs d'écran ; `title` s'affiche au survol ;
// `placeholder` est visible en permanence.
//
// Élargi le 2026-07-28 après un cas révélateur : `recipe-panel.jsx` portait
// `title="Fermer"` juste AU-DESSUS d'un `aria-label={t.closeLabel}` corrigé la
// veille. Un garde-fou limité à `aria-label` avait donc traduit une ligne et
// laissé sa voisine — d'où la couverture de la classe entière.
//
// Les formes dynamiques — title={t.xxx} — ne matchent pas : c'est le but.
//
// La valeur doit contenir au moins DEUX lettres consécutives pour compter comme
// un libellé traduisible. Sans ce garde, on signalerait `placeholder="0"` et
// `placeholder = '–'` : un chiffre et un tiret typographique n'ont rien à
// traduire, et le second n'est même pas du JSX (c'est une valeur par défaut de
// paramètre). Exiger des lettres évite ces deux faux positifs sans affaiblir la
// détection des vrais libellés.
const ARIA_LITTERAL = /(?:aria-label|title|alt|placeholder)\s*=\s*["'][^"'{}]*\p{L}{2}[^"'{}]*["']/u

// Exclusions ASSUMÉES, avec leur raison. Toute nouvelle exclusion doit venir
// avec la sienne — une exclusion silencieuse vide ce test de son sens.
const EXCLUS = [
  // Panneau d'administration : un seul utilisateur (admin@fridgeplus.app),
  // francophone. Traduire ses libellés serait du travail sans bénéficiaire.
  'src/features/admin/',
]
// `src/shared/ui/` était exclu tant que ces composants génériques n'avaient pas
// accès à la langue. Tranché le 2026-07-27 : ils appellent `useLang()`, comme le
// faisait déjà `confirm-provider.jsx` dans ce même dossier. `UIProvider` englobe
// toute l'application depuis `main.jsx`, donc l'accès est garanti au runtime.
// L'exclusion est levée.

function fichiersSource(dossier) {
  const out = []
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree)
    if (statSync(chemin).isDirectory()) { out.push(...fichiersSource(chemin)); continue }
    if (/\.(jsx?|tsx?)$/.test(entree) && !/\.test\./.test(entree)) out.push(chemin)
  }
  return out
}

function estExclu(cheminNormalise) {
  return EXCLUS.some(prefixe => cheminNormalise.includes(prefixe))
}

// Les commentaires d'exemple (`// <Button aria-label="Fermer">`) ne sont pas du
// code : les compter rendrait le test impossible à satisfaire sans mutiler de
// la documentation. Piège rencontré dans les deux sens sur ce dépôt — un import
// vivant seulement dans un commentaire passait pour mort, et inversement.
function estCommentaire(ligne) {
  const t = ligne.trim()
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')
}

describe('libellés d’accessibilité — traduits, jamais écrits en dur', () => {
  it('aucun aria-label littéral hors zones explicitement exclues', () => {
    const violations = []
    for (const fichier of fichiersSource(RACINE)) {
      const relatif = fichier.replace(process.cwd(), '').replace(/\\/g, '/').replace(/^\//, '')
      if (estExclu(relatif)) continue
      readFileSync(fichier, 'utf8').split('\n').forEach((ligne, i) => {
        if (estCommentaire(ligne)) return
        const trouve = ligne.match(ARIA_LITTERAL)
        if (trouve) violations.push(`${relatif}:${i + 1} → ${trouve[0]}`)
      })
    }

    expect(violations).toEqual([])
  })
})
