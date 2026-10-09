// Moteur de correspondance texte-libre → ingrédient du catalogue.
//
// Extrait de `use-voice-recognition.js` (2026-07-07) pour être réutilisé par
// la feature "photo de ticket de caisse" en plus de la saisie vocale : les
// deux ont le même problème (texte bruité → meilleur ingrédient du catalogue
// + gestion des cas ambigus), donc le même moteur, testé et calibré.
//
// Aucune dépendance à la reconnaissance vocale ici — fonctions pures.
//
// ⛔ PAS d'import statique de `fuse.js` : ce module est tiré au BOOT par la
// voix ET le scan de ticket (via App.jsx), et Fuse voyageait donc dans le
// graphe initial (9 ko gz / 25,7 ko de parse) pour tous — y compris qui ne
// dicte jamais rien. `buildFuseIndex` le charge à la demande ; `findMatches`
// tolère déjà un index absent (garde `if (fuseIndex)`) et dégrade en
// correspondance exacte. Mesuré le 2026-08-25 (audit bundle).

import { SPEECH_ALIASES } from '@shared/static/speech-aliases'
import { normalizeSearch } from './normalize-search'

const STOPWORDS = {
  fr: new Set(['du', 'de', 'la', 'des', 'le', 'les', 'et', 'un', 'une', 'mon', 'ma', 'mes', 'au', 'aux', 'il', 'y', 'en', 'sur', 'dans', 'avec', 'ai', 'aussi', 'voici', 'j', "j'ai", 'ce', 'ces', 'par', 'pour', 'tout', 'puis', 'encore', 'voilà', 'alors']),
  en: new Set(['a', 'an', 'the', 'some', 'of', 'and', 'i', 'have', 'got', 'my', 'few', 'there', 'is', 'also', 'here', 'with', 'then', 'bit', 'bit', 'some', 'few', 'this', 'that']),
}

// ─── Normalisation ───────────────────────────────────────────────────────────

// Ce corps a été déplacé dans `normalize-search.js` pour que les écrans de
// recherche (inventaire, ticket scanné, confirmation vocale) en partagent une
// seule définition — les leurs avaient divergé et ne trouvaient pas « bœuf ».
// Comportement inchangé ici, vérifié cas par cas dans `normalize-search.test.js`.
//
// ⚠️ Import PUIS export, et non `export … from` : ce module appelle lui-même
// `normalize()` à huit endroits, or un simple réexport ne lie pas le symbole
// dans la portée locale.
export const normalize = normalizeSearch

// ─── Plan C : déstemmatisation par langue ────────────────────────────────────
// Retourne toutes les formes singulier / base possibles d'un token normalisé
// selon la langue, pour que le matching soit robuste aux pluriels.

function getSingularForms(token, lang) {
  const forms = new Set([token])

  // Universel : -s / -x finaux (FR, EN, ES, DE)
  if ((token.endsWith('s') || token.endsWith('x')) && token.length > 3) {
    forms.add(token.slice(0, -1))
  }

  if (lang === 'en') {
    // berries → berry
    if (token.endsWith('ies') && token.length > 4) {
      forms.add(token.slice(0, -3) + 'y')
    }
    // tomatoes → tomato, potatoes → potato, dishes → dish
    if (token.endsWith('es') && token.length > 4) {
      forms.add(token.slice(0, -2))  // enlève -es entièrement
      forms.add(token.slice(0, -1))  // enlève seulement -s (tomatoe → pas idéal mais inoffensif)
    }
    // leaves → leaf, knives → knife
    if (token.endsWith('ves') && token.length > 4) {
      forms.add(token.slice(0, -3) + 'f')
      forms.add(token.slice(0, -3) + 'fe')
    }
  }

  if (lang === 'de') {
    // Tomaten → Tomate / Bananen → Banane (enlève -n final)
    if (token.endsWith('n') && token.length > 3) {
      forms.add(token.slice(0, -1))
    }
    // Tomaten → Tomate (enlève -en, ajoute aussi forme -e)
    if (token.endsWith('en') && token.length > 4) {
      const base = token.slice(0, -2)
      forms.add(base)
      forms.add(base + 'e')
    }
    // Eier → Ei / Kinder → Kind (enlève -er)
    if (token.endsWith('er') && token.length > 4) {
      forms.add(token.slice(0, -2))
    }
    // Brote → Brot / Käse → Käs (enlève -e final)
    if (token.endsWith('e') && token.length > 3) {
      forms.add(token.slice(0, -1))
    }
    // Würste → fuse.js gère le cas umlaut car normalize() aplatit les trémas
  }

  if (lang === 'es') {
    // limones → limon (normalize aplatit déjà les accents : limón → limon)
    if (token.endsWith('es') && token.length > 4) {
      forms.add(token.slice(0, -2))
    }
    // tomates → tomate (déjà couvert par -s universel)
  }

  return [...forms]
}

