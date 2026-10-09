import { supabase } from '@shared/lib/supabase/client'

// La règle du pseudo, pour les trois écrans où l'on en saisit un : inscription,
// « Choisis ton pseudo » (première connexion Google), page Identité.
//
// Jusqu'au 2026-10-04 chacun portait sa copie — celle de l'écran Google ne
// contrôlait que la longueur — et demandait « est-il libre ? » à la table
// `profiles`, qu'un visiteur ne peut pas lire : la réponse était toujours
// « libre », et le refus arrivait ensuite sous forme de message SQL.
//
// 🔴 Cette règle est aussi celle de la base (`username_available`,
// `handle_new_user`, `guard_profiles_username`). Un test compare les deux :
// on ne change pas l'une sans l'autre.
export const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/

export function isValidUsername(value) {
  return typeof value === 'string' && USERNAME_REGEX.test(value)
}

// Les mêmes mots sur les trois écrans : la règle dite sous le champ (`hint`),
// le refus de forme (`invalid`), le pseudo pris ou réservé (`taken`).
export const USERNAME_MESSAGES = {
  fr: {
    hint: '3 à 20 caractères : lettres sans accent, chiffres, _ et -.',
    invalid: 'Ce pseudo ne respecte pas la règle : 3 à 20 caractères, lettres sans accent, chiffres, _ et -.',
    taken: 'Ce pseudo n\'est pas disponible. Essaies-en un autre.',
  },
  en: {
    hint: '3 to 20 characters: unaccented letters, digits, _ and -.',
    invalid: 'This username breaks the rule: 3 to 20 characters, unaccented letters, digits, _ and -.',
    taken: 'This username is not available. Try another one.',
  },
}

// Demande à la base si ce pseudo peut être pris par la personne qui le demande.
// Rend `true`, `false` (déjà porté par un autre compte, ou réservé), ou `null`
// quand on n'a pas pu le savoir (réseau) : l'appelant laisse alors passer, et
// c'est l'écriture qui tranche (index d'unicité).
export async function isUsernameAvailable(username) {
  try {
    const { data, error } = await supabase.rpc('username_available', { p_username: username })
    if (error) return null
    return data === true
  } catch {
    return null
  }
}

// Lit l'erreur rendue par l'écriture d'un pseudo, pour ne jamais afficher le
// message SQL : 'taken' (index d'unicité, pseudo réservé), 'invalid' (règle de
// forme), ou `null` si l'erreur ne vient pas du pseudo.
export function usernameWriteProblem(error) {
  if (!error) return null
  if (error.code === '23505') return 'taken'
  const message = error.message ?? ''
  if (message.includes('reserved_username')) return 'taken'
  if (message.includes('invalid_username') || message.includes('username_length')) return 'invalid'
  return null
}
