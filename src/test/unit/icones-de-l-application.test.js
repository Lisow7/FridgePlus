import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'

// Audit du 2026-10-04, SEO-12 — les icônes de l'application installée, lues
// telles qu'elles sont VERSIONNÉES (générées par `npm run pwa-icons`) :
// - `apple-touch-icon` pointait sur `icon-192.png`, dont 4,1 % des pixels sont
//   transparents (coins arrondis) : iOS les peint en noir ;
// - l'icône « maskable » n'était pas centrée (centre à 292 px pour 256) et
//   sortait du cercle de sécurité : un lanceur à icônes rondes rognait le « + » ;
// - `/favicon.ico` et `/apple-touch-icon.png` répondaient 404, alors que des
//   clients les demandent sans lire les balises.

const PUBLIC = resolve(process.cwd(), 'public')
const FOND = [0xFD, 0xFA, 0xF6] // #FDFAF6, le fond des icônes

async function pixels(fichier) {
  const { data, info } = await sharp(resolve(PUBLIC, fichier)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, largeur: info.width, hauteur: info.height }
}

describe('icône tactile d’iOS', () => {
  it('index.html la déclare à l’adresse que les clients demandent d’eux-mêmes', () => {
    const index = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    expect(index).toMatch(/<link rel="apple-touch-icon"[^>]*href="\/apple-touch-icon\.png"/)
  })

  it('180 × 180, entièrement opaque (iOS peint la transparence en noir)', async () => {
    const { data, largeur, hauteur } = await pixels('apple-touch-icon.png')
    expect([largeur, hauteur]).toEqual([180, 180])
    let transparents = 0
    for (let i = 3; i < data.length; i += 4) if (data[i] < 255) transparents++
    expect(transparents).toBe(0)
  })
})

describe('icône « maskable »', () => {
  it('le dessin est centré et tient dans le cercle de sécurité (80 % du diamètre)', async () => {
    const { data, largeur, hauteur } = await pixels('icon-maskable-512.png')
    let minX = largeur, maxX = 0, minY = hauteur, maxY = 0, horsDuCercle = 0
    const rayon = 0.4 * largeur
    for (let y = 0; y < hauteur; y++) {
      for (let x = 0; x < largeur; x++) {
        const i = (y * largeur + x) * 4
        const ecart = Math.max(...FOND.map((c, k) => Math.abs(data[i + k] - c)))
        if (ecart <= 24) continue
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
        if (Math.hypot(x + 0.5 - largeur / 2, y + 0.5 - hauteur / 2) > rayon) horsDuCercle++
      }
    }
    expect(maxX).toBeGreaterThan(minX) // le dessin existe (sinon ce test ne prouverait rien)
    expect(Math.abs((minX + maxX) / 2 - largeur / 2)).toBeLessThanOrEqual(4)
    expect(Math.abs((minY + maxY) / 2 - hauteur / 2)).toBeLessThanOrEqual(4)
    expect(horsDuCercle).toBe(0)
  })

  it('le fond est plein jusqu’aux bords (un masque peut couper n’importe où)', async () => {
    const { data } = await pixels('icon-maskable-512.png')
    let transparents = 0
    for (let i = 3; i < data.length; i += 4) if (data[i] < 255) transparents++
    expect(transparents).toBe(0)
  })
})

describe('favicon.ico', () => {
  it('existe, et contient les tailles 16, 32 et 48', () => {
    const fichier = resolve(PUBLIC, 'favicon.ico')
    expect(existsSync(fichier)).toBe(true)
    const ico = readFileSync(fichier)
    // En-tête ICO : réservé 0, type 1 (icône), nombre d'images.
    expect(ico.readUInt16LE(0)).toBe(0)
    expect(ico.readUInt16LE(2)).toBe(1)
    const nombre = ico.readUInt16LE(4)
    const tailles = Array.from({ length: nombre }, (_, n) => ico[6 + n * 16] || 256)
    expect(tailles.sort((a, b) => a - b)).toEqual([16, 32, 48])
  })
})
