import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parse } from 'espree'
import { AUDIT_ACTIONS } from '@features/admin/lib/audit'
import { LIBELLES_DU_JOURNAL } from '@features/admin/lib/libelles-du-journal'

// Toute action écrite au journal d'activité a un nom dans le panneau, et aucun
// nom n'attend une action que rien n'écrit (audit du 2026-10-04, ADM-06 : les
// sept actions réellement présentes en base n'avaient aucun nom — elles ne
// s'affichaient que sous leur nom brut, et seulement dans « Tous » —, et la
// moitié des noms désignaient des actions que rien n'écrivait).
//
// Ce qui écrit au journal, et comment ce test le lit :
//   - le vocabulaire fermé du navigateur, `AUDIT_ACTIONS` ;
//   - les écritures du navigateur hors vocabulaire : l'argument « action » de
//     `logAdminAction(…)` (premier) et de `logUserAction(…)` (deuxième) —
//     chaînes, branches d'un ternaire ou d'un ??, valeurs d'un objet indexé
//     comme `actionMap[statut]` —, et `action: '…'` d'un objet écrit sur place ;
//   - les migrations : la valeur de la colonne `action` de chaque
//     `INSERT INTO public.activity_logs` ;
//   - les fonctions serveur : `action: '…'` dans un fichier qui écrit
//     `activity_logs`.

const RACINE = process.cwd()

const fichiers = (dossier, extension) => readdirSync(dossier).flatMap((nom) => {
  const chemin = join(dossier, nom)
  if (statSync(chemin).isDirectory()) return nom === 'test' || nom === 'node_modules' ? [] : fichiers(chemin, extension)
  return extension.test(nom) && !/[.]test[.]/.test(nom) ? [chemin] : []
})

// Les valeurs que peut prendre l'argument « action » — pas la condition d'un
// ternaire (dans `action === 'grant' ? … : …`, « grant » n'est pas une action).
function valeursPossibles(n, objets, acc = []) {
  if (!n) return acc
  if (n.type === 'Literal' && typeof n.value === 'string') acc.push(n.value)
  else if (n.type === 'ConditionalExpression') { valeursPossibles(n.consequent, objets, acc); valeursPossibles(n.alternate, objets, acc) }
  else if (n.type === 'LogicalExpression') { valeursPossibles(n.left, objets, acc); valeursPossibles(n.right, objets, acc) }
  else if (n.type === 'MemberExpression' && n.object?.type === 'Identifier') (objets.get(n.object.name) ?? []).forEach((v) => acc.push(v))
  return acc
}

const chainesDe = (objet) => objet.properties
  .filter((p) => p.type === 'Property' && p.value?.type === 'Literal' && typeof p.value.value === 'string')
  .map((p) => p.value.value)

function actionsDuNavigateur() {
  const trouvees = new Set(Object.values(AUDIT_ACTIONS))
  for (const f of fichiers(resolve(RACINE, 'src'), /[.]jsx?$/)) {
    const code = readFileSync(f, 'utf8')
    if (!/activity_logs|logAdminAction|logUserAction/.test(code)) continue
    const arbre = parse(code, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } })
    const objets = new Map() // variable → chaînes de l'objet littéral qui l'initialise
    const visiter = (n) => {
      if (!n || typeof n.type !== 'string') return
      if (n.type === 'VariableDeclarator' && n.id?.type === 'Identifier' && n.init?.type === 'ObjectExpression') objets.set(n.id.name, chainesDe(n.init))
      if (n.type === 'CallExpression' && n.callee?.type === 'Identifier') {
        const argument = n.callee.name === 'logAdminAction' ? n.arguments[0] : n.callee.name === 'logUserAction' ? n.arguments[1] : null
        if (argument) valeursPossibles(argument, objets).forEach((a) => trouvees.add(a))
      }
      if (n.type === 'Property' && (n.key?.name === 'action' || n.key?.value === 'action') && n.value?.type === 'Literal' && typeof n.value.value === 'string') trouvees.add(n.value.value)
      for (const cle of Object.keys(n)) {
        const v = n[cle]
        if (Array.isArray(v)) v.forEach(visiter)
        else if (v && typeof v === 'object') visiter(v)
      }
    }
    visiter(arbre)
  }
  return trouvees
}

function actionsDesMigrations() {
  const trouvees = new Set()
  for (const f of fichiers(resolve(RACINE, 'supabase/migrations'), /[.]sql$/)) {
    const sql = readFileSync(f, 'utf8')
    for (const m of sql.matchAll(/INSERT\s+INTO\s+(?:public\.)?activity_logs\s*\(([^)]*)\)\s*VALUES\s*\(([\s\S]*?)\)\s*;/gi)) {
      const i = m[1].split(',').map((c) => c.trim()).indexOf('action')
      // Les valeurs, découpées au premier niveau de parenthèses.
      const valeurs = []
      let profondeur = 0
      let courant = ''
      let dansChaine = false
      for (const c of m[2]) {
        if (c === "'") dansChaine = !dansChaine
        if (!dansChaine && c === '(') profondeur++
        if (!dansChaine && c === ')') profondeur--
        if (!dansChaine && profondeur === 0 && c === ',') { valeurs.push(courant.trim()); courant = ''; continue }
        courant += c
      }
      valeurs.push(courant.trim())
      const litterale = valeurs[i]?.match(/^'([a-z][a-z0-9_]*)'$/)
      if (litterale) trouvees.add(litterale[1])
    }
  }
  return trouvees
}

function actionsDesFonctionsServeur() {
  const trouvees = new Set()
  for (const f of fichiers(resolve(RACINE, 'supabase/functions'), /[.]ts$/)) {
    const code = readFileSync(f, 'utf8')
    if (!code.includes('activity_logs')) continue
    for (const m of code.matchAll(/action:\s*'([a-z][a-z0-9_]*)'/g)) trouvees.add(m[1])
  }
  return trouvees
}

describe('journal d’activité — tout a un nom', () => {
  const navigateur = actionsDuNavigateur()
  const migrations = actionsDesMigrations()
  const serveur = actionsDesFonctionsServeur()
  const ecrites = new Set([...navigateur, ...migrations, ...serveur])

  it('témoins : chaque source est bien lue', () => {
    expect(navigateur).toContain('special_access_granted')   // logAdminAction en toutes lettres
    expect(navigateur).toContain('recipe_rejected')          // valeur de actionMap[statut]
    expect(navigateur).toContain('ingredient_updated')       // branche d'un ternaire (`_isNew ? … : …`)
    expect(navigateur).toContain('account_soft_deleted')     // objet écrit sur place
    expect(migrations).toContain('notification_sent')
    expect(migrations).toContain('feature_flag_toggled')
    expect(serveur).toContain('i18n_auto_translated')
  })

  it('toute action écrite a un nom', () => {
    expect([...ecrites].filter((a) => !LIBELLES_DU_JOURNAL[a]).sort()).toEqual([])
  })

  it('aucun nom n’attend une action que rien n’écrit', () => {
    expect(Object.keys(LIBELLES_DU_JOURNAL).filter((a) => !ecrites.has(a)).sort()).toEqual([])
  })

  it('chaque nom a sa couleur et son groupe', () => {
    const incomplets = Object.entries(LIBELLES_DU_JOURNAL).filter(([, v]) => !v.label || !v.color || !v.group).map(([a]) => a)
    expect(incomplets).toEqual([])
  })
})
