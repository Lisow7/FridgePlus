import Fuse from 'fuse.js'

// Helpers de rapprochement catalogue + génération de libellés pour l'éditeur
// d'ingrédients (Lot 2b). Purs/testables. buildLabels ne sert QUE pour les
// NOUVELLES lignes (préservation des libellés existants gérée côté éditeur).

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

// Deux mots « équivalents » : pluriel uniquement (PAS de préfixe arbitraire, qui
// causait « frais »≈« fraise »).
function eqWord(a, b) {
  if (a.length < 3 || b.length < 3) return a === b
  return a === b || a === b + 's' || a + 's' === b || a === b + 'es' || a + 'es' === b
}

// ── Rapprochement d'un nom libre vers un ingrédient du catalogue ───────────────
// 1) correspondance par mots, départagée par : libellé exact > mot du nom le plus
//    EN TÊTE qui matche (le nom principal prime sur les descripteurs « frais »…)
//    > libellé le plus court. 2) repli flou STRICT (préfère null à un faux match).
export function matchIngredient(name, catalog, { threshold = 0.32 } = {}) {
  if (!name || !catalog?.length) return null
  const nName = norm(name)
  const qWords = nName.split(/\s+/).filter((w) => w.length >= 3)

  let best = null
  const better = (a, b) =>
    a.exact !== b.exact ? a.exact : a.minIdx !== b.minIdx ? a.minIdx < b.minIdx : a.labLen < b.labLen
  for (const c of catalog) {
    for (const lab of Object.values(c.labels ?? {})) {
      const nLab = norm(lab)
      const labWords = nLab.split(/\s+/).filter(Boolean)
      const exact = nName === nLab
      let minIdx = qWords.findIndex((w) => labWords.some((lw) => eqWord(w, lw)))
      if (!exact && minIdx === -1) continue
      const cand = { id: c.id, exact, minIdx: exact ? -1 : minIdx, labLen: labWords.length }
      if (!best || better(cand, best)) best = cand
    }
  }
  if (best) return { id: best.id, score: 0.1, confidence: 'high' }

  // Repli flou strict
  const fuse = new Fuse(catalog, {
    keys: ['labels.fr', 'labels.en', 'labels.es', 'labels.de', 'labels.ja'],
    threshold, includeScore: true, ignoreLocation: true,
  })
  const hit = fuse.search(name)[0]
  if (!hit || (hit.score ?? 1) > threshold) return null
  return { id: hit.item.id, score: hit.score ?? 1, confidence: (hit.score ?? 1) <= 0.2 ? 'high' : 'low' }
}

// ── Génération de libellé multilingue à partir de qty + nom catalogue ──────────
const PRETTY_FRAC = { 0.5: '½', 0.25: '¼', 0.75: '¾', 0.33: '⅓', 0.67: '⅔' }

// Unités dont l'affichage diffère par langue (les unités métriques g/kg/ml… sont
// identiques partout → pas besoin de map). « pcs » = pièce → omise du libellé.
const UNIT_DISPLAY = {
  cs:      { fr: 'c. à s.', en: 'tbsp', es: 'cda',  de: 'EL',    ja: '大さじ' },
  cc:      { fr: 'c. à c.', en: 'tsp',  es: 'cdta', de: 'TL',    ja: '小さじ' },
  pincée:  { fr: 'pincée',  en: 'pinch', es: 'pizca', de: 'Prise', ja: 'ひとつまみ' },
  bouquet: { fr: 'bouquet', en: 'bunch', es: 'manojo', de: 'Bund', ja: '束' },
  botte:   { fr: 'botte',   en: 'bunch', es: 'manojo', de: 'Bund', ja: '束' },
  gousse:  { fr: 'gousse',  en: 'clove', es: 'diente', de: 'Zehe', ja: '片' },
  tranche: { fr: 'tranche', en: 'slice', es: 'rebanada', de: 'Scheibe', ja: '枚' },
}

const amountStr = (a) => (a == null ? '' : (PRETTY_FRAC[a] ?? String(a)))
const unitDisplay = (unit, lang) => (UNIT_DISPLAY[unit]?.[lang] ?? unit)

function buildLabel(qty, nameInLang, lang) {
  const parts = []
  const a = amountStr(qty?.amount)
  if (a) parts.push(a)
  if (qty?.unit && qty.unit !== 'pcs') parts.push(unitDisplay(qty.unit, lang))
  if (nameInLang) parts.push(nameInLang)
  return parts.join(' ')
}

// qty = { amount, unit } ; catalogLabels = { fr, en, … } (nom de l'ingrédient).
// Retourne un libellé par langue présente dans catalogLabels.
export function buildLabels(qty, catalogLabels) {
  const out = {}
  for (const lang of Object.keys(catalogLabels ?? {})) {
    out[lang] = buildLabel(qty, catalogLabels[lang], lang)
  }
  return out
}
