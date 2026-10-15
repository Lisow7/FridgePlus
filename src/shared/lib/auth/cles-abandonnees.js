// Les clés que l'application n'écrit plus, effacées au démarrage chez tout le
// monde : un compte resté ouvert ne repasse jamais par l'écran qui les écrivait.
//   · `fridge-remember-email` : l'adresse e-mail que gardait « Se souvenir de
//     moi », EN CLAIR sur l'appareil — la case est retirée (décision du
//     2026-10-08) ; le navigateur retient déjà l'adresse.
export const CLES_ABANDONNEES = ['fridge-remember-email']

export function effacerLesClesAbandonnees() {
  for (const cle of CLES_ABANDONNEES) {
    try { localStorage.removeItem(cle) } catch { /* stockage refusé (navigation privée) */ }
  }
}
