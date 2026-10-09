// Tests unit pour les 7 validators MVP + orchestrator + error-codes/severity.
// Refonte Recettes Phase 2 — Sprint 18.

import { describe, it, expect, vi } from 'vitest'
import { ERROR_CODES, hasBlockingError, codesBySeverity } from '../../scripts/recipe-import/pipeline/error-codes.mjs'
import { SEVERITY, isWorse, maxSeverity, compareSeverity } from '../../scripts/recipe-import/pipeline/severity.mjs'
import { createOrchestrator, makeError } from '../../scripts/recipe-import/pipeline/orchestrator.mjs'
import { ingredientMapper } from '../../scripts/recipe-import/validators/ingredient-mapper.mjs'
import { nutritionValidator } from '../../scripts/recipe-import/validators/nutrition-validator.mjs'
import { stepsValidator } from '../../scripts/recipe-import/validators/steps-validator.mjs'
import { dietConsistencyChecker } from '../../scripts/recipe-import/validators/diet-consistency-checker.mjs'
import { duplicateDetector } from '../../scripts/recipe-import/validators/duplicate-detector.mjs'
import { completenessValidator } from '../../scripts/recipe-import/validators/completeness-validator.mjs'
import { relationsResolver } from '../../scripts/recipe-import/validators/relations-resolver.mjs'

// ─── severity.mjs ───────────────────────────────────────────────────────────
describe('severity', () => {
  it('isWorse compare correctement', () => {
    expect(isWorse('blocking', 'warning')).toBe(true)
    expect(isWorse('warning', 'blocking')).toBe(false)
    expect(isWorse('error', 'error')).toBe(false)
  })

  it('maxSeverity retourne le pire d\'une liste', () => {
    const errors = [{ severity: 'warning' }, { severity: 'blocking' }, { severity: 'info' }]
    expect(maxSeverity(errors)).toBe('blocking')
  })

  it('maxSeverity retourne null sur liste vide', () => {
    expect(maxSeverity([])).toBe(null)
    expect(maxSeverity(null)).toBe(null)
  })

  it('compareSeverity utilisable pour sort', () => {
    const errs = [{ severity: 'warning' }, { severity: 'blocking' }, { severity: 'info' }]
    errs.sort((a, b) => compareSeverity(b.severity, a.severity))
    expect(errs[0].severity).toBe('blocking')
  })
})

// ─── error-codes.mjs ─────────────────────────────────────────────────────────
describe('error-codes', () => {
  it('chaque code a severity + category', () => {
    for (const [code, meta] of Object.entries(ERROR_CODES)) {
      expect(meta.severity, `${code} severity`).toBeDefined()
      expect(meta.category, `${code} category`).toBeDefined()
      expect(Object.values(SEVERITY)).toContain(meta.severity)
    }
  })

  it('hasBlockingError détecte un code blocking', () => {
    expect(hasBlockingError([{ code: 'STEPS_MISSING' }])).toBe(true)
    expect(hasBlockingError([{ code: 'MISSING_EMOJI' }])).toBe(false)
    expect(hasBlockingError([])).toBe(false)
  })

  it('codesBySeverity filtre correctement', () => {
    const blocking = codesBySeverity(SEVERITY.BLOCKING)
    expect(blocking).toContain('STEPS_MISSING')
    expect(blocking).toContain('NO_INGREDIENTS')
    expect(blocking).not.toContain('MISSING_EMOJI')
  })
})

