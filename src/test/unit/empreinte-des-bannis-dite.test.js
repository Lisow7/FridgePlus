import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getLegalSection } from '@features/legal/data/legal-content'
import { DONNEES } from '@features/legal/data/suppression-compte'

// À l'effacement d'un compte encore banni, la base garde l'EMPREINTE de son
// adresse e-mail jusqu'à la fin du bannissement (migration
// 20261006_bannis_ne_se_reinscrivent_pas.sql, note d'Antoine sur la planche
// d'arbitrages). Une empreinte d'adresse reste une donnée personnelle : ce que
// l'application DIT de l'effacement doit le suivre — sinon elle promet
// « toutes tes données » et en garde une.

const texte = (lang, section) => JSON.stringify(getLegalSection(lang, section))
const courriel = readFileSync(resolve(process.cwd(), 'supabase/functions/notifier-bannissement/index.ts'), 'utf8')

describe('l’empreinte gardée après un bannissement est dite', () => {
  it('politique de confidentialité, durées de conservation : en français et en anglais', () => {
    expect(texte('fr', 'privacy')).toMatch(/Compte supprimé pendant une suspension : seule une empreinte de l'adresse e-mail/)
    expect(texte('en', 'privacy')).toMatch(/Account deleted while suspended: only a fingerprint of the e-mail address/)
  })

  it('FAQ : « aucune donnée personnelle n’est conservée » a son exception', () => {
    expect(texte('fr', 'faq')).toMatch(/Aucune donnée personnelle \(e-mail, pseudo, IP\) n'est conservée, sauf si le compte était suspendu/)
    expect(texte('en', 'faq')).toMatch(/No personal data \(email, username, IP\) is retained, except if the account was suspended/)
  })

  it('page publique de suppression (Google Play) : l’empreinte est dans « ce qui est conservé », avec sa durée', () => {
    expect(DONNEES.fr.conservees.join('\n')).toMatch(/Si ton compte était suspendu : une empreinte de ton adresse e-mail.*jusqu’à la fin de la suspension/)
    expect(DONNEES.en.conservees.join('\n')).toMatch(/If your account was suspended: a fingerprint of your email address.*until the suspension ends/)
  })

  it('e-mail de bannissement : ne promet plus « toutes tes données », et dit l’empreinte', () => {
    expect(courriel).not.toMatch(/toutes tes données|all your data/)
    expect(courriel).toMatch(/Seule une empreinte de ton adresse e-mail/)
    expect(courriel).toMatch(/Only a fingerprint of your e-mail address/)
  })

  // Décision du 2026-10-06 (choix d'Antoine) : une suspension « sans fin »
  // n'autorise pas une empreinte sans fin — 3 ans au plus, puis l'adresse
  // redevient libre (migration 20261006_durees_de_conservation_tenues.sql).
  it('partout où l’empreinte est dite, sa limite de 3 ans l’est aussi', () => {
    const banni = readFileSync(resolve(process.cwd(), 'src/features/auth/components/banned-screen.jsx'), 'utf8')
    const textes = {
      'politique fr': texte('fr', 'privacy'), 'politique en': texte('en', 'privacy'),
      'FAQ fr': texte('fr', 'faq'), 'FAQ en': texte('en', 'faq'),
      'page de suppression fr': DONNEES.fr.conservees.join('\n'), 'page de suppression en': DONNEES.en.conservees.join('\n'),
      'écran banni + e-mail': banni + courriel,
    }
    for (const [ou, t] of Object.entries(textes)) {
      const fr = (t.match(/fin de la suspension/g) ?? []).length
      const en = (t.match(/suspension ends/g) ?? []).length
      expect((t.match(/fin de la suspension \(3 ans au plus\)/g) ?? []).length, `${ou} : « (3 ans au plus) »`).toBe(fr)
      expect((t.match(/suspension ends \(3 years at most\)/g) ?? []).length, `${ou} : « (3 years at most) »`).toBe(en)
      expect(fr + en, `${ou} : l’empreinte y est dite`).toBeGreaterThan(0)
    }
  })

  it('e-mail de bannissement : il part de noreply@ — il n’invite pas à y répondre, il donne l’adresse du support', () => {
    expect(courriel).not.toMatch(/réponds à cet e-mail|reply to this email/)
    expect(courriel).toMatch(/écris à \$\{SUPPORT\} depuis l’adresse qui reçoit cet e-mail/)
    expect(courriel).toMatch(/write to \$\{SUPPORT\} from the address that receives this email/)
  })
})
