// src/test/unit/rows-to-ingredients.test.js
import { describe, it, expect } from 'vitest'
import { rowsToIngredients } from '@shared/contexts/data-provider'

describe('rowsToIngredients — carry des colonnes métadonnées BDD', () => {
  it('enrichit un item statique même si sa subcategory BDD DIFFÈRE (drift bof/cheese, le bug du 2026-08-27)', () => {
    // fr-brie vit dans le static sous la clé « bof » (l'écran Beurre-Œufs-
    // Fromage) mais en BDD sous « cheese ». La fusion par sous-catégorie ne le
    // trouvait jamais : ni icône, ni labels BDD — d'où les 22 fromages au même
    // 🧀 générique dans le frigo. L'enrichissement doit se faire PAR ID.
    const rows = [{
      id: 'fr-brie', labels: { fr: 'Brie de Meaux' }, emoji: '🧀',
      subcategory: 'cheese', sort_order: 1, group_id: 'fr-fromage',
      price: {}, seasonal_months: null,
      image_url: 'https://exemple.supabase.co/storage/v1/object/public/ingredient-icons/fr-brie.webp',
      nutrition: {}, allergens: ['milk'], breaks_diets: [], pack_size: {}, default_unit: null,
    }]
    const parsed = rowsToIngredients(rows)
    const occurrences = Object.values(parsed).flat().filter(i => i.id === 'fr-brie')
    expect(occurrences.length).toBeGreaterThan(0)
    for (const item of occurrences) {
      expect(item.image_url).toBe('https://exemple.supabase.co/storage/v1/object/public/ingredient-icons/fr-brie.webp')
      expect(item.labels.fr).toBe('Brie de Meaux')
    }
  })

  it('porte l\'image_url BDD sur un ingrédient présent dans le STATIC (le bug du 2026-08-27)', () => {
    // frz-poulet existe dans le static ⇒ passe par la branche MERGE. La fusion
    // recopiait tout SAUF image_url : les 653 icônes du bucket existaient mais
    // l'app les jetait ici, et chaque ingrédient du static retombait sur
    // l'emoji générique dans les listes du frigo.
    const rows = [{
      id: 'frz-poulet', labels: { fr: 'Poulet' }, emoji: '🍗',
      subcategory: 'frozen-meat', sort_order: 1, group_id: null,
      price: {}, seasonal_months: null,
      image_url: 'https://exemple.supabase.co/storage/v1/object/public/ingredient-icons/frz-poulet.webp',
      nutrition: {}, allergens: [], breaks_diets: [], pack_size: {}, default_unit: null,
    }]
    const parsed = rowsToIngredients(rows)
    const item = Object.values(parsed).flat().find(i => i.id === 'frz-poulet')
    expect(item.image_url).toBe('https://exemple.supabase.co/storage/v1/object/public/ingredient-icons/frz-poulet.webp')
  })

  it('porte nutrition/allergens/pack_size/breaks_diets/default_unit', () => {
    const rows = [{
      id: 'frz-poulet', labels: { fr: 'Poulet' }, emoji: '🍗',
      subcategory: 'frozen-meat', sort_order: 1, group_id: null,
      price: {}, seasonal_months: null, image_url: null,
      nutrition: { cal: 120, prot: 18, carb: 0, fat: 5, fib: 0, al: [] },
      allergens: [], breaks_diets: ['vegetarian', 'vegan'],
      pack_size: { fr: [{ size: 1, unit: 'kg', price: 8.5 }] },
      default_unit: 'g',
    }]
    const parsed = rowsToIngredients(rows)
    const item = Object.values(parsed).flat().find(i => i.id === 'frz-poulet')
    expect(item.nutrition.cal).toBe(120)
    expect(item.breaks_diets).toEqual(['vegetarian', 'vegan'])
    expect(item.default_unit).toBe('g')
    expect(item.pack_size.fr[0].size).toBe(1)
    expect(item.allergens).toEqual([])
  })

  it('porte les métadonnées d\'un ingrédient DB-only (sous-catégorie hors static)', () => {
    const rows = [{
      id: 'xx-test-db-only', labels: { fr: 'Test' }, emoji: '🧪',
      subcategory: 'xx-admin-only', sort_order: 1, group_id: null,
      price: {}, seasonal_months: null, image_url: null,
      nutrition: { cal: 50, prot: 1, carb: 1, fat: 1, fib: 0, al: [] },
      allergens: ['eggs'], breaks_diets: [],
      pack_size: { fr: [{ size: 1, unit: 'pcs', price: 1 }] },
      default_unit: 'piece',
    }]
    const parsed = rowsToIngredients(rows)
    const item = Object.values(parsed).flat().find(i => i.id === 'xx-test-db-only')
    expect(item.nutrition.cal).toBe(50)
    expect(item.allergens).toEqual(['eggs'])
    expect(item.default_unit).toBe('piece')
  })

  it('passe-plat static-only sans rows BDD (ne throw pas)', () => {
    const parsed = rowsToIngredients([])
    expect(typeof parsed).toBe('object')
    expect(Object.values(parsed).flat().some(i => i.id === 'frz-poulet')).toBe(true)
  })
})
