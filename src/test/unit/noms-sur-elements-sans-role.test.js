import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'espree'

// Un nom (`aria-label`, `aria-labelledby`) posé sur un élément SANS rôle :
// `span`, `div`, `p`… Les lecteurs d'écran l'ignorent — ARIA l'interdit sur un
// élément générique (règle axe `aria-prohibited-attr`).
//
// Trouvé par axe dans le panneau admin le 2026-10-08 (lot 12f : deux pastilles
// de Recettes +), puis par ce balayage dans tout `src/` (lot 9e) : huit de plus,
// dont la pastille de la cloche — « 3 notifications non lues » n'était jamais
// annoncé, le bouton s'appelait « Notifications » quoi qu'il arrive.
//
// Que faire à la place : nommer le CONTRÔLE qui porte l'information (le bouton
// de la cloche) ; `role="img"` quand l'élément est une image faite de morceaux
// (étoiles, points de progression, emoji) ; un texte `sr-only` quand le texte
// visible ne suffit pas ; rien quand il suffit.

const GENERIQUES = new Set(['span', 'div', 'p', 'b', 'i', 'em', 'strong', 'small', 'code', 'pre'])

function fichiers(dossier) {
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dossier, e.name)
    if (e.isDirectory()) return /^(test|node_modules)$/.test(e.name) ? [] : fichiers(p)
    return /\.jsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : []
  })
}

export function nomsSansRole(code) {
  const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true }, loc: true })
  const fautes = []
  const visiter = (n) => {
    if (!n || typeof n.type !== 'string') return
    if (n.type === 'JSXOpeningElement' && n.name.type === 'JSXIdentifier' && GENERIQUES.has(n.name.name)) {
      const attrs = n.attributes.filter((a) => a.type === 'JSXAttribute').map((a) => a.name.name)
      const etale = n.attributes.some((a) => a.type === 'JSXSpreadAttribute')
      if ((attrs.includes('aria-label') || attrs.includes('aria-labelledby')) && !attrs.includes('role') && !etale) {
        fautes.push(`${n.loc.start.line} <${n.name.name}>`)
      }
    }
    for (const v of Object.values(n)) {
      if (Array.isArray(v)) v.forEach(visiter)
      else if (v && typeof v.type === 'string') visiter(v)
    }
  }
  visiter(ast)
  return fautes
}

describe('un nom ne se pose pas sur un élément sans rôle', () => {
  it('le témoin voit la faute, et laisse passer rôle, bouton et nom absent', () => {
    expect(nomsSansRole('const a = <span aria-label="3 non lues">•</span>')).toEqual(['1 <span>'])
    expect(nomsSansRole('const a = <div\n  aria-labelledby="t">x</div>')).toEqual(['1 <div>'])
    expect(nomsSansRole('const a = <span role="img" aria-label="Note : 4 sur 5">★★★★</span>')).toEqual([])
    expect(nomsSansRole('const a = <button aria-label="Fermer">×</button>')).toEqual([])
    expect(nomsSansRole('const a = <section aria-label="Avis">…</section>')).toEqual([])
  })

  // Tout src/ lu et analysé d'un trait : plus que les 5 s par défaut sur une
  // machine chargée (mesuré le 2026-10-10 : suite complète à 369 s au lieu de
  // 157 s, ce test seul en 2 s). Même délai que pas-de-traces-de-conversation.
  it('aucun dans src/', () => {
    const racine = path.resolve(process.cwd(), 'src')
    const fautes = fichiers(racine).flatMap((f) => nomsSansRole(fs.readFileSync(f, 'utf8'))
      .map((x) => `${path.relative(racine, f).split(path.sep).join('/')}:${x}`))
    expect(fautes).toEqual([])
  }, 60_000)
})
