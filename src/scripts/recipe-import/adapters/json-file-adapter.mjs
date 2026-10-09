// JSON file adapter — import depuis un fichier JSON local (admin bulk paste).
// Refonte Recettes Phase 3 — Sprint 18.
//
// Format attendu : { batchName: string, recipes: ParsedRecipeData[] }
// OU : ParsedRecipeData[]  (array direct)
//
// Use case : admin colle un JSON généré ailleurs (assistant ou autre outil),
// chaque recette est déjà au format Fridge+ (shape contrôlé par prompt).

export const jsonFileAdapter = {
  SOURCE_NAME: 'json_file',

  /**
   * Read un fichier JSON via fs ou stdin.
   * @param {Object} options
   * @param {string} [options.content] - JSON content directement (priorité sur path)
   * @param {string} [options.path]    - Path absolu vers le fichier
   * @param {Function} [options.readFn] - Override pour tests
   * @returns {Promise<Array>} raw items[]
   */
  async fetch(options = {}) {
    let json
    if (options.content) {
      json = typeof options.content === 'string' ? JSON.parse(options.content) : options.content
    } else if (options.path) {
      const readFn = options.readFn ?? (async (p) => {
        const fs = await import('node:fs/promises')
        return fs.readFile(p, 'utf8')
      })
      const txt = await readFn(options.path)
      json = JSON.parse(txt)
    } else {
      throw new Error('jsonFileAdapter.fetch requires options.content or options.path')
    }

    // Format flexible : { recipes: [...] } ou [...] directement
    return Array.isArray(json) ? json : (json.recipes ?? [])
  },

  /**
   * Normalize : le format JSON est supposé déjà au format Fridge+.
   * On valide juste les champs essentiels, le pipeline P2 fera le reste.
   */
  normalize(rawItem, _context = {}) {
    // External key : si l'item a déjà un id, l'utilise ; sinon hash léger du contenu
    const externalKey = rawItem.id
      ? `json-${rawItem.id}`
      : `json-${hashContent(rawItem)}`

    // ParsedData = rawItem si déjà au format, sinon minimal wrap
    const parsedData = {
      ...rawItem,
      status: rawItem.status ?? 'draft',
    }

    return {
      externalKey,
      rawPayload: rawItem,
      parsedData,
    }
  },

  async run(options, context = {}) {
    const items = await this.fetch(options)
    return items.map(item => this.normalize(item, context))
  },
}

// Hash léger pour idempotency quand pas d'id natif
function hashContent(obj) {
  const str = JSON.stringify(obj)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36)
}
