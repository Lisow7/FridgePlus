import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'espree'

// Aucune hauteur en `vh` dans le code : `dvh`.
//
// Sur un téléphone, `vh` vaut la hauteur de l'écran barre d'adresse REPLIÉE.
// Une fenêtre en `maxHeight: '90vh'` dépasse donc de la partie visible quand la
// barre est là, et son bas — souvent ses boutons — passe dessous. `dvh` suit la
// barre ; sur un ordinateur, `dvh` = `vh` et rien ne change.
//
// L'audit du 2026-10-04 (ADM-20) l'avait vu sur le panneau admin. Le
// recensement du 2026-10-08 (lot 12g) en a trouvé 33 autres (30 en `vh`, 3
// classes `min-h-screen`) dans les fenêtres de toute l'app — et à la racine
// même de l'app : `min-h-screen` (100vh) à côté de `height: 100dvh`, où le
// minimum l'emportait. Les classes Tailwind `h-screen` / `min-h-screen` /
// `max-h-screen` valent 100vh : `*-dvh`.
//
// Sont lus les TEXTES (chaînes, gabarits, texte JSX) des .js/.jsx de src/,
// hors tests — pas les commentaires.

const VH = /(?<![\w.-])\d+(?:\.\d+)?vh\b/g
const ECRAN = /(?<![\w-])(?:min-|max-)?h-screen\b/g
const TEXTES = new Set(['String', 'Template', 'JSXText'])

function fichiers(dossier) {
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dossier, e.name)
    if (e.isDirectory()) return /^(test|node_modules)$/.test(e.name) ? [] : fichiers(p)
    return /\.jsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : []
  })
}

export function hauteursEnVh(code) {
  const { tokens } = parse(code, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true }, tokens: true, loc: true })
  return tokens.filter((t) => TEXTES.has(t.type))
    .flatMap((t) => [...(t.value.match(VH) ?? []), ...(t.value.match(ECRAN) ?? [])].map((m) => `${t.loc.start.line} : ${m}`))
}

describe('hauteurs : dvh, jamais vh', () => {
  it('le témoin voit les deux formes, et seulement dans le code', () => {
    expect(hauteursEnVh("const s = { maxHeight: '90vh', height: 'calc(100vh - 92px)' }")).toEqual(['1 : 90vh', '1 : 100vh'])
    expect(hauteursEnVh('const c = <div className="min-h-screen flex" />')).toEqual(['1 : min-h-screen'])
    expect(hauteursEnVh("// en 100vh, le bas passait dessous\nconst s = { maxHeight: '90dvh', width: '100vw' }")).toEqual([])
  })

  // Tout src/ est lu : environ 0,85 s seul, 0,6 à 0,9 s en CI — mais plus de
  // 5 s, le délai par défaut, une fois sous la charge d'une suite complète en
  // local (2026-10-08). Un délai explicite, pour que l'échec dise une faute,
  // pas une machine occupée.
  it('aucune hauteur en vh dans src/', () => {
    const racine = path.resolve(process.cwd(), 'src')
    const fautes = fichiers(racine).flatMap((f) => hauteursEnVh(fs.readFileSync(f, 'utf8'))
      .map((h) => `${path.relative(racine, f).split(path.sep).join('/')}:${h}`))
    expect(fautes).toEqual([])
  }, 20000)
})
