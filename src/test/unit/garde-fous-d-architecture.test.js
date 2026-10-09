import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { compterLesDesactivations } from '../../../scripts/verifier-plafond-lint.mjs'

// Audit du 2026-10-04, lot « garde-fous d'architecture », sous-lot A (ARCH-17 (4) (7),
// ARCH-16 (1) (2) (3) (5) (6) (7)) : des cliquets qui ne mesuraient pas tout, et une CI
// qui faisait confiance à des étiquettes mouvantes.

const RACINE = resolve(process.cwd())
const lire = (chemin) => readFileSync(resolve(RACINE, chemin), 'utf8')
const pkg = JSON.parse(lire('package.json'))

describe('le cliquet de lint compte aussi les eslint-disable (ARCH-17 (4))', () => {
  it('compte chaque désactivation, sous toutes ses formes, hors src/test', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fridge-desactivations-'))
    mkdirSync(join(dir, 'src', 'features'), { recursive: true })
    mkdirSync(join(dir, 'src', 'test'), { recursive: true })
    writeFileSync(join(dir, 'src', 'features', 'a.jsx'), '// eslint-disable-next-line react-hooks/immutability\nconst x = 1\n/* eslint-disable no-unused-vars */\nconst y = 2 // eslint-disable-line\n')
    writeFileSync(join(dir, 'src', 'features', 'b.js'), 'const z = 3\n')
    writeFileSync(join(dir, 'src', 'test', 'c.test.jsx'), '// eslint-disable-next-line react-hooks/immutability\n')
    expect(compterLesDesactivations(join(dir, 'src'))).toBe(3)
  })

  it('le plafond vaut le compte exact du dépôt (ni plus, ni moins)', () => {
    expect(typeof pkg.lintDesactivationsPlafond).toBe('number')
    expect(compterLesDesactivations(resolve(RACINE, 'src'))).toBe(pkg.lintDesactivationsPlafond)
  })

  it('le script le vérifie au lint (sinon le plafond ne serait tenu que par ce test)', () => {
    const script = lire('scripts/verifier-plafond-lint.mjs')
    expect(script).toMatch(/lintDesactivationsPlafond/)
    expect(script).toMatch(/compterLesDesactivations\(/)
  })
})

describe('un test de bout en bout qui ne passe qu’au second essai fait échouer la CI (ARCH-17 (7))', () => {
  it('playwright.config.js : failOnFlakyTests en CI, les relances restent journalisées', () => {
    const config = lire('playwright.config.js')
    expect(config).toMatch(/failOnFlakyTests:\s*!!process\.env\.CI/)
    expect(config).toMatch(/retries:\s*process\.env\.CI \? 2 : 0/)
  })
})

describe('les actions de la CI sont épinglées par SHA (ARCH-16 (6))', () => {
  const workflows = readdirSync(resolve(RACINE, '.github/workflows')).filter((f) => /\.ya?ml$/.test(f))
  it('chaque « uses: » porte un SHA de 40 caractères et la version en commentaire', () => {
    const fautifs = []
    for (const f of workflows) {
      for (const m of lire(`.github/workflows/${f}`).matchAll(/^\s*-?\s*uses:\s*(\S+)(.*)$/gm)) {
        const [, ref, reste] = m
        if (ref.startsWith('./')) continue
        if (!/@[0-9a-f]{40}$/.test(ref) || !/#\s*v\d/.test(reste)) fautifs.push(`${f} : ${ref}`)
      }
    }
    expect(fautifs).toEqual([])
  })
  it('Dependabot suit les actions (il sait mettre à jour un SHA)', () => {
    expect(lire('.github/dependabot.yml')).toMatch(/package-ecosystem:\s*github-actions/)
  })
})

describe('une seule liste d’alias (ARCH-16 (3))', () => {
  it('vite, eslint et jsconfig connaissent les mêmes alias', () => {
    const vite = [...lire('vite.config.js').matchAll(/'(@[a-z]+)':\s*path\.resolve/g)].map((m) => m[1]).sort()
    const eslint = [...lire('eslint.config.js').matchAll(/\['(@[a-z]+)',\s*'\.\/src/g)].map((m) => m[1]).sort()
    const jsconfig = Object.keys(JSON.parse(lire('jsconfig.json')).compilerOptions.paths).map((k) => k.replace('/*', '')).sort()
    expect(vite.length).toBeGreaterThan(3)
    expect(eslint).toEqual(vite)
    expect(jsconfig).toEqual(vite)
  })
})

describe('gitleaks n’exempte que les deux clés factices de .env.test, pas le fichier (ARCH-16 (7))', () => {
  it('.gitleaks.toml : chemin ET motif', () => {
    const toml = lire('.gitleaks.toml')
    expect(toml).toMatch(/matchCondition\s*=\s*"AND"/)
    expect(toml).toMatch(/VITE_SUPABASE_\(URL\|ANON_KEY\)/)
  })
})

describe('dépendances et scripts rangés (ARCH-16 (1) (2) (5))', () => {
  it('openai est une devDependency : un seul script l’importe', () => {
    expect(pkg.dependencies.openai).toBeUndefined()
    expect(pkg.devDependencies.openai).toBeDefined()
  })
  it('.npmrc ne force plus legacy-peer-deps (l’installation stricte se résout)', () => {
    const actives = lire('.npmrc').split('\n').filter((l) => !l.trim().startsWith('#')).join('\n')
    expect(actives).not.toMatch(/legacy-peer-deps/)
  })
  it('les deux scripts à usage unique qui importaient glob et @babel sans les déclarer sont partis', () => {
    expect(existsSync(resolve(RACINE, 'scripts/codemods'))).toBe(false)
    expect(existsSync(resolve(RACINE, 'scripts/strip-changelog-i18n.mjs'))).toBe(false)
  })
})
