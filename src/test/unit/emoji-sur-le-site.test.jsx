import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { FLUENT_EMOJI_MAP } from '@shared/static/fluent-emoji-map'
import { AVATAR_CATALOG, getAvatarUrl } from '@shared/lib/avatars'
import Emoji from '@shared/ui/emoji'

// Décision du 2026-10-06, choix d'Antoine (« emoji = sur_le_site ») ;
// audit du 2026-10-04, SEC-06 / RGPD-09. Chaque emoji était une image demandée
// à api.iconify.design ou à cdn.jsdelivr.net : le navigateur leur donnait
// l'adresse IP du visiteur, avant tout choix de cookies. Les images sont
// maintenant servies par le site lui-même (public/emoji/).

function fichiers(dossier, motif, out = []) {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const p = join(dossier, e.name)
    if (e.isDirectory()) { if (!/test/.test(e.name)) fichiers(p, motif, out) }
    else if (motif.test(e.name)) out.push(p)
  }
  return out
}
const codepoints = (ch) => [...ch].map((c) => c.codePointAt(0).toString(16)).filter((c) => c !== 'fe0f' && c !== 'fe0e').join('-')

describe('les emoji viennent du site, plus d’un CDN', () => {
  it('aucune adresse d’Iconify ni de jsDelivr dans le code', () => {
    const fautifs = fichiers('src', /\.(js|jsx)$/).filter((f) => /api\.iconify\.design|cdn\.jsdelivr\.net/.test(readFileSync(f, 'utf8')))
    expect(fautifs).toEqual([])
  })

  it('le composant demande l’image au site (Fluent, puis Twemoji)', () => {
    const { container, unmount } = render(<Emoji char="🍅" />)
    expect(container.querySelector('img').getAttribute('src')).toMatch(/^\/[^/].*emoji\/fluent\/tomato\.svg$|^\/emoji\/fluent\/tomato\.svg$/)
    unmount()
    const { container: c2 } = render(<Emoji char="🪨" />)
    expect(c2.querySelector('img').getAttribute('src')).toMatch(/emoji\/twemoji\/1faa8\.svg$/)
  })

  it('les avatars aussi', () => {
    expect(getAvatarUrl('tomato')).toMatch(/emoji\/twemoji\/1f345\.svg$/)
  })
})

describe('chaque image existe, et ne contient rien d’exécutable', () => {
  it('les emoji Fluent de la table ont leur fichier', () => {
    const manquants = Object.values(FLUENT_EMOJI_MAP).filter((n) => !existsSync(`public/emoji/fluent/${n}.svg`))
    expect(manquants).toEqual([])
  })

  it('les avatars ont leur fichier', () => {
    expect(AVATAR_CATALOG.filter((a) => !existsSync(`public/emoji/twemoji/${a.code}.svg`)).map((a) => a.id)).toEqual([])
  })

  // Parcourt tout `src/` avec une expression Unicode : ≈ 2,5 s seul, davantage
  // quand la suite entière charge la machine (le délai par défaut est de 5 s).
  it('chaque emoji écrit dans le code a son image (Fluent ou Twemoji)', () => {
    const vus = new Set()
    for (const f of fichiers('src', /\.(js|jsx)$/)) for (const m of readFileSync(f, 'utf8').matchAll(/\p{RGI_Emoji}/gv)) vus.add(m[0])
    const fluent = new Set(Object.keys(FLUENT_EMOJI_MAP))
    const sansImage = [...vus].filter((e) => !fluent.has(e) && !existsSync(`public/emoji/twemoji/${codepoints(e)}.svg`))
    expect(sansImage).toEqual([])
  }, 30_000)

  it('aucun SVG ne contient de script, de gestionnaire d’événement ni de référence externe', () => {
    const DANGER = /<script|<foreignObject|\son[a-z]+\s*=|(xlink:)?href\s*=\s*["'](?!#)|url\(\s*["']?(?!#)/i
    const fautifs = fichiers('public/emoji', /\.svg$/).filter((f) => DANGER.test(readFileSync(f, 'utf8')))
    expect(fautifs).toEqual([])
  })
})

describe('l’application hors ligne ne précharge pas 380 images', () => {
  it('les emoji sont exclus du précache et mis en cache à la demande', () => {
    const config = readFileSync('vite.config.js', 'utf8')
    expect(config).toMatch(/'\*\*\/emoji\/\*\*'/)
    expect(config).toMatch(/cacheName: 'emoji'/)
  })
})