// ─── orchestrator.mjs ───────────────────────────────────────────────────────
describe('orchestrator', () => {
  it('makeError throw sur code inconnu', () => {
    expect(() => makeError('UNKNOWN_CODE')).toThrow(/Unknown error code/)
  })

  it('makeError construit erreur valide', () => {
    const err = makeError('MISSING_EMOJI', { field: 'emoji', raw: null })
    expect(err.code).toBe('MISSING_EMOJI')
    expect(err.severity).toBe(SEVERITY.WARNING)
    expect(err.field).toBe('emoji')
  })

  it('orchestrator run sans validators retourne valid', async () => {
    const orch = createOrchestrator([])
    const result = await orch.run({ test: 1 })
    expect(result.status).toBe('valid')
    expect(result.errors).toEqual([])
  })

  it('orchestrator run avec validator OK garde status valid', async () => {
    const okValidator = vi.fn(() => ({ ok: true, errors: [], parsedData: { x: 1 } }))
    const orch = createOrchestrator([okValidator])
    const result = await orch.run({ x: 0 })
    expect(okValidator).toHaveBeenCalled()
    expect(result.status).toBe('valid')
  })

  it('orchestrator catche les erreurs throw d\'un validator', async () => {
    const buggy = () => { throw new Error('boom') }
    const orch = createOrchestrator([buggy])
    const result = await orch.run({})
    expect(result.errors[0].code).toBe('VALIDATOR_THREW')
    // Errors with code 'VALIDATOR_THREW' don't have meta in ERROR_CODES,
    // so they don't trigger hasBlockingError → status stays valid.
    // L'important : pipeline ne crash pas + erreur loggée.
  })

  it('orchestrator marque invalid si blocking error', async () => {
    const blocking = () => ({
      ok: false,
      errors: [makeError('STEPS_MISSING', { field: 'steps' })],
    })
    const orch = createOrchestrator([blocking])
    const result = await orch.run({})
    expect(result.status).toBe('invalid')
  })

  it('orchestrator émet events lifecycle', async () => {
    const onBefore = vi.fn()
    const onAfter = vi.fn()
    const orch = createOrchestrator([])
    orch.on('before-validate', onBefore)
    orch.on('after-validate', onAfter)
    await orch.run({})
    expect(onBefore).toHaveBeenCalled()
    expect(onAfter).toHaveBeenCalled()
  })
})

// ─── ingredient-mapper ───────────────────────────────────────────────────────
describe('ingredient-mapper', () => {
  const catalogue = new Map([
    ['gp-tomate', { id: 'gp-tomate', allergens: [], breaks_diets: [] }],
    ['gp-pates', { id: 'gp-pates', allergens: ['gluten'], breaks_diets: ['gluten_free'] }],
  ])

  it('passe si tous les ingrédients existent', () => {
    const result = ingredientMapper(
      { ingredients: [{ id: 'gp-tomate', amount: 100, unit: 'g' }] },
      { ingredients: catalogue }
    )
    expect(result.ok).toBe(true)
  })

  it('détecte orphan required → BLOCKING', () => {
    const result = ingredientMapper(
      { ingredients: [{ id: 'gp-unknown', amount: 100, unit: 'g', required: true }] },
      { ingredients: catalogue }
    )
    expect(result.ok).toBe(false)
    expect(result.errors[0].code).toBe('INGREDIENT_ORPHAN_REQUIRED')
    expect(result.errors[0].severity).toBe(SEVERITY.BLOCKING)
  })

  it('détecte orphan optional → ERROR', () => {
    const result = ingredientMapper(
      { ingredients: [{ id: 'gp-unknown', amount: 100, unit: 'g', required: false }] },
      { ingredients: catalogue }
    )
    expect(result.errors[0].code).toBe('INGREDIENT_ORPHAN_OPTIONAL')
  })

  it('détecte missing qty + unit', () => {
    const result = ingredientMapper(
      { ingredients: [{ id: 'gp-tomate' }] },
      { ingredients: catalogue }
    )
    expect(result.errors[0].code).toBe('INGREDIENT_SLOTS_MISSING_QTY')
  })

  it('skip si pas d\'ingrédients (autre validator s\'en charge)', () => {
    const result = ingredientMapper({ ingredients: [] }, { ingredients: catalogue })
    expect(result.ok).toBe(true)
  })
})

// ─── nutrition-validator ─────────────────────────────────────────────────────
describe('nutrition-validator', () => {
  it('passe sans erreur si nutrition cohérente Atwater', () => {
    const result = nutritionValidator({
      nutrition: { calories: 100, protein: 5, carbs: 10, fat: 4 } // 5*4 + 10*4 + 4*9 = 96 (proche)
    })
    expect(result.ok).toBe(true)
  })

  it('détecte kcal=0 + macros présents', () => {
    const result = nutritionValidator({
      nutrition: { calories: 0, protein: 10, carbs: 10, fat: 5 }
    })
    expect(result.errors[0].code).toBe('NUTRITION_ZERO_KCAL')
  })

  it('détecte écart kcal vs Atwater > 30%', () => {
    const result = nutritionValidator({
      nutrition: { calories: 100, protein: 50, carbs: 50, fat: 50 } // Atwater = 850 → diff 750 % >> 30 %
    })
    expect(result.errors[0].code).toBe('NUTRITION_MACROS_INCONSISTENT')
  })

  it('skip si pas de nutrition', () => {
    expect(nutritionValidator({}).ok).toBe(true)
  })
})

