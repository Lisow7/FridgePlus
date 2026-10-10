import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROUTES } from '@routes/routes-config'

// Audit du 2026-10-04, SEC-07 : la politique de divulgation (`SECURITY.md`,
// `security.txt`) datait de mai, proposait un recours inatteignable (un avis
// privé GitHub sur un dépôt privé — 404 pour un chercheur) et un « DM Twitter »
// sans compte nommé. Depuis le 2026-10-10 le dépôt est public : l'avis privé
// est le recours écrit, et il est vrai. Ce garde-fou tient la page à jour.
// Depuis la décision du 2026-10-08, security.txt désigne la page publique
// `/securite` (la même politique, en français et en anglais) ; ce qu'elle dit
// est confronté à SECURITY.md par `pages-accessibilite-et-securite.test.jsx`.

const securite = readFileSync(resolve(process.cwd(), 'SECURITY.md'), 'utf8')
const securityTxt = readFileSync(resolve(process.cwd(), 'public/.well-known/security.txt'), 'utf8')

describe('SECURITY.md — une politique de divulgation qu’un chercheur peut suivre', () => {
  it('porte une date de mise à jour postérieure à l’ouverture du dépôt public', () => {
    const m = securite.match(/Dernière mise à jour : (\d{4}-\d{2}-\d{2})/)
    expect(m, 'ligne « Dernière mise à jour : AAAA-MM-JJ »').not.toBeNull()
    expect(m[1] >= '2026-10-10').toBe(true)
  })

  it('le recours de secours est l’avis privé GitHub du dépôt public, sans réseau social sans compte', () => {
    expect(securite).toMatch(/https:\/\/github\.com\/Lisow7\/FridgePlus\/security\/advisories\/new/)
    expect(securite).not.toMatch(/Twitter|X DM/)
  })

  it('security.txt renvoie à la page publique « Sécurité », que l’app sert, et n’a pas expiré', () => {
    expect(securityTxt).toMatch(/^Policy: https:\/\/fridgeplus\.app\/securite$/m)
    expect(ROUTES.some((r) => r.path === '/securite' && !r.Guard)).toBe(true)
    expect(securite).toContain('https://fridgeplus.app/securite')
    const m = securityTxt.match(/Expires: (\d{4}-\d{2}-\d{2})/)
    expect(m).not.toBeNull()
    expect(m[1] > new Date().toISOString().slice(0, 10)).toBe(true)
  })
})
