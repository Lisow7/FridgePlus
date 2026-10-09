import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse } from 'espree'

// Quels champs de formulaire n'ont pas de nom accessible ? (audit du
// 2026-10-04, A11Y-07 : 76 champs sur 131 — 27 sans aucun nom, 49 nommés par
// leur seul `placeholder`, qui disparaît à la saisie.)
//
// Un `<input>`, `<select>` ou `<textarea>` est NOMMÉ s'il porte `aria-label`,
// `aria-labelledby` ou `title`, s'il est DANS un `<label>` ou un
// `<Field label=…>` (`@shared/ui/field`), ou si son `id`
// est la cible d'un `htmlFor` du même fichier (même texte source, littéral ou
// expression). Ne comptent pas : les types sans saisie (hidden, submit,
// button, reset, image), les champs cachés (`hidden`, classe `hidden`,
// `display: 'none'`), et les champs à props étalées (`{...rest}`) — leur nom
// vient de l'appelant, ils sont rendus à part dans `delegues`.
//
// C'est aussi un CLIQUET : `src/test/unit/champs-sans-nom-plafond.test.js`
// compare les comptes à `champsSansNomPlafond`, `champsPlaceholderSeulPlafond`
// et `champsLibelleInvisiblePlafond` (package.json), au cran exact.
//
// LIBELLÉ INVISIBLE (décision du 2026-10-06, « libellés = visibles ») : un
// champ de saisie nommé SEULEMENT par `aria-label` ou `title` — un nom que les
// lecteurs d'écran entendent mais que l'écran ne montre pas — et dont le texte
// grisé (`placeholder`) tient lieu de libellé, puis s'efface dès qu'on tape.
// Un `<label>`, un `htmlFor`, `<Field label>` ou `aria-labelledby` (qui
// pointe un texte visible) le rendent visible.

const CHAMPS = new Set(['input', 'select', 'textarea'])
const SANS_SAISIE = new Set(['hidden', 'submit', 'button', 'reset', 'image'])
// Types sans texte à saisir : un texte grisé n'y joue pas le libellé.
const SANS_TEXTE = new Set(['checkbox', 'radio', 'range', 'file', 'color'])

function collecter(dossier, fichiers = []) {
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name)
    const n = p.split(path.sep).join('/')
    if (e.isDirectory()) { if (!/node_modules|[.]git|dist|\/test\//.test(n)) collecter(p, fichiers) }
    else if (/[.]jsx$/.test(e.name) && !/[.]test[.]/.test(e.name)) fichiers.push(n)
  }
  return fichiers
}

const nomDe = (attr) => (attr.name?.type === 'JSXIdentifier' ? attr.name.name : attr.name?.namespace ? `${attr.name.namespace.name}:${attr.name.name.name}` : null)

function texteDeLaValeur(code, valeur) {
  if (!valeur) return null
  if (valeur.type === 'Literal') return JSON.stringify(valeur.value)
  if (valeur.type === 'JSXExpressionContainer') {
    const e = valeur.expression
    if (e.type === 'Literal') return JSON.stringify(e.value)
    if (e.type === 'TemplateLiteral' && e.expressions.length === 0) return JSON.stringify(e.quasis[0].value.cooked)
    return code.slice(e.range[0], e.range[1]).replace(/\s+/g, '')
  }
  return null
}

