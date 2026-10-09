import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { AUDIT_ACTIONS } from '@features/admin/lib/audit'

// Le journal d'activité n'accepte d'un compte ordinaire que les lignes que
// l'application écrit pour lui : une liste blanche EN BASE
// (`private.entree_de_journal_permise`, migration
// 20261005_journal_et_textes_bornes.sql, audit du 2026-10-04 ADM-07).
//
// Une action ajoutée dans le navigateur, hors panneau admin, sans l'ajouter en
// base serait refusée EN SILENCE : aucune écriture du journal ne lève, et
// l'écran n'en dit rien. Ce cliquet relit le code et la dernière migration
// qui définit la liste blanche.

const RACINE = process.cwd()

function actionsPermisesEnBase() {
  const dossier = resolve(RACINE, 'supabase/migrations')
  const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort().reverse()
  for (const f of fichiers) {
    const sql = readFileSync(resolve(dossier, f), 'utf8')
    const debut = sql.indexOf('FUNCTION private.entree_de_journal_permise(')
    if (debut < 0) continue
    const corps = sql.slice(debut, sql.indexOf('$function$;', debut))
    return new Set([...corps.matchAll(/WHEN '([a-z_]+)' THEN/g)].map((m) => m[1]))
  }
  throw new Error('private.entree_de_journal_permise introuvable dans supabase/migrations')
}

function fichiersSource(dossier) {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) return fichiersSource(chemin)
    return /\.(js|jsx)$/.test(nom) ? [chemin] : []
  })
}

// Le code qu'exécute un compte ordinaire : tout `src/`, sauf le panneau admin
// (l'admin écrit toute action, sous son nom) et les tests.
const CODE = fichiersSource(resolve(RACINE, 'src'))
  .map((chemin) => relative(RACINE, chemin).replace(/\\/g, '/'))
  .filter((f) => !f.startsWith('src/features/admin/') && !f.startsWith('src/test/'))

// L'aide `logUserAction(userId, action, cible)` passe l'action en variable :
// ce sont ses appels qu'on lit.
const AIDES = new Set(['src/features/recipes/api/recipes.js'])

function actionsEcritesParLeNavigateur() {
  const trouvees = []
  for (const f of CODE) {
    const src = readFileSync(resolve(RACINE, f), 'utf8')
    for (const m of src.matchAll(/logUserAction\([^,]+,\s*'([a-z_]+)'/g)) trouvees.push({ f, action: m[1] })
    for (const m of src.matchAll(/logAuditAction\(\s*AUDIT_ACTIONS\.([A-Z_]+)/g)) {
      trouvees.push({ f, action: AUDIT_ACTIONS[m[1]] ?? `AUDIT_ACTIONS.${m[1]} (inconnue)` })
    }
    // Toute écriture directe : un objet écrit sur place, dont on lit l'action.
    // Une ligne passée en variable (`insert(ligne)`) échapperait à la lecture :
    // elle est signalée, sauf dans l'aide connue.
    for (const m of src.matchAll(/from\('activity_logs'\)\s*\.(?:insert|upsert)\(/g)) {
      const suite = src.slice(m.index + m[0].length).trimStart()
      const litterale = suite.startsWith('{') ? suite.slice(0, suite.indexOf('}')).match(/action:\s*'([a-z_]+)'/) : null
      if (litterale) trouvees.push({ f, action: litterale[1] })
      else if (!AIDES.has(f)) trouvees.push({ f, action: '(écriture que ce cliquet ne sait pas lire : objet sur place, action en toutes lettres)' })
    }
  }
  return trouvees
}

describe('Journal : le navigateur n\'écrit que ce que la base accepte d\'un compte ordinaire', () => {
  it('la liste blanche se lit dans la migration', () => {
    expect([...actionsPermisesEnBase()].sort()).toEqual([
      'account_soft_deleted', 'profile_data_exported', 'profile_data_viewed', 'recipe_deleted', 'recipe_submitted',
    ])
  })

  it('chaque action écrite hors panneau admin figure dans la liste blanche', () => {
    const permises = actionsPermisesEnBase()
    const trouvees = actionsEcritesParLeNavigateur()
    // Le cliquet ne doit pas passer à vide : les cinq écritures actuelles.
    expect(new Set(trouvees.map((x) => x.action)).size).toBeGreaterThanOrEqual(5)
    const refusees = trouvees.filter((x) => !permises.has(x.action)).map((x) => `${x.f} → ${x.action}`)
    expect(refusees).toEqual([])
  })
})
