import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Garde-fou sur la Content-Security-Policy servie en production.
//
// `vercel.json` est du JSON strict : impossible d'y mettre un commentaire.
// Les décisions et leur justification vivent donc ICI — c'est ce fichier
// qu'il faut lire avant de modifier l'en-tête CSP.
//
// Voir aussi SECURITY.md.

function cspDirectives() {
  const raw = readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')
  const config = JSON.parse(raw)

  const headers = (config.headers ?? []).flatMap(entry => entry.headers ?? [])
  const csps = headers.filter(h => h.key === 'Content-Security-Policy')
  if (csps.length === 0) throw new Error('Aucun en-tête Content-Security-Policy dans vercel.json')
  // Ne PAS se contenter du premier : si une route se voit un jour attribuer sa
  // propre CSP, ce garde-fou deviendrait aveugle à celle-ci (elle pourrait
  // rétablir 'unsafe-inline' sans faire tomber un seul test). Tant qu'il n'y en
  // a qu'une, l'assertion est triviale ; le jour où une seconde apparaît, elle
  // force à faire boucler les tests ci-dessous sur chacune.
  if (csps.length > 1) {
    throw new Error(
      `vercel.json déclare ${csps.length} en-têtes Content-Security-Policy. `
      + 'Ce garde-fou n\'en vérifie qu\'un : le faire boucler sur toutes avant '
      + 'de considérer la politique comme couverte.',
    )
  }
  const [csp] = csps

  // "script-src 'self' https://x; style-src 'self'" → { 'script-src': ["'self'", 'https://x'], … }
  return Object.fromEntries(
    csp.value.split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const [name, ...values] = part.split(/\s+/)
        return [name, values]
      }),
  )
}

describe('Content-Security-Policy (vercel.json)', () => {
  it('script-src n\'autorise PAS \'unsafe-inline\'', () => {
    const { 'script-src': scriptSrc } = cspDirectives()
    expect(
      scriptSrc,
      "script-src ne doit jamais contenir 'unsafe-inline' : ce mot-clé rouvre "
      + 'la classe entière des XSS par injection de <script> inline. Vérifié le '
      + '2026-08-06 : l\'app fonctionne sans, y compris le bloc JSON-LD de '
      + 'index.html — les navigateurs ne traitent pas les data blocks '
      + 'application/ld+json comme des scripts exécutables.',
    ).not.toContain("'unsafe-inline'")
  })

  it('style-src conserve \'unsafe-inline\' — décision assumée, pas un oubli', () => {
    const { 'style-src': styleSrc } = cspDirectives()
    // Le retirer casserait le rendu : React applique ses styles via l'attribut
    // `style=`, et les ATTRIBUTS style sont bloqués sans 'unsafe-inline'. Ni
    // nonce ni hash ne les couvrent (seul 'unsafe-hashes' le ferait, au cas
    // par cas). Avec ~3715 styles inline dans le code, les supprimer est une
    // refonte, pas un durcissement.
    // Si ce test tombe un jour, c'est que quelqu'un l'a retiré : lire ce
    // commentaire avant de conclure à une amélioration.
    expect(styleSrc).toContain("'unsafe-inline'")
  })

  it('verrouille les directives structurantes', () => {
    const d = cspDirectives()
    // Empêche l'injection d'objets/plugins, la réécriture de <base> (vol de
    // chemins relatifs) et l'embarquement en iframe (clickjacking).
    expect(d['object-src']).toEqual(["'none'"])
    expect(d['base-uri']).toEqual(["'self'"])
    expect(d['frame-ancestors']).toEqual(["'none'"])
    expect(d['default-src']).toEqual(["'self'"])
  })
})
