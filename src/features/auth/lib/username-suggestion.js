// Suggère un pseudo pour un nouvel utilisateur OAuth.
// Priorité : prénom Google (metadata) nettoyé → fallback neutre "Chef-xxxx".
// On n'utilise JAMAIS le préfixe e-mail (respect vie privée — cf. spec §2).
export function suggestUsername(metadata = {}, seed = '') {
  const raw =
    metadata.given_name ||
    (typeof metadata.name === 'string' ? metadata.name.split(' ')[0] : '') ||
    metadata.full_name ||
    ''
  const cleaned = String(raw)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 20)
  if (cleaned.length >= 3) return cleaned
  const digits = String(seed).replace(/\D/g, '')
  const suffix = (digits.slice(-4) || '0000').padStart(4, '0')
  return `Chef-${suffix}`
}
