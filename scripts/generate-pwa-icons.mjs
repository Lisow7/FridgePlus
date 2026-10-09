// Génère les icônes de l'application depuis le favicon SVG.
//
// Sortie :
//   public/icon-192.png            — icône classique 192×192 (any purpose)
//   public/icon-512.png            — icône classique 512×512 (any purpose)
//   public/icon-maskable-512.png   — icône maskable 512×512 : fond plein, dessin
//                                    centré dans le cercle de sécurité
//   public/apple-touch-icon.png    — icône tactile d'iOS 180×180, OPAQUE
//   public/favicon.ico             — 16, 32 et 48 px, pour les clients qui ne
//                                    lisent pas le favicon SVG
//
// Audit du 2026-10-04, SEO-12 : l'icône maskable n'était pas centrée (centre à
// 292 px pour 256) et son « + » sortait du cercle de sécurité — un lanceur à
// icônes rondes le rognait ; iOS recevait `icon-192.png`, dont les coins
// transparents deviennent noirs ; `/favicon.ico` et `/apple-touch-icon.png`
// répondaient 404. Le dessin est désormais CENTRÉ PAR LA MESURE (`trim` sur ses
// pixels réels), pas par des coordonnées choisies à l'œil.
// Le garde-fou `icones-de-l-application` lit les fichiers produits.
//
// Usage : npm run pwa-icons

import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svgFavicon = readFileSync(join(root, 'public/favicon.svg'))
const FOND = '#FDFAF6'

// 1. Icônes classiques — on agrandit le favicon SVG (coins arrondis transparents :
// permis pour une icône « any »).
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

// 2. Le DESSIN seul (« F+ » du favicon, sans son fond) : on le MESURE en le
// rendant grand puis en le rognant à ses pixels réels, et cette boîte sert à
// le placer — en vectoriel, pour rester net et léger (un dessin redimensionné
// en image pesait quatre fois plus dans le précache).
const VUE = 48 // le viewBox du favicon
const RENDU = 1024
const interieur = svgFavicon.toString()
  .replace(/^[\s\S]*?<svg\b[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .replace(/<rect\b[^>]*\/>/, '')
const mesure = await sharp(Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VUE} ${VUE}" width="${RENDU}" height="${RENDU}">${interieur}</svg>`,
)).trim().toBuffer({ resolveWithObject: true })
const k = RENDU / VUE
const boite = {
  x: -mesure.info.trimOffsetLeft / k,
  y: -mesure.info.trimOffsetTop / k,
  largeur: mesure.info.width / k,
  hauteur: mesure.info.height / k,
}

/** Le dessin centré sur un fond plein et opaque ; `part` = côté du dessin / taille. */
async function iconePleine(taille, part, sortie) {
  const s = Math.min((taille * part) / boite.largeur, (taille * part) / boite.hauteur)
  const tx = (taille - boite.largeur * s) / 2 - boite.x * s
  const ty = (taille - boite.hauteur * s) / 2 - boite.y * s
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${taille} ${taille}" width="${taille}" height="${taille}">`
    + `<rect width="${taille}" height="${taille}" fill="${FOND}"/>`
    + `<g transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${s.toFixed(5)})">${interieur}</g></svg>`
  await sharp(Buffer.from(svg))
    .flatten({ background: FOND })
    // Palette de 256 couleurs : deux glyphes et un dégradé n'en demandent pas
    // plus, et le fichier pèse moitié moins (précache plafonné).
    .png({ palette: true, quality: 100, compressionLevel: 9 })
    .toFile(join(root, sortie))
}

// 3. Maskable : 58 % de la largeur. Le cercle de sécurité du W3C fait 80 % du
// diamètre ; à 58 %, la demi-diagonale du dessin (≈ 171 px sur 512) tient même
// dans le cercle visible des icônes adaptatives d'Android (66 %).
await iconePleine(512, 0.58, 'public/icon-maskable-512.png')
console.log('✓ public/icon-maskable-512.png généré (512×512, centré, dans le cercle de sécurité)')

// 4. Icône tactile d'iOS : opaque (iOS arrondit lui-même les coins).
await iconePleine(180, 0.66, 'public/apple-touch-icon.png')
console.log('✓ public/apple-touch-icon.png généré (180×180, opaque)')

// 5. favicon.ico : des PNG dans un conteneur ICO (lu depuis Windows Vista et
// par tous les navigateurs actuels).
const tailles = [16, 32, 48]
const pngs = await Promise.all(tailles.map(async (taille) => ({
  taille,
  donnees: await sharp(svgFavicon).resize(taille, taille).png({ compressionLevel: 9 }).toBuffer(),
})))
const entete = Buffer.alloc(6)
entete.writeUInt16LE(0, 0) // réservé
entete.writeUInt16LE(1, 2) // type : icône
entete.writeUInt16LE(pngs.length, 4)
const repertoire = Buffer.alloc(16 * pngs.length)
let decalage = entete.length + repertoire.length
pngs.forEach(({ taille, donnees }, n) => {
  const o = n * 16
  repertoire.writeUInt8(taille, o) // largeur
  repertoire.writeUInt8(taille, o + 1) // hauteur
  repertoire.writeUInt8(0, o + 2) // palette
  repertoire.writeUInt8(0, o + 3) // réservé
  repertoire.writeUInt16LE(1, o + 4) // plans
  repertoire.writeUInt16LE(32, o + 6) // bits par pixel
  repertoire.writeUInt32LE(donnees.length, o + 8)
  repertoire.writeUInt32LE(decalage, o + 12)
  decalage += donnees.length
})
writeFileSync(join(root, 'public/favicon.ico'), Buffer.concat([entete, repertoire, ...pngs.map((p) => p.donnees)]))
console.log('✓ public/favicon.ico généré (16, 32, 48)')
