import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Les pages privées ne sont pas référencées, et le robot peut le lire
// (audit du 2026-10-04, SEO-03).
//
// En production, `/login`, `/signup`, `/cart`, `/profile`, `/cook/…` et
// `/auth/…` répondaient 200, « index, follow », avec le titre de l'accueil :
// Google pouvait les référencer sous ce titre. Un en-tête `X-Robots-Tag:
// noindex` le leur interdit. Et `robots.txt` ne doit PAS interdire leur
// exploration : un robot qui ne passe pas ne voit jamais le `noindex`.

const RACINE = resolve(__dirname, '../../..')
const vercel = JSON.parse(readFileSync(resolve(RACINE, 'vercel.json'), 'utf8'))
const robots = readFileSync(resolve(RACINE, 'public/robots.txt'), 'utf8')

const reglesNoindex = vercel.headers.filter((h) => h.headers.some((x) => x.key === 'X-Robots-Tag' && /noindex/.test(x.value)))
const estNoindex = (chemin) => reglesNoindex.some((r) => new RegExp(`^${r.source}$`).test(chemin))

describe('pages privées pas référencées', () => {
  for (const chemin of ['/login', '/signup', '/cart', '/profile', '/profile/compte', '/cook/affogato', '/auth/recovery']) {
    it(`${chemin} : noindex`, () => expect(estNoindex(chemin)).toBe(true))
  }

  for (const chemin of ['/', '/faq', '/guide', '/legal', '/community', '/recipe/affogato', '/changelog']) {
    it(`${chemin} : référençable`, () => expect(estNoindex(chemin)).toBe(false))
  }

  it('robots.txt n’interdit que /api/, et garde le plan du site', () => {
    const interdits = [...robots.matchAll(/^Disallow:\s*(\S*)/gm)].map((m) => m[1])
    expect(interdits).toEqual(['/api/'])
    expect(robots).toMatch(/^Sitemap: https:\/\/fridgeplus\.app\/sitemap\.xml/m)
  })
})
