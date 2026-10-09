// Tests unit pour les 3 adapters sources du pipeline d'import recettes.
// Refonte Recettes Phase 3 — Sprint 18.

import { describe, it, expect, vi } from 'vitest'
import { BaseAdapter, isValidAdapter } from '../../scripts/recipe-import/adapters/_base-adapter.mjs'
import { themealdbAdapter } from '../../scripts/recipe-import/adapters/themealdb-adapter.mjs'
import { jsonFileAdapter } from '../../scripts/recipe-import/adapters/json-file-adapter.mjs'
import { adminUiAdapter } from '../../scripts/recipe-import/adapters/admin-ui-adapter.mjs'

// ─── _base-adapter ─────────────────────────────────────────────────────────────
describe('BaseAdapter (interface)', () => {
  it('isValidAdapter accepte adapters concrets', () => {
    expect(isValidAdapter(themealdbAdapter)).toBe(true)
    expect(isValidAdapter(jsonFileAdapter)).toBe(true)
    expect(isValidAdapter(adminUiAdapter)).toBe(true)
  })

  it('isValidAdapter rejette objets incomplets', () => {
    expect(isValidAdapter(null)).toBe(false)
    expect(isValidAdapter({})).toBe(false)
    expect(isValidAdapter({ fetch: () => {} })).toBe(false)
    expect(isValidAdapter({ fetch: () => {}, normalize: () => {} })).toBe(false)
  })

  // ⚠️ Le mot-clé `async` et le `await` ne sont PAS décoratifs ici. `fetch()` est
  // asynchrone, donc `.rejects` rend une PROMESSE : sans `await`, l'assertion
  // n'était jamais jouée et ce test affichait vert en ne vérifiant rien du tout.
  // Révélé le 2026-09-12 par la montée en Vitest 5, qui refuse désormais une
  // assertion asynchrone laissée flottante — Vitest 4 la laissait passer en silence.
  it('BaseAdapter throw si non implémenté', async () => {
    expect(() => BaseAdapter.SOURCE_NAME).toThrow(/SOURCE_NAME/)
    await expect(new BaseAdapter().fetch()).rejects.toThrow(/fetch/)
    expect(() => new BaseAdapter().normalize()).toThrow(/normalize/)
  })

  it('chaque adapter a un SOURCE_NAME unique', () => {
    const names = [
      themealdbAdapter.SOURCE_NAME,
      jsonFileAdapter.SOURCE_NAME,
      adminUiAdapter.SOURCE_NAME,
    ]
    expect(new Set(names).size).toBe(3)
  })
})

// ─── themealdb-adapter ────────────────────────────────────────────────────────
describe('themealdbAdapter', () => {
  const sampleMeal = {
    idMeal: '52772',
    strMeal: 'Teriyaki Chicken Casserole',
    strCategory: 'Chicken',
    strArea: 'Japanese',
    strInstructions: 'Preheat oven to 350°F.\nMix soy sauce and water.\nCook chicken for 30 minutes.',
    strImage: 'https://example.com/chicken.jpg',
    strIngredient1: 'soy sauce',
    strMeasure1: '3/4 cup',
    strIngredient2: 'chicken breast',
    strMeasure2: '500 g',
    strIngredient3: '',
    strMeasure3: '',
  }

  it('SOURCE_NAME = themealdb', () => {
    expect(themealdbAdapter.SOURCE_NAME).toBe('themealdb')
  })

  it('normalize 1 meal correctement', () => {
    const result = themealdbAdapter.normalize(sampleMeal, { ingredients: new Map() })
    expect(result.externalKey).toBe('themealdb-52772')
    expect(result.parsedData.name.en).toBe('Teriyaki Chicken Casserole')
    expect(result.parsedData.country).toBe('jp')
    expect(result.parsedData.type).toBe('main')
    expect(result.parsedData.status).toBe('draft')
    expect(result.parsedData.image_url).toBe('https://example.com/chicken.jpg')
  })

  it('extract ingredients (max 20)', () => {
    const result = themealdbAdapter.normalize(sampleMeal, { ingredients: new Map() })
    expect(result.parsedData.ingredients).toHaveLength(2)
    expect(result.parsedData.ingredients[0].id).toBeDefined()
    expect(result.parsedData.ingredients[0].notes.en).toBe('soy sauce')
  })

  it('parse measure "3/4 cup" → amount=0.75 unit="cup"', () => {
    const result = themealdbAdapter.normalize(sampleMeal, { ingredients: new Map() })
    const soy = result.parsedData.ingredients[0]
    expect(soy.amount).toBeCloseTo(0.75)
    expect(soy.unit).toBe('cup')
  })

  it('parse measure "500 g" → amount=500 unit="g"', () => {
    const result = themealdbAdapter.normalize(sampleMeal, { ingredients: new Map() })
    const chicken = result.parsedData.ingredients[1]
    expect(chicken.amount).toBe(500)
    expect(chicken.unit).toBe('g')
  })

  it('split instructions en étapes', () => {
    const result = themealdbAdapter.normalize(sampleMeal, { ingredients: new Map() })
    expect(result.parsedData.steps.en).toHaveLength(3)
    expect(result.parsedData.steps.en[0]).toMatch(/Preheat/)
  })

  it('map fuzzy ingredients depuis catalogue', () => {
    const catalogue = new Map([
      ['gp-poulet', { id: 'gp-poulet', labels: { fr: 'Poulet', en: 'Chicken breast' } }],
    ])
    const result = themealdbAdapter.normalize(sampleMeal, { ingredients: catalogue })
    const chicken = result.parsedData.ingredients[1]
    expect(chicken.id).toBe('gp-poulet')
  })

  it('fetch utilise fetchFn override (test isolation)', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ categories: [{ strCategory: 'Beef' }] }) })
      .mockResolvedValueOnce({ json: async () => ({ meals: [{ idMeal: '1' }] }) })
      .mockResolvedValueOnce({ json: async () => ({ meals: [sampleMeal] }) })

    const meals = await themealdbAdapter.fetch({ fetchFn })
    expect(meals).toHaveLength(1)
    expect(meals[0].idMeal).toBe('52772')
  })
})

