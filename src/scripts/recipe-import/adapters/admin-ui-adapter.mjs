// Admin UI adapter — import d'1 recette à la fois via interface admin.
// Refonte Recettes Phase 3 — Sprint 18.
//
// Use case : admin clique "Importer recette" dans Qualité v3, colle un payload
// JSON manuellement, valide via pipeline. Permet aussi import depuis URL externe
// avec scraping manuel (admin colle le résultat).
//
// Différence vs json-file-adapter : 1 seule recette à la fois (vs batch), trigger
// événement `admin_imported` pour audit.

export const adminUiAdapter = {
  SOURCE_NAME: 'admin_ui',

  /**
   * Fetch : retourne juste le payload fourni en option (pas de IO réseau/disque).
   * @param {Object} options
   * @param {Object} options.recipe - 1 ParsedRecipeData (ou raw à normaliser)
   */
  async fetch(options = {}) {
    if (!options.recipe) throw new Error('adminUiAdapter.fetch requires options.recipe')
    return [options.recipe]
  },

  normalize(rawItem, context = {}) {
    const adminId = context.adminId ?? 'unknown'
    const timestamp = Date.now()
    const externalKey = rawItem.id
      ? `admin-${adminId}-${rawItem.id}`
      : `admin-${adminId}-${timestamp}`

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
