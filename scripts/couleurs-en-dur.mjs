import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse } from 'espree'

// Combien de couleurs hexadécimales écrites en dur dans les composants ?
// (audit du 2026-10-04, UX-13 : les jetons existent — `--color-surface`,
// `--color-brand-600`… — mais le code les recopie : `#FDFAF6` ×58, `#D46A10`
// ×68 ; corriger un contraste ou changer une teinte touche des centaines de
// lignes.)
//
// Sont comptées les couleurs `#rgb`, `#rrggbb` et `#rrggbbaa` écrites dans les
// TEXTES des fichiers `.jsx` de src/ (chaînes, gabarits, texte JSX, valeurs
// d'attributs comme `className="bg-[#B85000]"`), hors tests. Les commentaires
// ne comptent pas. Les `.js` (jetons, thèmes, données) non plus : c'est là
// qu'une couleur doit vivre, sous un nom.
//
// C'est un CLIQUET : `src/test/unit/couleurs-en-dur-plafond.test.js` compare le
// total à `couleursEnDurPlafond` (package.json), au cran exact — une couleur
// ajoutée en dur fait échouer la CI ; une couleur remplacée par son jeton fait
// baisser le plafond. Pour la liste par fichier : `node scripts/couleurs-en-dur.mjs`.

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g
const TEXTES = new Set(['String', 'Template', 'JSXText'])

function collecter(dossier, fichiers = []) {
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name)
    // Le NOM du dossier : un motif `/test/` sur le chemin ne voit pas le
    // dossier `src/test` lui-même (pas de barre finale), et le parcourait.
    if (e.isDirectory()) { if (!/^(node_modules|[.]git|dist|test)$/.test(e.name)) collecter(p, fichiers) }
    else if (/[.]jsx$/.test(e.name) && !/[.]test[.]/.test(e.name)) fichiers.push(p)
  }
  return fichiers
}

export function couleursDuCode(code) {
  const { tokens } = parse(code, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true }, tokens: true })
  let n = 0
  for (const t of tokens) if (TEXTES.has(t.type)) n += (t.value.match(HEX) ?? []).length
  return n
}

export function recenserLesCouleursEnDur({ racine = process.cwd(), dossier = 'src' } = {}) {
  const parFichier = []
  const illisibles = []
  let total = 0
  for (const p of collecter(path.join(racine, dossier))) {
    const fichier = path.relative(racine, p).split(path.sep).join('/')
    try {
      const n = couleursDuCode(fs.readFileSync(p, 'utf8'))
      if (n) parFichier.push({ fichier, n })
      total += n
    } catch (e) {
      illisibles.push({ fichier, erreur: e.message })
    }
  }
  parFichier.sort((a, b) => b.n - a.n || a.fichier.localeCompare(b.fichier))
  return { total, parFichier, illisibles }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { total, parFichier, illisibles } = recenserLesCouleursEnDur()
  for (const { fichier, n } of parFichier) console.log(`${String(n).padStart(4)}  ${fichier}`)
  for (const i of illisibles) console.log(`ILLISIBLE ${i.fichier} : ${i.erreur}`)
  console.log(`${total} couleur(s) en dur dans ${parFichier.length} fichier(s) .jsx`)
}
