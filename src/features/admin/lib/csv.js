// Export CSV sûr (audit du 2026-10-04, SEC-08).
//
// Un champ écrit tel quel casse la colonne à la première virgule, et une
// cellule qui commence par =, +, - ou @ devient une FORMULE à l'ouverture dans
// un tableur — exécutée sur le poste de l'admin, avec ce qu'un membre a pu
// écrire dans un nom (« injection CSV »). Chaque champ est entre guillemets,
// les guillemets doublés, et une formule neutralisée par une apostrophe.

const AMORCE_DE_FORMULE = /^[=+\-@\t\r]/

export function champCsv(valeur) {
  let texte = valeur == null ? '' : String(valeur)
  if (AMORCE_DE_FORMULE.test(texte)) texte = `'${texte}`
  return `"${texte.replace(/"/g, '""')}"`
}

export function versCsv(lignes) {
  return lignes.map((ligne) => ligne.map(champCsv).join(',')).join('\r\n')
}
