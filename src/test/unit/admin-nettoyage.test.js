import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, basename, extname } from 'node:path'
import { AUDIT_ACTIONS } from '@features/admin/lib/audit'
import { ADMIN_I18N } from '@features/admin/i18n/admin-i18n'

// Audit du 2026-10-04, lot 14f — le ménage de l'admin (ADM-27, ADM-24 (1, 2)).
// Deux journaux (`logAdminAction` dans l'API, `logAuditAction` dans lib/),
// neuf copies de `fmtDate`, deux `showFeedback` à minuteur nu, deux
// `pillStyle`, une fonction que seuls des tests appelaient, une API de
// 650 lignes, un README qui décrivait un i18n « × 5 langues » partagé par
// tout l'admin, un dictionnaire dont 27 clés sur 36 n'étaient lues nulle part.

const RACINE = resolve(process.cwd())
const ADMIN = join(RACINE, 'src/features/admin')

function fichiers(dossier, motif = /\.jsx?$/) {
  const out = []
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, e.name)
    if (e.isDirectory()) out.push(...fichiers(chemin, motif))
    else if (motif.test(e.name)) out.push(chemin)
  }
  return out
}
const relatif = (chemin) => chemin.slice(ADMIN.length + 1).replaceAll('\\', '/')
const lire = (chemin) => readFileSync(chemin, 'utf8')

describe('admin — un seul journal', () => {
  it('seul lib/audit.js écrit dans activity_logs', () => {
    const ecrivains = fichiers(ADMIN)
      .filter((f) => /from\('activity_logs'\)\s*\.insert\(/.test(lire(f)))
      .map(relatif)
    expect(ecrivains).toEqual(['lib/audit.js'])
  })

  it('le vocabulaire fermé nomme tout ce que l’API admin écrit', () => {
    expect(AUDIT_ACTIONS).toMatchObject({
      RECIPE_PENDING:         'recipe_pending',
      BASE_RECIPE_ADDED:      'base_recipe_added',
      BASE_RECIPE_UPDATED:    'base_recipe_updated',
      SPECIAL_ACCESS_GRANTED: 'special_access_granted',
      SPECIAL_ACCESS_REVOKED: 'special_access_revoked',
    })
  })
})

describe('admin — plus de copies ni de code mort', () => {
  const composants = fichiers(join(ADMIN, 'components'))

  it.each([
    ['fmtDate', /^\s*function fmtDate\(/m],
    ['showFeedback à minuteur nu', /setTimeout\(\(\) => setFeedback\(null\)/],
    ['pillStyle', /function pillStyle\(/],
  ])('%s n’est plus recopié dans les composants', (_nom, motif) => {
    expect(composants.filter((f) => motif.test(lire(f))).map(relatif)).toEqual([])
  })

  it('adminUpdateStagingErrors, que seuls des tests appelaient, n’existe plus', () => {
    const api = fichiers(join(ADMIN, 'api')).filter((f) => /adminUpdateStagingErrors/.test(lire(f))).map(relatif)
    expect(api).toEqual([])
  })

  it('api/admin.js tient sous 500 lignes (la file d’import a son module)', () => {
    const lignes = lire(join(ADMIN, 'api/admin.js')).split(/\r?\n/).length
    expect(lignes).toBeLessThan(500)
    expect(statSync(join(ADMIN, 'api/import-queue.js')).isFile()).toBe(true)
  })
})

describe('admin — le dictionnaire et le README disent vrai', () => {
  it('chaque clé de ADMIN_I18N est lue par un composant', () => {
    const lues = new Set()
    for (const f of fichiers(join(ADMIN, 'components'))) {
      if (!/admin-i18n/.test(lire(f))) continue
      for (const m of lire(f).matchAll(/\bt\.([a-zA-Z]+)/g)) lues.add(m[1])
    }
    const mortes = Object.keys(ADMIN_I18N.fr).filter((cle) => !lues.has(cle))
    expect(mortes).toEqual([])
    // Français seul (décision du 2026-10-08) : plus de branche anglaise à tenir alignée.
    expect(ADMIN_I18N.en).toBeUndefined()
  })

  it('le README cite chaque fichier de la feature, et ne décrit plus un i18n « × 5 langues »', () => {
    const readme = lire(join(ADMIN, 'README.md'))
    // `lib/audit.js`, `admin-panel`, `MissingImageControls` : le nom du fichier, sans dossier ni extension.
    const cites = new Set([...readme.matchAll(/`([^`\n]+)`/g)].map((m) => basename(m[1]).replace(/\.(jsx?|md)$/, '')))
    const manquants = fichiers(ADMIN, /\.(jsx?|md)$/)
      .map((f) => basename(f, extname(f)))
      .filter((nom) => nom !== 'README' && !cites.has(nom))
    expect(manquants).toEqual([])
    expect(readme).not.toMatch(/× 5 langues|adminLogAction/)
    expect(readme).toMatch(/logAuditAction/)
  })
})
