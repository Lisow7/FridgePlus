// Compression côté client d'une image avant envoi à une Edge Function :
// réduit la bande passante et la taille du payload. Le redimensionnement
// ne dépasse jamais les dimensions d'origine (pas d'agrandissement d'une
// petite image). Partagé entre le scan de ticket de caisse et le partage
// de photo dans les avis recettes.

const DEFAULT_MAX_DIMENSION = 1600
const DEFAULT_QUALITY = 0.8

export function computeScaledDimensions(width, height, maxDimension) {
  const scale = Math.min(1, maxDimension / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

export async function compressImageToBase64(file, { maxDimension = DEFAULT_MAX_DIMENSION, quality = DEFAULT_QUALITY } = {}) {
  const bitmap = await createImageBitmap(file)
  const { width, height } = computeScaledDimensions(bitmap.width, bitmap.height, maxDimension)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return dataUrl.split(',')[1]
}
