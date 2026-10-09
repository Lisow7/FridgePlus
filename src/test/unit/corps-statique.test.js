import { describe, it, expect } from 'vitest'
import {
  corpsFaq, corpsGuide, corpsLegal, corpsChangelog, jsonLdFaq, echapper, CORPS_PAR_CHEMIN,
} from '@prerender/corps-statique'
import { getFaqBasics } from '@shared/lib/i18n/faq-basics-i18n'
import { TOUR_STEPS_I18N } from '@features/onboarding/i18n/tour-steps-i18n'
import { getLegalSection } from '@features/legal/data/legal-content'
import { CHANGELOG } from '@features/changelog/data/changelog'
import { pickReleaseName } from '@features/changelog/data/changelog-i18n'
import { getContentCta } from '@shared/lib/i18n/content-cta-i18n'

// Garde-fou du contenu réellement SERVI dans `/faq` et `/guide`.
//
// ── Ce qu'il protège ───────────────────────────────────────────────────────
// `corps-statique.js` est une SECONDE présentation des mêmes textes : il les
// relit dans les dictionnaires pour les écrire en HTML au moment du build.
// Aucune phrase n'y est recopiée, mais la STRUCTURE, elle, peut diverger — une
// question retirée de la boucle, une section oubliée, et le fichier servi
// redevient une coquille sans que rien ne casse.
//
// D'où des assertions qui BOUCLENT sur le dictionnaire : ajouter une question
// sans toucher au générateur doit rester vert, en retirer une du générateur
// doit rougir. Vérifié par mutation le 2026-08-19.
//
// 🔴 Ne jamais vérifier un pré-rendu par son TITRE : c'est la seule chose que
// l'ancien pré-rendu écrivait déjà. Le contrôle qui discrimine porte sur une
// phrase du CORPS.

describe('/faq — le corps servi', () => {
  const html = corpsFaq('fr')

  it('contient CHAQUE question de prise en main, avec sa réponse', () => {
    for (const { q, a } of getFaqBasics('fr')) {
      expect(html).toContain(echapper(q))
      expect(html).toContain(echapper(a))
    }
  })

  it('contient aussi la FAQ du service, pas seulement la prise en main', () => {
    // Les deux sources doivent être rendues : n'en servir qu'une passerait
    // inaperçu, le fichier resterait parfaitement valide.
    expect(html).toContain('Le service est-il gratuit')
    expect(html).toContain('Comment supprimer mon compte')
  })

  it('ne promet AUCUN abonnement tant que le premium est en pause', () => {
    // Même contradiction que celle corrigée dans `legal-content.js`, mais ici
    // dans le HTML servi — donc dans ce que lisent les moteurs qui n'exécutent
    // pas le JavaScript, et qui n'ont aucun moyen de voir le démenti.
    expect(html).toContain('aucun moyen de payer')
    expect(html).not.toContain('abonnement mensuel ou annuel')
  })

  it('a bien une hiérarchie de titres, pas un mur de texte', () => {
    expect(html).toMatch(/<h1>Questions fréquentes<\/h1>/)
    // 3 sections : prise en main, service, et le bloc de fin.
    expect((html.match(/<h2>/g) ?? []).length).toBe(3)
    expect((html.match(/<h3>/g) ?? []).length).toBeGreaterThan(10)
  })
})

