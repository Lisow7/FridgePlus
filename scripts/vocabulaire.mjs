import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse } from 'espree'

// Un nom par chose (audit du 2026-10-04, UX-08 et UX-16 ; décision du 2026-10-08). La référence est `docs/vocabulaire.md` : ce
// détecteur relève, dans ce que l'app AFFICHE, les synonymes qu'elle écarte.
//
// Chaque texte (chaîne, gabarit, texte JSX) est rattaché à sa langue :
// - la clé `fr` / `en` qui l'englobe (`{ fr: { titre: '…' } }`, `{ fr: '…' }`) ;
// - la branche d'un `lang === 'fr' ? '…' : '…'` (ou `fr ? … : …`, `isFr ? …`).
// Un texte sans langue connue n'est confronté qu'aux règles `sure: true` (un
// mot qui n'existe que dans une langue). es/de/ja : héritage non exposé, ignoré.
//
// Ne comptent pas : le panneau admin (outil interne), les tests, les
// commentaires et les expressions régulières (seuls les textes sont lus).
//
// C'est un garde-fou : `src/test/unit/vocabulaire-tenu.test.js` exige une liste
// vide. Pour la lire : `node scripts/vocabulaire.mjs`.

const L = 'A-Za-zÀ-ÖØ-öø-ÿ'
const mot = (m) => new RegExp(`(?<![${L}])(?:${m})(?![${L}])`, 'i')

export const REGLES = [
  // ── Ce qu'on a chez soi : « Inventaire » (EN « Inventory »). Seul le NOM est
  // visé (menu, titre du panneau, aide) : « dans ton frigo », « Ouvrir mon
  // frigo », le tri « 🎯 Mon frigo » parlent du frigo, pas de l'inventaire.
  { notion: 'inventaire', lang: 'fr', interdit: mot('Aperçu du frigo'), canon: 'Inventaire', sure: true },
  { notion: 'inventaire', lang: 'fr', interdit: /^\s*Mon frigo\s*[—–]/, canon: 'Inventaire — n aliments' },
  { notion: 'inventaire', lang: 'en', interdit: mot('Fridge overview|Fridge at a glance'), canon: 'Inventory', sure: true },
  { notion: 'inventaire', lang: 'en', interdit: /^\s*My fridge\s*[—–]/, canon: 'Inventory — n items' },
  // ── Les courses : « Panier » (EN « Cart »), « Mes listes » pour celles qu'on garde
  { notion: 'panier', lang: 'fr', interdit: mot('listes? de courses'), canon: 'panier (ou « liste » pour une liste gardée)', sure: true },
  { notion: 'panier', lang: 'en', interdit: mot('baskets?'), canon: 'cart', sure: true },
  { notion: 'panier', lang: 'en', interdit: mot('shopping lists?'), canon: 'cart (or « list » for a saved one)', sure: true },
  // ── La cuisine pas à pas : « Mode cuisine » (EN « Cooking mode »), la voix en est une option
  { notion: 'mode cuisine', lang: 'fr', interdit: mot('cuisine guidée'), canon: 'Mode cuisine', sure: true },
  { notion: 'mode cuisine', lang: 'fr', interdit: mot('mode cuisine vocal|cuisine vocale'), canon: 'Mode cuisine (la voix en est une option)', sure: true },
  { notion: 'mode cuisine', lang: 'en', interdit: mot('guided cooking'), canon: 'Cooking mode', sure: true },
  { notion: 'mode cuisine', lang: 'en', interdit: mot('(?:hands-free )?(?:voice|vocal) cooking(?: mode)?|hands-free cooking mode'), canon: 'Cooking mode (voice is an option)', sure: true },
  // ── « Mes recettes » = seulement celles qu'on a créées
  { notion: 'mes recettes', lang: 'fr', interdit: mot('Voir mes recettes'), canon: 'Voir les recettes', sure: true },
  { notion: 'mes recettes', lang: 'en', interdit: mot('See my recipes|View my recipes'), canon: 'See the recipes', sure: true },
  // ── Le bouton orange : « Actions rapides » (EN « Quick actions »)
  { notion: 'actions rapides', lang: 'fr', interdit: mot("bouton d['’]actions"), canon: 'Actions rapides', sure: true },
  { notion: 'actions rapides', lang: 'fr', interdit: mot('bouton orange'), sauf: /Actions rapides/, canon: '« le bouton orange, Actions rapides » la première fois', sure: true },
  { notion: 'actions rapides', lang: 'en', interdit: mot('actions button'), canon: 'Quick actions', sure: true },
  { notion: 'actions rapides', lang: 'en', interdit: mot('orange button'), sauf: /Quick actions/, canon: '« the orange button, Quick actions » the first time', sure: true },
  // ── Le ticket de caisse : « Photo du ticket » (EN « Receipt photo »)
  { notion: 'photo du ticket', lang: 'fr', interdit: mot('scan(?:ner)? (?:du |de ton |ton |le )?ticket(?: de caisse)?|scanne ton ticket'), canon: 'Photo du ticket (consigne : « Photographie ton ticket »)', sure: true },
  { notion: 'photo du ticket', lang: 'en', interdit: mot('receipt scan(?:ning)?|scan (?:your|the) receipt'), canon: 'Receipt photo (instruction: « Snap your receipt »)', sure: true },
  // ── La voix : « À la voix » (EN « By voice »)
  // « Parle à ton frigo » reste le slogan, « reconnaissance vocale » la demande d'accord.
  { notion: 'à la voix', lang: 'fr', interdit: mot('Dis-le au micro|Dis-le'), canon: 'À la voix', sure: true },
  { notion: 'à la voix', lang: 'fr', interdit: /^\s*Le micro\s*$/, canon: 'À la voix' },
  { notion: 'à la voix', lang: 'en', interdit: mot('say (?:it|them) (?:to|into) the mic'), canon: 'By voice', sure: true },
  { notion: 'à la voix', lang: 'en', interdit: /^\s*(?:Say it|The mic)\s*$/, canon: 'By voice' },
  // ── Ce qui n'est pas encore là : « Bientôt » (EN « Coming soon »)
  { notion: 'bientôt', lang: 'fr', interdit: mot('Prochainement|Bientôt disponibles?|Ce qui arrive'), canon: 'Bientôt', sure: true },
  { notion: 'bientôt', lang: 'en', interdit: mot('Available soon|Soon available'), canon: 'Coming soon', sure: true },
  { notion: 'bientôt', lang: 'en', interdit: /^\s*Soon\b/, canon: 'Coming soon' },
  // ── En anglais, se connecter : « Sign in »
  { notion: 'sign in', lang: 'en', interdit: mot('log ?in'), canon: 'Sign in' },
  // ── UX-16 : les mots anglais dans l'app française
  { notion: 'publication', lang: 'fr', interdit: mot('posts?'), canon: 'publication' },
  { notion: "j'aime", lang: 'fr', interdit: mot('likes?'), canon: "j'aime" },
  { notion: 'support', lang: 'fr', interdit: /^\s*Support\s*$/, canon: 'Écrire au support' },
  { notion: 'grandes quantités', lang: 'fr', interdit: mot('batch cooking'), canon: 'Grandes quantités', sure: true },
]

