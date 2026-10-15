// L'activité du tableau de bord par période : la base rend des comptes PAR
// JOUR (UTC, `admin_activite_par_jour`), cette fonction les range en sept ou
// trente jours, douze mois, ou une colonne par année. Pure : `maintenant` est
// injecté, et tout se calcule en UTC comme dans la base — l'ancien graphique
// mêlait minuit local et dates UTC, et un jour basculait près de minuit à Paris.

const pad = (n) => String(n).padStart(2, '0')
const jourUtc = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
const moisUtc = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`

function seauxDeJours(maintenant, nombre) {
  return Array.from({ length: nombre }, (_, i) => {
    const d = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate() - (nombre - 1 - i)))
    return { key: jourUtc(d), label: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }) }
  })
}

function seauxDeMois(maintenant) {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - (11 - i), 1))
    return { key: moisUtc(d), label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' }) }
  })
}

/**
 * @param {{ jour: string, actions: number, inscriptions: number, recettes: number }[]} jours
 *   une ligne par jour (« AAAA-MM-JJ »), telle que la base la rend
 * @param {'7j'|'30j'|'12m'|'all'} periode
 * @param {Date} [maintenant]
 * @returns {{ label: string, actions: number, signups: number, recipes: number }[]}
 */
export function agregerParPeriode(jours, periode, maintenant = new Date()) {
  const cleDe = periode === '12m' ? (j) => j.slice(0, 7) : periode === 'all' ? (j) => j.slice(0, 4) : (j) => j.slice(0, 10)

  let seaux
  if (periode === '7j') seaux = seauxDeJours(maintenant, 7)
  else if (periode === '30j') seaux = seauxDeJours(maintenant, 30)
  else if (periode === '12m') seaux = seauxDeMois(maintenant)
  else {
    if (!jours.length) return []
    const premiere = Math.min(...jours.map((j) => Number(j.jour.slice(0, 4))))
    const derniere = maintenant.getUTCFullYear()
    seaux = Array.from({ length: derniere - premiere + 1 }, (_, i) => ({ key: String(premiere + i), label: String(premiere + i) }))
  }

  const parCle = new Map(seaux.map((s) => [s.key, { label: s.label, actions: 0, signups: 0, recipes: 0 }]))
  for (const j of jours) {
    const point = parCle.get(cleDe(String(j.jour)))
    if (!point) continue
    point.actions += Number(j.actions) || 0
    point.signups += Number(j.inscriptions) || 0
    point.recipes += Number(j.recettes) || 0
  }
  return seaux.map((s) => parCle.get(s.key))
}
