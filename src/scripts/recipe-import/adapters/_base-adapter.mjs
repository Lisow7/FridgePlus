// Interface commune pour les source adapters du pipeline d'import recettes.
// Refonte Recettes Phase 3 — Sprint 18.
//
// Chaque adapter implémente :
//   - SOURCE_NAME : identifiant unique (ex: 'themealdb', 'ia_batch', 'json_file', 'admin_ui')
//   - async fetch(options) : récupère les données brutes du source → raw payload[]
//   - normalize(rawItem, context) : transforme 1 raw item → 1 parsedData
//
// Permet d'ajouter une nouvelle source = 1 fichier adapter sans toucher au pipeline.
//
// Pattern : Adapter / Strategy. Composable avec orchestrator + validators de P2.

/**
 * @typedef {Object} ParsedRecipeData
 * @property {string} [id]              - ID stable (NULL si nouveau)
 * @property {Object} name              - jsonb i18n { fr, en, ... } (D6)
 * @property {Object} [description]     - jsonb i18n
 * @property {string} [emoji]
 * @property {number} [time_min]
 * @property {number} [prep_time_min]
 * @property {number} [cook_time_min]
 * @property {string} [difficulty]      - easy|medium|hard
 * @property {string} [type]            - meal type
 * @property {number} [servings]
 * @property {string} [country]         - ISO country code
 * @property {Array}  [diet]
 * @property {Array}  ingredients       - [{ id, amount, unit, required, ... }]
 * @property {Object|Array} [steps]     - jsonb { fr: [...], en: [...] }
 * @property {Array}  [allergens]       - text[] (sera auto-dérivé par trigger D22)
 * @property {string} [image_url]
 * @property {string} [status]          - draft|published|featured
 * @property {Array}  [functional_tags] - quick, economical, etc.
 * @property {Array}  [relations]       - [{ type, target_slug|target_id, metadata }]
 */

/**
 * @typedef {Object} AdapterContext
 * @property {Map<string, Object>} [ingredients]      - Catalogue id → ingredient
 * @property {Map<string, string>} [existingRecipes]  - normalized_name → id
 * @property {Map<string, string>} [recipesByNameAndId] - lookup pour relations
 * @property {string} [batchId]                       - UUID du batch import
 */

/**
 * @typedef {Object} AdapterResult
 * @property {string} externalKey  - Idempotency key (ex: 'themealdb-12345')
 * @property {Object} rawPayload   - INTACT du source (jsonb pour staging)
 * @property {ParsedRecipeData} parsedData - Normalisé vers shape Fridge+
 */

/**
 * Interface abstraite. À ne PAS instancier directement.
 * Sert de référence et de validation runtime des adapters concrets.
 */
export class BaseAdapter {
  /** @returns {string} */
  static get SOURCE_NAME() {
    throw new Error('Adapter must define static SOURCE_NAME')
  }

  /**
   * Récupère les données brutes depuis le source.
   * @param {Object} options - Spécifique à chaque source
   * @returns {Promise<Array<Object>>} rawItems[]
   */
  async fetch(_options) {
    throw new Error('Adapter must implement fetch()')
  }

  /**
   * Transforme 1 raw item → 1 AdapterResult.
   * @param {Object} rawItem
   * @param {AdapterContext} _context
   * @returns {AdapterResult}
   */
  normalize(_rawItem, _context) {
    throw new Error('Adapter must implement normalize()')
  }

  /**
   * Pipeline complet : fetch + normalize. Helper standard.
   * @param {Object} options
   * @param {AdapterContext} context
   * @returns {Promise<AdapterResult[]>}
   */
  async run(options, context = {}) {
    const items = await this.fetch(options)
    return items.map(item => this.normalize(item, context))
  }
}

/**
 * Helper : valide qu'une fonction respecte le contrat adapter.
 * Utile pour les adapters fonctionnels (pas obligés d'étendre BaseAdapter).
 */
export function isValidAdapter(adapter) {
  return Boolean(
    adapter
    && typeof adapter.fetch === 'function'
    && typeof adapter.normalize === 'function'
    && typeof adapter.SOURCE_NAME === 'string'
  )
}