function estCache(code, attrs) {
  for (const a of attrs) {
    const n = nomDe(a)
    if (n === 'hidden') return true
    if (n === 'className' && a.value?.type === 'Literal' && /(^|\s)hidden(\s|$)/.test(a.value.value)) return true
    if (n === 'style' && a.value?.type === 'JSXExpressionContainer') {
      const s = code.slice(a.value.range[0], a.value.range[1])
      if (/display\s*:\s*['"]none['"]/.test(s)) return true
    }
  }
  return false
}

function analyser(fichier) {
  const code = fs.readFileSync(fichier, 'utf8')
  let ast
  try {
    ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module', range: true, loc: true, ecmaFeatures: { jsx: true } })
  } catch {
    return { illisible: true, champs: [] }
  }
  const cibles = new Set() // textes source des `htmlFor`
  const trouves = []
  ;(function marcher(noeud, dansLabel) {
    if (!noeud || typeof noeud.type !== 'string') return
    let label = dansLabel
    if (noeud.type === 'JSXElement') {
      const ouvrant = noeud.openingElement
      const nom = ouvrant.name.type === 'JSXIdentifier' ? ouvrant.name.name : null
      for (const a of ouvrant.attributes) {
        if (a.type === 'JSXAttribute' && nomDe(a) === 'htmlFor') {
          const t = texteDeLaValeur(code, a.value)
          if (t) cibles.add(t)
        }
      }
      if (nom === 'label') label = true
      // `@shared/ui/field` relie son libellé à son enfant unique.
      if (nom === 'Field' && ouvrant.attributes.some((a) => a.type === 'JSXAttribute' && nomDe(a) === 'label')) label = true
      if (CHAMPS.has(nom)) trouves.push({ ouvrant, nom, dansLabel: label })
    }
    for (const cle of Object.keys(noeud)) {
      if (cle === 'parent' || cle === 'loc' || cle === 'range') continue
      const v = noeud[cle]
      if (Array.isArray(v)) v.forEach((x) => marcher(x, label))
      else if (v && typeof v.type === 'string') marcher(v, label)
    }
  })(ast, false)

  const champs = []
  for (const { ouvrant, nom, dansLabel } of trouves) {
    const attrs = ouvrant.attributes
    const ligne = ouvrant.loc.start.line
    if (attrs.some((a) => a.type === 'JSXSpreadAttribute')) { champs.push({ ligne, nom, sorte: 'delegue' }); continue }
    const type = attrs.find((a) => nomDe(a) === 'type')
    if (type?.value?.type === 'Literal' && SANS_SAISIE.has(type.value.value)) continue
    if (estCache(code, attrs)) continue
    const noms = new Set(attrs.map(nomDe))
    const id = attrs.find((a) => nomDe(a) === 'id')
    const idCible = id && cibles.has(texteDeLaValeur(code, id.value))
    if (dansLabel || idCible || noms.has('aria-labelledby')) { champs.push({ ligne, nom, sorte: 'nomme' }); continue }
    if (noms.has('aria-label') || noms.has('title')) {
      const sansTexte = type?.value?.type === 'Literal' && SANS_TEXTE.has(type.value.value)
      champs.push({ ligne, nom, sorte: noms.has('placeholder') && !sansTexte ? 'libelle-invisible' : 'nomme' })
      continue
    }
    champs.push({ ligne, nom, sorte: noms.has('placeholder') ? 'placeholder' : 'sans-nom' })
  }
  return { champs }
}

export function recenserLesChampsSansNom({ racine = 'src' } = {}) {
  const sansNom = []
  const placeholderSeul = []
  const delegues = []
  const libellesInvisibles = []
  const illisibles = []
  let total = 0
  for (const f of collecter(racine)) {
    const { champs, illisible } = analyser(f)
    if (illisible) { illisibles.push(f); continue }
    for (const c of champs) {
      total++
      const ou = { fichier: f, ligne: c.ligne, nom: c.nom }
      if (c.sorte === 'sans-nom') sansNom.push(ou)
      else if (c.sorte === 'placeholder') placeholderSeul.push(ou)
      else if (c.sorte === 'delegue') delegues.push(ou)
      else if (c.sorte === 'libelle-invisible') libellesInvisibles.push(ou)
    }
  }
  return { total, sansNom, placeholderSeul, delegues, libellesInvisibles, illisibles }
}

// `node scripts/champs-sans-nom.mjs` : la liste, pour corriger.
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const r = recenserLesChampsSansNom()
  console.log(`${r.total} champs — ${r.sansNom.length} sans nom, ${r.placeholderSeul.length} placeholder seul, ${r.libellesInvisibles.length} libellé invisible, ${r.delegues.length} délégués, ${r.illisibles.length} fichier(s) illisible(s)`)
  for (const c of r.sansNom) console.log(`  SANS NOM     ${c.fichier}:${c.ligne}  <${c.nom}>`)
  for (const c of r.placeholderSeul) console.log(`  PLACEHOLDER  ${c.fichier}:${c.ligne}  <${c.nom}>`)
  for (const c of r.libellesInvisibles) console.log(`  INVISIBLE    ${c.fichier}:${c.ligne}  <${c.nom}>`)
  for (const f of r.illisibles) console.log(`  ILLISIBLE    ${f}`)
}
