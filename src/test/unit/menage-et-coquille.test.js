import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

// Audit du 2026-10-04, lot « ménage » (ARCH-14 (8) (11)) et SEC-10 (3).
// Des fichiers que l'app n'importe pas (knip les croyait vivants parce qu'un
// test ou un script les lisait), huit scripts à usage unique, un README qui
// cite un hook inexistant — et un service worker qui servait la coquille de
// l'app à `/sitemap.xml`, `/robots.txt` et `/.well-known/security.txt`.

const RACINE = resolve(process.cwd())
const lire = (chemin) => readFileSync(resolve(RACINE, chemin), 'utf8')
const absent = (chemin) => expect(existsSync(resolve(RACINE, chemin)), `${chemin} devrait être parti`).toBe(false)

describe('ce que l’app n’importe pas est parti (ARCH-14 (8))', () => {
  it('les quatre fichiers orphelins et leurs tests', () => {
    for (const f of [
      'src/features/onboarding/i18n/aha-nudge-i18n.js',
      'src/features/onboarding/lib/feature-tiers.js',
      'src/shared/lib/recipes/jsonld-recipe-mapper.js',
      'src/shared/lib/recipes/parse-durations.js',
      'src/test/unit/jsonld-recipe-mapper.test.js',
      'src/test/unit/parseDurations.test.js',
    ]) absent(f)
  })

  it('nutrition.js vit avec les scripts qui le lisent, et eux seuls', () => {
    absent('src/shared/static/nutrition.js')
    expect(existsSync(resolve(RACINE, 'scripts/lib/nutrition.js'))).toBe(true)
    for (const s of ['scripts/ingredients-drift-check.mjs', 'scripts/ingredients-upsert-targeted.mjs', 'scripts/sync-ingredients.mjs']) {
      expect(lire(s), s).toMatch(/\.\/lib\/nutrition\.js/)
    }
  })

  it('les deux README ne promettent plus ce qui n’existe pas', () => {
    expect(lire('src/features/onboarding/README.md')).not.toMatch(/feature-tiers|Source unique des tiers/)
    expect(lire('src/features/voice/README.md')).not.toMatch(/use-cooking-voice|parse-durations/)
  })
})

describe('les scripts à usage unique sont partis (ARCH-14 (11))', () => {
  it('plus aucun scripts/fix-*.mjs ; scripts/legacy/ reste, par choix écrit', () => {
    expect(readdirSync(resolve(RACINE, 'scripts')).filter((f) => /^fix-.*\.mjs$/.test(f))).toEqual([])
    expect(existsSync(resolve(RACINE, 'scripts/legacy/README.md'))).toBe(true)
  })
})

describe('le service worker ne sert pas la coquille de l’app aux fichiers et à .well-known (SEC-10 (3))', () => {
  it('la liste d’exclusion du repli de navigation couvre les extensions et /.well-known/', () => {
    const config = lire('vite.config.js')
    const liste = config.match(/navigateFallbackDenylist:\s*\[([\s\S]*?)\],?\s*\n/)?.[1] ?? ''
    expect(liste).toMatch(/\/\^\\\/api\//)
    expect(liste).toMatch(/\/\^\\\/auth\//)
    expect(liste).toMatch(/\.\[a-z0-9\]\+\$/)
    expect(liste).toMatch(/well-known/)
  })
})
