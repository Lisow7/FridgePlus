// Parser d'ingrédients FR à RÈGLES (pas de NLP : plus fiable en français,
// cf. recherche Lot 2). Transforme une ligne de texte libre en
// { amount, unit, name, raw }. Le rapprochement au catalogue + la génération
// des libellés multilingues sont des étapes séparées (préservation des libellés
// existants gérée côté éditeur — cf. invariants spec).

const FRAC = {
  '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
  '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
}
const FRAC_CHARS = Object.keys(FRAC).join('')

// Unités FR reconnues → forme canonique. Ordre = du plus spécifique au plus
// général (ex. « cuillère à soupe » avant « c », « grammes » avant « g »).
const UNITS = [
  [/^cuill[èe]res?\s*à\s*soupe/i, 'cs'],
  [/^c\.?\s*à\s*soupe/i, 'cs'],
  [/^c\.?\s*à\s*s\.?(?=\s|$)/i, 'cs'],
  [/^c[àa]s(?=\s|$)/i, 'cs'],
  [/^cuill[èe]res?\s*à\s*caf[ée]/i, 'cc'],
  [/^c\.?\s*à\s*caf[ée]/i, 'cc'],
  [/^c[àa]c(?=\s|$)/i, 'cc'],
  [/^kg(?=\s|$)/i, 'kg'],
  [/^kilos?(?:grammes?)?(?=\s|$)/i, 'kg'],
  [/^grammes?(?=\s|$)/i, 'g'],
  [/^g(?=\s|$)/i, 'g'],
  [/^mg(?=\s|$)/i, 'mg'],
  [/^cl(?=\s|$)/i, 'cl'],
  [/^ml(?=\s|$)/i, 'ml'],
  [/^dl(?=\s|$)/i, 'dl'],
  [/^litres?(?=\s|$)/i, 'l'],
  [/^l(?=\s|$)/i, 'l'],
  [/^pinc[ée]es?(?=\s|$)/i, 'pincée'],
  [/^bouquets?(?=\s|$)/i, 'bouquet'],
  [/^bottes?(?=\s|$)/i, 'botte'],
  [/^gousses?(?=\s|$)/i, 'gousse'],
  [/^tranches?(?=\s|$)/i, 'tranche'],
  [/^bo[îi]tes?(?=\s|$)/i, 'boîte'],
  [/^sachets?(?=\s|$)/i, 'sachet'],
  [/^verres?(?=\s|$)/i, 'verre'],
  [/^pi[èe]ces?(?=\s|$)/i, 'pcs'],
  [/^pcs?(?=\s|$)/i, 'pcs'],
]

// Connecteurs FR en tête de nom à retirer (« de », « d' », « de la »…).
const CONNECTOR = /^(?:de\s+l['']|de\s+la\s+|de\s+|d['']|des\s+|du\s+|à\s+|au\s+|aux\s+)/i

const round2 = (x) => Math.round(x * 100) / 100

function parseQty(s) {
  let m
  if ((m = s.match(new RegExp(`^(\\d+)\\s+(\\d+)\\s*/\\s*(\\d+)\\s*`)))) // « 1 1/2 »
    return { amount: round2(+m[1] + +m[2] / +m[3]), rest: s.slice(m[0].length) }
  if ((m = s.match(new RegExp(`^(\\d+)\\s*([${FRAC_CHARS}])\\s*`)))) // « 1 ½ »
    return { amount: round2(+m[1] + FRAC[m[2]]), rest: s.slice(m[0].length) }
  if ((m = s.match(new RegExp(`^([${FRAC_CHARS}])\\s*`)))) // « ½ »
    return { amount: round2(FRAC[m[1]]), rest: s.slice(m[0].length) }
  if ((m = s.match(/^(\d+)\s*\/\s*(\d+)\s*/))) // « 1/2 »
    return { amount: round2(+m[1] / +m[2]), rest: s.slice(m[0].length) }
  if ((m = s.match(/^(\d+[.,]\d+)\s*/))) // décimal « 1,5 »
    return { amount: parseFloat(m[1].replace(',', '.')), rest: s.slice(m[0].length) }
  if ((m = s.match(/^(\d+)\s*/))) // entier
    return { amount: +m[1], rest: s.slice(m[0].length) }
  return { amount: null, rest: s }
}

export function parseIngredientLine(line) {
  if (line == null) return null
  // normalise apostrophes typographiques + retire les puces de liste
  let s = String(line).replace(/[''’]/g, "'").trim().replace(/^[-•*–]\s*/, '').trim()
  if (!s) return null
  const raw = s

  const { amount, rest } = parseQty(s)
  let r = rest.trim()

  let unit = null
  for (const [re, canon] of UNITS) {
    const m = r.match(re)
    if (m) { unit = canon; r = r.slice(m[0].length).trim(); break }
  }

  const name = r.replace(CONNECTOR, '').trim()
  return { amount: amount ?? null, unit, name, raw }
}

// Découpe un collage multi-lignes en lignes d'ingrédients. Sépare par saut de
// ligne / point-virgule / virgule SUIVIE d'un espace (préserve « 1,5 » décimal).
export function parseIngredientList(text) {
  if (!text) return []
  return String(text)
    .split(/[\n;]+|,(?=\s)/)
    .map((l) => parseIngredientLine(l))
    .filter(Boolean)
}
