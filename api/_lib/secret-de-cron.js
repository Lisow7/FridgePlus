// Le secret d'un cron Vercel : exigé, et comparé en temps constant (audit du
// 2026-10-04, SEC-05 = BDD-17). Avant : sans CRON_SECRET dans l'environnement,
// la valeur attendue devenait « Bearer undefined » et passait ; et `!==`
// s'arrête au premier octet qui diffère.
import { timingSafeEqual } from 'node:crypto'

export function secretAccepte(authHeader, secret) {
  if (!secret) return false
  const propose = Buffer.from(String(authHeader ?? ''))
  const attendu = Buffer.from(`Bearer ${secret}`)
  return propose.length === attendu.length && timingSafeEqual(propose, attendu)
}