describe('/guide — le corps servi', () => {
  const html = corpsGuide('fr')

  it('rend les 5 étapes publiques, dans l’ordre du menu (bouton orange, Remplir, Vérifier, Cuisiner, Aller plus loin)', () => {
    const titres = [...html.matchAll(/<h2>([^<]*)<\/h2>/g)].map(m => m[1])
    // Les 5 premiers sont les étapes ; le dernier est le bloc de fin, qui
    // doit rester APRÈS elles — c'est l'ordre de lecture de la page.
    expect(titres.slice(0, 5)).toEqual([
      TOUR_STEPS_I18N.fr.fab.title,
      TOUR_STEPS_I18N.fr.fridge.title,
      TOUR_STEPS_I18N.fr.check.title,
      TOUR_STEPS_I18N.fr.recipes.title,
      TOUR_STEPS_I18N.fr.final_guest.title,
    ])
    expect(titres.at(-1)).toBe(getContentCta('fr').title)
  })

  it('rend le détail de chaque étape, pas seulement son titre', () => {
    for (const cle of ['fab', 'fridge', 'check', 'recipes', 'final_guest']) {
      const etape = TOUR_STEPS_I18N.fr[cle]
      if (etape.desc) expect(html).toContain(echapper(etape.desc))
      for (const tip of etape.tips ?? []) expect(html).toContain(echapper(tip.t))
      for (const opt of etape.options ?? []) expect(html).toContain(echapper(opt.t))
    }
  })

  it('n’expose que la finale INVITÉ — les finales connectées dépendent du profil', () => {
    // Ce HTML est servi sans lecteur connu : la finale invité (« Aller plus
    // loin » : ce qu'un compte ajoute, l'état exact du premium) vaut pour
    // quiconque arrive de la recherche. `final_free` / `final_premium`
    // s'adressent à un compte précis et restent réservées à la page vivante.
    expect(html).toContain(echapper(TOUR_STEPS_I18N.fr.final_guest.desc))
    expect(html).not.toContain(echapper(TOUR_STEPS_I18N.fr.final_free.desc))
    expect(html).not.toContain(echapper(TOUR_STEPS_I18N.fr.final_premium.desc))
  })
})

describe('/faq — le corps servi', () => {
  it('range la prise en main par bloc et renvoie chaque réponse à l’étape du guide', () => {
    const html = corpsFaq('fr')
    for (const libelle of ['Remplir', 'Vérifier', 'Cuisiner', 'Compte &amp; données']) {
      expect(html).toContain(`<p><small>${libelle}</small></p>`)
    }
    const liens = [...html.matchAll(/href="\/guide#etape-(\d)"/g)].map(m => Number(m[1]))
    expect(liens.length).toBe(getFaqBasics('fr').length)
    for (const n of liens) { expect(n).toBeGreaterThanOrEqual(1); expect(n).toBeLessThanOrEqual(5) }
    expect(html).toContain(echapper('Tout part du bouton orange'))
  })
})

describe('balisage FAQPage', () => {
  it('déclare autant de questions que la page en affiche', () => {
    const donnees = jsonLdFaq('fr')
    expect(donnees['@type']).toBe('FAQPage')
    expect(donnees.mainEntity).toHaveLength(getFaqBasics('fr').length)
  })

  it('chaque question balisée est VISIBLE dans le corps', () => {
    // La règle de Google : le balisage doit décrire du contenu présent sur la
    // page. Un balisage plus riche que la page est une fausse déclaration.
    const html = corpsFaq('fr')
    for (const q of jsonLdFaq('fr').mainEntity) {
      expect(html).toContain(echapper(q.name))
    }
  })
})

describe('échappement', () => {
  it('neutralise ce qui casserait le HTML', () => {
    // 9 noms de recettes contiennent déjà `&`, `"` ou `<`. Le jour où un texte
    // de FAQ en contient, il doit s'afficher, pas ouvrir une balise.
    expect(echapper('Fromage & <b>pain</b> "frais"'))
      .toBe('Fromage &amp; &lt;b&gt;pain&lt;/b&gt; &quot;frais&quot;')
  })

  it('rend une chaîne même sur une valeur absente', () => {
    expect(echapper(undefined)).toBe('')
    expect(echapper(null)).toBe('')
  })
})

describe('périmètre des pages traitées', () => {
  it('ne couvre QUE les pages dont le contenu est dans le bundle', () => {
    // `/community` en est volontairement absente : son feed vient de la base,
    // et servir une coquille avec un contenu figé serait pire que rien.
    //
    // `/suppression-compte` s'y est ajoutée le 2026-09-12 : Google Play exige
    // une URL publique de suppression de compte, et rien ne garantit que son
    // relecteur — ni le robot qui l'a précédé — exécute le JavaScript. Une page
    // blanche y vaudrait une absence de page, donc un refus de publication.
    //
    // Inscrire un chemin ici sans écrire son générateur ferait échouer le
    // build : c'est le bon sens de l'erreur.
    expect(Object.keys(CORPS_PAR_CHEMIN).sort()).toEqual(['/changelog', '/faq', '/guide', '/legal', '/suppression-compte'])
    for (const gen of Object.values(CORPS_PAR_CHEMIN)) {
      expect(typeof gen.corps).toBe('function')
    }
  })
})

