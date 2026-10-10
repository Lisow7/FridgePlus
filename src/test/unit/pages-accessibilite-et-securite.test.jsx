import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync, existsSync } from 'node:fs'

import { ROUTES } from '@routes/routes-config'
import { LIBELLES_DES_ROUTES } from '@shared/static/libelles-des-routes'
import { laPagePoseSonTitre } from '@shared/lib/route-title'
import { CORPS_PAR_CHEMIN } from '@prerender/corps-statique'
import { PAGES_STATIQUES, MORCEAUX_PAR_CHEMIN } from '../../../scripts/lib/prerender-page.mjs'
import { PAGE_ACCESSIBILITE } from '@features/legal/data/page-accessibilite'
import { PAGE_SECURITE, AVIS_PRIVE_GITHUB } from '@features/legal/data/page-securite'
import { SUPPORT_EMAIL } from '@shared/lib/contact'
import AccessibilityPage from '@features/legal/pages/accessibility-page'
import SecurityPage from '@features/legal/pages/security-page'

// Décisions du 2026-10-08 :
//   • une page « Accessibilité » courte et honnête, liée au pied de page — ce
//     qui est fait, ce qui reste, comment signaler un problème —, préparée à
//     l'avance pour les moteurs et inscrite au plan du site ;
//   • une page publique « Sécurité », que security.txt désigne : le contenu de
//     SECURITY.md en français et en anglais (comment signaler, ce qu'on
//     s'engage à faire).
// Une page « honnête » n'affirme que ce qui est vérifié : le dernier bloc de
// ce fichier confronte chaque promesse à ce qui la tient réellement.

const PAGES = [
  { chemin: '/accessibilite', contenu: PAGE_ACCESSIBILITE, Page: AccessibilityPage, morceau: 'accessibility-page' },
  { chemin: '/securite', contenu: PAGE_SECURITE, Page: SecurityPage, morceau: 'security-page' },
]

const lire = (chemin) => readFileSync(chemin, 'utf8')
// Tout le texte d'une langue, à plat : titre, chapeau, sections, mise à jour.
const textes = (c) => [
  c.titre, c.intro, c.miseAJour,
  ...c.sections.flatMap((s) => [s.titre, ...(s.paragraphes ?? []), ...(s.liste ?? []), s.lien?.texte].filter(Boolean)),
]

