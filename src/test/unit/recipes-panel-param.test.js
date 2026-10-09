import { describe, it, expect } from 'vitest'
import {
  RECIPES_PANEL_PARAM,
  isRecipesPanelOpen,
  withRecipesPanel,
} from '@shared/lib/recipes/recipes-panel-param'

describe('recipes-panel-param', () => {
  describe('isRecipesPanelOpen', () => {
    it('détecte le panneau ouvert', () => {
      expect(isRecipesPanelOpen('?recettes=1')).toBe(true)
    })
    it('fermé si param absent', () => {
      expect(isRecipesPanelOpen('')).toBe(false)
      expect(isRecipesPanelOpen('?q=tomate')).toBe(false)
    })
    it('fermé si valeur ≠ 1', () => {
      expect(isRecipesPanelOpen('?recettes=0')).toBe(false)
    })
  })

  describe('withRecipesPanel', () => {
    it('ajoute le param sans perdre les autres', () => {
      const out = withRecipesPanel('?q=tomate&diet=vegan', true)
      expect(out.get(RECIPES_PANEL_PARAM)).toBe('1')
      expect(out.get('q')).toBe('tomate')
      expect(out.get('diet')).toBe('vegan')
    })
    it('retire le param sans perdre les autres', () => {
      const out = withRecipesPanel('?recettes=1&q=tomate', false)
      expect(out.has(RECIPES_PANEL_PARAM)).toBe(false)
      expect(out.get('q')).toBe('tomate')
    })
    it('ne mute pas la querystring source', () => {
      const src = '?q=tomate'
      withRecipesPanel(src, true)
      expect(src).toBe('?q=tomate')
    })
  })
})