describe('/legal — le corps servi', () => {
  const html = corpsLegal('fr')

  it('rend les trois sections publiques, avec leur contenu', () => {
    for (const cle of ['legal', 'terms', 'privacy']) {
      expect(html).toContain(`<section id="${cle}">`)
    }
    // Une phrase du CORPS, jamais un titre : le titre était déjà servi avant.
    expect(html).toContain('Éditeur')
    expect(html).toContain(echapper(getLegalSection('fr', 'legal').intro))
  })

  it('n’expose PAS les CGV tant que le premium est en pause', () => {
    // Leurs mentions de tarif, de rétractation et de remboursement décrivent un
    // paiement qui n'existe pas encore. `legal-page.jsx` les masque déjà pour
    // cette raison : le HTML servi ne doit pas dire l'inverse de la page.
    expect(html).not.toContain('<section id="cgv">')
  })

  it('n’a pas de saut de niveau de titre', () => {
    // Les sections de `legal-content.js` commencent par un `h3` : sans le `h2`
    // de section, le plan de la page passerait de h1 à h3.
    expect(html).toMatch(/<h1>[^<]+<\/h1><section id="legal"><h2>/)
  })

  it('la FAQ n’y est plus — elle a sa propre URL', () => {
    expect(html).not.toContain('Le service est-il gratuit')
  })
})

describe('/changelog — le corps servi', () => {
  const html = corpsChangelog('fr')

  it('rend TOUTES les versions, pas seulement les récentes', () => {
    // Servir une page tronquée pendant que le rendu JS en affiche une complète
    // recréerait l'écart qu'on vient de supprimer.
    expect((html.match(/<article>/g) ?? []).length).toBe(CHANGELOG.length)
  })

  it('rend le TEXTE des changements, pas seulement les numéros de version', () => {
    const premier = CHANGELOG[0]
    const label = premier.changes[0].label
    expect(html).toContain(echapper(typeof label === 'string' ? label : label.fr))
  })

  it('utilise le nom de release traduit, pas le champ brut', () => {
    // ⚠️ Les titres de release SE TRADUISENT (`RELEASE_NAMES_EN`). Lire
    // `entry.name` servirait un nom qui ne correspond pas à la page anglaise.
    const en = corpsChangelog('en')
    const attendu = pickReleaseName(CHANGELOG[0], 'en')
    expect(en).toContain(echapper(attendu))
  })
})

describe('bloc de fin — la suite proposée est SERVIE, pas seulement rendue', () => {
  // 🔴 Le piège que ce bloc de tests ferme : ajouter un appel à l'action dans
  // le composant sans l'ajouter au générateur. La page rendue proposerait une
  // suite, le fichier servi non — exactement l'écart qu'on a passé deux PR à
  // supprimer. Et les liens ci-dessous SONT le maillage interne que suit un
  // robot qui n'exécute pas JavaScript.

  it('/faq propose d’ouvrir l’app et renvoie vers /guide', () => {
    const html = corpsFaq('fr')
    const t = getContentCta('fr')
    expect(html).toContain(echapper(t.title))
    expect(html).toContain('<a href="/">')
    expect(html).toContain('<a href="/guide">')
  })

  it('/guide renvoie vers /faq — le lien qui manquait', () => {
    // Le maillage était à sens unique : /faq pointait vers /guide, jamais
    // l'inverse. Une page qui ne renvoie vers rien est un cul-de-sac.
    const html = corpsGuide('fr')
    expect(html).toContain('<a href="/faq">')
    expect(html).toContain('<a href="/">')
  })

  it('annonce ce qui attend le visiteur, pas seulement un bouton', () => {
    // « Gratuit, sans compte » lève les deux objections les plus probables
    // avant qu'elles soient formulées — et c'est vrai : le frigo, les recettes
    // et le micro fonctionnent sans compte.
    expect(corpsFaq('fr')).toContain(echapper(getContentCta('fr').note))
  })

  it('lit le dictionnaire partagé, jamais une copie', () => {
    // Si quelqu'un recopiait les libellés ici, ce test resterait vert mais la
    // page et le fichier servi pourraient diverger. On compare donc au
    // dictionnaire, qui est aussi la source du composant.
    const en = corpsFaq('en')
    expect(en).toContain(echapper(getContentCta('en').action))
    expect(en).not.toContain(echapper(getContentCta('fr').action))
  })
})
