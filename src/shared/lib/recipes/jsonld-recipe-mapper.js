// Mappe un objet schema.org/Recipe (JSON-LD, extrait d'une page de recette) vers
// un brouillon exploitable par l'éditeur admin. PUR/testable. L'extraction du
// JSON-LD depuis l'URL se fait côté serveur (Edge Function, anti-CORS) ; le
// rapprochement des ingrédients au catalogue se fait côté client (réutilise le
// parser + matchIngredient, comme le « coller »).
//
// ⚠️ Garde-fou copyright : le résultat = BROUILLON à relire/adapter, pas une
// copie publiable telle quelle.

const asArray = (x) => (Array.isArray(x) ? x : x == null ? [] : [x])

// ISO 8601 duration (« PT1H30M ») → minutes (ou null).
export function parseIsoDuration(iso) {
  if (typeof iso !== 'string') return null
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!m || (!m[1] && !m[2] && !m[3])) return null
  return (parseInt(m[1] || 0) * 60) + parseInt(m[2] || 0) + Math.round(parseInt(m[3] || 0) / 60)
}

function extractImage(img) {
  if (!img) return null
  if (typeof img === 'string') return img
  if (Array.isArray(img)) return extractImage(img[0])
  if (typeof img === 'object') return img.url ?? img.contentUrl ?? null
  return null
}

function parseYield(y) {
  if (typeof y === 'number') return y
  if (Array.isArray(y)) return parseYield(y[0])
  if (typeof y === 'string') { const m = y.match(/\d+/); return m ? parseInt(m[0]) : null }
  return null
}

// recipeInstructions → tableau de chaînes (gère string, HowToStep{text},
// HowToSection{itemListElement}).
function extractInstructions(instr) {
  return asArray(instr).flatMap((step) => {
    if (typeof step === 'string') return [step]
    if (step && typeof step === 'object') {
      if (step.itemListElement) return extractInstructions(step.itemListElement)
      if (step.text) return [String(step.text)]
    }
    return []
  }).map((s) => s.trim()).filter(Boolean)
}

export function mapJsonLdRecipe(jsonld, { lang = 'fr' } = {}) {
  if (!jsonld || typeof jsonld !== 'object') return null
  const timeMin =
    parseIsoDuration(jsonld.totalTime) ??
    (() => {
      const p = parseIsoDuration(jsonld.prepTime)
      const c = parseIsoDuration(jsonld.cookTime)
      return p != null || c != null ? (p || 0) + (c || 0) : null
    })()

  return {
    name: String(jsonld.name ?? ''),
    imageUrl: extractImage(jsonld.image),
    servings: parseYield(jsonld.recipeYield),
    timeMin,
    ingredientLines: asArray(jsonld.recipeIngredient).filter((x) => typeof x === 'string').map((s) => s.trim()).filter(Boolean),
    steps: { [lang]: extractInstructions(jsonld.recipeInstructions) },
  }
}
