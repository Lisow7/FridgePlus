import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { COLONNES_DU_PROFIL } from '@shared/lib/auth/fetch-profile'

// Audit du 2026-10-04, CPT-18 : le profil chargé à chaque connexion emportait
// des colonnes que l'application ne lit jamais (`stripe_customer_id`,
// `inactive_warned_at`, `push_last_variant_index`) — des données de plus en
// mémoire du navigateur, sans usage. Chaque colonne chargée doit être nommée
// ailleurs dans `src` ; l'export RGPD ne compte pas : il relit la base avec sa
// propre liste, il ne se sert pas du profil chargé.
const HORS_DU_COMPTE = /fetch-profile\.js$|data-export\.js$|database\.ts$|\.test\./

function fichiersDeSrc(dossier, liste = []) {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) { if (nom !== 'test') fichiersDeSrc(chemin, liste) }
    else if (/\.(js|jsx|ts|tsx)$/.test(nom) && !HORS_DU_COMPTE.test(chemin)) liste.push(chemin)
  }
  return liste
}

describe('le profil chargé ne porte que des colonnes qui servent', () => {
  it('chaque colonne lue par fetchProfile est nommée ailleurs dans l’application', () => {
    const textes = fichiersDeSrc('src').map((f) => readFileSync(f, 'utf8'))
    const sansUsage = COLONNES_DU_PROFIL.filter((c) => !textes.some((t) => new RegExp(`\\b${c}\\b`).test(t)))
    expect(sansUsage).toEqual([])
  })
})
