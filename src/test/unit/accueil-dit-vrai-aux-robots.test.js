import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SEO_META } from '@shared/static/seo-meta'
import { PREMIUM_ENABLED } from '@shared/lib/premium-config'

// Ce que l'accueil dit aux machines est vrai (audit du 2026-10-04, SEO-07).
//
// `index.html` — recopié dans les 522 pages pré-rendues — annonçait cinq
// langues (l'app en propose deux), un abonnement Premium à 4,99 € et 34,99 €
// (aucun paiement n'existe, et un visiteur ne voit aucun point d'entrée
// Premium), et une description « multilingue » que la page rendue ne dit plus.
// Google demande que le balisage reflète le contenu visible.

const HTML = readFileSync(resolve(__dirname, '../../../index.html'), 'utf8')
const blocsJsonLd = [...HTML.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1])
const application = blocsJsonLd.map((b) => JSON.parse(b)).find((d) => d['@type'] === 'WebApplication')

describe('l’accueil dit vrai aux robots', () => {
  it('le balisage de l’application se lit (témoin)', () => {
    expect(application).toBeTruthy()
  })

  it('deux langues, pas cinq', () => {
    expect(application.inLanguage).toEqual(['fr-FR', 'en-US'])
    expect(HTML).not.toMatch(/og:locale:alternate"\s+content="(es_ES|de_DE|ja_JP)"/)
    expect(JSON.stringify(application)).not.toMatch(/\b(ES|DE|JA)\b/)
  })

  it('aucune offre payante tant que le Premium est fermé', () => {
    expect(PREMIUM_ENABLED).toBe(false)
    const offres = [].concat(application.offers ?? [])
    expect(offres.length).toBeGreaterThan(0)
    for (const offre of offres) expect(Number(offre.price)).toBe(0)
    expect(JSON.stringify(application)).not.toMatch(/Premium/)
  })

  it('le JSON-LD n’embarque pas d’entités HTML', () => {
    for (const bloc of blocsJsonLd) expect(bloc).not.toMatch(/&amp;|&lt;|&gt;/)
  })

  it('la description servie est celle de la page rendue', () => {
    const description = HTML.match(/<meta name="description" content="([^"]*)"/)[1]
    expect(description.replace(/&#39;|'/g, '’')).toBe(SEO_META.fr.description.replace(/'/g, '’'))
  })
})
