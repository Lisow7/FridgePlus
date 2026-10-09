// Garde-fou : parité des clés dans TOUS les dictionnaires i18n de l'app.
//
// Généralise `community-i18n-parity.test.js` aux 13 dictionnaires (§5.2 de
// l'audit front). Ce test frère ne le remplace pas : celui-ci ne vérifie que
// l'invariant commun, les tests dédiés gardent leurs invariants spécifiques.
//
// ── Les deux invariants, tous deux issus de bugs réels ───────────────────────
//
//  1. PARITÉ DES CLÉS. Une clé oubliée dans un bloc de langue rend `t.xxx`
//     `undefined` à l'affichage : libellé vide, sans erreur, sans test rouge.
//
//  2. BLOCS COMPLETS UNIQUEMENT — c'est le piège coûteux. Les composants
//     résolvent la langue par `DICO[lang] ?? DICO.fr`. Une langue absente
//     retombe donc proprement sur le français. Mais un bloc PARTIEL
//     (`es: { uneSeuleCle }`) est truthy : le fallback ne joue plus et tout le
//     reste du panneau devient `undefined`. Ajouter une langue = la traduire
//     entièrement, jamais à moitié.
//
// Le second invariant n'est attrapé que si l'on compare CHAQUE bloc présent au
// bloc de référence — pas seulement `fr` contre `en`. Ce n'est pas théorique :
// 3 dictionnaires (aha-nudge, getting-started, quick-start) portent les 5
// langues, les 10 autres seulement fr/en. Un test câblé sur fr↔en laisserait
// passer un bloc `es` à moitié traduit, soit exactement le bug visé.
//
// ── Découverte automatique ───────────────────────────────────────────────────
// `import.meta.glob` plutôt qu'une liste d'imports : une liste figée ne couvre
// pas le 14ᵉ dictionnaire ajouté le mois prochain, et le garde-fou décline en
// silence. Tout objet exporté qui ressemble à un dictionnaire de langues est
// donc contrôlé, sans inscription manuelle.

import { describe, it, expect } from 'vitest'

const LANGUES = ['fr', 'en', 'es', 'de', 'ja']
const REFERENCE = 'fr'

// Tous les modules i18n de l'app, chargés d'un bloc.
//
// ⚠️ L'exclusion de `/src/test/` doit se faire DANS le glob, pas après : les
// fichiers de test i18n (`community-i18n-parity.test.js`…) matchent `*i18n*`,
// et `eager: true` les évalue à l'import — leurs `describe`/`it` s'enregistrent
// alors dans CE fichier. Symptôme observé : 33 tests exécutés pour 3 déclarés.
const MODULES = import.meta.glob(['/src/**/*i18n*.{js,jsx}', '!/src/test/**'], { eager: true })

// Un dictionnaire = un objet dont les clés de premier niveau sont des codes
// langue, avec au moins le bloc de référence. Écarte les helpers exportés
// (`pickReleaseName`, `localizeReleaseDate`…) et les tables qui ne sont pas
// indexées par langue (`RELEASE_NAMES_EN`, dont les clés sont des titres FR —
// sa complétude est déjà couverte par `changelog-i18n-completeness.test.js`).
function estDictionnaireDeLangues(valeur) {
  if (!valeur || typeof valeur !== 'object' || Array.isArray(valeur)) return false
  const cles = Object.keys(valeur)
  if (cles.length === 0) return false
  if (!cles.includes(REFERENCE)) return false
  return cles.every(c => LANGUES.includes(c))
}

function collecterDictionnaires() {
  const out = []
  for (const [chemin, module] of Object.entries(MODULES)) {
    for (const [nomExport, valeur] of Object.entries(module)) {
      if (!estDictionnaireDeLangues(valeur)) continue
      out.push({ chemin: chemin.replace('/src/', ''), nomExport, dico: valeur })
    }
  }
  return out
}

const DICTIONNAIRES = collecterDictionnaires()

describe('dictionnaires i18n — parité des clés entre langues', () => {
  // Si le glob casse (chemin, extension, renommage de dossier), la boucle
  // ci-dessous ne teste plus rien tout en restant verte. Ce seuil est le
  // canari : 13 dictionnaires recensés au 2026-07-30.
  it('découvre tous les dictionnaires de l’app', () => {
    expect(DICTIONNAIRES.length).toBeGreaterThanOrEqual(13)
  })

  it('chaque bloc de langue a exactement les clés du bloc de référence', () => {
    const violations = []

    for (const { chemin, nomExport, dico } of DICTIONNAIRES) {
      const clesRef = Object.keys(dico[REFERENCE])

      for (const langue of Object.keys(dico)) {
        if (langue === REFERENCE) continue
        const cles = Object.keys(dico[langue])

        const manquantes = clesRef.filter(k => !cles.includes(k))
        const enTrop = cles.filter(k => !clesRef.includes(k))

        if (manquantes.length > 0) {
          violations.push(`${chemin} → ${nomExport}.${langue} : ${manquantes.length} clé(s) manquante(s) — ${manquantes.join(', ')}`)
        }
        if (enTrop.length > 0) {
          violations.push(`${chemin} → ${nomExport}.${langue} : ${enTrop.length} clé(s) absente(s) de ${REFERENCE} — ${enTrop.join(', ')}`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('aucun bloc de langue vide (un bloc truthy neutralise le fallback)', () => {
    const vides = []
    for (const { chemin, nomExport, dico } of DICTIONNAIRES) {
      for (const langue of Object.keys(dico)) {
        if (Object.keys(dico[langue]).length === 0) vides.push(`${chemin} → ${nomExport}.${langue}`)
      }
    }
    expect(vides).toEqual([])
  })
})
