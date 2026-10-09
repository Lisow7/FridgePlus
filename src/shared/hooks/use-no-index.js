import { useEffect } from 'react'

// « Ne pas référencer » cette page, tant qu'elle est montée (audit du
// 2026-10-04, SEO-03).
//
// Toute adresse inconnue répond 200 avec la coquille de l'accueil : pour un
// robot, une page « introuvable » est indiscernable d'une vraie page (« soft
// 404 »). Pour une application à page unique, Google recommande de poser
// `<meta name="robots" content="noindex">` par le JavaScript. Une balise
// `robots` déjà présente est réécrite, puis rendue telle quelle en quittant.
export function useNoIndex(actif = true) {
  useEffect(() => {
    if (!actif || typeof document === 'undefined') return undefined
    const existante = document.head.querySelector('meta[name="robots"]')
    if (existante) {
      const avant = existante.getAttribute('content')
      existante.setAttribute('content', 'noindex')
      return () => { existante.setAttribute('content', avant ?? '') }
    }
    const meta = document.createElement('meta')
    meta.setAttribute('name', 'robots')
    meta.setAttribute('content', 'noindex')
    document.head.appendChild(meta)
    return () => { meta.remove() }
  }, [actif])
}
