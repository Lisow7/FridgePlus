// Génère les icônes PNG nécessaires au manifest PWA depuis le favicon SVG.
//
// Sortie :
//   public/icon-192.png            — icône classique 192×192 (any purpose)
//   public/icon-512.png            — icône classique 512×512 (any purpose)
//   public/icon-maskable-512.png   — icône maskable 512×512 (zone de sécurité
//                                    centrale ~80% pour Android adaptative)
//
// Usage : npm run pwa-icons

import sharp from 'sharp'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svgFavicon = readFileSync(join(root, 'public/favicon.svg'))

// 1. Icônes classiques — on agrandit le favicon SVG
await sharp(svgFavicon)
  .resize(192, 192)
  .png({ quality: 90, compressionLevel: 8 })
  .toFile(join(root, 'public/icon-192.png'))
console.log('✓ public/icon-192.png généré (192×192)')

await sharp(svgFavicon)
  .resize(512, 512)
  .png({ quality: 90, compressionLevel: 8 })
  .toFile(join(root, 'public/icon-512.png'))
console.log('✓ public/icon-512.png généré (512×512)')

// 2. Icône maskable — zone de sécurité ~80% (Android peut rogner les bords).
// On reconstruit un SVG plus grand avec le contenu dans un cercle central
// 80% pour garantir la visibilité du « F+ » même après rognage.
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="handleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F7A85E"/>
      <stop offset="100%" stop-color="#D46A10"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="#FDFAF6"/>
  <text x="105" y="345" font-family="Georgia, serif" font-size="280" font-weight="700" fill="#2C1A0E">F</text>
  <text x="320" y="325" font-family="Georgia, serif" font-size="240" font-weight="700" fill="url(#handleGrad)">+</text>
</svg>`

await sharp(Buffer.from(maskableSvg))
  .resize(512, 512)
  .png({ quality: 90, compressionLevel: 8 })
  .toFile(join(root, 'public/icon-maskable-512.png'))
console.log('✓ public/icon-maskable-512.png généré (512×512, maskable safe-zone)')
