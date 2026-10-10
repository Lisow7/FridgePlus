import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'espree'

// Un `onClick` sur un élément non interactif (`div`, `span`, `p`, `li`,
// `header`…) sans rôle ni clavier : à la souris seulement.
//
// Trouvé par balayage de l'arbre JSX le 2026-10-08 (lot 9f, complément
// d'audit) : la pastille Premium repliable (« Mode cuisine vocal ») ne
// s'ouvrait pas au clavier ; les ingrédients de « J'ai cuisiné » ne se
// cochaient pas. Ce que ce garde-fou laisse passer, et pourquoi :
//   - un gestionnaire qui ne fait qu'arrêter la propagation (l'intérieur d'une
//     fenêtre) ;
//   - le FOND d'une fenêtre qui la ferme : Échap fait la même chose au clavier
//     (`useDialogue`), et ce n'est pas un contrôle ;
//   - les exceptions NOMMÉES ci-dessous : un clic de confort, doublé par un
//     vrai bouton dans le même élément.

const NON_INTERACTIFS = new Set(['div', 'span', 'p', 'li', 'ul', 'section', 'article', 'header', 'footer', 'td', 'tr', 'img', 'svg', 'label'])
const ARRET = /^(\w+\s*\?\s*undefined\s*:\s*)?\(?\s*\w*\s*\)?\s*=>\s*\{?\s*\w+\.stopPropagation\(\)\s*;?\s*\}?$/
const FOND = [
  /^(onClose|onBack|onCancel|onDismiss|onRefuse|onCloseDialog|fermer|close|handleClose)$/,
  /^\w+\s*\?\s*undefined\s*:\s*(onClose|onCancel|fermer)$/,
  /^\(?\s*\w+\s*\)?\s*=>\s*\{?\s*if\s*\(\s*\w+\.target\s*===\s*\w+\.currentTarget/,
  // Un fond qui referme en remettant son état : `() => setActionPost(null)`.
  /^\(\)\s*=>\s*set\w+\((null|false)\)$/,
]
const EXCEPTIONS = [
  // En-tête dépliable : le titre porte un vrai `<button aria-expanded>` qui
  // arrête la propagation ; le clic sur l'en-tête est un confort de souris.
  { fichier: 'features/profile/components/danger-zone.jsx', element: 'div', gestionnaire: 'collapsible ? () => setOpen' },
  { fichier: 'features/profile/components/profile-section.jsx', element: 'header', gestionnaire: '() => setOpen' },
  // Ligne d'ingrédient de la fiche : elle contient un vrai `<button>` sans
  // gestionnaire propre, dont l'activation remonte à la ligne.
  { fichier: 'features/recipes/components/recipe-detail-body.jsx', element: 'div', gestionnaire: '() => handleIngredientClick' },
]

function fichiers(dossier) {
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dossier, e.name)
    if (e.isDirectory()) return /^(test|node_modules)$/.test(e.name) ? [] : fichiers(p)
    return /\.jsx$/.test(e.name) ? [p] : []
  })
}

export function clicsSansClavier(code, fichier = '') {
  const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true }, loc: true, range: true })
  const fautes = []
  const visiter = (n) => {
    if (!n || typeof n.type !== 'string') return
    if (n.type === 'JSXOpeningElement' && n.name.type === 'JSXIdentifier' && NON_INTERACTIFS.has(n.name.name)) {
      const attrs = Object.fromEntries(n.attributes.filter((a) => a.type === 'JSXAttribute').map((a) => [a.name.name, a.value]))
      const clic = attrs.onClick?.expression
      const etale = n.attributes.some((a) => a.type === 'JSXSpreadAttribute')
      if (clic && !etale) {
        const h = code.slice(clic.range[0], clic.range[1]).replace(/\s+/g, ' ').trim()
        const clavier = 'onKeyDown' in attrs || 'onKeyUp' in attrs
        const excuse = ARRET.test(h) || FOND.some((re) => re.test(h)) || ('role' in attrs && clavier)
          || EXCEPTIONS.some((x) => fichier.endsWith(x.fichier) && x.element === n.name.name && h.startsWith(x.gestionnaire))
        if (!excuse) fautes.push(`${n.loc.start.line} <${n.name.name} onClick={${h.slice(0, 60)}}>`)
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

describe('aucun clic à la souris seulement', () => {
  it('le témoin voit la faute, et laisse passer bouton, arrêt de propagation et fond de fenêtre', () => {
    expect(clicsSansClavier('const a = <div onClick={() => setOpen(true)}>x</div>')).toHaveLength(1)
    expect(clicsSansClavier('const a = <label onClick={basculer}>x</label>')).toHaveLength(1)
    expect(clicsSansClavier('const a = <button onClick={() => setOpen(true)}>x</button>')).toEqual([])
    expect(clicsSansClavier('const a = <div onClick={e => e.stopPropagation()}>x</div>')).toEqual([])
    expect(clicsSansClavier('const a = <div onClick={onClose}>x</div>')).toEqual([])
    expect(clicsSansClavier('const a = <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>x</div>')).toEqual([])
    expect(clicsSansClavier('const a = <div role="button" tabIndex={0} onClick={f} onKeyDown={g}>x</div>')).toEqual([])
  })

  // Tout src/ lu et analysé d'un trait : plus que les 5 s par défaut sur une
  // machine chargée (mesuré le 2026-10-10 : suite complète à 369 s au lieu de
  // 157 s, ce test seul en 2 s). Même délai que pas-de-traces-de-conversation.
  it('aucun dans src/, hors exceptions nommées', () => {
    const racine = path.resolve(process.cwd(), 'src')
    const fautes = fichiers(racine).flatMap((f) => {
      const rel = path.relative(racine, f).split(path.sep).join('/')
      return clicsSansClavier(fs.readFileSync(f, 'utf8'), rel).map((x) => `${rel}:${x}`)
    })
    expect(fautes).toEqual([])
  }, 60_000)
})
