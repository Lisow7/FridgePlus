import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SHELL_I18N } from '@shared/lib/i18n/app-shell-i18n'

// Garde-fou des deux corrections d'accessibilité du 2026-08-16.
//
// ── Pourquoi un test de STRUCTURE et pas de rendu ──────────────────────────
// `AppShell` réclame une quarantaine de props et trois providers ; le monter
// pour vérifier deux attributs coûterait plus que ce qu'il rapporte. Ce qui est
// vérifié ici n'est pas un comportement mais un CONTRAT à trois pièces, dont
// chacune est inutile sans les deux autres :
//
//   1. un lien `href="#contenu-principal"` ;
//   2. la cible `id="contenu-principal"` sur `<main>` ;
//   3. `tabIndex={-1}` sur cette cible.
//
// C'est le point 3 qui justifie ce test. Sans lui, le lien FONCTIONNE en
// apparence — la page défile — mais le focus clavier reste dans l'en-tête, et
// la tabulation suivante repart du haut. Le lien n'évite alors rien, et rien
// dans l'UI ne le montre : c'est le garde-fou vert qui ne protège rien, motif
// que ce projet a déjà payé plusieurs fois.
//
// ⚠️ Un lien d'évitement doit devenir VISIBLE au focus. Le style est donc lu
// lui aussi : un `sr-only` permanent ferait disparaître le focus à l'écran pour
// quelqu'un de voyant qui navigue au clavier.

const SHELL = readFileSync(resolve(process.cwd(), 'src/app/layout/app-shell.jsx'), 'utf8')
const HEADER_COMMUNAUTE = readFileSync(
  resolve(process.cwd(), 'src/features/community/components/community-header.jsx'), 'utf8',
)

// Les commentaires sont retirés AVANT toute recherche : le 2026-08-14, un
// cliquet de ce dépôt attrapait un appel supprimé mais pas un appel commenté.
// Ici, l'énoncé du contrat figure justement en commentaire juste au-dessus.
function sansCommentaires(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const shell = sansCommentaires(SHELL)

describe('lien d’évitement — les 3 pièces du contrat', () => {
  it('le lien existe et pointe vers l’ancre du contenu', () => {
    expect(shell).toMatch(/href="#contenu-principal"/)
  })

  it('la cible existe sur <main>', () => {
    expect(shell).toMatch(/id="contenu-principal"/)
  })

  it('🔴 la cible est focalisable — sans quoi le lien ne déplace QUE le défilement', () => {
    // La pièce silencieuse. `<main id=… tabIndex={-1}>` : on vérifie que les
    // deux attributs sont sur le MÊME élément, pas seulement présents tous les
    // deux quelque part dans le fichier.
    const balise = shell.match(/<main[\s\S]{0,600}?>/)
    expect(balise, '<main> introuvable dans app-shell').not.toBeNull()
    expect(balise[0]).toMatch(/id="contenu-principal"/)
    expect(balise[0]).toMatch(/tabIndex=\{-1\}/)
  })

  it('le lien devient visible au focus (pas un sr-only permanent)', () => {
    expect(shell).toMatch(/\.fp-skip-link:focus\s*\{[^}]*left:\s*8px/)
  })

  it('passe au-dessus de l’en-tête collant, mais SOUS les modales', () => {
    // Un lien d'évitement caché derrière l'en-tête est invisible au focus ;
    // au-dessus d'une modale, il flotterait sur un dialogue au focus piégé.
    expect(shell).toMatch(/z-index:\s*\$\{Z_INDEX\.BANNER\}/)
  })

  it('le libellé vient du dictionnaire partagé, et il est traduit', () => {
    // Le dictionnaire vit dans `@shared/lib/i18n/app-shell-i18n` et NON dans le
    // composant : défini dans `app-shell.jsx`, il échappait au glob `*i18n*` de
    // `i18n-dictionaries-parity.test.js` — donc au garde-fou de parité des
    // langues. On vérifie ici le branchement ; la parité, elle, est désormais
    // couverte par le mécanisme du projet, pas par une assertion sur mesure.
    expect(shell).toMatch(/from '@shared\/lib\/i18n\/app-shell-i18n'/)
    expect(shell).toMatch(/SHELL_I18N\[lang\]\s*\?\?\s*SHELL_I18N\.fr/)
    for (const langue of ['fr', 'en', 'es', 'de', 'ja']) {
      expect(SHELL_I18N[langue]?.skipToContent, `langue ${langue}`).toBeTruthy()
    }
  })
})

describe('/community — titre de premier niveau', () => {
  it('le titre du fil est un <h1>, pas un <span>', () => {
    const sansComm = sansCommentaires(HEADER_COMMUNAUTE)
    expect(sansComm).toMatch(/<h1[\s\S]{0,800}?t\.title\.toUpperCase\(\)[\s\S]{0,40}?<\/h1>/)
  })

  it('ce <h1> neutralise sa marge par défaut', () => {
    // Sans `margin: 0`, la marge d'un `<h1>` décale la barre de l'en-tête —
    // une régression visuelle qu'aucun test de structure ne verrait autrement.
    const bloc = sansCommentaires(HEADER_COMMUNAUTE).match(/<h1 style=\{\{[\s\S]*?\}\}>/)
    expect(bloc, '<h1> introuvable dans community-header').not.toBeNull()
    expect(bloc[0]).toMatch(/margin:\s*0/)
  })
})
