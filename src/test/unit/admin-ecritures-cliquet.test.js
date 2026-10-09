import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Audit du 2026-10-04, ADM-02 — le « trou du cliquet ». Le garde-fou de
// `appliquer-en-lot.test.js` ne repère que `await Promise.all(` jeté. La forme
// « un seul appel » — `await adminX(...)` en instruction nue, résultat jeté —
// passait : huit sites du panneau et trois de l'API du support retiraient une
// ligne ou baissaient un badge sans savoir si l'écriture avait eu lieu.
//
// Ce cliquet refuse toute INSTRUCTION qui attend une écriture d'administration
// sans en lire le résultat, dans le panneau ET les API qu'il appelle.

const RACINE = resolve(process.cwd())
const DOSSIERS = ['src/features/admin']
const FICHIERS = [
  'src/features/support/api/support.js',
  'src/shared/lib/recipes/recipes-repository.js',
  'src/shared/api/feature-flags.js',
]

// Une instruction qui commence par `await` (en début de ligne, ou après `{` ou
// `;`) et appelle une écriture : fonction `admin…`, les quelques écritures
// d'administration qui ne portent pas ce préfixe, ou une requête Supabase.
const INSTRUCTION_JETEE = /(^\s*|[{;]\s*)await\s+(admin[A-Z]\w*|markTicketReadByAdmin|setFeatureFlag|supabase\s*(\.\s*from\b|$))/

// Une ligne de commentaire peut citer l'ancien patron pour l'expliquer.
const COMMENTAIRE = /^\s*(\/\/|\*|\/\*)/

// Les seules exceptions, chacune avec sa raison.
const EXCEPTIONS = [
  // `logAdminAction` : le journal des modérations est écrit « au mieux », après
  // une écriture réussie — son échec ne doit pas faire échouer la modération.
  // L'audit (ADM-05) le distingue explicitement de la consultation d'une donnée
  // sensible, où la trace est la CONDITION de l'affichage.
  { fichier: 'src/features/admin/api/admin.js', ligne: "await supabase.from('activity_logs').insert({" },
]

function fichiersDe(dossier) {
  const out = []
  for (const e of readdirSync(join(RACINE, dossier), { withFileTypes: true })) {
    const chemin = join(dossier, e.name)
    if (e.isDirectory()) out.push(...fichiersDe(chemin))
    else if (/\.jsx?$/.test(e.name)) out.push(chemin.replaceAll('\\', '/'))
  }
  return out
}

function coupables() {
  const liste = []
  for (const fichier of [...DOSSIERS.flatMap(fichiersDe), ...FICHIERS]) {
    readFileSync(join(RACINE, fichier), 'utf8').split(/\r?\n/).forEach((ligne, i) => {
      if (COMMENTAIRE.test(ligne) || !INSTRUCTION_JETEE.test(ligne)) return
      if (EXCEPTIONS.some((e) => e.fichier === fichier && ligne.trim() === e.ligne)) return
      liste.push(`${fichier}:${i + 1}  ${ligne.trim()}`)
    })
  }
  return liste
}

describe('aucune écriture d’administration n’est attendue sans être lue', () => {
  it('le balayage voit bien une écriture jetée (témoin)', () => {
    expect(INSTRUCTION_JETEE.test('    await adminToggleBan(userId, true)')).toBe(true)
    expect(INSTRUCTION_JETEE.test("      onConfirm: async () => { await adminDeleteTicket(id); retirer() },")).toBe(true)
    expect(INSTRUCTION_JETEE.test("  await supabase.from('support_tickets')")).toBe(true)
    expect(INSTRUCTION_JETEE.test('  await supabase')).toBe(true)
    expect(INSTRUCTION_JETEE.test('    const { error } = await adminToggleBan(userId, true)')).toBe(false)
    expect(INSTRUCTION_JETEE.test('    return await adminDeleteRecipe(id)')).toBe(false)
    expect(COMMENTAIRE.test(' * Avant : `onConfirm: async () => { await adminX(id); retirer() }`')).toBe(true)
  })

  it('… et il en reste zéro', () => {
    expect(
      coupables(),
      'Ces lignes attendent une écriture sans regarder si elle a eu lieu. Lire `{ error }` '
      + '(et ne retirer une ligne, baisser un badge ou annoncer un succès qu’après), ou passer '
      + 'par `supprimerAvecAnnulation` / `appliquerEnLot` (features/admin/lib).',
    ).toEqual([])
  })
})
