import { describe, it, expect } from 'vitest'
import { TOUR_STEPS_I18N } from '@features/onboarding/i18n/tour-steps-i18n'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PAGES_STATIQUES, SITE } from '../../../scripts/lib/prerender-page.mjs'

// Garde-fou de `public/llms.txt`.
//
// ── Ce que c'est, et ce que ça vaut ────────────────────────────────────────
// `llms.txt` est une convention proposée en 2024 : un index en Markdown, à la
// racine du site, qui dit à un modèle de langage quelles pages existent et de
// quoi elles parlent. Plusieurs éditeurs de modèles l'ont adoptée pour leur propre
// documentation.
//
// ⚠️ **Aucun moteur grand public n'a confirmé publiquement le consommer**, et
// Google dit explicitement que le fichier ne change rien sur ses surfaces. Le
// pari est donc à faible coût, pas une certitude — et il n'a de sens QUE parce
// que les pages listées servent désormais leur contenu dans le HTML : un index
// qui pointe vers des coquilles vides ne vaut rien.
//
// ── Ce que ce test empêche ────────────────────────────────────────────────
// Un fichier écrit à la main dérive en silence : il continue de pointer vers
// une page renommée ou supprimée, et rien ne casse. Les assertions ci-dessous
// le rattachent à `PAGES_STATIQUES`, la même source que le pré-rendu et le
// sitemap.

const FICHIER = readFileSync(resolve(process.cwd(), 'public/llms.txt'), 'utf8')

// Toutes les URL du fichier, dans l'ordre.
const liens = [...FICHIER.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map(m => m[1])

describe('llms.txt — la forme imposée par la convention', () => {
  it('commence par un H1 qui nomme le site', () => {
    // C'est le SEUL élément requis par la spécification ; tout le reste est
    // optionnel. S'il manque, le fichier n'est pas un llms.txt.
    expect(FICHIER.startsWith('# Fridge+')).toBe(true)
  })

  it('porte un résumé en citation, juste après le titre', () => {
    expect(FICHIER).toMatch(/^# Fridge\+\s*\n\s*\n> /)
  })

  it('groupe les liens sous des sections H2', () => {
    const sections = [...FICHIER.matchAll(/^## (.+)$/gm)].map(m => m[1])
    // La convention recommande 3 à 5 sections : assez pour orienter, assez peu
    // pour rester lisible d'un coup d'œil.
    expect(sections.length).toBeGreaterThanOrEqual(3)
    expect(sections.length).toBeLessThanOrEqual(5)
    // « Optional » a un sens précis : ce qui peut être ignoré sans perte.
    expect(sections).toContain('Optional')
  })

  it('accompagne chaque lien d’une note qui dit de quoi parle la page', () => {
    // Un lien sans description n'apprend rien à un lecteur automatique — c'est
    // exactement ce que le sitemap fait déjà, en mieux.
    const lignes = FICHIER.split('\n').filter(l => l.startsWith('- ['))
    expect(lignes.length).toBeGreaterThan(0)
    for (const ligne of lignes) {
      expect(ligne, `sans description : ${ligne}`).toMatch(/\):\s+\S/)
    }
  })
})

describe('llms.txt — cohérence avec le site réel', () => {
  it('ne pointe que vers des URL du domaine', () => {
    const etrangeres = liens.filter(u => !u.startsWith(SITE))
    expect(etrangeres).toEqual([])
  })

  it('chaque page listée est une page RÉELLE', () => {
    // Une page renommée ou retirée laisserait ici un lien mort, sans que rien
    // ne casse. On confronte à `PAGES_STATIQUES` — la source que lisent aussi
    // le pré-rendu et le générateur de sitemap.
    const connues = new Set([
      `${SITE}/`,
      `${SITE}/sitemap.xml`,
      ...PAGES_STATIQUES.map(p => `${SITE}${p.chemin}`),
    ])
    const inconnues = liens.filter(u => !connues.has(u))
    expect(inconnues).toEqual([])
  })

  it('n’oublie AUCUNE des pages publiques pré-rendues', () => {
    // L'inverse du test précédent : ajouter une page statique sans la déclarer
    // ici la rendrait invisible à l'index, en silence.
    const manquantes = PAGES_STATIQUES
      .map(p => `${SITE}${p.chemin}`)
      .filter(u => !liens.includes(u))
    expect(manquantes).toEqual([])
  })

  // 🔴 Mesuré le 2026-09-12 : ce fichier — écrit POUR les IA — annonçait
  // « français, anglais, espagnol, allemand et japonais » alors que l'app n'en
  // propose que deux. Le même mensonge avait été corrigé dans la documentation interne et dans
  // l'image OG le 27/08 ; il a survécu ici, à l'endroit précis où un modèle vient
  // chercher la description de référence du produit. Et il annonçait un guide
  // « en quatre étapes » qui en compte cinq depuis le 2026-09-11.
  it('ne promet que les langues réellement proposées', () => {
    expect(FICHIER).not.toMatch(/espagnol|allemand|japonais/i)
    expect(FICHIER).toMatch(/français et (en )?anglais|français, anglais/i)
  })

  it('annonce le bon nombre d’étapes du guide', () => {
    const etapesReelles = Object.keys(TOUR_STEPS_I18N.fr).filter(c => !c.startsWith('final')).length + 1
    expect(etapesReelles).toBe(5)
    expect(FICHIER).not.toMatch(/quatre étapes/)
    expect(FICHIER).toMatch(/cinq étapes/)
  })
})
