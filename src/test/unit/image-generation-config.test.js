// Config de génération d'images (modèle / qualité / coût) — migration du
// 2026-08-26 : `gpt-image-1` est déprécié par OpenAI au 23 octobre 2026,
// le défaut devient `gpt-image-1-mini` (décision lot 2, la feuille de route interne).
import { describe, it, expect } from 'vitest'
import { resolveGenerationConfig } from '../../../scripts/lib/image-generation-config.mjs'

describe('resolveGenerationConfig', () => {
  it('par défaut : gpt-image-1-mini en medium', () => {
    const cfg = resolveGenerationConfig({})
    expect(cfg.model).toBe('gpt-image-1-mini')
    expect(cfg.quality).toBe('medium')
  })

  it('le coût estimé suit la qualité (mini, tarifs 2026-08-26 arrondis haut)', () => {
    expect(resolveGenerationConfig({ quality: 'low' }).costPerImage).toBe(0.01)
    expect(resolveGenerationConfig({ quality: 'medium' }).costPerImage).toBe(0.02)
    expect(resolveGenerationConfig({ quality: 'high' }).costPerImage).toBe(0.06)
  })

  it('--model et --quality surchargent le défaut', () => {
    const cfg = resolveGenerationConfig({ model: 'gpt-image-2', quality: 'low' })
    expect(cfg.model).toBe('gpt-image-2')
    expect(cfg.quality).toBe('low')
  })

  it('un modèle non-mini garde une estimation CONSERVATRICE', () => {
    // Les tarifs des gros modèles varient ; on reprend le plafond historique
    // observé (0,15 $/photo) plutôt qu'un chiffre optimiste.
    const cfg = resolveGenerationConfig({ model: 'gpt-image-2', quality: 'high' })
    expect(cfg.costPerImage).toBeGreaterThanOrEqual(0.15)
  })

  it('gpt-image-1 est accepté mais signalé DÉPRÉCIÉ (retrait OpenAI 2026-10-23)', () => {
    const cfg = resolveGenerationConfig({ model: 'gpt-image-1' })
    expect(cfg.deprecationWarning).toMatch(/2026-10-23/)
  })

  it('les autres modèles ne portent aucun avertissement', () => {
    expect(resolveGenerationConfig({}).deprecationWarning).toBeNull()
  })

  it('refuse un modèle inconnu', () => {
    expect(() => resolveGenerationConfig({ model: 'dall-e-9' })).toThrow(/mod/i)
  })

  it('refuse une qualité inconnue (auto compris — la cause de la facture de 82,57 $)', () => {
    expect(() => resolveGenerationConfig({ quality: 'auto' })).toThrow(/qualit/i)
    expect(() => resolveGenerationConfig({ quality: 'ultra' })).toThrow(/qualit/i)
  })
})