// ─── steps-validator ────────────────────────────────────────────────────────
describe('steps-validator', () => {
  it('détecte steps absent → BLOCKING', () => {
    const result = stepsValidator({ steps: null })
    expect(result.errors[0].code).toBe('STEPS_MISSING')
    expect(result.errors[0].severity).toBe(SEVERITY.BLOCKING)
  })

  it('détecte steps string brut → ERROR', () => {
    const result = stepsValidator({ steps: 'Mélanger puis cuire' })
    expect(result.errors[0].code).toBe('STEPS_NOT_ARRAY')
  })

  it('détecte <3 étapes → WARNING', () => {
    const result = stepsValidator({ steps: { fr: ['Étape unique de plus de 10 chars'] } })
    expect(result.errors[0].code).toBe('STEPS_TOO_SHORT')
  })

  it('détecte étape <10 chars dans liste correcte', () => {
    const result = stepsValidator({
      steps: { fr: ['Première étape avec assez de chars', 'Salt', 'Troisième étape qui est correcte'] }
    })
    expect(result.errors[0].code).toBe('STEPS_TOO_SHORT')
  })

  it('passe avec 3+ étapes longues', () => {
    const result = stepsValidator({
      steps: { fr: [
        'Première étape avec contenu détaillé',
        'Deuxième étape avec instructions précises',
        'Troisième étape pour finaliser la recette',
      ] }
    })
    expect(result.ok).toBe(true)
  })
})

// ─── diet-consistency-checker ───────────────────────────────────────────────
describe('diet-consistency-checker', () => {
  const catalogue = new Map([
    ['gp-lait', { id: 'gp-lait', allergens: ['milk'], breaks_diets: ['vegan', 'dairy_free'] }],
    ['gp-tomate', { id: 'gp-tomate', allergens: [], breaks_diets: [] }],
  ])

  it('détecte recipe vegan avec ingredient milk → BLOCKING', () => {
    const result = dietConsistencyChecker(
      { diet: ['vegan'], ingredients: [{ id: 'gp-lait', amount: 100 }] },
      { ingredients: catalogue }
    )
    expect(result.errors[0].code).toBe('DIET_INCONSISTENT_HARD')
    expect(result.errors[0].severity).toBe(SEVERITY.BLOCKING)
  })

  it('passe si diet cohérent', () => {
    const result = dietConsistencyChecker(
      { diet: ['vegetarian'], ingredients: [{ id: 'gp-tomate' }, { id: 'gp-lait' }] },
      { ingredients: catalogue }
    )
    expect(result.ok).toBe(true)
  })

  it('skip si pas de diet déclaré', () => {
    const result = dietConsistencyChecker(
      { diet: [], ingredients: [{ id: 'gp-lait' }] },
      { ingredients: catalogue }
    )
    expect(result.ok).toBe(true)
  })
})

// ─── diet-consistency-checker v2 format ──────────────────────────────────────
describe('diet-consistency-checker (format enrichi v2)', () => {
  const catalogue = new Map([
    ['gp-lait', { id: 'gp-lait', allergens: ['milk'], breaks_diets: ['vegan', 'dairy_free'] }],
    ['gp-tomate', { id: 'gp-tomate', allergens: [], breaks_diets: [] }],
  ])

  it('détecte DIET_INCONSISTENT_HARD avec format v2 (groups)', () => {
    const result = dietConsistencyChecker(
      {
        diet: ['vegan'],
        ingredients: {
          groups: [
            { name: { fr: 'Base' }, items: [{ id: 'gp-lait', amount: 100, unit: 'ml' }] },
          ],
        },
      },
      { ingredients: catalogue }
    )
    expect(result.errors[0].code).toBe('DIET_INCONSISTENT_HARD')
  })

  it('passe si diet cohérent avec format v2 (groups)', () => {
    const result = dietConsistencyChecker(
      {
        diet: ['vegetarian'],
        ingredients: {
          groups: [
            { name: { fr: 'Base' }, items: [{ id: 'gp-tomate', amount: 200, unit: 'g' }] },
          ],
        },
      },
      { ingredients: catalogue }
    )
    expect(result.ok).toBe(true)
  })
})

