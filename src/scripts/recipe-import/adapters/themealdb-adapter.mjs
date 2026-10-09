// TheMealDB adapter — source publique gratuite MIT (~300 recettes).
// Refonte Recettes Phase 3 — Sprint 18.
//
// API : https://www.themealdb.com/api.php
// Format réponse : { meals: [{ idMeal, strMeal, strCategory, strArea,
//                              strInstructions, strIngredient1-20, strMeasure1-20,
//                              strMeasureN, strImage, strYoutube, ... }] }
//
// Stratégie pour atteindre ~300 recettes : on parcourt toutes les catégories
// (filter.php?c=...) puis lookup détaillé de chaque meal id.
//
// Mapping TheMealDB → Fridge+ :
//   - strMeal → name.en (FR via DeepL edge function en Phase 6, pas ici)
//   - strArea (American/French/Italian/...) → country code via map
//   - strCategory → meal type
//   - strInstructions split → steps.en (array)
//   - strIngredient1-20 + strMeasure1-20 → ingredients[] (orphans détectés par P2)

const BASE_URL = 'https://www.themealdb.com/api/json/v1/1'

// Mapping TheMealDB area → ISO country code
const AREA_TO_COUNTRY = {
  American: 'us', British: 'gb', Canadian: 'ca', Chinese: 'cn',
  Croatian: 'hr', Dutch: 'nl', Egyptian: 'eg', Filipino: 'ph',
  French: 'fr', Greek: 'gr', Indian: 'in', Irish: 'ie',
  Italian: 'it', Jamaican: 'jm', Japanese: 'jp', Kenyan: 'ke',
  Malaysian: 'my', Mexican: 'mx', Moroccan: 'ma', Polish: 'pl',
  Portuguese: 'pt', Russian: 'ru', Spanish: 'es', Thai: 'th',
  Tunisian: 'tn', Turkish: 'tr', Ukrainian: 'ua', Vietnamese: 'vn',
}

// Mapping category → meal type Fridge+
const CATEGORY_TO_TYPE = {
  Beef: 'main', Chicken: 'main', Lamb: 'main', Pork: 'main',
  Seafood: 'main', Vegetarian: 'main', Vegan: 'main',
  Pasta: 'main', Side: 'side', Starter: 'starter',
  Dessert: 'dessert', Breakfast: 'breakfast', Goat: 'main',
  Miscellaneous: 'main',
}