describe.each(PAGES)('$chemin — une page publique à part entière', ({ chemin, contenu, Page, morceau }) => {
  it('a sa route, SANS garde : la page ne lit aucune donnée de compte', () => {
    const route = ROUTES.find((r) => r.path === chemin)
    expect(route).toBeTruthy()
    expect(route.Guard).toBeUndefined()
    expect(route.label).toBe(LIBELLES_DES_ROUTES[chemin])
    expect(LIBELLES_DES_ROUTES[chemin]).toEqual({ fr: expect.any(String), en: expect.any(String) })
  })

  it('pose elle-même son titre d’onglet', () => {
    expect(laPagePoseSonTitre(chemin)).toBe(true)
  })

  it('est pré-rendue, avec son titre, sa description et son fichier préchargé', () => {
    const page = PAGES_STATIQUES.find((p) => p.chemin === chemin)
    expect(page?.titre).toMatch(/ — Fridge\+$/)
    expect(page?.description.length).toBeGreaterThan(80)
    expect(MORCEAUX_PAR_CHEMIN[chemin]).toEqual([morceau])
    // Le nom du morceau EST le nom du fichier de la page : sans quoi le build
    // ne trouve pas le fichier à précharger et s'arrête.
    expect(existsSync(`src/features/legal/pages/${morceau}.jsx`)).toBe(true)
  })

  it.each(['fr', 'en'])('le HTML servi (%s) porte tout le texte de la page vivante', (lang) => {
    const html = CORPS_PAR_CHEMIN[chemin].corps(lang)
    const c = contenu[lang]
    expect(html).toContain(`<h1>${c.titre}</h1>`)
    for (const s of c.sections) expect(html).toContain(`<h2>${s.titre}</h2>`)
    for (const texte of textes(c)) expect(html, texte).toContain(texte.replace(/&/g, '&amp;').replace(/"/g, '&quot;'))
  })

  it.each(['fr', 'en'])('la page vivante (%s) : un h1, une section titrée par bloc, le lien de contact', (lang) => {
    const c = contenu[lang]
    render(<MemoryRouter><Page lang={lang} darkMode={false} /></MemoryRouter>)
    expect(screen.getByRole('heading', { level: 1, name: c.titre })).toBeInTheDocument()
    for (const s of c.sections) {
      expect(screen.getByRole('region', { name: s.titre })).toBeInTheDocument()
    }
    expect(screen.getAllByRole('link').some((a) => a.getAttribute('href')?.startsWith(`mailto:${SUPPORT_EMAIL}`))).toBe(true)
  })

  it('le français et l’anglais disent la même chose, bloc pour bloc', () => {
    const forme = (c) => c.sections.map((s) => [s.id, s.paragraphes?.length ?? 0, s.liste?.length ?? 0, Boolean(s.lien)])
    expect(forme(contenu.en)).toEqual(forme(contenu.fr))
  })

  it('aucune couleur en dur : la page suit le thème par ses variables', () => {
    const source = lire(`src/features/legal/pages/${morceau}.jsx`) + lire('src/features/legal/components/page-publique-de-texte.jsx')
    expect(source).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/)
  })

  it('figure au plan du site et dans llms.txt', () => {
    expect(lire('public/sitemap.xml')).toContain(`<loc>https://fridgeplus.app${chemin}</loc>`)
    expect(lire('public/llms.txt')).toContain(`(https://fridgeplus.app${chemin})`)
  })
})

describe('/securite — dit ce que dit SECURITY.md, et security.txt la désigne', () => {
  const md = lire('SECURITY.md')
  const txt = lire('public/.well-known/security.txt')
  const fr = textes(PAGE_SECURITE.fr).join('\n')
  const en = textes(PAGE_SECURITE.en).join('\n')

  it('une seule adresse : celle de SECURITY.md et du Contact de security.txt', () => {
    expect(md).toContain(SUPPORT_EMAIL)
    expect(txt).toContain(`Contact: mailto:${SUPPORT_EMAIL}`)
  })

  it('security.txt renvoie vers la page publique', () => {
    expect(txt).toMatch(/^Policy: https:\/\/fridgeplus\.app\/securite$/m)
    expect(txt).toMatch(/^Acknowledgments: https:\/\/fridgeplus\.app\/securite#securite-remerciements$/m)
    expect(PAGE_SECURITE.fr.sections.map((s) => s.id)).toContain('securite-remerciements')
  })

  it('les mêmes délais que SECURITY.md', () => {
    expect(md).toMatch(/Acknowledgment within 48 h/)
    expect(md).toMatch(/Initial assessment within 7 days/)
    expect(md).toMatch(/P0 \(active exploitation, data exposure\) : ≤ 24 h/)
    expect(md).toMatch(/P1 \(high impact, exploitable\) : ≤ 7 days/)
    expect(md).toMatch(/P2 \(medium impact\) : ≤ 30 days/)
    for (const attendu of ['48 h', '7 jours', '24 h', '30 jours']) expect(fr, attendu).toContain(attendu)
    for (const attendu of ['48 hours', '7 days', '24 hours', '30 days']) expect(en, attendu).toContain(attendu)
  })

  it('le recours si personne ne répond : l’avis de sécurité privé de GitHub, comme SECURITY.md', () => {
    expect(md).toContain(AVIS_PRIVE_GITHUB)
    for (const lang of ['fr', 'en']) {
      expect(PAGE_SECURITE[lang].sections.some((s) => s.lien?.href === AVIS_PRIVE_GITHUB), lang).toBe(true)
    }
  })

  it('ni « DM sur X », ni promesse Premium à un visiteur (ADR 0006)', () => {
    for (const texte of [fr, en]) {
      expect(texte).not.toMatch(/\bDM\b|twitter|\bsur X\b|\bon X\b/i)
      expect(texte).not.toMatch(/premium/i)
    }
  })
})

describe('/accessibilite — chaque promesse est tenue par quelque chose', () => {
  const fr = textes(PAGE_ACCESSIBILITE.fr).join('\n')
  const en = textes(PAGE_ACCESSIBILITE.en).join('\n')

  it('« WCAG 2.2 niveau AA, à chaque modification » : la CI lance axe avec ces critères', () => {
    expect(fr).toMatch(/WCAG 2\.2/)
    expect(en).toMatch(/WCAG 2\.2/)
    expect(lire('e2e/support/axe-regles.js')).toMatch(/'wcag22aa'/)
    expect(lire('e2e/support/axe-regles.js')).toMatch(/export const REGLES_DIFFEREES = \[\]/)
  })

  it('« pages publiques, en clair et en sombre, sur ordinateur et sur téléphone » : la passe axe le fait', () => {
    const spec = lire('e2e/a11y.spec.js')
    expect(spec).toMatch(/for \(const theme of \['light', 'dark'\]\)/)
    expect(spec).toMatch(/nom: 'mobile', width: 390/)
    for (const { chemin } of PAGES) expect(spec, chemin).toContain(`'/FridgePlus${chemin}'`)
    expect(lire('e2e/a11y-connecte.spec.js')).toMatch(/const DETTE_CONTRASTE = \{\}/)
  })

  it('« 4,5:1 » et « 24 pixels » : les garde-fous existent', () => {
    expect(fr).toContain('4,5:1')
    expect(en).toContain('4.5:1')
    expect(fr).toMatch(/24 pixels/)
    expect(lire('src/shared/ui/button.jsx')).toMatch(/min-h-6 min-w-6/)
  })

  it('« animations réduites » : le bloc global prefers-reduced-motion existe', () => {
    expect(fr).toMatch(/animations/)
    expect(lire('src/index.css')).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
  })

  it('« sans glisser » : les étapes ont leurs flèches', () => {
    expect(fr).toMatch(/↑ ↓/)
    expect(existsSync('src/test/unit/etapes-sans-glisser.test.jsx')).toBe(true)
  })

  it('ne se dit pas conforme : aucun audit indépendant n’a eu lieu', () => {
    expect(fr).toMatch(/n’est pas une déclaration de conformité/)
    expect(en).toMatch(/is not a statement of conformity/)
    expect(fr).not.toMatch(/\b(totalement|entièrement) conforme/i)
  })

  it('le chemin du support dans l’app est celui des vrais libellés, dans les deux langues', () => {
    expect(fr).toContain('« Aide & infos » → « Contacter le support »')
    expect(en).toContain('“Help & info” → “Contact support”')
    const aide = lire('src/features/onboarding/i18n/help-guide-i18n.js')
    for (const libelle of ['Aide & infos', 'Contacter le support', 'Help & info', 'Contact support']) {
      expect(aide, libelle).toMatch(new RegExp(`(btn_label|support_btn):\\s*'${libelle}'`))
    }
  })
})

describe('le pied de page mène à l’accessibilité', () => {
  it('sur téléphone comme sur ordinateur', () => {
    const pied = lire('src/app/layout/footer.jsx')
    expect(pied.match(/<FooterLink to="\/accessibilite"/g)?.length).toBe(2)
  })
})
