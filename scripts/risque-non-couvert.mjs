import fs from 'node:fs'
import path from 'node:path'

// Croise la couverture avec le RISQUE du code. Un pourcentage global ne dit pas
// ou aller ; « ce module ecrit en base, supprime des donnees, touche a l'argent
// ou aux droits — et n'est pas teste » le dit.

const RACINE = process.cwd()
let resume
try {
  resume = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'))
} catch {
  console.error('Aucune mesure de couverture trouvee.')
  console.error('Lancer `npm run test:coverage`, ou `npm run test:risque` qui enchaine les deux.')
  process.exit(2)
}

// Signaux de risque, du plus grave au moins grave.
const SIGNAUX = [
  { poids: 5, nom: 'suppression',   re: /\.delete\(|removeItem|\bclear\w*\(|hardDelete|DROP |purge/i },
  { poids: 4, nom: 'ecriture BDD',  re: /\.insert\(|\.update\(|\.upsert\(|\.rpc\(/ },
  { poids: 4, nom: 'argent',        re: /stripe|checkout|subscription|price|budget|cost_cents/i },
  { poids: 4, nom: 'droits',        re: /is_admin|isAdmin|role|permission|banned|premium/i },
  { poids: 3, nom: 'persistance',   re: /localStorage\.setItem|sessionStorage\.setItem/ },
  { poids: 2, nom: 'auth',          re: /signIn|signOut|signUp|session|token/i },
]

const lignes = []
for (const [absolu, m] of Object.entries(resume)) {
  if (absolu === 'total') continue
  const rel = path.relative(RACINE, absolu).split(path.sep).join('/')
  if (!rel.startsWith('src/') || rel.startsWith('src/test/')) continue
  let texte = ''
  try { texte = fs.readFileSync(absolu, 'utf8') } catch { continue }
  const trouves = SIGNAUX.filter(s => s.re.test(texte))
  if (!trouves.length) continue
  const risque = trouves.reduce((a, s) => a + s.poids, 0)
  const couv = m.lines.pct
  // Priorite = risque x manque de couverture.
  const priorite = Math.round(risque * (100 - couv))
  lignes.push({ rel, risque, couv, priorite, motifs: trouves.map(s => s.nom), lignesTotal: m.lines.total })
}

lignes.sort((a, b) => b.priorite - a.priorite)

console.log(`Modules porteurs de risque : ${lignes.length}`)
console.log(`Couverture globale : ${resume.total.lines.pct}% des lignes\n`)
console.log('PRIO  COUV%  LIGNES  FICHIER / motifs de risque')
console.log('----  -----  ------  -------------------------------------------')
for (const l of lignes.slice(0, 30)) {
  console.log(
    String(l.priorite).padStart(4) + '  ' +
    String(l.couv).padStart(5) + '  ' +
    String(l.lignesTotal).padStart(6) + '  ' +
    l.rel.replace(/^src\//, '') + '  [' + l.motifs.join(', ') + ']'
  )
}

const zero = lignes.filter(l => l.couv === 0)
console.log(`\n=== A RISQUE ET JAMAIS EXECUTES PAR UN TEST : ${zero.length} ===`)
for (const l of zero.slice(0, 25)) {
  console.log(`  ${String(l.lignesTotal).padStart(4)} l  ${l.rel.replace(/^src\//, '')}  [${l.motifs.join(', ')}]`)
}
