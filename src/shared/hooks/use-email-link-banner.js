import { useAuth } from '@shared/contexts/auth-provider'
import { useRestoreAccount } from '@shared/hooks/use-restore-account'
import { SUPPORT_EMAIL } from '@shared/lib/contact'

// Le bandeau du haut de l'app qui dit ce qu'est devenu un lien reçu par
// e-mail. Deux sources, un seul bandeau :
//   - la restauration de compte (`?restore-account=…`), comme avant ;
//   - un lien de connexion qui n'aboutit pas (confirmation d'inscription, mot
//     de passe oublié, retour de Google) : expiré, déjà utilisé, ou ouvert dans
//     un autre navigateur que celui de la demande. Jusqu'au 2026-10-04 ce cas
//     ne produisait rien du tout (audit CPT-03) ; c'est `AuthProvider` qui le
//     détecte (`authLinkProblem`).
//
// Chaque message dit quoi faire ensuite. Celui d'un lien de connexion ne se
// ferme pas tout seul : il est plus long, et la personne vient d'arriver.
export const EMAIL_LINK_MESSAGES = {
  fr: {
    expired: 'Ce lien a expiré ou a déjà servi. Demande-en un nouveau depuis « Se connecter » : il est valable une heure, une seule fois.',
    'no-session': 'Ce lien n\'a pas pu te connecter dans ce navigateur. Connecte-toi avec ton mot de passe ; s\'il est oublié, refais la demande depuis cet appareil.',
    failed: `La connexion n'a pas abouti. Réessaie ; si ça recommence, écris à ${SUPPORT_EMAIL}.`,
    banned: `Ce compte est suspendu. Pour contester, ou demander l'effacement de tes données, écris à ${SUPPORT_EMAIL}.`,
  },
  en: {
    expired: 'This link has expired or was already used. Request a new one from "Sign in": it is valid for one hour, once.',
    'no-session': 'This link could not sign you in on this browser. Sign in with your password; if you forgot it, request the link again from this device.',
    failed: `Sign-in did not go through. Try again; if it keeps happening, write to ${SUPPORT_EMAIL}.`,
    banned: `This account is suspended. To appeal, or to request the deletion of your data, write to ${SUPPORT_EMAIL}.`,
  },
}

// Usage (App.jsx) :
//   const [banner, dismissBanner] = useEmailLinkBanner({ lang, restoreAccount })
export function useEmailLinkBanner({ lang = 'fr', restoreAccount }) {
  const [restoreBanner, dismissRestoreBanner] = useRestoreAccount({ lang, restoreAccount })
  const { authLinkProblem, clearAuthLinkProblem } = useAuth()

  if (restoreBanner) return [restoreBanner, dismissRestoreBanner]
  if (authLinkProblem) {
    const messages = EMAIL_LINK_MESSAGES[lang] ?? EMAIL_LINK_MESSAGES.fr
    return [{ ok: false, msg: messages[authLinkProblem] }, clearAuthLinkProblem]
  }
  return [null, dismissRestoreBanner]
}
