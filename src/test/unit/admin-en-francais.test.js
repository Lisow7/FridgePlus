import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Décision du 2026-10-08 : le panneau admin parle français seul — un seul
// utilisateur, francophone ; les branches anglaises mortes partent, un texte par
// chose. Les garde-fous i18n de l'app excluaient déjà l'admin pour cette raison.
//
// ⚠️ Ce qui RESTE bilingue, et doit le rester : les DONNÉES. `lang` choisit
// encore, dans les éditeurs d'ingrédients, d'étapes et de tarifs, la langue des
// données éditées (on édite l'anglais en passant l'app en anglais) ; les
// formulaires `{ fr, en }` d'une recette ou d'un ingrédient, les textes d'une
// annonce, les langues et devises des prix, l'aperçu d'une recette et le TEXTE
// des réponses rapides du support (il part chez la personne qui a écrit) en
// font partie. Ce garde-fou ne vise que l'interface.

function fichiers(dossier, liste = []) {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) fichiers(chemin, liste)
    else if (/\.(js|jsx)$/.test(nom)) liste.push(chemin)
  }
  return liste
}

const ADMIN = fichiers('src/features/admin').map((f) => ({ f: f.split('\\').join('/'), code: readFileSync(f, 'utf8') }))

describe('le panneau admin parle français seul', () => {
  it('aucun ternaire de traduction sur la langue (deux textes, l’un français, l’autre anglais)', () => {
    const motif = /(?:\blang\s*[!=]==?\s*'(?:fr|en)'|\bisFr)\s*\?\s*['`"]/g
    const trouves = ADMIN.flatMap(({ f, code }) => (code.match(motif) ?? []).map((m) => `${f} : ${m}`))
    expect(trouves).toEqual([])
  })

  it('aucun dictionnaire d’interface avec une branche « en »', () => {
    // Les dictionnaires d'interface ont leurs langues au premier niveau (`  en: {`) ;
    // les données bilingues tiennent sur une ligne (`{ fr: '…', en: '…' }`).
    const trouves = ADMIN.filter(({ code }) => /^ {2}en:\s*\{/m.test(code)).map(({ f }) => f)
    expect(trouves).toEqual([])
  })

  it('aucune lecture d’un dictionnaire d’interface par la langue', () => {
    const motif = /\b(?:I18N|SECTION_TITLES|ADMIN_I18N|REASON_LABELS|NOTIF_I18N)\[lang\]/g
    const trouves = ADMIN.flatMap(({ f, code }) => (code.match(motif) ?? []).map((m) => `${f} : ${m}`))
    expect(trouves).toEqual([])
  })

  it('les données, elles, restent bilingues (témoins)', () => {
    const lire = (f) => ADMIN.find((x) => x.f.endsWith(f)).code
    expect(lire('sections/ingredient-form.jsx')).toMatch(/useState\(\{ fr:'', en:''/)
    expect(lire('sections/pricing-edit-modal.jsx')).toMatch(/const LANG_LABELS = \{ fr: 'FR 🇫🇷', en: 'EN 🇬🇧'/)
    expect(lire('data/support-quick-replies.js')).toMatch(/text: \{\s*fr: '/)
    expect(lire('components/ingredients-editor.jsx')).toMatch(/labels\?\.\[lang\]/)
  })
})
