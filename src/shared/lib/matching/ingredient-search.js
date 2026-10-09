// Recherche d'aliment au clavier (inventaire, « Chercher un aliment »).
//
// POURQUOI CE MODULE — audit d'intuitivité du 2026-10-02 : la recherche de
// l'inventaire faisait `normalize(nom).includes(saisie)`. Deux défauts vus en
// vrai :
//   - « oeuf » ramenait d'abord trois coupes de bœuf (« b-oeuf ») : une
//     correspondance au MILIEU d'un mot n'a pas de sens pour un aliment ;
//   - « pâtes » ne trouvait rien : « Pâtes » est un parent (`group_id`), non
//     stockable, exclu du catalogue cherchable — alors que ses 12 enfants
//     (Spaghetti, Penne…) sont exactement ce que la personne veut.
//
// Règles, dans l'ordre où elles classent (rang le plus bas = affiché d'abord) :
//   0. le nom entier égale la saisie (au pluriel près) — et si ce nom est
//      celui d'une FAMILLE, ses enfants passent juste derrière (0.5) : qui tape
//      « pâtes » veut des spaghetti, pas de la pâte à tartiner ;
//   1. le nom COMMENCE par la saisie (chaque mot tapé = début d'un mot du nom) ;
//   2. chaque mot tapé est le début d'un mot du nom, ailleurs dans le nom ;
//   3. l'aliment appartient à une famille (parent) qui correspond — ou à un
//      alias existant (`SPEECH_ALIASES`, ex. « patate » → pomme de terre) ;
//   4. faute de frappe tolérée (1 lettre, 2 au-delà de 7 lettres) — SEULEMENT
//      si rien d'autre ne correspond, pour ne jamais noyer un bon résultat.
// Singulier/pluriel confondus (-s/-x final), accents/ligatures/majuscules
// ignorés via `normalizeSearch` (qui gère « œ », cf. son en-tête).
//
// Pas de Fuse ici : la tolérance est bornée et le catalogue (~650 entrées)
// tient dans une boucle — et Fuse est volontairement hors du graphe initial
// (cf. ingredient-text-matcher.js).

import { normalizeSearch } from './normalize-search'
import { SPEECH_ALIASES } from '@shared/static/speech-aliases'

const MAX_RESULTS = 60

const stem = (w) => (w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w)
const words = (s) => normalizeSearch(s).split(/[^a-z0-9]+/).filter(Boolean)
const labelOf = (ing, lang) => ing.labels?.[lang] ?? ing.labels?.fr ?? ing.id

// Distance de Damerau-Levenshtein restreinte (transposition adjacente comprise).
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[a.length][b.length]
}

// Rang 0/1/2 si chaque mot tapé ouvre un mot du nom, sinon null.
function prefixRank(queryWords, nameWords) {
  const stems = nameWords.map(stem)
  if (stems.join(' ') === queryWords.map(stem).join(' ')) return 0
  const all = queryWords.every((q) => {
    const sq = stem(q)
    return nameWords.some((w, i) => w.startsWith(q) || stems[i].startsWith(sq))
  })
  if (!all) return null
  const first = stem(queryWords[0])
  return nameWords[0]?.startsWith(queryWords[0]) || stems[0]?.startsWith(first) ? 1 : 2
}

function typoMatch(queryWords, nameWords) {
  return queryWords.every((q) => {
    if (q.length < 4) return nameWords.some((w) => w.startsWith(q))
    const tolerance = q.length > 7 ? 2 : 1
    return nameWords.some((w) =>
      editDistance(q, w) <= tolerance || editDistance(q, w.slice(0, q.length)) <= tolerance,
    )
  })
}

/**
 * @param {string} query — la saisie brute
 * @param {Iterable<{id:string, labels:object, group_id?:string|null}>} catalog
 * @param {{lang?: string}} [options]
 * @returns {{id:string, name:string, rank:number, ing:object}[]} aliments
 *   stockables (jamais un parent), du plus pertinent au moins pertinent.
 */
export function searchIngredients(query, catalog, { lang = 'fr' } = {}) {
  const queryWords = words(query)
  if (queryWords.length === 0) return []
  const fullQuery = queryWords.join(' ')

  const all = [...catalog]
  const parentIds = new Set(all.filter((i) => i.group_id).map((i) => i.group_id))
  const byId = new Map(all.map((i) => [i.id, i]))
  const best = new Map() // id → rang

  const consider = (ing, rank) => {
    if (!ing || parentIds.has(ing.id)) return
    if (!best.has(ing.id) || rank < best.get(ing.id)) best.set(ing.id, rank)
  }

  const nameWordsOf = new Map(all.map((i) => [i.id, words(labelOf(i, lang))]))

  for (const ing of all) {
    const nameWords = nameWordsOf.get(ing.id)
    const rank = prefixRank(queryWords, nameWords)
    if (rank === null) continue
    if (parentIds.has(ing.id)) {
      // Une famille qui correspond propose tous ses enfants — en tête si la
      // saisie la nomme exactement, sinon après les correspondances directes
      for (const child of all) if (child.group_id === ing.id) consider(child, rank === 0 ? 0.5 : 3)
    } else {
      consider(ing, rank)
    }
  }

  // Alias existants (clés déjà normalisées) : saisie = alias, ou début d'alias
  for (const [alias, id] of Object.entries(SPEECH_ALIASES[lang] ?? {})) {
    if (alias === fullQuery || (fullQuery.length >= 3 && alias.startsWith(fullQuery))) {
      const target = byId.get(id)
      if (target && parentIds.has(id)) {
        for (const child of all) if (child.group_id === id) consider(child, 3)
      } else consider(target, 3)
    }
  }

  if (best.size === 0) {
    for (const ing of all) {
      if (!parentIds.has(ing.id) && typoMatch(queryWords, nameWordsOf.get(ing.id))) consider(ing, 4)
    }
  }

  return [...best]
    .map(([id, rank]) => ({ id, rank, ing: byId.get(id), name: labelOf(byId.get(id), lang) }))
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, lang))
    .slice(0, MAX_RESULTS)
}
