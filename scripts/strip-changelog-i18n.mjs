#!/usr/bin/env node
// Sprint 9 S9.f — strip ES/DE/JA from changelog.js historical entries.
//
// Format des entries :
//   { type: 'chore', label: {
//     fr: { summary: '...', items: [] },
//     en: { summary: '...', items: [] },
//     es: { summary: '...', items: [] },  ← À retirer
//     de: { summary: '...', items: [] },  ← À retirer
//     ja: { summary: '...', items: [] },  ← À retirer
//   }},
//
// Approche : parser le fichier avec @babel/parser, marcher l'AST,
// retirer les ObjectProperty dont la key est 'es', 'de', ou 'ja'
// quand elles sont dans un objet `label`.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import generate from '@babel/generator'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FILE = path.resolve(__dirname, '../src/features/changelog/data/changelog.js')

const STRIP_LANGS = new Set(['es', 'de', 'ja'])

function getKeyName(key) {
  if (key.type === 'Identifier') return key.name
  if (key.type === 'StringLiteral') return key.value
  return null
}

const code = fs.readFileSync(FILE, 'utf8')
const ast = parse(code, { sourceType: 'module' })

let removedCount = 0

// Approche : retirer toute propriété de niveau objet dont la clé est es/de/ja
// quand son frère immédiat contient les mêmes "summary" structurel. C'est
// assez large, mais le changelog n'a pas d'autres es/de/ja légitimes.
traverse.default(ast, {
  ObjectExpression(p) {
    // L'objet est un "label" si :
    // - Il contient une clé `fr` ou `en` (multi-lang)
    // - Ou ses valeurs sont des objets avec `summary`
    const hasMultiLangSiblings = p.node.properties.some(prop => {
      if (prop.type !== 'ObjectProperty') return false
      const k = getKeyName(prop.key)
      return k === 'fr' || k === 'en'
    })
    if (!hasMultiLangSiblings) return

    p.node.properties = p.node.properties.filter(prop => {
      if (prop.type !== 'ObjectProperty') return true
      const k = getKeyName(prop.key)
      if (k && STRIP_LANGS.has(k)) {
        // Retire toutes les variantes : ObjectExpression OU StringLiteral
        // (les très anciennes entries utilisent des strings directes).
        if (prop.value.type === 'ObjectExpression' || prop.value.type === 'StringLiteral') {
          removedCount++
          return false
        }
      }
      return true
    })
  },
})

const { code: out } = generate.default(ast, {
  jsescOption: { quotes: 'single' },
  retainLines: false,
})

fs.writeFileSync(FILE, out, 'utf8')

console.log(`✅ Retiré ${removedCount} entrées ES/DE/JA de changelog.js`)
console.log(`   Avant : ${code.split('\n').length} lignes`)
console.log(`   Après : ${out.split('\n').length} lignes`)
console.log(`   Δ     : -${code.split('\n').length - out.split('\n').length} lignes`)
