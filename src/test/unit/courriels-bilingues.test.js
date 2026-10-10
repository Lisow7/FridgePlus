import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Audit du 2026-10-04, CPT-18 : les six modèles d'e-mail de Supabase Auth
// n'étaient qu'en français (aucun `.Data.lang`), alors que `signUpWithEmail`
// range la langue dans user_metadata exprès pour eux. Un compte anglophone
// recevait sa confirmation d'inscription et son lien « mot de passe oublié »
// en français.
//
// La règle des modèles : la langue se lit UNE fois en tête,
// `{{ $en := eq (print .Data.lang) "en" }}` — `print` parce qu'un compte sans
// langue (Google, comptes anciens) ne doit jamais faire échouer le gabarit, donc
// l'envoi : une clé absente s'imprime « <nil> », et c'est le français —, puis
// chaque texte visible est un bloc `{{ if $en }}…{{ else }}…{{ end }}`.
const DOSSIER = 'supabase/email-templates'
const MODELES = readdirSync(DOSSIER).filter((f) => f.endsWith('.html'))
const BLOC = /\{\{ if \$en \}\}([\s\S]*?)\{\{ else \}\}([\s\S]*?)\{\{ end \}\}/g

// Ce qui reste visible une fois retirés les blocs bilingues, les balises, les
// actions du gabarit et le nom de la marque : rien ne doit rester.
function texteEnUneSeuleLangue(html) {
  return html
    .replace(BLOC, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{\{[\s\S]*?\}\}/g, ' ')
    .replace(/&nbsp;|&[a-z]+;|&#\d+;/g, ' ')
    .replace(/Fridge\+?|◆/g, ' ')
    .replace(/[\s+·—–\-.,:;!?'’"«»()]+/g, ' ')
    .trim()
}

describe('les e-mails d’authentification parlent la langue du compte', () => {
  it('les six modèles de Supabase Auth sont là', () => {
    expect(MODELES.sort()).toEqual([
      'change-email.html', 'confirm-signup.html', 'invite-user.html',
      'magic-link.html', 'reauthentication.html', 'reset-password.html',
    ])
  })

  for (const nom of MODELES) {
    describe(nom, () => {
      const html = readFileSync(join(DOSSIER, nom), 'utf8')

      it('la langue se lit une fois, en tête, dans user_metadata', () => {
        expect(html.startsWith('{{ $en := eq (print .Data.lang) "en" }}')).toBe(true)
      })

      it('la page déclare sa langue', () => {
        expect(html).toContain('<html lang="{{ if $en }}en{{ else }}fr{{ end }}">')
      })

      it('chaque {{ if }} a sa fin', () => {
        const ouvertures = html.match(/\{\{-?\s*(if|range|with)\b/g) ?? []
        const fins = html.match(/\{\{-?\s*end\s*-?\}\}/g) ?? []
        expect(fins.length).toBe(ouvertures.length)
      })

      it('aucun texte visible en une seule langue', () => {
        expect(texteEnUneSeuleLangue(html)).toBe('')
      })

      it('chaque bloc a deux versions, non vides et différentes', () => {
        const blocs = [...html.matchAll(BLOC)]
        expect(blocs.length).toBeGreaterThan(5)
        for (const [, en, fr] of blocs) {
          expect(en.trim()).not.toBe('')
          expect(fr.trim()).not.toBe('')
          expect(en).not.toBe(fr)
        }
      })
    })
  }
})
