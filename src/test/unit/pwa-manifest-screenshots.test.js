// Cohérence des screenshots du manifeste PWA (vite.config.js) avec les
// fichiers réels de public/screenshots/.
//
// Pourquoi ce garde-fou : une entrée `screenshots` qui pointe vers un fichier
// absent ou déclare une taille fausse ne casse RIEN au build — Chrome ignore
// l'entrée en silence et PWABuilder/Play la rejettent bien plus tard, au
// moment de l'empaquetage. Même famille de piège que le sitemap : le fichier
// versionné doit rester cohérent avec ce qu'il déclare.
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(__dirname, '../../..')
const viteConfig = readFileSync(path.join(ROOT, 'vite.config.js'), 'utf8')

// Le bloc `screenshots: [...]` du manifeste, capturé puis parsé ligne à ligne.
const bloc = viteConfig.match(/screenshots:\s*\[([\s\S]*?)\]/)
const entrees = [...(bloc?.[1] ?? '').matchAll(
  /screenshots\/([\w-]+\.jpg)`,\s*sizes:\s*'(\d+)x(\d+)'/g,
)].map(([, fichier, largeur, hauteur]) => ({
  fichier, largeur: Number(largeur), hauteur: Number(hauteur),
}))

describe('manifeste PWA — screenshots', () => {
  it('déclare id, categories et au moins un screenshot narrow + un wide', () => {
    expect(viteConfig).toMatch(/^\s*id: base,/m)
    expect(viteConfig).toMatch(/categories: \[/)
    expect(bloc).not.toBeNull()
    expect(viteConfig).toMatch(/form_factor: 'narrow'/)
    expect(viteConfig).toMatch(/form_factor: 'wide'/)
  })

  it('chaque screenshot déclaré existe dans public/screenshots/', () => {
    expect(entrees.length).toBeGreaterThanOrEqual(2)
    for (const { fichier } of entrees) {
      expect(
        existsSync(path.join(ROOT, 'public/screenshots', fichier)),
        `public/screenshots/${fichier} est déclaré dans le manifeste mais absent`,
      ).toBe(true)
    }
  })

  it('les dimensions déclarées (`sizes`) sont celles des fichiers réels', async () => {
    for (const { fichier, largeur, hauteur } of entrees) {
      const meta = await sharp(path.join(ROOT, 'public/screenshots', fichier)).metadata()
      expect({ fichier, largeur: meta.width, hauteur: meta.height })
        .toEqual({ fichier, largeur, hauteur })
    }
  })

  it('les screenshots restent hors du precache Workbox', () => {
    // jpg absent de globPatterns ET exclusion explicite : les deux doivent
    // tenir — si quelqu'un ajoute jpg au precache, l'exclusion prend le relais.
    expect(viteConfig).toMatch(/globIgnores:\s*\[[\s\S]*?'\*\*\/screenshots\/\*\*'/)
  })
})
