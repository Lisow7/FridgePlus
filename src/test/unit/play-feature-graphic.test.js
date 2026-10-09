// L'image de présentation de la fiche Google Play respecte le format exigé.
//
// ── Pourquoi ce garde-fou ────────────────────────────────────────────────
// Play accepte « JPEG or 24-bit PNG (no alpha) », en 1024×500 exactement
// (Play Console Help, vérifié le 2026-09-12). Un PNG avec canal alpha passe
// le build, passe les tests, se commite — et n'échoue qu'à l'upload dans la
// Console, des jours plus tard, sur un message qui ne dit pas pourquoi.
//
// C'est un piège de fabrication, pas un piège d'écriture : `sharp` applique ses
// opérations dans SON ordre interne, où l'aplatissement précède la composition.
// Un `.flatten()` enchaîné après un `.composite()` ne retire donc PAS l'alpha
// apporté par la capture (mesuré : 4 canaux en sortie). Le générateur compose
// puis aplatit en deux passes ; ce test vérifie le résultat, pas la méthode.
import { describe, it, expect } from 'vitest'
import { statSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const FICHIER = path.resolve(__dirname, '../../../store-assets/play/feature-graphic.png')

describe('image de présentation Google Play', () => {
  it('fait exactement 1024×500', async () => {
    const { width, height } = await sharp(FICHIER).metadata()
    expect({ width, height }).toEqual({ width: 1024, height: 500 })
  })

  it('n’a PAS de canal alpha — c’est ce que Play refuse, et ça ne se voit pas à l’œil', async () => {
    const { hasAlpha, channels } = await sharp(FICHIER).metadata()
    expect(hasAlpha).toBe(false)
    expect(channels).toBe(3)
  })

  it('reste sous le poids raisonnable d’un asset de fiche (< 1 Mo)', () => {
    expect(statSync(FICHIER).size).toBeLessThan(1024 * 1024)
  })
})