// ─── duplicate-detector ──────────────────────────────────────────────────────
describe('duplicate-detector', () => {
  const existing = new Map([
    ['spaghetti carbonara', 'carbo-1'],
    ['quiche lorraine', 'quiche-1'],
  ])

  it('détecte exact match', () => {
    const result = duplicateDetector(
      { name: { fr: 'Spaghetti Carbonara' } },
      { existingRecipes: existing }
    )
    expect(result.errors[0].code).toBe('DUPLICATE_NAME_EXACT')
  })

  it('détecte fuzzy match Levenshtein <=2', () => {
    const result = duplicateDetector(
      { name: { fr: 'Spaghetti Carbonarra' } }, // 1 char extra
      { existingRecipes: existing }
    )
    expect(result.errors[0].code).toBe('DUPLICATE_NAME_FUZZY')
  })

  it('passe si nom différent', () => {
    const result = duplicateDetector(
      { name: { fr: 'Tarte aux pommes' } },
      { existingRecipes: existing }
    )
    expect(result.ok).toBe(true)
  })

  it('exclut self (re-validation existante)', () => {
    const result = duplicateDetector(
      { id: 'carbo-1', name: { fr: 'Spaghetti Carbonara' } },
      { existingRecipes: existing }
    )
    expect(result.ok).toBe(true)
  })
})

// ─── completeness-validator ─────────────────────────────────────────────────
describe('completeness-validator', () => {
  it('détecte no_ingredients → BLOCKING', () => {
    const result = completenessValidator({ ingredients: [], status: 'published' })
    expect(result.errors.find(e => e.code === 'NO_INGREDIENTS')).toBeDefined()
  })

  it('détecte missing description.fr sur publish', () => {
    const result = completenessValidator({
      ingredients: [{ id: 'x' }],
      status: 'published',
      description: { fr: '', en: 'Some desc' },
      emoji: '🥗',
      country: 'fr',
    })
    expect(result.errors.find(e => e.code === 'MISSING_DESCRIPTION_FR')).toBeDefined()
  })

  it('détecte missing emoji par défaut', () => {
    const result = completenessValidator({
      ingredients: [{ id: 'x' }],
      emoji: '🍳', // default placeholder
    })
    expect(result.errors.find(e => e.code === 'MISSING_EMOJI')).toBeDefined()
  })

  it('détecte servings hors range', () => {
    const result = completenessValidator({
      ingredients: [{ id: 'x' }], servings: 50, status: 'draft', emoji: '🥗',
    })
    expect(result.errors.find(e => e.code === 'INVALID_SERVINGS')).toBeDefined()
  })

  it('skip desc check si status=draft', () => {
    const result = completenessValidator({
      ingredients: [{ id: 'x' }], status: 'draft', description: { fr: '', en: '' }, emoji: '🥗',
    })
    expect(result.errors.find(e => e.code === 'MISSING_DESCRIPTION_FR')).toBeUndefined()
  })

  it('accepte le format enrichi v2 (groups) — no NO_INGREDIENTS error', () => {
    const result = completenessValidator({
      ingredients: {
        groups: [
          { name: { fr: 'Base' }, items: [{ id: 'gp-tomate', amount: 200, unit: 'g' }] },
        ],
      },
      status: 'draft',
      emoji: '🥗',
    })
    expect(result.errors.find(e => e.code === 'NO_INGREDIENTS')).toBeUndefined()
  })

  it('détecte NO_INGREDIENTS avec format v2 sans items', () => {
    const result = completenessValidator({
      ingredients: { groups: [] },
      status: 'draft',
      emoji: '🥗',
    })
    expect(result.errors.find(e => e.code === 'NO_INGREDIENTS')).toBeDefined()
  })
})

// ─── relations-resolver ──────────────────────────────────────────────────────
describe('relations-resolver', () => {
  const lookup = new Map([
    ['carbonara', 'carbo-1'],
    ['carbo-1', 'carbo-1'],
    ['bechamel', 'bechamel-base'],
  ])

  it('résout slug → target_id', () => {
    const result = relationsResolver(
      { relations: [{ type: 'sub_recipe', target_slug: 'bechamel' }] },
      { recipesByNameAndId: lookup }
    )
    expect(result.ok).toBe(true)
    expect(result.parsedData.relations[0].target_id).toBe('bechamel-base')
  })

  it('détecte slug introuvable → ERROR', () => {
    const result = relationsResolver(
      { relations: [{ type: 'pairs_well', target_slug: 'unknown-recipe' }] },
      { recipesByNameAndId: lookup }
    )
    expect(result.errors[0].code).toBe('RELATIONS_PARENT_UNRESOLVED')
  })

  it('détecte type invalide', () => {
    const result = relationsResolver(
      { relations: [{ type: 'bogus_type', target_slug: 'carbonara' }] },
      { recipesByNameAndId: lookup }
    )
    expect(result.errors[0].code).toBe('RELATIONS_PARENT_UNRESOLVED')
  })

  it('skip si pas de relations', () => {
    const result = relationsResolver({}, { recipesByNameAndId: lookup })
    expect(result.ok).toBe(true)
  })
})

