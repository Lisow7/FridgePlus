import fs from 'node:fs'
import path from 'node:path'

// Cherche les FONCTIONS JUMELLES : meme nom, deux fichiers, corps proches mais
// pas identiques. C'est la forme de defaut dominante de ce depot — une garantie
// presente d'un cote et perdue dans la copie (5 occurrences en une nuit).

const FICHIERS = []
;(function collecter(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    const norm = p.split(path.sep).join('/')
    if (e.isDirectory()) { if (!/node_modules|[.]git|dist|\/test\//.test(norm)) collecter(p) }
    else if (/[.]jsx?$/.test(e.name) && !/[.]test[.]/.test(e.name)) FICHIERS.push(norm)
  }
})('src')

// Extrait les fonctions nommees : `function nom(`, `const nom = (`, `const nom = useCallback(`
const fonctions = new Map() // nom -> [{fichier, corps}]
for (const f of FICHIERS) {
  const src = fs.readFileSync(f, 'utf8')
  const lignes = src.split('\n')
  for (let i = 0; i < lignes.length; i++) {
    const m = lignes[i].match(/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/)
      || lignes[i].match(/^\s*const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:useCallback\(\s*)?(?:async\s*)?\(/)
    if (!m) continue
    // Corps : jusqu'a la ligne dont l'indentation revient au niveau de depart
    const indent = lignes[i].search(/\S/)
    const corps = [lignes[i]]
    for (let j = i + 1; j < lignes.length; j++) {
      const l = lignes[j]
      corps.push(l)
      if (l.trim() && l.search(/\S/) <= indent && /^\s*[})\]]/.test(l)) break
      if (corps.length > 120) break
    }
    if (corps.length < 8) continue // trop court pour etre interessant
    if (!fonctions.has(m[1])) fonctions.set(m[1], [])
    fonctions.get(m[1]).push({ fichier: f, ligne: i + 1, corps: corps.join('\n') })
  }
}

// Similarite grossiere : proportion de lignes normalisees communes.
const normaliser = (s) => s.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'))
function similarite(a, b) {
  const A = new Set(normaliser(a)), B = new Set(normaliser(b))
  let communs = 0
  for (const x of A) if (B.has(x)) communs++
  return communs / Math.max(A.size, B.size)
}

const jumeaux = []
for (const [nom, occ] of fonctions) {
  if (occ.length < 2) continue
  for (let i = 0; i < occ.length; i++) {
    for (let j = i + 1; j < occ.length; j++) {
      if (occ[i].fichier === occ[j].fichier) continue
      const s = similarite(occ[i].corps, occ[j].corps)
      // Proches mais PAS identiques : c'est la zone interessante.
      if (s >= 0.55 && s < 0.999) jumeaux.push({ nom, s, a: occ[i], b: occ[j] })
    }
  }
}
jumeaux.sort((x, y) => y.s - x.s)

console.log(`Fonctions jumelles proches mais divergentes : ${jumeaux.length}\n`)
for (const j of jumeaux.slice(0, 15)) {
  const A = new Set(normaliser(j.a.corps)), B = new Set(normaliser(j.b.corps))
  const seulA = [...A].filter(x => !B.has(x))
  const seulB = [...B].filter(x => !A.has(x))
  // Les lignes qui ressemblent a une GARDE : condition + sortie, filtre, validation.
  const garde = (l) => /^\s*if\s*\(.*\)\s*(return|throw)|\.filter\(|=== *null|!\w+\?\.|\?\?/.test(l)
  const gardesA = seulA.filter(garde), gardesB = seulB.filter(garde)
  if (!gardesA.length && !gardesB.length) continue
  console.log(`── ${j.nom}  (similarite ${(j.s * 100).toFixed(0)} %)`)
  console.log(`   A: ${j.a.fichier}:${j.a.ligne}`)
  console.log(`   B: ${j.b.fichier}:${j.b.ligne}`)
  if (gardesA.length) console.log('   garde presente SEULEMENT en A :\n' + gardesA.slice(0, 3).map(l => '        ' + l.slice(0, 100)).join('\n'))
  if (gardesB.length) console.log('   garde presente SEULEMENT en B :\n' + gardesB.slice(0, 3).map(l => '        ' + l.slice(0, 100)).join('\n'))
  console.log()
}