const LANGUES = new Set(['fr', 'en', 'es', 'de', 'ja'])
// Le journal des versions raconte le passé avec les mots de son époque.
const HORS_REGLE = /\/admin\/|\/test\/|[.]test[.]|\/changelog\/data\//
// Un identifiant n'est pas un texte affiché : 'user_basket', 'basket-modals-root',
// 'shared_baskets', 'basket' (une clé) — ni la valeur d'un attribut technique.
const TECHNIQUE = /^[A-Za-z0-9]*[_./:@#-][A-Za-z0-9_./:@#-]*$|^[a-z][a-z0-9]*$/
const ATTRIBUTS_TECHNIQUES = /^(className|class|id|key|href|to|src|type|name|role|htmlFor|rel|target|ref|style|data-[\w-]+|testId)$/

export function synonymesEcartes(texte, lang) {
  if (lang && lang !== 'fr' && lang !== 'en') return []
  const trouves = []
  for (const r of REGLES) {
    if (lang ? r.lang !== lang : !r.sure) continue
    const m = texte.match(r.interdit)
    if (m && !(r.sauf && r.sauf.test(texte))) trouves.push({ notion: r.notion, mot: m[0], canon: r.canon })
  }
  return trouves
}

function collecter(dossier, fichiers = []) {
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name)
    if (e.isDirectory()) { if (!/node_modules|[.]git|dist/.test(e.name)) collecter(p, fichiers) }
    else if (/[.]jsx?$/.test(e.name)) fichiers.push(p)
  }
  return fichiers
}

