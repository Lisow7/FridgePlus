import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Petits textes relevés par l'audit du 2026-10-04 en parcourant l'app. Chacun
// est épinglé ici pour ne pas revenir ; le cliquet général (tutoiement,
// vocabulaire de référence) viendra avec le lot « app plus simple à comprendre ».
const lire = (chemin) => readFileSync(resolve(process.cwd(), chemin), 'utf8')

describe('textes relevés par l’audit', () => {
  it('la carte « Panier de courses » tutoie, comme le reste de l’app', () => {
    const source = lire('src/shared/ui/upgrade-gate.jsx')
    expect(source).not.toMatch(/Cochez chaque article/)
    expect(source).toMatch(/Coche chaque article/)
  })

  // UX-16 : du jargon montré à l'utilisateur. Les commentaires sont retirés
  // avant la recherche (ils parlent d'« export JSON » et de « snapshots »).
  const sansCommentaires = (chemin) => lire(chemin)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

  it('le compte parle sans jargon : ni « opt-out », ni « JSON », ni numéro d’article', () => {
    const source = sansCommentaires('src/features/profile/pages/profile-account-page.jsx')
    expect(source).not.toMatch(/privDesc:\s*'[^']*opt-out/)
    expect(source).not.toMatch(/dataDesc:\s*'[^']*(JSON|Art\.)/)
  })

  it('l’historique des dépenses parle de dépenses, pas d’« instantanés » ni de « snapshots »', () => {
    const source = sansCommentaires('src/features/profile/components/erase-spending-history-section.jsx')
    expect(source).not.toMatch(/instantan/i)
    expect(source).not.toMatch(/snapshot/i)
  })

  it('la forme du frigo est décrite sans parler d’un ancien fonctionnement', () => {
    // « Elle ne dépend plus de la langue » ne dit rien à quelqu'un qui n'a pas
    // connu l'époque où la forme dépendait de la langue.
    const source = lire('src/features/profile/pages/profile-preferences-page.jsx')
    expect(source).not.toMatch(/ne dépend plus de la langue/)
    expect(source).not.toMatch(/no longer depends on the language/)
  })
})
