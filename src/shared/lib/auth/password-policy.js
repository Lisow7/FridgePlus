// v3.416 — Source unique de vérité pour la policy mot de passe Fridge+.
// DOIT correspondre à la policy Supabase Auth (Settings → Auth → Password) :
//   - 8 caractères minimum
//   - 1 minuscule, 1 MAJUSCULE, 1 chiffre, 1 caractère spécial
//
// Bug v3.415 : validation client ne demandait que 8+ MAJ + chiffre,
// donc un mot de passe « TestPass123 » passait côté client mais Supabase
// renvoyait 422 weak_password (caractère spécial manquant). Friction
// brutale pour les nouveaux comptes — fix : aligner client sur serveur.

// Caractères spéciaux acceptés par Supabase (source : message d'erreur
// renvoyé par /auth/v1/signup : !@#$%^&*()_+-=[]{};':"|<>?,./`~).
export const PWD_SPECIAL_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|<>?,./`~]/

export const PWD_MIN_LENGTH = 8
export const PWD_SCORE_MAX = 5  // 5 critères : longueur + min + MAJ + chiffre + spécial

/**
 * Valide un mot de passe contre la policy serveur.
 * @param {string} pwd
 * @returns {{ score: number, errors: string[] }}
 *   score 0-5 (5 = tous les critères validés). errors liste les manquants.
 */
export function validatePassword(pwd) {
  const errors = []
  if (!pwd || pwd.length < PWD_MIN_LENGTH) errors.push('min8')
  if (!/[a-z]/.test(pwd ?? ''))            errors.push('lowercase')
  if (!/[A-Z]/.test(pwd ?? ''))            errors.push('uppercase')
  if (!/[0-9]/.test(pwd ?? ''))            errors.push('digit')
  if (!PWD_SPECIAL_REGEX.test(pwd ?? ''))  errors.push('special')
  return { score: PWD_SCORE_MAX - errors.length, errors }
}

// Couleurs strength meter : 5 segments, du rouge au vert.
export const PWD_COLORS = ['#dc2626', '#ef4444', '#f97316', '#facc15', '#22c55e']

export const PWD_STRENGTH_LABELS = {
  fr: ['Très faible', 'Faible', 'Moyen', 'Bon', 'Fort'],
  en: ['Very weak',   'Weak',   'Medium', 'Good', 'Strong'],
}

// Hint user-facing standardisé (utilisé partout où on demande un nouveau MdP).
export const PWD_HINT = {
  fr: '8 caractères min., 1 minuscule, 1 MAJUSCULE, 1 chiffre, 1 caractère spécial (!@#$…).',
  en: '8 chars min., 1 lowercase, 1 UPPERCASE, 1 digit, 1 special (!@#$…).',
}

export const PWD_ERROR_WEAK = {
  fr: 'Mot de passe trop faible. Il faut au moins 8 caractères, 1 minuscule, 1 MAJUSCULE, 1 chiffre et 1 caractère spécial.',
  en: 'Password too weak. At least 8 chars, 1 lowercase, 1 UPPERCASE, 1 digit and 1 special character required.',
}
