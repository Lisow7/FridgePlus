import { describe, it, expect } from 'vitest'
import { SUPPORT_SELF_HELP, getSelfHelp } from '@features/support/data/support-self-help'

describe('support-self-help', () => {
  it('chaque entrée a q/a en fr + en', () => {
    for (const [catId, tips] of Object.entries(SUPPORT_SELF_HELP)) {
      expect(Array.isArray(tips), catId).toBe(true)
      expect(tips.length, catId).toBeGreaterThan(0)
      for (const tip of tips) {
        expect(tip.q.fr).toBeTruthy()
        expect(tip.q.en).toBeTruthy()
        expect(tip.a.fr).toBeTruthy()
        expect(tip.a.en).toBeTruthy()
      }
    }
  })

  it('getSelfHelp résout les conseils dans la langue demandée', () => {
    const fr = getSelfHelp('bug_voice', 'fr')
    const en = getSelfHelp('bug_voice', 'en')
    expect(fr.length).toBeGreaterThan(0)
    expect(fr.length).toBe(en.length)
    expect(fr[0].q).toBe(SUPPORT_SELF_HELP.bug_voice[0].q.fr)
    expect(en[0].a).toBe(SUPPORT_SELF_HELP.bug_voice[0].a.en)
  })

  it('catégorie sans aide → tableau vide (chemins « Signaler »)', () => {
    expect(getSelfHelp('report_user', 'fr')).toEqual([])
    expect(getSelfHelp('inconnue', 'fr')).toEqual([])
  })

  it('langue inconnue → fallback fr', () => {
    const tip = getSelfHelp('question', 'zz')[0]
    expect(tip.q).toBe(SUPPORT_SELF_HELP.question[0].q.fr)
    expect(tip.a).toBe(SUPPORT_SELF_HELP.question[0].a.fr)
  })
})
