// Génère store-assets/play/feature-graphic.png — l'image de présentation
// exigée par la fiche Google Play : fond SVG (textes, pastille) + CAPTURE
// RÉELLE de l'app composée par-dessus, coins arrondis. Même recette que
// `scripts/generate-og.mjs`, avec deux contraintes propres au Play Store :
//
//   • 1024×500 EXACTEMENT — toute autre taille est refusée à l'upload ;
//   • PNG 24 bits **SANS canal alpha** (« JPEG or 24-bit PNG (no alpha) »,
//     Play Console Help, vérifié le 2026-09-12). D'où le `.flatten()` : la
//     capture porte un canal alpha, et sans aplatissement il contaminerait
//     l'image finale. Un PNG transparent passe le build et échoue à l'upload,
//     des jours plus tard — c'est exactement ce que le test associé verrouille.
//
// La capture source est `public/og-app-capture.png` (800×1240, frigo fermé avec
// le bouton orange) : la même que l'image OG, pour que la fiche et les aperçus
// de lien montrent la même app. La re-capturer quand l'UI change de visage.
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'store-assets/play/feature-graphic.svg'))

// DOIT rester synchro avec le rectangle d'ombre dessiné dans le SVG.
const CARD = { left: 700, top: 64, width: 232, height: 372, radius: 20 }

const capture = await sharp(join(root, 'public/og-app-capture.png'))
  .resize(CARD.width, CARD.height)
  .composite([{
    input: Buffer.from(
      `<svg width="${CARD.width}" height="${CARD.height}">
         <rect width="${CARD.width}" height="${CARD.height}" rx="${CARD.radius}" fill="#fff"/>
       </svg>`,
    ),
    blend: 'dest-in',
  }])
  .png()
  .toBuffer()

// ⚠️ Deux passes, et ce n'est pas du zèle : sharp applique ses opérations dans
// SON ordre interne, où l'aplatissement précède la composition. Enchaîné à la
// suite du `composite`, le `.flatten()` ne retire donc pas l'alpha apporté par
// la capture — le fichier sort en 4 canaux et Play le refuse. On compose
// d'abord, on aplatit ensuite, sur l'image déjà composée.
const composee = await sharp(svg)
  .resize(1024, 500)
  .composite([{ input: capture, left: CARD.left, top: CARD.top }])
  .png()
  .toBuffer()

await sharp(composee)
  // `flatten` pose l'image sur le crème du fond et retire l'alpha ;
  // `palette: false` garde 24 bits (une palette indexée n'en est pas un).
  .flatten({ background: '#FDFAF6' })
  .png({ compressionLevel: 9, palette: false })
  .toFile(join(root, 'store-assets/play/feature-graphic.png'))

const { width, height, channels, hasAlpha } = await sharp(join(root, 'store-assets/play/feature-graphic.png')).metadata()
console.log(`✓ store-assets/play/feature-graphic.png — ${width}×${height}, ${channels} canaux, alpha : ${hasAlpha}`)
if (width !== 1024 || height !== 500 || hasAlpha) {
  console.error('❌  Format refusé par Play : il faut 1024×500 sans canal alpha.')
  process.exit(1)
}
