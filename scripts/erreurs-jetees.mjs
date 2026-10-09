import fs from 'node:fs'
import path from 'node:path'

// Généralisation du lot 19 : quelles fonctions RENDENT une erreur, et qui
// l'ignore ?
//
// Étape 1 — recenser les fonctions exportées dont le corps contient
//           `return { error` ou `return { ok:` : par contrat, elles signalent
//           leurs échecs à l'appelant.
// Étape 2 — trouver leurs appels dont le résultat n'est ni affecté, ni
//           déstructuré, ni chaîné. Ces appels-là jettent l'information.

const FICHIERS = []
;(function collecter(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    const n = p.split(path.sep).join('/')
    if (e.isDirectory()) { if (!/node_modules|[.]git|dist|\/test\//.test(n)) collecter(p) }
    else if (/[.]jsx?$/.test(e.name) && !/[.]test[.]/.test(e.name)) FICHIERS.push(n)
  }
})('src')

// ── Étape 1 : les fonctions au contrat « je rends mon erreur »
const contrat = new Map() // nom -> fichier
for (const f of FICHIERS) {
  const src = fs.readFileSync(f, 'utf8')
  const lignes = src.split('\n')
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

// ── Étape 2 : les appels qui jettent le resultat
const jetes = []
for (const f of FICHIERS) {
  const lignes = fs.readFileSync(f, 'utf8').split('\n')
  lignes.forEach((l, i) => {
    for (const nom of contrat.keys()) {
      // Appel present sur la ligne ?
      const re = new RegExp(`(^|[^\\w$.])${nom}\\s*\\(`)
      if (!re.test(l)) continue
      // Import, definition, ou commentaire : hors sujet.
      if (/^\s*(import|export)\b/.test(l) || /^\s*(\/\/|\*)/.test(l)) continue
      if (f === contrat.get(nom) && new RegExp(`function\\s+${nom}\\b`).test(l)) continue
      // Resultat exploite : affecte, deconstruit, chaine, ou rendu.
      const avant = l.slice(0, l.search(re) + 1)
      if (/[=:]\s*$|=>\s*$|\breturn\s+$|\bawait\s+$/.test(avant.trimEnd() + ' ') === false
          && /(const|let|var)\s|=>|return|=\s*await|\.then|\?\?|\|\||&&/.test(avant)) continue
      // Motif « resultat jete » : la ligne commence par `await X(` ou `X(`.
      const jete = new RegExp(`^\\s*(await\\s+)?${nom}\\s*\\(`).test(l)
      if (jete) jetes.push({ fichier: f, ligne: i + 1, nom, code: l.trim().slice(0, 88) })
    }
  })
}

console.log(`Fonctions au contrat « je rends mon erreur » : ${contrat.size}`)
console.log(`Appels qui JETTENT ce resultat : ${jetes.length}\n`)
const parFichier = new Map()
for (const j of jetes) {
  if (!parFichier.has(j.fichier)) parFichier.set(j.fichier, [])
  parFichier.get(j.fichier).push(j)
}
for (const [f, liste] of [...parFichier.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`── ${f.replace('src/', '')}  (${liste.length})`)
  for (const j of liste) console.log(`   :${j.ligne}  ${j.code}`)
}
