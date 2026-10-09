// Comparaison de secrets en temps constant (audit du 2026-10-04, BDD-18 (3)).
//
// `===` s'arrête au premier octet qui diffère : le temps de réponse dit
// jusqu'où le secret proposé était juste. Ici, tous les octets sont lus et
// combinés par XOR, quel que soit l'écart. Deux longueurs différentes rendent
// faux sans lecture : la longueur d'un secret n'est pas ce qu'on protège.
export function memeSecret(propose: string, attendu: string): boolean {
  const a = new TextEncoder().encode(propose)
  const b = new TextEncoder().encode(attendu)
  if (a.length === 0 || a.length !== b.length) return false
  let ecart = 0
  for (let i = 0; i < a.length; i++) ecart |= a[i] ^ b[i]
  return ecart === 0
}