// ─── json-file-adapter ────────────────────────────────────────────────────────
describe('jsonFileAdapter', () => {
  it('SOURCE_NAME = json_file', () => {
    expect(jsonFileAdapter.SOURCE_NAME).toBe('json_file')
  })

  it('fetch depuis content JSON string (array)', async () => {
    const items = await jsonFileAdapter.fetch({
      content: JSON.stringify([{ name: { fr: 'Test 1' } }, { name: { fr: 'Test 2' } }]),
    })
    expect(items).toHaveLength(2)
    expect(items[0].name.fr).toBe('Test 1')
  })

  it('fetch depuis content JSON string (wrapped { recipes })', async () => {
    const items = await jsonFileAdapter.fetch({
      content: JSON.stringify({ batchName: 'b1', recipes: [{ id: 'r1' }] }),
    })
    expect(items).toHaveLength(1)
  })

  it('fetch depuis path utilise readFn override', async () => {
    const readFn = vi.fn().mockResolvedValue(JSON.stringify([{ id: 'r1' }]))
    const items = await jsonFileAdapter.fetch({ path: '/fake/path.json', readFn })
    expect(readFn).toHaveBeenCalledWith('/fake/path.json')
    expect(items).toHaveLength(1)
  })

  it('throw si ni content ni path', async () => {
    await expect(jsonFileAdapter.fetch({})).rejects.toThrow(/content.*path/)
  })

  it('normalize garde le shape + ajoute externalKey + status=draft', () => {
    const result = jsonFileAdapter.normalize({ id: 'r-123', name: { fr: 'X' } })
    expect(result.externalKey).toBe('json-r-123')
    expect(result.parsedData.status).toBe('draft')
    expect(result.parsedData.name.fr).toBe('X')
  })

  it('normalize sans id génère hash externalKey', () => {
    const r1 = jsonFileAdapter.normalize({ name: { fr: 'A' } })
    const r2 = jsonFileAdapter.normalize({ name: { fr: 'B' } })
    expect(r1.externalKey).toMatch(/^json-/)
    expect(r2.externalKey).toMatch(/^json-/)
    expect(r1.externalKey).not.toBe(r2.externalKey)
  })
})

// ─── admin-ui-adapter ────────────────────────────────────────────────────────
describe('adminUiAdapter', () => {
  it('SOURCE_NAME = admin_ui', () => {
    expect(adminUiAdapter.SOURCE_NAME).toBe('admin_ui')
  })

  it('fetch retourne array de 1 element', async () => {
    const items = await adminUiAdapter.fetch({ recipe: { name: { fr: 'Test' } } })
    expect(items).toHaveLength(1)
  })

  it('throw si recipe absent', async () => {
    await expect(adminUiAdapter.fetch({})).rejects.toThrow(/recipe/)
  })

  it('normalize inclut adminId dans externalKey', () => {
    const result = adminUiAdapter.normalize(
      { id: 'r1', name: { fr: 'Test' } },
      { adminId: 'admin-uuid-123' }
    )
    expect(result.externalKey).toContain('admin-admin-uuid-123-r1')
  })

  it('normalize sans recipe.id utilise timestamp', () => {
    const result = adminUiAdapter.normalize({ name: { fr: 'X' } }, { adminId: 'a1' })
    expect(result.externalKey).toMatch(/^admin-a1-\d+$/)
  })
})

// ─── Integration : adapters + validators (pipeline complet) ─────────────────
describe('adapters → validators integration', () => {
  it('themealdb → orchestrator complet sans crash', async () => {
    // Import dynamic pour éviter circular dep
    const { createOrchestrator } = await import('../../scripts/recipe-import/pipeline/orchestrator.mjs')
    const { completenessValidator } = await import('../../scripts/recipe-import/validators/completeness-validator.mjs')
    const { stepsValidator } = await import('../../scripts/recipe-import/validators/steps-validator.mjs')

    const meal = {
      idMeal: 'test', strMeal: 'Test meal', strCategory: 'Beef', strArea: 'French',
      strInstructions: 'Step one detailed.\nStep two detailed.\nStep three detailed.',
      strIngredient1: 'beef', strMeasure1: '200 g',
    }
    const { parsedData } = themealdbAdapter.normalize(meal, { ingredients: new Map() })
    const orch = createOrchestrator([completenessValidator, stepsValidator])
    const result = await orch.run(parsedData, {})
    expect(result.status).toBeDefined()
    expect(['valid', 'invalid']).toContain(result.status)
  })
})
