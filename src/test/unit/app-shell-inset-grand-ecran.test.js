// La page d'accueil réserve la hauteur du bandeau cookies — sauf sur grand
// écran, où le bandeau est une carte de coin et où réserver ferait sauter le
// frigo (voir cookie-banner-coin-grand-ecran.test.jsx).
//
// `AppShell` réclame une quarantaine de props et trois providers : comme
// a11y-navigation-clavier.test.jsx, on vérifie le contrat sur le source.
// Ce que ce test verrouille : le seuil du bandeau et celui de la mise en page
// sont LE MÊME nombre — deux constantes qui divergent, c'est un frigo qui
// saute à nouveau sur une tranche de largeurs sans que personne ne le voie.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { COOKIE_BANNER_LIGNE_MIN_WIDTH } from '@features/legal/components/cookie-banner'

const shell = readFileSync(resolve(__dirname, '../../app/layout/app-shell.jsx'), 'utf8')

describe('app-shell — réservation de l’espace bas', () => {
  it('réserve la hauteur du bandeau par une classe, pas par un style en ligne (sinon la variante grand écran ne peut pas la lever)', () => {
    expect(shell).not.toMatch(/paddingBottom:\s*'var\(--fp-bottom-inset/)
    expect(shell).toMatch(/pb-\[var\(--fp-bottom-inset,0px\)\]/)
  })

  it('lève la réservation à partir du seuil où le bandeau devient une carte de coin', () => {
    expect(shell).toContain(`min-[${COOKIE_BANNER_LIGNE_MIN_WIDTH}px]:pb-0`)
  })
})