const nomDeCle = (cle) => (cle?.type === 'Identifier' ? cle.name : typeof cle?.value === 'string' ? cle.value : null)

// La langue d'une branche de `cond ? a : b` : `lang === 'fr'`, `'en' !== lang`,
// `fr`, `isFr`… → [langue de a, langue de b], ou null.
function languesDuTernaire(test) {
  if (test?.type === 'Identifier') {
    if (/^(is)?fr$/i.test(test.name)) return ['fr', 'en']
    if (/^(is)?en$/i.test(test.name)) return ['en', 'fr']
  }
  if (test?.type === 'BinaryExpression' && ['===', '==', '!==', '!='].includes(test.operator)) {
    const lit = [test.left, test.right].find((c) => c.type === 'Literal' && (c.value === 'fr' || c.value === 'en'))
    if (lit) {
      const autre = lit.value === 'fr' ? 'en' : 'fr'
      return test.operator.startsWith('!') ? [autre, lit.value] : [lit.value, autre]
    }
  }
  return null
}

export function textesDuCode(code) {
  const arbre = parse(code, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true }, loc: true })
  const textes = []
  const visiter = (noeud, lang) => {
    if (!noeud || typeof noeud.type !== 'string') return
    if (noeud.type === 'Property') {
      const cle = nomDeCle(noeud.key)
      visiter(noeud.value, LANGUES.has(cle) ? cle : lang)
      return
    }
    if (noeud.type === 'ConditionalExpression') {
      const [a, b] = languesDuTernaire(noeud.test) ?? [lang, lang]
      visiter(noeud.test, lang)
      visiter(noeud.consequent, a)
      visiter(noeud.alternate, b)
      return
    }
    // (Les chemins de modules ont tous l'allure d'un identifiant : TECHNIQUE
    // les écarte plus bas.)
    if (noeud.type === 'JSXAttribute' && ATTRIBUTS_TECHNIQUES.test(noeud.name?.name ?? '')) return
    // Les journaux de développement (`console.error('[basket] …')`) non plus.
    if (noeud.type === 'CallExpression' && noeud.callee?.type === 'MemberExpression' && noeud.callee.object?.name === 'console') return
    if (noeud.type === 'Literal' && typeof noeud.value === 'string') textes.push({ texte: noeud.value, ligne: noeud.loc.start.line, lang })
    else if (noeud.type === 'TemplateElement') textes.push({ texte: noeud.value.cooked ?? noeud.value.raw, ligne: noeud.loc.start.line, lang })
    else if (noeud.type === 'JSXText') textes.push({ texte: noeud.value, ligne: noeud.loc.start.line, lang })
    for (const cle of Object.keys(noeud)) {
      if (cle === 'loc' || cle === 'parent') continue
      const v = noeud[cle]
      if (Array.isArray(v)) v.forEach((x) => visiter(x, lang))
      else if (v && typeof v === 'object') visiter(v, lang)
    }
  }
  visiter(arbre, null)
  return textes
}

export function recenserLeVocabulaire({ racine = process.cwd(), dossiers = ['src'] } = {}) {
  const releves = []
  const illisibles = []
  for (const dossier of dossiers) {
    const absolu = path.join(racine, dossier)
    if (!fs.existsSync(absolu)) continue
    for (const p of collecter(absolu)) {
      const fichier = path.relative(racine, p).split(path.sep).join('/')
      if (HORS_REGLE.test(`/${fichier}`)) continue
      try {
        for (const { texte, ligne, lang } of textesDuCode(fs.readFileSync(p, 'utf8'))) {
          if (TECHNIQUE.test(texte.trim())) continue
          for (const s of synonymesEcartes(texte, lang)) releves.push({ fichier, ligne, lang, ...s })
        }
      } catch (e) {
        illisibles.push({ fichier, erreur: e.message })
      }
    }
  }
  return { releves, illisibles }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { releves, illisibles } = recenserLeVocabulaire()
  for (const r of releves) console.log(`${r.fichier}:${r.ligne}  [${r.lang ?? '?'}] « ${r.mot} » → ${r.canon}`)
  for (const i of illisibles) console.log(`ILLISIBLE ${i.fichier} : ${i.erreur}`)
  console.log(`${releves.length} synonyme(s) écarté(s), ${illisibles.length} fichier(s) illisible(s)`)
}