export const themealdbAdapter = {
  SOURCE_NAME: 'themealdb',

  /**
   * Fetch toutes les recettes (par catégorie pour atteindre ~300).
   * @param {Object} options
   * @param {string[]} [options.categories] - Si NULL, fetch toutes (Categories list endpoint)
   * @param {number}   [options.limit]      - Si défini, arrête après N meals fetched (utile pour test mini)
   * @param {Function} [options.fetchFn]    - Override pour tests (default: globalThis.fetch)
   * @returns {Promise<Array>} raw meals[]
   */
  async fetch(options = {}) {
    const fetchFn = options.fetchFn ?? globalThis.fetch
    if (!fetchFn) throw new Error('fetch not available (provide options.fetchFn for Node <18)')
    const limit = Number.isFinite(Number(options.limit)) ? Number(options.limit) : null

    // Helper : fetch + parse JSON avec gestion d'erreur explicite (status code + content-type).
    // Permet de skip une requête fautive au lieu de crash le pipeline complet.
    // Tolérant aux mocks de test (qui ne fournissent pas forcément headers/ok).
    async function fetchJson(url) {
      try {
        const res = await fetchFn(url)
        if (res?.ok === false) {
          console.warn(`  ⚠ HTTP ${res.status} sur ${url} — skip`)
          return null
        }
        // Check content-type seulement si headers dispo (en prod ; pas en test mock)
        const ct = res?.headers?.get?.('content-type') ?? ''
        if (ct && !ct.includes('json')) {
          const sample = typeof res.text === 'function' ? (await res.text()).slice(0, 80) : ''
          console.warn(`  ⚠ Non-JSON (${ct.slice(0, 30)}) sur ${url} — skip — sample: ${sample}`)
          return null
        }
        return await res.json()
      } catch (err) {
        console.warn(`  ⚠ Fetch error sur ${url} — skip — ${err.message}`)
        return null
      }
    }

    // 1. Récupérer la liste des catégories si pas fournies
    let categories = options.categories
    if (!categories) {
      const catData = await fetchJson(`${BASE_URL}/categories.php`)
      if (!catData) throw new Error('categories.php fetch failed — aborting')
      categories = (catData.categories ?? []).map(c => c.strCategory)
    }

    // 2. Pour chaque catégorie, fetch les meal IDs. Stop early si limit atteint.
    const allIds = new Set()
    for (const cat of categories) {
      if (limit && allIds.size >= limit) break
      const data = await fetchJson(`${BASE_URL}/filter.php?c=${encodeURIComponent(cat)}`)
      if (!data) continue
      for (const m of data.meals ?? []) {
        allIds.add(m.idMeal)
        if (limit && allIds.size >= limit) break
      }
    }

    // 3. Lookup détaillé de chaque meal (parallèle par batch de 5 pour respecter rate limit).
    const meals = []
    const ids = [...allIds].slice(0, limit ?? Infinity)
    const BATCH = 5
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH)
      const results = await Promise.all(
        batch.map(id => fetchJson(`${BASE_URL}/lookup.php?i=${id}`))
      )
      for (const r of results) {
        if (!r) continue
        for (const m of r.meals ?? []) meals.push(m)
      }
    }
    return meals
  },

  /**
   * Normalize 1 raw meal → AdapterResult.
   * @param {Object} rawItem - 1 meal TheMealDB
   * @param {import('./_base-adapter.mjs').AdapterContext} context
   */
  normalize(rawItem, context = {}) {
    const externalKey = `themealdb-${rawItem.idMeal}`

    // Extract ingredients (strIngredient1-20 + strMeasure1-20)
    const ingredients = []
    for (let i = 1; i <= 20; i++) {
      const ingName = (rawItem[`strIngredient${i}`] ?? '').trim()
      const measure = (rawItem[`strMeasure${i}`] ?? '').trim()
      if (!ingName) continue
      // Tente de mapper au catalogue Fridge+ via fuzzy match prefix
      const id = guessIngredientId(ingName, context.ingredients) ?? slugify(ingName)
      const { amount, unit } = parseMeasure(measure)
      ingredients.push({
        id,
        amount,
        unit,
        required: true,
        notes: { en: ingName }, // garde le nom original en cas de mapping foireux
      })
    }

    // Steps : split par newline ou phrase
    const stepsRaw = rawItem.strInstructions ?? ''
    const steps = stepsRaw
      .split(/\r?\n|(?<=[.!?])\s+(?=[A-Z])/)
      .map(s => s.trim())
      .filter(Boolean)

    const parsedData = {
      name: { en: rawItem.strMeal ?? '' },
      country: AREA_TO_COUNTRY[rawItem.strArea] ?? null,
      type: CATEGORY_TO_TYPE[rawItem.strCategory] ?? 'main',
      emoji: '🍽️', // sera amélioré par admin ou IA en Phase 6
      ingredients,
      steps: { en: steps },
      image_url: rawItem.strImage ?? null,
      status: 'draft', // toutes les recettes TheMealDB partent en draft → admin review
      // diet/allergens : vides → auto-dérivés par trigger D22 quand inserted
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

// Helpers ─────────────────────────────────────────────────────────────────────

// Tente de matcher ingredient TheMealDB au catalogue Fridge+ via fuzzy.
function guessIngredientId(name, catalogue) {
  if (!catalogue || !name) return null
  const norm = name.toLowerCase().replace(/[^a-z]/g, '')
  for (const [id, ing] of catalogue) {
    const labels = ing?.labels ?? {}
    for (const label of Object.values(labels)) {
      if (typeof label !== 'string') continue
      const labelNorm = label.toLowerCase().replace(/[^a-z]/g, '')
      if (labelNorm === norm || labelNorm.startsWith(norm) || norm.startsWith(labelNorm)) {
        return id
      }
    }
  }
  return null
}

// Slugify fallback pour les ingrédients sans match
function slugify(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Parse "1 cup", "100 g", "2 tbsp" → { amount, unit }
function parseMeasure(s) {
  if (!s) return { amount: null, unit: null }
  const match = s.match(/^(\d+(?:[./]\d+)?(?:\.\d+)?)\s*(.*)/)
  if (!match) return { amount: null, unit: s }
  const amountRaw = match[1]
  // Handle fractions like "1/2"
  let amount = null
  if (amountRaw.includes('/')) {
    const [num, denom] = amountRaw.split('/').map(Number)
    amount = denom > 0 ? num / denom : null
  } else {
    amount = Number(amountRaw)
  }
  return {
    amount: Number.isFinite(amount) ? amount : null,
    unit: (match[2] ?? '').trim() || null,
  }
}
