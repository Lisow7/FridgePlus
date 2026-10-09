import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

// La documentation d'entrée dit vrai sur les modules (audit du 2026-10-04,
// ARCH-12).
//
// `docs/ARCHITECTURE.md` listait 16 modules sur 18 et `CONTRIBUTING.md`
// promettait « chaque feature a son README » : deux n'en avaient pas
// (`push-notifications`, `receipt-scan`). `doc-references.test.js` vérifie que
// les CHEMINS cités existent ; il ne voyait pas ce qui MANQUE. Ce test compare
// le document au dossier.

const FEATURES = resolve(process.cwd(), 'src/features')
const modules = readdirSync(FEATURES).filter((n) => statSync(join(FEATURES, n)).isDirectory()).sort()
const architecture = readFileSync(resolve(process.cwd(), 'docs/ARCHITECTURE.md'), 'utf8')
const section3 = architecture.slice(architecture.indexOf('## 3.'), architecture.indexOf('## 4.'))

describe('les modules de src/features sont documentés', () => {
  it('témoin : le dossier compte plus de dix modules', () => {
    expect(modules.length).toBeGreaterThan(10)
  })

  it.each(modules)('« %s » a son README', (nom) => {
    expect(existsSync(join(FEATURES, nom, 'README.md'))).toBe(true)
  })

  it('docs/ARCHITECTURE.md §3 cite chaque module, et aucun module disparu', () => {
    const cites = [...section3.matchAll(/`([a-z][a-z-]*)`\s*\(/g)].map((m) => m[1]).sort()
    expect(cites).toEqual(modules)
  })
})