// ─── Plan C : indexation des formes plurielles dans le lookup ────────────────
// Construit toutes les clés à indexer pour un label donné selon la langue.
// Permet à la Passe 1 (n-grammes) de trouver directement les pluriels.

function expandKeys(label, lang = 'fr') {
  const base = label.toLowerCase().trim()
  const keys = new Set()

  const addWithBasePlural = (k) => {
    if (!k || k.length < 2) return
    keys.add(k)
    if (!/[sxz]$/.test(k)) keys.add(k + 's')
    if (k.endsWith('al')) keys.add(k.slice(0, -2) + 'aux')  // FR : animal → animaux
  }

  addWithBasePlural(base)
  const norm = normalize(base)
  if (norm !== base) addWithBasePlural(norm)

  // Variante sans tiret : "pomme-de-terre" → "pomme de terre"
  const deHyphen = base.replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
  if (deHyphen !== base) {
    addWithBasePlural(deHyphen)
    const normDe = normalize(deHyphen)
    if (normDe !== deHyphen) addWithBasePlural(normDe)
  }

  // Variante sans parenthèses ASCII ET pleine-largeur + point médian
  // "Okara (pulpe de soja)" → "okara"  |  "エピ（パン）" → "エピ"
  // "コルドン・ブルー" → "コルドン ブルー"
  const stripParens = base
    .replace(/\s*\([^)]*\)/g, '')   // ASCII
    .replace(/\s*（[^）]*）/g, '')  // pleine-largeur
    .replace(/・/g, ' ')            // point médian
    .replace(/\s+/g, ' ').trim()
  if (stripParens && stripParens !== base && stripParens.length > 1) {
    addWithBasePlural(stripParens)
    const normSP = normalize(stripParens)
    if (normSP !== stripParens) addWithBasePlural(normSP)
    // Combine suppression parenthèses + tirets
    const stripParensDeH = stripParens.replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
    if (stripParensDeH !== stripParens) {
      addWithBasePlural(stripParensDeH)
      const normSPDH = normalize(stripParensDeH)
      if (normSPDH !== stripParensDeH) addWithBasePlural(normSPDH)
    }
  }

  const nb = normalize(base)

  if (lang === 'en') {
    // tomato → tomatoes, potato → potatoes
    if (!nb.endsWith('s') && !nb.endsWith('x')) {
      keys.add(nb + 'es')
    }
    // berry → berries (consonne + y → -ies)
    if (nb.endsWith('y') && nb.length > 2 && !'aeiou'.includes(nb[nb.length - 2])) {
      keys.add(nb.slice(0, -1) + 'ies')
    }
    // leaf → leaves
    if (nb.endsWith('f')) {
      keys.add(nb.slice(0, -1) + 'ves')
    }
    // knife → knives
    if (nb.endsWith('fe')) {
      keys.add(nb.slice(0, -2) + 'ves')
    }
  }

  if (lang === 'de') {
    // Tomate → Tomaten (label en -e → pluriel en -en)
    if (nb.endsWith('e')) {
      keys.add(nb + 'n')
    }
    // Formes génériques -e et -en (très fréquentes en allemand)
    keys.add(nb + 'en')
    if (!nb.endsWith('e')) {
      keys.add(nb + 'e')
    }
    // Ei → Eier (mots courts ≤ 5 chars — évite l'inflation pour les mots longs)
    if (nb.length <= 5) {
      keys.add(nb + 'er')
    }
  }

  if (lang === 'es') {
    // limon → limones (normalize aplatit l'accent : limón → limon + es = limones)
    if (!nb.endsWith('s')) {
      keys.add(nb + 'es')
    }
  }

  return [...keys].filter(k => k.length > 1)
}

// ─── Nettoyage des labels pour la comparaison ───────────────────────────────
// Supprime parenthèses ASCII, remplace tirets par des espaces.
// Exemples : "Okara (pulpe de soja)" → "okara"
//            "Saint-Jacques" → "saint jacques"

function cleanForMatching(s) {
  return normalize(s)
    .replace(/\s*\([^)]*\)/g, '')    // parenthèses ASCII
    .replace(/-/g, ' ')              // tiret → espace
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Construction des index ──────────────────────────────────────────────────

function buildIdMap(ingredients) {
  const map = new Map()
  for (const arr of Object.values(ingredients)) {
    for (const ing of arr) map.set(ing.id, ing)
  }
  return map
}

