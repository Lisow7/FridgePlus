import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse } from 'espree'

// Où l'app vouvoie-t-elle encore ? (audit du 2026-10-04, UX-16 : la règle
// « tutoiement partout, sauf les pages légales » tenait à 364 chaînes contre 3 ;
// il restait « Appuyez sur ♡ », « Recevez un rappel », la page 404 statique et
// les données structurées de l'accueil.)
//
// Est relevé, dans ce que l'app AFFICHE : un mot en « -ez » (l'impératif ou le
// présent du vouvoiement : « Appuyez », « vous avez ») et « vous », « votre »,
// « vos ». Ne comptent pas :
// - les pages légales (`src/features/legal/`) et le panneau admin, qui
//   vouvoient par choix ;
// - les commentaires et les expressions régulières : seuls les textes (chaînes,
//   gabarits, texte JSX) sont lus, à travers l'arbre du code ;
// - les mots qui finissent en « -ez » sans vouvoyer (MOTS_EN_EZ) ;
// - les formes conjuguées que le glossaire culinaire doit RECONNAÎTRE dans les
//   étapes des recettes (« hachez »), rangées sous sa clé `match`.
//
// C'est aussi un garde-fou : `src/test/unit/tutoiement-partout.test.js` exige
// une liste vide. Pour la lire : `node scripts/vouvoiement.mjs`.

const MOTS_EN_EZ = new Set(['chez', 'assez', 'nez', 'rez', 'merguez'])
const MOT_EN_EZ = /[A-Za-zÀ-ÖØ-öø-ÿ]+ez(?![A-Za-zÀ-ÖØ-öø-ÿ])/g
const PRONOMS = /(?<![A-Za-zÀ-ÖØ-öø-ÿ])(vous|votre|vos)(?![A-Za-zÀ-ÖØ-öø-ÿ])/gi
const HORS_REGLE = /\/(legal|admin)\/|\/test\/|[.]test[.]/
// Glossaire culinaire : ses listes `match` sont des mots à reconnaître.
const LISTES_A_RECONNAITRE = { 'src/shared/lib/recipes/culinary-glossary.js': 'match' }

export function motsQuiVouvoient(texte) {
  const trouves = []
  for (const m of texte.match(MOT_EN_EZ) ?? []) if (!MOTS_EN_EZ.has(m.toLowerCase())) trouves.push(m)
  for (const m of texte.match(PRONOMS) ?? []) trouves.push(m)
  return trouves
}

function collecter(dossier, fichiers = []) {
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name)
    if (e.isDirectory()) { if (!/node_modules|[.]git|dist/.test(e.name)) collecter(p, fichiers) }
    // Le seul `.ts` de src/ est le fichier de types généré (`npm run db:types`).
    else if (/[.]jsx?$/.test(e.name)) fichiers.push(p)
  }
  return fichiers
}

// Parcourt l'arbre du code et rend chaque texte avec sa ligne ; `cleIgnoree`
// écarte les textes rangés sous une propriété de ce nom.
function textesDuCode(code, cleIgnoree) {
  const arbre = parse(code, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true }, loc: true })
  const textes = []
  const visiter = (noeud) => {
    if (!noeud || typeof noeud.type !== 'string') return
    if (noeud.type === 'Property' && cleIgnoree && (noeud.key?.name === cleIgnoree || noeud.key?.value === cleIgnoree)) return
    if (noeud.type === 'Literal' && typeof noeud.value === 'string') textes.push({ texte: noeud.value, ligne: noeud.loc.start.line })
    else if (noeud.type === 'TemplateElement') textes.push({ texte: noeud.value.cooked ?? noeud.value.raw, ligne: noeud.loc.start.line })
    else if (noeud.type === 'JSXText') textes.push({ texte: noeud.value, ligne: noeud.loc.start.line })
    for (const cle of Object.keys(noeud)) {
      if (cle === 'loc' || cle === 'parent') continue
      const v = noeud[cle]
      if (Array.isArray(v)) v.forEach(visiter)
      else if (v && typeof v === 'object') visiter(v)
    }
  }
  visiter(arbre)
  return textes
}

// HTML servi tel quel : tout le texte compte (les données structurées aussi,
// que lisent les moteurs de recherche), sauf les commentaires.
function textesDuHtml(code) {
  // Les commentaires sont blanchis sans retirer leurs sauts de ligne : les
  // numéros de ligne restent ceux du fichier.
  const sansCommentaires = code.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '))
  return sansCommentaires.split(/\r?\n/).map((l, i) => ({ texte: l, ligne: i + 1 }))
}

export function recenserLeVouvoiement({ racine = process.cwd(), dossiers = ['src'], pages = ['index.html', 'public/404.html'] } = {}) {
  const releves = []
  const illisibles = []
  const relever = (fichier, textes) => {
    for (const { texte, ligne } of textes) {
      for (const mot of motsQuiVouvoient(texte)) releves.push({ fichier, ligne, mot })
    }
  }
  for (const dossier of dossiers) {
    const absolu = path.join(racine, dossier)
    if (!fs.existsSync(absolu)) continue
    for (const p of collecter(absolu)) {
      const fichier = path.relative(racine, p).split(path.sep).join('/')
      if (HORS_REGLE.test(`/${fichier}`)) continue
      try {
        relever(fichier, textesDuCode(fs.readFileSync(p, 'utf8'), LISTES_A_RECONNAITRE[fichier]))
      } catch (e) {
        illisibles.push({ fichier, erreur: e.message })
      }
    }
  }
  for (const page of pages) {
    const absolu = path.join(racine, page)
    if (fs.existsSync(absolu)) relever(page, textesDuHtml(fs.readFileSync(absolu, 'utf8')))
  }
  return { releves, illisibles }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { releves, illisibles } = recenserLeVouvoiement()
  for (const r of releves) console.log(`${r.fichier}:${r.ligne}  « ${r.mot} »`)
  for (const i of illisibles) console.log(`ILLISIBLE ${i.fichier} : ${i.erreur}`)
  console.log(`${releves.length} vouvoiement(s), ${illisibles.length} fichier(s) illisible(s)`)
}
