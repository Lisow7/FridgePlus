import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Généralisation du lot 19 : quelles fonctions RENDENT une erreur, et qui
// l'ignore ?
//
// Étape 1 — recenser les fonctions exportées dont le corps contient
//           `return { error` ou `return { ok:` : par contrat, elles signalent
//           leurs échecs à l'appelant.
// Étape 2 — trouver leurs appels dont le résultat n'est ni affecté, ni
//           déstructuré, ni chaîné. Ces appels-là jettent l'information.
//
// Depuis le 2026-10-05 (audit du 2026-10-04, ARCH-05), c'est aussi un CLIQUET :
// `src/test/unit/erreurs-jetees-plafond.test.js` compare ce compte à
// `erreursJeteesPlafond` (package.json), au cran exact, comme le lint. Le
// compte ne peut que baisser.

// Journaux « au mieux » : écrits APRÈS l'action, ils ne doivent pas la faire
// échouer, et ils disent leur propre échec (`console.error` dans `audit.js`).
// Les ignorer est voulu ; les compter noierait les vrais oublis.
export const AU_MIEUX = new Set(['logAuditAction'])

function collecter(dossier, fichiers = []) {
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name)
    const n = p.split(path.sep).join('/')
    if (e.isDirectory()) { if (!/node_modules|[.]git|dist|\/test\//.test(n)) collecter(p, fichiers) }
    else if (/[.]jsx?$/.test(e.name) && !/[.]test[.]/.test(e.name)) fichiers.push(n)
  }
  return fichiers
}

export function recenserLesErreursJetees({ racine = 'src' } = {}) {
  const fichiers = collecter(racine)

  // ── Étape 1 : les fonctions au contrat « je rends mon erreur »
  const contrat = new Map() // nom -> fichier
  for (const f of fichiers) {
    const lignes = fs.readFileSync(f, 'utf8').split('\n')
    for (let i = 0; i < lignes.length; i++) {
      const m = lignes[i].match(/^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/)
      if (!m) continue
      // Corps approximatif : jusqu'au prochain `export` de premier niveau.
      let fin = lignes.length
      for (let j = i + 1; j < lignes.length; j++) if (/^export\s/.test(lignes[j])) { fin = j; break }
      const corps = lignes.slice(i, fin).join('\n')
      if (/return\s*\{\s*(error|ok)\b/.test(corps)) contrat.set(m[1], f)
    }
  }

  // ── Étape 2 : les appels qui jettent le résultat
  // Motifs compilés UNE fois par nom (les recompiler à chaque ligne coûtait
  // ~5 s sur `src/`, à chaque passage de la suite).
  const motifs = [...contrat.keys()].filter((nom) => !AU_MIEUX.has(nom)).map((nom) => ({
    nom,
    appel: new RegExp(`(^|[^\\w$.])${nom}\\s*\\(`),
    definition: new RegExp(`function\\s+${nom}\\b`),
    enTete: new RegExp(`^\\s*(await\\s+)?${nom}\\s*\\(`),
  }))
  const jetes = []
  for (const f of fichiers) {
    const lignes = fs.readFileSync(f, 'utf8').split('\n')
    lignes.forEach((l, i) => {
      for (const { nom, appel: re, definition, enTete } of motifs) {
        // Appel présent sur la ligne ?
        if (!l.includes(nom) || !re.test(l)) continue
        // Import, définition, ou commentaire : hors sujet.
        if (/^\s*(import|export)\b/.test(l) || /^\s*(\/\/|\*)/.test(l)) continue
        if (f === contrat.get(nom) && definition.test(l)) continue
        // Résultat exploité : affecté, déconstruit, chaîné, ou rendu.
        const avant = l.slice(0, l.search(re) + 1)
        if (/[=:]\s*$|=>\s*$|\breturn\s+$|\bawait\s+$/.test(avant.trimEnd() + ' ') === false
            && /(const|let|var)\s|=>|return|=\s*await|\.then|\?\?|\|\||&&/.test(avant)) continue
        // Motif « résultat jeté » : la ligne commence par `await X(` ou `X(`…
        if (!enTete.test(l)) continue
        // … sauf si elle CONTINUE la ligne d'avant, qui reçoit le résultat :
        // `const { … } =` puis `X(…)` à la ligne suivante, un argument
        // (`Promise.all([` puis `X(…),`), un ternaire, un `&&`… Faux positif vu
        // le 2026-10-08 : il a masqué, au lot 14c, le retrait d'un vrai oubli.
        const lignePrecedente = (lignes[i - 1] ?? '').replace(/\/\/.*$/, '').trimEnd()
        if (/(=|=>|\(|\[|,|\?|:|&&|\|\||\?\?|\breturn)$/.test(lignePrecedente)) continue
        // … sauf si l'appel se poursuit sur la ligne suivante par un `.then`
        // qui reçoit le résultat (`.then((resultat) => …)`).
        if (/^\s*\.then\(\s*\(?\s*[A-Za-z_$]/.test(lignes[i + 1] ?? '')) continue
        jetes.push({ fichier: f, ligne: i + 1, nom, code: l.trim().slice(0, 88) })
      }
    })
  }
  return { contrat, jetes }
}

// Lancé directement (`node scripts/erreurs-jetees.mjs`) : le rapport lisible.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { contrat, jetes } = recenserLesErreursJetees()
  console.log(`Fonctions au contrat « je rends mon erreur » : ${contrat.size}`)
  console.log(`Appels qui JETTENT ce résultat : ${jetes.length} (hors journaux au mieux : ${[...AU_MIEUX].join(', ')})\n`)
  const parFichier = new Map()
  for (const j of jetes) {
    if (!parFichier.has(j.fichier)) parFichier.set(j.fichier, [])
    parFichier.get(j.fichier).push(j)
  }
  for (const [f, liste] of [...parFichier.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`── ${f.replace('src/', '')}  (${liste.length})`)
    for (const j of liste) console.log(`   :${j.ligne}  ${j.code}`)
  }
}
