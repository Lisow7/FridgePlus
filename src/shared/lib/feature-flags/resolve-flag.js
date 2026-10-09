// Helper pur de résolution d'un feature flag.
// `flagsMap` : Map<string, boolean> chargée depuis la table feature_flags.
// Si la clé n'existe pas (flag pas encore seedé), renvoie `fallback` — ce qui
// permet de gater une feature dont le flag n'est pas encore en base.
export function resolveFlag(flagsMap, key, fallback = false) {
  if (!flagsMap || typeof flagsMap.has !== 'function') return fallback
  return flagsMap.has(key) ? flagsMap.get(key) : fallback
}
