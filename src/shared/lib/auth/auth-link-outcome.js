// Ce qu'un lien reçu par e-mail (confirmation d'inscription, mot de passe
// oublié) ou un retour de Google a laissé dans l'adresse, et ce qu'il faut en
// dire à la personne.
//
// Le service d'authentification ramène sur le site avec :
//   - `?code=…` à échanger contre une session — l'échange n'est possible que
//     dans le navigateur qui a fait la demande (il garde la clé du protocole
//     PKCE), pendant quelques minutes, une seule fois ;
//   - ou `error`, `error_code`, `error_description` (dans la requête et dans
//     le fragment) quand le lien est expiré, déjà utilisé, ou que le service a
//     échoué.
//
// La bibliothèque traite les deux sans prévenir l'application quand ça échoue
// (`_initialize` rend l'erreur, aucun événement ne part) et, sans clé, elle
// ignore le code. Jusqu'au 2026-10-04 la personne arrivait donc sur l'accueil,
// déconnectée, sans un mot (audit CPT-03).

const PARAMETRES_DU_LIEN = ['code', 'sb_flow_id', 'error', 'error_code', 'error_description']

const RIEN = { hasCode: false, hasError: false, errorCode: null }

// Même lecture que la bibliothèque : le fragment, puis la requête (qui gagne).
function parametres(url) {
  const lus = {}
  if (url.hash.length > 1) {
    try { new URLSearchParams(url.hash.slice(1)).forEach((valeur, cle) => { lus[cle] = valeur }) } catch { /* fragment ordinaire */ }
  }
  url.searchParams.forEach((valeur, cle) => { lus[cle] = valeur })
  return lus
}

export function readAuthLinkParams(href) {
  let url
  try { url = new URL(href) } catch { return RIEN }
  const lus = parametres(url)
  return {
    hasCode: !!lus.code,
    hasError: !!(lus.error || lus.error_code || lus.error_description),
    errorCode: lus.error_code ?? null,
  }
}

// `atArrival` : ce que l'adresse disait au chargement ; `hasSession` : y a-t-il
// une session une fois que la bibliothèque a fini de traiter l'adresse.
//   'expired'    — le service dit que le lien est expiré ou a déjà servi ;
//   'banned'     — le compte est banni (le service refuse de le connecter) ;
//   'failed'     — tout autre échec annoncé (Google refusé, erreur du serveur) ;
//   'no-session' — un code était là mais n'a ouvert aucune session ;
//   null         — rien à dire.
export function authLinkProblem(atArrival, hasSession) {
  if (atArrival.hasError) {
    if (atArrival.errorCode === 'otp_expired') return 'expired'
    if (atArrival.errorCode === 'user_banned') return 'banned'
    return 'failed'
  }
  if (atArrival.hasCode && !hasSession) return 'no-session'
  return null
}

// L'adresse sans ce que le lien y avait mis : un rechargement ne doit pas
// rejouer le message.
export function cleanAuthLinkUrl(href) {
  let url
  try { url = new URL(href) } catch { return href }
  for (const nom of PARAMETRES_DU_LIEN) url.searchParams.delete(nom)
  if (url.hash.length > 1) {
    const fragment = new URLSearchParams(url.hash.slice(1))
    if (PARAMETRES_DU_LIEN.some((nom) => fragment.has(nom))) {
      for (const nom of PARAMETRES_DU_LIEN) fragment.delete(nom)
      url.hash = fragment.toString()
    }
  }
  return url.toString()
}