export function buildLookup(ingredients, lang) {
  const map = new Map()
  for (const arr of Object.values(ingredients)) {
    for (const ing of arr) {
      const lbl = ing.labels?.[lang]
      if (!lbl) continue
      for (const key of expandKeys(lbl, lang)) {
        if (!map.has(key)) map.set(key, ing)
      }
    }
  }
  // Injection des synonymes oraux (aliases) non couverts par les labels
  const aliases = SPEECH_ALIASES[lang] ?? {}
  const idMap = buildIdMap(ingredients)
  for (const [alias, id] of Object.entries(aliases)) {
    const ing = idMap.get(id)
    if (ing) {
      const normAlias = normalize(alias)
      if (!map.has(normAlias)) map.set(normAlias, ing)
    }
  }
  return map
}

// Catégories (parents) : un ingrédient dont l'id est référencé comme
// `group_id` par d'autres (ex. « Poisson » parent de « Cabillaud », « Saumon »)
// est une CATÉGORIE générique. Dans le frigo, ces parents sont des en-têtes
// NON sélectionnables (cf. subcategory-modal) — seules les variantes se
// stockent. Le matcher doit refléter ça : un parent reconnu ne se
// sélectionne pas, il GUIDE vers ses variantes (cf. findMatches).
export function buildGroupInfo(ingredients) {
  const all = []
  for (const arr of Object.values(ingredients ?? {})) {
    for (const ing of arr) all.push(ing)
  }
  const parentIds = new Set(all.filter(i => i.group_id).map(i => i.group_id))
  const childrenByParent = new Map()
  for (const ing of all) {
    if (!ing.group_id) continue
    if (!childrenByParent.has(ing.group_id)) childrenByParent.set(ing.group_id, [])
    childrenByParent.get(ing.group_id).push({ id: ing.id, labels: ing.labels })
  }
  return { parentIds, childrenByParent }
}

export function buildFlatList(ingredients, lang) {
  const seen = new Set()
  const list = []
  for (const arr of Object.values(ingredients)) {
    for (const ing of arr) {
      if (seen.has(ing.id)) continue
      seen.add(ing.id)
      const lbl = ing.labels?.[lang]
      if (!lbl) continue
      // Nettoie le label : parenthèses, ・, tirets, et の (ja) supprimés/espacés
      // "Nori-Algen" → ["nori","algen"] | "子牛のブランケット" (ja) → ["子牛","ブランケット"]
      const cleaned = cleanForMatching(lbl, lang)
      list.push({
        id: ing.id,
        labels: ing.labels,
        emoji: ing.emoji,
        normLabel: cleaned,
        normWords: cleaned.split(/\s+/).filter(Boolean),
      })
    }
  }
  return list
}

// Plan B : index fuse.js — seuil strict pour éviter les faux positifs.
// ASYNC depuis le 2026-08-25 : Fuse est chargé ici, à la demande, plus jamais
// au boot. Les appelants attendent la promesse (contextes déjà async) ou la
// résolvent en arrière-plan et tolèrent un index encore nul.
export async function buildFuseIndex(flatList) {
  const { default: Fuse } = await import('fuse.js')
  return new Fuse(flatList, {
    keys: ['normLabel'],
    threshold: 0.32,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 4,
    shouldSort: true,
  })
}

// ─── Matching mot-dans-label (Passe 2) ──────────────────────────────────────

function tokenMatchesLabel(normToken, normWords, lang = 'fr') {
  for (const form of getSingularForms(normToken, lang)) {
    if (normWords.includes(form)) return true
    // Essaie aussi form + 's' (cas où le label est au singulier)
    if (!/[sxz]$/.test(form) && normWords.includes(form + 's')) return true
  }
  return false
}

// ─── Recherche principale ────────────────────────────────────────────────────

