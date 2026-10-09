#!/usr/bin/env node
// v3.169.0 — Codemod paramétrable pour réécrire les imports relatifs
// vers les nouveaux alias (@app, @features, @shared) lors de la migration
// architecture (cf. le plan de travail interne).
//
// USAGE :
//   node scripts/codemods/rewrite-imports.mjs --mapping path/to/mapping.json [--dry|--write] [--glob 'src/**/*.{js,jsx,ts,tsx}']
//
// MAPPING JSON FORMAT :
//   { "from": "../../components/ui/", "to": "@shared/ui/" }
//   { "from": "../../data/ingredients", "to": "@shared/static/ingredients" }
//   { "from": /^\.\.\/data\/(.*)$/, "to": "@shared/static/$1" }   // regex string
//
// MODES :
//   --dry    (défaut) : compte les matches, montre un diff des 5 premiers, n'écrit rien.
//   --write           : applique les changements en place.
//
// IMPORTS GÉRÉS :
//   - import X from '...'
//   - import { X } from '...'
//   - import * as X from '...'
//   - import '...'
//   - export ... from '...'
//   - lazy(() => import('...'))
//   - dynamic import('...')

import { readFileSync, writeFileSync } from 'node:fs'
import { glob } from 'glob'
import path from 'node:path'

const args = process.argv.slice(2)
const mappingPath = getArg('--mapping')
const isWrite     = args.includes('--write')
const isDry       = !isWrite || args.includes('--dry')
const filesGlob   = getArg('--glob') ?? 'src/**/*.{js,jsx}'

if (!mappingPath) {
  console.error('Erreur : --mapping <fichier.json> requis.')
  console.error('Voir entête de ce script pour le format.')
  process.exit(1)
}

function getArg(name) {
  const idx = args.indexOf(name)
  if (idx === -1 || idx + 1 >= args.length) return null
  return args[idx + 1]
}

// ── Charger le mapping ────────────────────────────────────────────────
const rawMapping = JSON.parse(readFileSync(mappingPath, 'utf8'))
if (!Array.isArray(rawMapping)) {
  console.error('Erreur : le mapping doit être un array de { from, to }.')
  process.exit(1)
}

const rules = rawMapping.map(({ from, to }) => {
  // Si "from" est encadré par /.../, on traite comme regex
  if (typeof from === 'string' && from.startsWith('/') && from.lastIndexOf('/') > 0) {
    const lastSlash = from.lastIndexOf('/')
    const pattern = from.slice(1, lastSlash)
    const flags   = from.slice(lastSlash + 1)
    return { from: new RegExp(pattern, flags), to, isRegex: true }
  }
  return { from, to, isRegex: false }
})

// ── Patterns d'import à matcher dans le source ────────────────────────
// Capture le chemin entre quotes : 'path' ou "path"
const IMPORT_PATTERNS = [
  // import X from '...' / import { X } from '...' / import * as X from '...' / import '...'
  /(\bimport\s+(?:[\w*\s{},]+\s+from\s+)?)(['"])([^'"]+)(['"])/g,
  // export ... from '...'
  /(\bexport\s+(?:[\w*\s{},]+\s+from\s+)?)(['"])([^'"]+)(['"])/g,
  // dynamic import('...') (incluant lazy(() => import('...')))
  /(\bimport\s*\(\s*)(['"])([^'"]+)(['"])(\s*\))/g,
]

// ── Parcourir les fichiers ────────────────────────────────────────────
const files = await glob(filesGlob, { ignore: ['**/node_modules/**', '**/dist/**'] })

let totalReplacements = 0
const previews = []  // 5 premiers diffs pour le mode --dry

for (const file of files) {
  const original = readFileSync(file, 'utf8')
  let updated   = original
  let fileReplacements = 0

  for (const { from, to, isRegex } of rules) {
    for (const pattern of IMPORT_PATTERNS) {
      updated = updated.replace(pattern, (match, prefix, quote1, importPath, quote2, ...rest) => {
        // String.replace passe les groupes capturés, puis l'offset (number),
        // puis la string entière. Le suffix n'est valide QUE s'il est une
        // string (= un groupe capturé), sinon c'est l'offset → on l'ignore.
        const suffix = (typeof rest[0] === 'string') ? rest[0] : ''
        const newPath = applyRule(importPath, from, to, isRegex)
        if (newPath === importPath) return match
        fileReplacements++
        return `${prefix}${quote1}${newPath}${quote2}${suffix}`
      })
    }
  }

  if (fileReplacements > 0) {
    totalReplacements += fileReplacements
    if (previews.length < 5) {
      previews.push({ file, count: fileReplacements, before: original.slice(0, 200), after: updated.slice(0, 200) })
    }
    if (isWrite) writeFileSync(file, updated, 'utf8')
  }
}

function applyRule(importPath, from, to, isRegex) {
  if (isRegex) {
    return importPath.replace(from, to)
  }
  if (importPath === from || importPath.startsWith(from)) {
    return to + importPath.slice(from.length)
  }
  return importPath
}

// ── Rapport ───────────────────────────────────────────────────────────
console.log(`\n📋 Codemod ${isWrite ? '(WRITE)' : '(DRY-RUN)'}`)
console.log(`Mapping : ${path.resolve(mappingPath)}`)
console.log(`Glob    : ${filesGlob}`)
console.log(`Fichiers analysés : ${files.length}`)
console.log(`Remplacements  : ${totalReplacements}`)
console.log(`Fichiers touchés : ${previews.length > 0 ? '~' + previews.filter(p => p.count > 0).length : 0}`)

if (previews.length > 0) {
  console.log('\n🔍 Aperçu (5 premiers fichiers) :')
  for (const { file, count } of previews) {
    console.log(`  ${file} : ${count} replacement(s)`)
  }
}

if (isDry && totalReplacements > 0) {
  console.log('\n💡 Mode dry-run : aucun fichier modifié.')
  console.log('   Pour appliquer : ajoute --write')
}

process.exit(0)
