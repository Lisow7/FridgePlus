import { useState, useEffect } from 'react'
import QRCode from 'qrcode'

// QR code client-side (Canvas) — aucune donnée ne quitte le navigateur.
// Retourne un dataURL (string) ou null tant que pas généré / si url vide.
export function useQrCode(url, { dark = '#1A0E06', light = '#FFFFFF', width = 160 } = {}) {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    if (!url) return
    let alive = true
    QRCode.toDataURL(url, { width, margin: 2, color: { dark, light } })
      .then(d => { if (alive) setSrc(d) })
      .catch(() => { if (alive) setSrc(null) })
    return () => { alive = false }
  }, [url, dark, light, width])
  // Sortie gatée sur `url` : retourne null si pas d'url (évite un setState
  // synchrone dans l'effet + un QR périmé qui persisterait après reset).
  return url ? src : null
}
