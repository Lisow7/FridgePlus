// Un compte relié à Google ? Ses fournisseurs de connexion (`app_metadata`)
// le disent. L'app ne savait pas le reconnaître (audit du 2026-10-04) : son
// adresse est celle de Google — elle ne se change pas ici —, et il n'a pas de
// mot de passe à confirmer.
export function estUnCompteGoogle(user) {
  const meta = user?.app_metadata
  if (!meta) return false
  const fournisseurs = meta.providers ?? (meta.provider ? [meta.provider] : [])
  return fournisseurs.includes('google')
}
