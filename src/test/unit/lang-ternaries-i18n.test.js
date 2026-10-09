// Garde-fou : aucune traduction écrite en dur dans un ternaire sur `lang`.
//
// Clôture le §5 de l'audit front (lots #892, #897, #898 : 79 sites migrés).
// Motif : avec `lang === 'fr' ? 'Fermer' : 'Close'`, ajouter une 3ᵉ langue
// impose de rouvrir chaque site d'appel. Un lookup `I18N[lang] ?? I18N.fr`
// coûte une ligne dans un dictionnaire.
//
// Frère de `aria-labels-i18n.test.js`, dont il reprend la structure et la
// politique d'exclusion.
//
// ── Pourquoi la détection ne peut pas être un simple grep ────────────────────
// Deux familles ont échappé au grep du chantier, chacune découverte APRÈS coup :
//
//  1. Les ternaires MULTI-LIGNES. `recipe-detail-header` portait
//     `title={lang === 'en'` sur une ligne et `? 'Locked — …'` sur la suivante.
//     Un scan ligne à ligne ne peut pas les voir. Ce test lit donc chaque
//     fichier d'un bloc.
//
//  2. Les ALIAS BOOLÉENS. `const isFr = lang !== 'en'` puis `isFr ? '…' : '…'`
//     masque complètement la comparaison de langue (36 sites dans #898).
//     D'où la seconde règle, qui interdit l'alias lui-même.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RACINE = join(process.cwd(), 'src')

// Ternaire dont la branche immédiate est une chaîne littérale, le `?` pouvant
// se trouver sur la ligne suivante. La chaîne est capturée pour être triée
// par `estFauxPositif()` — tout ce que ce motif remonte n'est PAS une traduction.
const TERNAIRE_LITTERAL = /lang\s*[!=]==\s*'(?:fr|en|es|de|ja)'\s*\??\s*\n?\s*\?\s*(['"`])([^'"`]*)\1/gu

// Alias booléen de langue : `const isFr = lang !== 'en'`. Ancré en fin de ligne
// pour ne pas confondre avec un ternaire dont le test tient sur une ligne
// (`const isSingular = lang === 'fr' ? count <= 1 : count === 1`).
//
// ⚠️ Le `\r` de l'ancrage n'est pas décoratif : le dépôt est sur Windows, donc
// `split('\n')` laisse un retour chariot en fin de ligne. Sans lui, cette règle
// ne matche jamais — et le test passe au vert en ne détectant rien. Vérifié par
// mutation, pas par lecture.
const ALIAS_BOOLEEN = /^[ \t]*(?:const|let)\s+\w+\s*=\s*lang\s*[!=]==\s*'(?:fr|en|es|de|ja)'[ \t\r]*$/

// ── Les trois familles de faux positifs ──────────────────────────────────────
// Elles ressemblent à des traductions et n'en sont pas. Les migrer casserait
// le code : une locale de formatage n'est pas un libellé, une clé de
// dictionnaire non plus, et un format monétaire encode une position autant
// qu'un symbole.
function estFauxPositif(valeur) {
  // 1. Locale de formatage ou code de langue : 'fr-FR', 'ja-JP', 'en', 'fr'.
  //    Couvre `toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang)`, la clé de
  //    dictionnaire de `cart-stepper` et la bascule de `language-toggle`.
  if (/^[a-z]{2}(-[A-Z]{2})?$/.test(valeur)) return true

  // 2. Format monétaire : le symbole ET sa position changent selon la langue
  //    ('$12.00' vs '12,00 €'). Le `$` doit être un vrai symbole, pas
  //    l'ouverture d'une interpolation `${…}` — sans quoi tout template
  //    literal passerait à travers.
  if (/€|\$(?!\{)/.test(valeur)) return true

  // 3. Rien à traduire : il faut au moins deux lettres consécutives. Écarte
  //    les séparateurs et les valeurs numériques. Même garde que le test
  //    frère sur les `aria-label`.
  if (!/\p{L}{2}/u.test(valeur)) return true

  return false
}

// Exclusions ASSUMÉES, avec leur raison. Toute nouvelle exclusion doit venir
// avec la sienne — une exclusion silencieuse vide ce test de son sens.
const EXCLUS = [
  // Panneau d'administration : un seul utilisateur (admin@fridgeplus.app),
  // francophone. Traduire ses libellés serait du travail sans bénéficiaire.
  // Même arbitrage, et même formulation, que `aria-labels-i18n.test.js`.
  // Périmètre écarté ici : 31 ternaires + 3 alias booléens.
  'src/features/admin/',
]

// Pas d'exclusion pour l'onboarding : `tour-wizard.jsx` et `welcome-screen.jsx`
// sont désormais des lookups, comme le reste. Ils sont la seule exception
// assumée à la convention `?? I18N.fr` — ils replient sur `?? .en`, parce que
// l'anglais sert mieux un hispanophone sur le tout premier écran de l'app.
// Le comportement est inchangé depuis l'origine ; seule la forme a été unifiée.

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

// Les commentaires d'exemple ne sont pas du code : les compter rendrait le test
// impossible à satisfaire sans mutiler de la documentation — y compris celle de
// ce fichier, qui cite les motifs qu'il interdit.
function estCommentaire(ligne) {
  const t = ligne.trim()
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')
}

// Numéro de ligne (1-indexé) d'un index de caractère dans le fichier entier.
function ligneDe(contenu, index) {
  return contenu.slice(0, index).split('\n').length
}

describe('traductions — dans les dictionnaires, jamais dans un ternaire sur lang', () => {
  it('aucun ternaire de traduction en dur hors zones explicitement exclues', () => {
    const violations = []

    for (const fichier of fichiersSource(RACINE)) {
      const relatif = fichier.replace(process.cwd(), '').replace(/\\/g, '/').replace(/^\//, '')
      if (estExclu(relatif)) continue

      const contenu = readFileSync(fichier, 'utf8')
      const lignes = contenu.split('\n')

      // Règle 1 — ternaire à branche littérale, y compris multi-lignes.
      for (const m of contenu.matchAll(TERNAIRE_LITTERAL)) {
        const noLigne = ligneDe(contenu, m.index)
        if (estCommentaire(lignes[noLigne - 1])) continue
        if (estFauxPositif(m[2])) continue
        violations.push(`${relatif}:${noLigne} → ${m[0].replace(/\s+/g, ' ')}`)
      }

      // Règle 2 — alias booléen de langue. Un ternaire multi-lignes dont le
      // test tient seul sur sa ligne (`const norm = lang === 'ja'` suivi de
      // `? …` en dessous) n'en est pas un : la ligne suivante le distingue.
      lignes.forEach((ligne, i) => {
        if (estCommentaire(ligne)) return
        if (!ALIAS_BOOLEEN.test(ligne)) return
        const suivante = (lignes[i + 1] ?? '').trim()
        if (suivante.startsWith('?')) return
        violations.push(`${relatif}:${i + 1} → ${ligne.trim()}`)
      })
    }

    expect(violations).toEqual([])
  })
})