// ─── seo-schema-validator ───────────────────────────────────────────────────
import { seoSchemaValidator } from '../../scripts/recipe-import/validators/seo-schema-validator.mjs'

describe('seoSchemaValidator', () => {
  const baseRecipe = {
    status: 'published',
    name: { fr: 'X' },
    description: { fr: 'X' },
    type: 'main',
    time_min: 30,
    diet: ['vegetarian'],
    functional_tags: ['quick'],
    servings: 4,
    country: 'FR',
    ingredients: [{ ids: ['fr-tomate'], qty: { amount: 200, unit: 'g' }, required: true }],
    steps: [{ text: 'cuire' }],
  }

  it('OK quand tous les champs SEO sont présents', () => {
    const { ok, errors } = seoSchemaValidator(baseRecipe)
    expect(ok).toBe(true)
    expect(errors).toEqual([])
  })

  it('warning SEO_MISSING_TIME si aucun champ temps', () => {
    const r = { ...baseRecipe, time_min: undefined, prep_time_min: undefined, cook_time_min: undefined }
    const { errors } = seoSchemaValidator(r)
    expect(errors.find(e => e.code === 'SEO_MISSING_TIME')).toBeDefined()
    expect(errors.find(e => e.code === 'SEO_MISSING_TIME').severity).toBe('warning')
  })

  it('OK si seulement prep_time_min est défini', () => {
    const r = { ...baseRecipe, time_min: undefined, prep_time_min: 15, cook_time_min: undefined }
    const { errors } = seoSchemaValidator(r)
    expect(errors.find(e => e.code === 'SEO_MISSING_TIME')).toBeUndefined()
  })

  it('OK si seulement cook_time_min est défini', () => {
    const r = { ...baseRecipe, time_min: undefined, prep_time_min: undefined, cook_time_min: 20 }
    const { errors } = seoSchemaValidator(r)
    expect(errors.find(e => e.code === 'SEO_MISSING_TIME')).toBeUndefined()
  })

  it('warning SEO_MISSING_KEYWORDS si diet et functional_tags vides', () => {
    const r = { ...baseRecipe, diet: [], functional_tags: [] }
    const { errors } = seoSchemaValidator(r)
    expect(errors.find(e => e.code === 'SEO_MISSING_KEYWORDS')).toBeDefined()
  })

  it('OK si diet présent et functional_tags vide', () => {
    const r = { ...baseRecipe, diet: ['vegan'], functional_tags: [] }
    const { errors } = seoSchemaValidator(r)
    expect(errors.find(e => e.code === 'SEO_MISSING_KEYWORDS')).toBeUndefined()
  })

  it('warning SEO_MISSING_CATEGORY si type manquant', () => {
    const r = { ...baseRecipe, type: undefined }
    const { errors } = seoSchemaValidator(r)
    expect(errors.find(e => e.code === 'SEO_MISSING_CATEGORY')).toBeDefined()
  })

  it('skip si status != published|featured', () => {
    const r = { ...baseRecipe, status: 'draft', type: undefined, time_min: undefined, diet: [], functional_tags: [] }
    const { ok, errors } = seoSchemaValidator(r)
    expect(ok).toBe(true)
    expect(errors).toEqual([])
  })

  it('cumule les warnings si plusieurs champs manquants', () => {
    const r = { status: 'published' }
    const { errors } = seoSchemaValidator(r)
    expect(errors.length).toBe(3)
    expect(errors.map(e => e.code).sort()).toEqual(['SEO_MISSING_CATEGORY', 'SEO_MISSING_KEYWORDS', 'SEO_MISSING_TIME'])
  })

  it('expose displayName pour debugging', () => {
    expect(seoSchemaValidator.displayName).toBe('seo-schema-validator')
  })
})