export function findMatches(text, lang, lookup, flatList, fuseIndex, groupInfo) {
  const stops = STOPWORDS[lang] ?? new Set()

  const tokens = text.toLowerCase()
    .split(/[\s,;.!?«»'"()-]+/)
    .filter(w => w.length > 1 && !stops.has(w) && !stops.has(normalize(w)))

  if (tokens.length === 0) return { exact: [], ambiguous: [] }

  const exact = []
  const ambiguous = []
  const seenExactIds = new Set()
  const consumed = new Set()    // indices de tokens déjà consommés
  const seenAmbigWords = new Set()

  // ── Passe 1 : correspondance exacte n-grammes (4→1) ──────────────────────
  // Cherche d'abord les phrases les plus longues pour éviter les faux positifs
  // sur les sous-mots (ex. "poulet" dans "bouillon de poulet").
  for (let size = 4; size >= 1; size--) {
    for (let i = 0; i <= tokens.length - size; i++) {
      const positions = Array.from({ length: size }, (_, k) => i + k)
      if (positions.some(p => consumed.has(p))) continue

      const slice = tokens.slice(i, i + size)
      const phrase = slice.join(' ')
      const normPhrase = normalize(phrase)

      const ing = lookup.get(phrase) ?? lookup.get(normPhrase)
      if (ing && !seenExactIds.has(ing.id)) {
        seenExactIds.add(ing.id)
        exact.push(ing)
        positions.forEach(p => consumed.add(p))
      }
    }
  }

  // ── Passe 2 : correspondance mot entier dans le label (lang-aware) ────────
  // Pour chaque token non consommé, cherche si ce mot (ou sa forme singulier)
  // apparaît dans le label d'un ingrédient.
  if (flatList) {
    for (let i = 0; i < tokens.length; i++) {
      if (consumed.has(i)) continue
      const token = tokens[i]
      if (token.length < 3) continue

      const normToken = normalize(token)
      if (seenAmbigWords.has(normToken)) continue

      const candidates = flatList.filter(ing => {
        if (seenExactIds.has(ing.id)) return false
        return tokenMatchesLabel(normToken, ing.normWords, lang)
      })

      if (candidates.length === 1) {
        const ing = candidates[0]
        seenExactIds.add(ing.id)
        exact.push({ id: ing.id, labels: ing.labels, emoji: ing.emoji })
        consumed.add(i)
      } else if (candidates.length >= 2 && candidates.length <= 15) {
        seenAmbigWords.add(normToken)
        ambiguous.push({
          id: null,
          word: token,
          candidates: candidates.map(c => ({ id: c.id, labels: c.labels })),
          ambiguous: true,
        })
        consumed.add(i)
      }
    }
  }

  // ── Passe 3 : recherche floue fuse.js (filet de sécurité) ────────────────
  // Attrape les variantes non couvertes par C : composés allemands, erreurs
  // de prononciation légères, formes de pluriel très irrégulières.
  // Seuil strict (≤ 0.30) pour minimiser les faux positifs.
  if (fuseIndex) {
    for (let i = 0; i < tokens.length; i++) {
      if (consumed.has(i)) continue
      const token = tokens[i]
      if (token.length < 4) continue

      const normToken = normalize(token)

      const fresh = []
      const results = fuseIndex.search(normToken, { limit: 6 })
      for (const r of results) {
        if (!seenExactIds.has(r.item.id) && (r.score ?? 1) <= 0.30) {
          if (!fresh.find(f => f.item.id === r.item.id)) fresh.push(r)
        }
      }

      if (fresh.length === 1) {
        const ing = fresh[0].item
        seenExactIds.add(ing.id)
        exact.push({ id: ing.id, labels: ing.labels, emoji: ing.emoji })
        consumed.add(i)
      } else if (fresh.length >= 2 && fresh.length <= 10) {
        const key = normToken
        if (!seenAmbigWords.has(key)) {
          seenAmbigWords.add(key)
          ambiguous.push({
            id: null,
            word: token,
            candidates: fresh.map(r => ({ id: r.item.id, labels: r.item.labels })),
            ambiguous: true,
          })
          consumed.add(i)
        }
      }
    }
  }

  // ── Garde-fou catégories : un PARENT reconnu ne se sélectionne pas ────────
  // Cohérent avec le frigo (en-têtes de groupe non sélectionnables) : on retire
  // les parents des exacts. S'il a ≥2 variantes → désambiguïsation (guide vers
  // une variante). 1 variante → on sélectionne directement la variante. 0 → on
  // ignore. Sans groupInfo, comportement historique inchangé (rétro-compat).
  if (groupInfo?.parentIds?.size) {
    const keptExact = []
    for (const ing of exact) {
      if (!groupInfo.parentIds.has(ing.id)) { keptExact.push(ing); continue }
      const children = groupInfo.childrenByParent.get(ing.id) ?? []
      if (children.length === 1) {
        if (!seenExactIds.has(children[0].id)) keptExact.push({ id: children[0].id, labels: children[0].labels })
      } else if (children.length >= 2) {
        const word = ing.labels?.[lang] ?? ing.labels?.fr ?? ing.id
        const key = normalize(word)
        if (!seenAmbigWords.has(key)) {
          seenAmbigWords.add(key)
          ambiguous.push({ id: null, word, candidates: children.map(c => ({ id: c.id, labels: c.labels })), ambiguous: true })
        }
      }
      // parent jamais conservé dans les exacts
    }
    return { exact: keptExact, ambiguous }
  }

  return { exact, ambiguous }
}
