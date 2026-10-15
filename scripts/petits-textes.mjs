import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse } from 'espree'
import { TEXTE_MIN_PX } from '../src/shared/lib/taille-de-texte.js'

// Combien de tailles de texte sous le plancher (12 px) dans les composants, hors
// panneau admin ? (Décision du 2026-10-08 : « 12 px minimum, hors admin — un
// réglage commun et un cliquet au cran exact, comme pour les couleurs ».)
//
// Sont comptées, dans les fichiers `.jsx` de src/ hors `src/features/admin/` et
// hors tests :
//   · la valeur d'une propriété `fontSize` (`'11px'`, `11`, et chaque branche
//     d'une expression : `grand ? 13 : 9.5` compte une fois) ;
//   · les classes Tailwind `text-[11px]` des textes du fichier.
// Lecture par jetons : les commentaires ne comptent pas.
//
// C'est un CLIQUET : `src/test/unit/petits-textes-plafond.test.js` compare le
// total à `petitsTextesPlafond` (package.json), au cran exact — un texte ajouté
// sous le plancher fait échouer la CI ; un texte remonté fait baisser le
// plafond. Pour la liste par fichier : `node scripts/petits-textes.mjs`.
const TAILLE = /^(\d+(?:\.\d+)?)(px)?$/
const CLASSE = /text-\[(\d+(?:\.\d+)?)px\]/g
const TEXTES = new Set(['String', 'Template', 'JSXText'])

function collecter(dossier, fichiers = []) {
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name)
    if (e.isDirectory()) { if (!/^(node_modules|[.]git|dist|test)$/.test(e.name)) collecter(p, fichiers) }
    else if (/[.]jsx$/.test(e.name) && !/[.]test[.]/.test(e.name)) fichiers.push(p)
  }
  return fichiers
}

const sousLePlancher = (valeur) => {
  const m = TAILLE.exec(valeur.replace(/^['"`]|['"`]$/g, ''))
  return Boolean(m) && parseFloat(m[1]) < TEXTE_MIN_PX
}

export function petitsTextesDuCode(code) {
  const { tokens } = parse(code, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true }, tokens: true })
  let n = 0
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (TEXTES.has(t.type)) for (const m of t.value.matchAll(CLASSE)) if (parseFloat(m[1]) < TEXTE_MIN_PX) n++
    // `fontSize:` puis sa valeur, jusqu'à la virgule ou l'accolade de même niveau.
    if (t.type === 'Identifier' && t.value === 'fontSize' && tokens[i + 1]?.value === ':') {
      let profondeur = 0
      for (let j = i + 2; j < tokens.length; j++) {
        const v = tokens[j]
        if (v.type === 'Punctuator') {
          if ('([{'.includes(v.value)) profondeur++
          else if (')]}'.includes(v.value)) { if (profondeur === 0) break; profondeur-- }
          else if (v.value === ',' && profondeur === 0) break
        } else if ((v.type === 'Numeric' || v.type === 'String') && sousLePlancher(v.value)) n++
      }
    }
  }
  return n
}

export function recenserLesPetitsTextes({ racine = process.cwd(), dossier = 'src' } = {}) {
  const parFichier = []
  const illisibles = []
  let total = 0
  for (const p of collecter(path.join(racine, dossier))) {
    const fichier = path.relative(racine, p).split(path.sep).join('/')
    if (fichier.startsWith('src/features/admin/')) continue
    try {
      const n = petitsTextesDuCode(fs.readFileSync(p, 'utf8'))
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
  const { total, parFichier, illisibles } = recenserLesPetitsTextes()
  for (const { fichier, n } of parFichier) console.log(`${String(n).padStart(4)}  ${fichier}`)
  for (const i of illisibles) console.log(`ILLISIBLE ${i.fichier} : ${i.erreur}`)
  console.log(`${total} taille(s) de texte sous ${TEXTE_MIN_PX} px dans ${parFichier.length} fichier(s) .jsx hors admin`)
}
