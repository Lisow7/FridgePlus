import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// `public/404.html` est la page que Vercel sert pour un FICHIER inconnu
// (`/favicon.ico`, `/une-image-absente.png`…). Elle datait de l'hébergement
// sur GitHub Pages, où le site vivait sous `/FridgePlus/` : son logo et son
// bouton « Retour à l'accueil » pointaient encore là. En production cette
// adresse n'existe pas — la sortie de la page d'erreur menait à une autre page
// d'erreur (audit du 2026-10-04, SEO-08).
const html = readFileSync(resolve(process.cwd(), 'public/404.html'), 'utf8')

describe('page 404 statique', () => {
  it('ne renvoie plus vers /FridgePlus/', () => {
    expect(html).not.toContain('/FridgePlus')
  })

  it('son logo et son bouton ramènent à l’accueil du site', () => {
    const liens = [...html.matchAll(/<a\s+href="([^"]*)"/g)].map(m => m[1])
    expect(liens.length).toBeGreaterThanOrEqual(2)
    expect(liens.every(href => href === '/')).toBe(true)
  })

  it('reste hors de l’index des moteurs', () => {
    expect(html).toMatch(/<meta\s+name="robots"\s+content="noindex/)
  })
})