// ─── Integration pipeline complet ────────────────────────────────────────────
describe('pipeline integration (orchestrator + tous validators)', () => {
  const catalogue = new Map([
    ['gp-tomate', { id: 'gp-tomate', allergens: [], breaks_diets: [] }],
    ['gp-pates', { id: 'gp-pates', allergens: ['gluten'], breaks_diets: ['gluten_free'] }],
    ['gp-lait', { id: 'gp-lait', allergens: ['milk'], breaks_diets: ['vegan'] }],
  ])

  const existingRecipes = new Map([['spaghetti carbonara', 'carbo-1']])
  const recipesByNameAndId = new Map([['carbonara', 'carbo-1'], ['carbo-1', 'carbo-1']])

  const context = { ingredients: catalogue, existingRecipes, recipesByNameAndId }

  function makePipeline() {
    return createOrchestrator([
      completenessValidator,
      ingredientMapper,
      nutritionValidator,
      stepsValidator,
      dietConsistencyChecker,
      duplicateDetector,
      relationsResolver,
    ])
  }

  it('recette parfaite passe le pipeline', async () => {
    const orch = makePipeline()
    const result = await orch.run({
      id: 'tarte-pommes',
      name: { fr: 'Tarte aux pommes' },
      status: 'published',
      description: { fr: 'Recette classique', en: 'Classic recipe' },
      emoji: '🥧',
      country: 'fr',
      servings: 4,
      time_min: 60,
      ingredients: [{ id: 'gp-tomate', amount: 200, unit: 'g' }],
      nutrition: { calories: 100, protein: 3, carbs: 15, fat: 4 },
      steps: { fr: ['Préparer la pâte avec soin', 'Disposer les pommes en rosace', 'Enfourner 40 min à 180°C'] },
      diet: [],
    }, context)
    expect(result.status).toBe('valid')
  })

  it('recette avec multiples problèmes accumule erreurs', async () => {
    const orch = makePipeline()
    const result = await orch.run({
      name: { fr: 'Spaghetti Carbonara' }, // doublon exact
      status: 'published',
      description: { fr: '', en: '' }, // manquante
      emoji: '🍳', // default
      country: '', // manquant
      servings: 0, // invalide
      ingredients: [
        { id: 'gp-pates', amount: 250, unit: 'g' },
        { id: 'gp-lait', amount: 100, unit: 'ml' },
      ],
      diet: ['vegan'], // incohérent avec gp-lait
      steps: { fr: ['Court'] }, // <3 et court
    }, context)

    const codes = result.errors.map(e => e.code)
    expect(codes).toContain('DIET_INCONSISTENT_HARD')
    expect(codes).toContain('DUPLICATE_NAME_EXACT')
    expect(codes).toContain('MISSING_EMOJI')
    expect(codes).toContain('MISSING_DESCRIPTION_FR')
    expect(codes).toContain('STEPS_TOO_SHORT')
    expect(result.status).toBe('invalid') // diet_inconsistent_hard = blocking
  })
})

import { schemaVersionDetector } from '../../scripts/recipe-import/validators/schema-version-detector.mjs'

describe('schemaVersionDetector', () => {
  it('OK pour format ENRICHI v2 (objet avec groups)', () => {
    const r = { ingredients: { groups: [{ name: { fr: 'G1' }, items: [{ id: 'gp-pates', amount: 200, unit: 'g' }] }] } }
    const { ok, errors } = schemaVersionDetector(r)
    expect(ok).toBe(true)
    expect(errors).toEqual([])
  })

  it('INFO SCHEMA_LEGACY_INGREDIENTS pour format LEGACY (array)', () => {
    const r = { ingredients: [{ ids: ['gp-pates'], qty: { amount: 200, unit: 'g' } }] }
    const { ok, errors } = schemaVersionDetector(r)
    expect(ok).toBe(false)
    expect(errors[0].code).toBe('SCHEMA_LEGACY_INGREDIENTS')
    expect(errors[0].severity).toBe('info')
  })

  it('OK si ingredients absent (rien à flag)', () => {
    expect(schemaVersionDetector({}).ok).toBe(true)
    expect(schemaVersionDetector({ ingredients: null }).ok).toBe(true)
  })

  it('INFO si format inconnu (string par ex)', () => {
    const { ok, errors } = schemaVersionDetector({ ingredients: 'random' })
    expect(ok).toBe(false)
    expect(errors[0].code).toBe('SCHEMA_LEGACY_INGREDIENTS')
  })

  it('OK si objet avec groups vide (format v2 valide juste vide)', () => {
    expect(schemaVersionDetector({ ingredients: { groups: [] } }).ok).toBe(true)
  })

  it('expose displayName pour debugging', () => {
    expect(schemaVersionDetector.displayName).toBe('schema-version-detector')
  })
})
