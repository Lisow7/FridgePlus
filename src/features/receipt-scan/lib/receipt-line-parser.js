// Reconstruit les lignes de produits d'un ticket de caisse à partir de la
// réponse allégée de l'Edge Function scan-receipt (blocks/paragraphs/words +
// positions). Ne garde QUE le libellé produit : pas de quantité, pas de prix,
// pas de conditionnement extrait (décision produit — cf. spec).
//
// Algorithme :
//   1. Exclut les blocks qui ne ressemblent pas à une colonne de noms de
//      produits (majoritairement numériques, ou correspondant à des mots-clés
//      connus : en-tête magasin, total, TVA, paiement…).
//   2. Aplati les mots restants, les regroupe par bande horizontale (Y) pour
//      reconstruire les lignes visuelles (un paragraph Google Vision peut
//      empiler plusieurs lignes — il n'existe pas de niveau "ligne" dans
//      l'API).
//   3. Trie chaque bande par X pour recomposer l'ordre de lecture gauche à
//      droite, puis filtre une dernière fois les lignes qui ressemblent à du
//      bruit (filet de sécurité si le filtrage par block n'a pas suffi).

const NON_PRODUCT_KEYWORDS = [
  /\btotal\b/i, /tva\b/i, /\bespeces\b|carte bancaire|\bcb\b|emv|\bpaiement\b/i,
  /\bmerci\b|\bbienvenue\b|\bticket\b|\bcaisse\b|\bsiret\b|tel\s?:/i,
  /\bremise\b/i, /article\(s\)/i, /hors taxe/i, /a payer/i, /avantages? du jour/i,
  /\bmarket\b/i,
]
const DATE_PATTERN = /\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/
const TIME_PATTERN = /\b\d{1,2}[:h]\d{2}\b/
const PRICE_ONLY_PATTERN = /^-?\d+([.,]\d{2})?\s?€?$/
const QTY_MULTIPLIER_PATTERN = /^\d+([.,]\d+)?\s?[xX×]\s?\d+([.,]\d+)?\s?€?$/
const ONLY_NUMBERS_PATTERN = /^[\d\s.,€%-]+$/

function looksLikeNoise(text) {
  const t = (text ?? '').trim()
  if (t.length < 3) return true
  if (NON_PRODUCT_KEYWORDS.some(re => re.test(t))) return true
  if (DATE_PATTERN.test(t) || TIME_PATTERN.test(t)) return true
  if (PRICE_ONLY_PATTERN.test(t) || QTY_MULTIPLIER_PATTERN.test(t)) return true
  if (ONLY_NUMBERS_PATTERN.test(t)) return true
  return false
}

function isNumericWord(text) {
  return /^[\d.,€%-]+$/.test(text ?? '')
}

function isProductBlock(block) {
  const words = (block.paragraphs ?? []).flatMap(p => p.words ?? [])
  if (words.length === 0) return false
  const blockText = words.map(w => w.text).join(' ')
  if (looksLikeNoise(blockText)) return false
  const numericRatio = words.filter(w => isNumericWord(w.text)).length / words.length
  return numericRatio < 0.5
}

function wordCenterY(word) {
  const { y0 = 0, y1 = 0 } = word.boundingBox ?? {}
  return (y0 + y1) / 2
}
function wordCenterX(word) {
  const { x0 = 0, x1 = 0 } = word.boundingBox ?? {}
  return (x0 + x1) / 2
}
function wordHeight(word) {
  const { y0 = 0, y1 = 0 } = word.boundingBox ?? {}
  return y1 - y0
}

function median(nums) {
  if (nums.length === 0) return 20
  const sorted = [...nums].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

// Regroupe des mots (potentiellement de blocks/paragraphs différents) en
// lignes visuelles, par proximité verticale, puis trie chaque ligne par X.
function clusterWordsIntoRows(words) {
  if (words.length === 0) return []
  const sorted = [...words].sort((a, b) => wordCenterY(a) - wordCenterY(b))
  const tolerance = median(sorted.map(wordHeight).filter(h => h > 0)) * 0.6

  const rows = []
  let currentRow = [sorted[0]]
  let currentRowY = wordCenterY(sorted[0])

  for (let i = 1; i < sorted.length; i++) {
    const y = wordCenterY(sorted[i])
    if (Math.abs(y - currentRowY) <= tolerance) {
      currentRow.push(sorted[i])
      currentRowY = currentRow.reduce((sum, w) => sum + wordCenterY(w), 0) / currentRow.length
    } else {
      rows.push(currentRow)
      currentRow = [sorted[i]]
      currentRowY = y
    }
  }
  rows.push(currentRow)

  return rows.map(row =>
    [...row].sort((a, b) => wordCenterX(a) - wordCenterX(b)).map(w => w.text).join(' ')
  )
}

export function extractProductLabels(visionResponse) {
  const blocks = visionResponse?.blocks ?? []
  const productBlocks = blocks.filter(isProductBlock)
  const words = productBlocks.flatMap(b => (b.paragraphs ?? []).flatMap(p => p.words ?? []))
  const rows = clusterWordsIntoRows(words)
  return rows.filter(text => !looksLikeNoise(text))
}
