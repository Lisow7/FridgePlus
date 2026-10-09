// Génère public/og-image.png (1200×630) : fond SVG (textes, pastilles, ombre)
// + CAPTURE RÉELLE de l'app composée par-dessus avec coins arrondis.
// La capture vit dans public/og-app-capture.png (1060×900, vue frigo ouvert
// + garde-manger) — la re-capturer quand l'UI change de visage.
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg  = readFileSync(join(root, 'public/og-image.svg'))

// Position/taille de la carte capture — DOIT rester synchro avec l'emplacement
// dessiné (ombre) dans og-image.svg.
const CARD = { left: 650, top: 100, width: 260, height: 403, radius: 22 }

const capture = await sharp(join(root, 'public/og-app-capture.png'))
  .resize(CARD.width, CARD.height)
  .composite([{
    // Masque d'arrondi : ne garder que l'intérieur du rectangle arrondi.
    input: Buffer.from(
      `<svg width="${CARD.width}" height="${CARD.height}">
         <rect width="${CARD.width}" height="${CARD.height}" rx="${CARD.radius}" fill="#fff"/>
       </svg>`
    ),
    blend: 'dest-in',
  }])
  .png()
  .toBuffer()

await sharp(svg)
  .resize(1200, 630)
  .composite([{ input: capture, left: CARD.left, top: CARD.top }])
  .png({ quality: 90, compressionLevel: 8 })
  .toFile(join(root, 'public/og-image.png'))

console.log('✓ public/og-image.png généré (1200×630, capture réelle intégrée)')
