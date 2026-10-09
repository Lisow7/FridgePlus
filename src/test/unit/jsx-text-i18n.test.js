// Garde-fou : aucun TEXTE ENFANT de JSX écrit en dur dans le code vu par les
// utilisateurs — le 4e cliquet i18n, frère de `aria-labels-i18n`,
// `lang-ternaries-i18n` et `i18n-dictionaries-parity`.
//
// Pourquoi il manquait : les trois frères couvrent les attributs, les
// ternaires et la parité des clés — mais PAS le texte entre deux balises.
// C'est exactement le trou où logeaient les 8 fuites de l'audit du 2026-08-25 :
// un francophone lisait « Trending » en plein fil communauté, un anglophone
// recevait « ⚠ Choisis un ingrédient… » sur la fiche recette. Le cas le plus
// parlant : `filter-drawer-rows.jsx` portait un `aria-label={clearLabel}`
// TRADUIT deux lignes au-dessus d'un texte visible « Effacer » en dur — le
// cliquet des attributs avait protégé la ligne du haut, pas sa voisine.
//
// ⚠️ ANGLE MORT ASSUMÉ : les enfants MIXTES (`<span>{n} recettes</span>`) ne
// matchent pas — le texte y côtoie une expression. Cette famille a été vérifiée
// vide par deux balayages séparés le 2026-08-25 ; si elle se repeuple, ce test
// ne le verra pas. Le noter ici plutôt que de le découvrir plus tard.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RACINE = join(process.cwd(), 'src')

const EXCLUS = [
  // Panneau d'administration : un seul utilisateur, francophone (même raison
  // que dans aria-labels-i18n — 168 libellés recensés, aucun bénéficiaire).
  'src/features/admin/',
  // Données, pas interface : les libellés y sont DÉJÀ par langue.
  'src/shared/static/',
  'src/features/changelog/data/',
  'src/test/',
]

// Valeurs tolérées PARTOUT, chacune avec sa raison. Une exception sans raison
// vide ce test de son sens.
const VALEURS_TOLEREES = new Set([
  // Identiques dans les deux langues.
  'Admin', 'min', '24h', 'OK',
  // Noms de langue dans LEUR langue : voulu dans un sélecteur de langue.
  'Français', 'English',
  // Branding non traduisible (feedback_branding).
  'Fridge', 'Fridge+', 'FridgePlus', 'Premium', '⭐ Premium', 'Beta', 'Bêta',
  // Repli du composant Section de /legal : inatteignable aujourd'hui (les 5
  // sections FR et EN ont toutes des blocks non vides, vérifié le 2026-08-25).
  // Toléré comme hygiène plutôt que corrigé pour ne pas déranger un composant
  // légal sans bénéficiaire réel.
  'Contenu non disponible.',
])

// Un enfant textuel pur sur une ligne : `>texte<` sans expression ni balise.
const ENFANT_INLINE = />([^<>{}]*\p{L}{2}[^<>{}]*)</gu

// Rejette ce qui est du CODE et non un libellé : les opérateurs de comparaison
// produisent des faux `>x<` (`pos > 0 && pos <= len` matche `0 && pos`).
function estDuCode(v) {
  // ` ? ` : un ternaire coupé par la regex (`diff > 0 ? 'up' : diff < 0`
  // matche `0 ? 'up' : diff`). Un vrai libellé ne contient pas « ? » entouré
  // d'espaces — un point d'interrogation final, si.
  return /&&|\|\||=>|==|<=|>=|\?\.|\$\{|`|[()]| \? |\breturn\b|\bconst\b|\bPromise\b/.test(v)
    || /^[)\]}.,;:?]/.test(v.trim())
}

function estCommentaire(ligne) {
  const t = ligne.trim()
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.includes('{/*')
}

function fichiersSource(dossier) {
  const out = []
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree)
    if (statSync(chemin).isDirectory()) { out.push(...fichiersSource(chemin)); continue }
    if (/\.jsx$/.test(entree) && !/\.test\./.test(entree) && !/i18n/i.test(entree)) out.push(chemin)
  }
  return out
}

describe('texte enfant du JSX — traduit, jamais écrit en dur', () => {
  it('aucun libellé littéral entre deux balises hors zones exclues', () => {
    const violations = []
    for (const fichier of fichiersSource(RACINE)) {
      const relatif = fichier.replace(process.cwd(), '').replace(/\\/g, '/').replace(/^\//, '')
      if (EXCLUS.some(p => relatif.includes(p))) continue
      // `\r?\n` : dépôt Windows — un split('\n') laisse un \r final qui fait
      // rater les comparaisons (piège documenté dans lang-ternaries-i18n).
      readFileSync(fichier, 'utf8').split(/\r?\n/).forEach((ligne, i) => {
        if (estCommentaire(ligne)) return
        for (const m of ligne.matchAll(ENFANT_INLINE)) {
          const v = m[1].trim()
          if (!/\p{L}{2}/u.test(v)) continue
          if (estDuCode(v)) continue
          if (VALEURS_TOLEREES.has(v)) continue
          violations.push(`${relatif}:${i + 1} → "${v}"`)
        }
      })
    }

    expect(violations).toEqual([])
  })
})
