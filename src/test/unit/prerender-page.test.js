import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  construirePage,
  construirePageStatique,
  corpsRecette,
  jsonLdRecette,
  TYPE_TO_CATEGORY_PRERENDU,
  temoinsManquants,
  idValide,
  echapper,
  remplacerMeta,
  PAGES_STATIQUES,
} from '../../../scripts/lib/prerender-page.mjs'
import { ROUTES } from '@routes/routes-config'
import { TOUR_STEPS_I18N } from '@features/onboarding/i18n/tour-steps-i18n'

// Ces tests appellent la VRAIE fonction et lisent le VRAI HTML produit — ils ne
// relisent pas le source du script. La distinction n'est pas cosmétique : le
// 2026-08-14, un garde-fou du même projet qui cherchait un motif dans du texte
// brut laissait passer un appel simplement commenté.
//
// Le gabarit ci-dessous reprend la forme d'`index.html` (attributs ALIGNÉS par
// des espaces multiples, comme dans le vrai fichier) : un test sur un gabarit
// « propre » validerait une regex incapable de traiter le fichier réel.
const GABARIT = `<!doctype html>
<html lang="fr">
  <head>
    <title>Fridge+ — Gérez votre frigo</title>
    <meta name="description" content="Description générique du site." />
    <meta property="og:type"              content="website" />
    <meta property="og:title"             content="Fridge+ — Gérez votre frigo" />
    <meta property="og:description"       content="Description générique du site." />
    <meta property="og:image"             content="https://fridgeplus.app/og-image.png" />
    <meta property="og:image:width"       content="1200" />
    <meta property="og:image:height"      content="630" />
    <meta property="og:image:alt"         content="Fridge+" />
    <meta name="twitter:title"       content="Fridge+ — Gérez votre frigo" />
    <meta name="twitter:description" content="Description générique du site." />
    <meta name="twitter:image"       content="https://fridgeplus.app/og-image.png" />
  </head>
  <body><div id="root"></div></body>
</html>`

const AVEC_PHOTO = {
  id: 'boeuf-bourguignon',
  nom: 'Bœuf bourguignon',
  description: 'Bœuf braisé au vin rouge de Bourgogne.',
  image: 'https://exemple.supabase.co/storage/v1/object/public/recipe-photos/boeuf.webp',
}
const SANS_PHOTO = { id: 'affogato', nom: 'Affogato', description: 'Glace vanille et espresso.', image: null }

function contenuDe(html, cle) {
  const m = html.match(new RegExp(`<meta\\s+(?:name|property)="${cle}"\\s+content="([^"]*)"`))
  return m?.[1] ?? null
}

describe('pré-rendu — métadonnées de partage', () => {
  it('remplace titre, description et image par ceux de la recette', () => {
    const html = construirePage(GABARIT, AVEC_PHOTO)
    expect(html).toContain('<title>Bœuf bourguignon — Fridge+</title>')
    expect(contenuDe(html, 'og:title')).toBe('Bœuf bourguignon — Fridge+')
    expect(contenuDe(html, 'og:description')).toBe('Bœuf braisé au vin rouge de Bourgogne.')
    expect(contenuDe(html, 'og:image')).toBe(AVEC_PHOTO.image)
    expect(contenuDe(html, 'twitter:image')).toBe(AVEC_PHOTO.image)
    expect(contenuDe(html, 'description')).toBe('Bœuf braisé au vin rouge de Bourgogne.')
  })

  it('ne laisse AUCUNE métadonnée générique du site', () => {
    // Le défaut d'origine : une page recette qui parle au nom de l'accueil.
    const html = construirePage(GABARIT, AVEC_PHOTO)
    expect(html).not.toContain('Description générique du site.')
    expect(html).not.toContain('Gérez votre frigo')
  })

  it("déclare sa propre URL en canonical ET og:url", () => {
    const html = construirePage(GABARIT, AVEC_PHOTO)
    const url = 'https://fridgeplus.app/recipe/boeuf-bourguignon'
    expect(html).toContain(`<link rel="canonical" href="${url}" />`)
    expect(contenuDe(html, 'og:url')).toBe(url)
    // …et à l'intérieur du <head>, sinon les crawlers les ignorent.
    expect(html.indexOf('rel="canonical"')).toBeLessThan(html.indexOf('</head>'))
  })

  it("passe og:type de website à article", () => {
    expect(contenuDe(construirePage(GABARIT, AVEC_PHOTO), 'og:type')).toBe('article')
  })
})

describe('pré-rendu — les dimensions suivent la SOURCE de l’image', () => {
  // Piège discret : `index.html` annonce 1200×630 (l'og-image du site) alors que
  // les photos de recette font 1024×1024. Laisser les dimensions du gabarit
  // ferait décrire un carré comme un panoramique, et certains crawlers
  // recadrent d'après ces valeurs.
  it('photo de recette → 1024×1024', () => {
    const html = construirePage(GABARIT, AVEC_PHOTO)
    expect(contenuDe(html, 'og:image:width')).toBe('1024')
    expect(contenuDe(html, 'og:image:height')).toBe('1024')
  })

  it("pas de photo → image du site et 1200×630 CONSERVÉS", () => {
    const html = construirePage(GABARIT, SANS_PHOTO)
    expect(contenuDe(html, 'og:image')).toBe('https://fridgeplus.app/og-image.png')
    expect(contenuDe(html, 'og:image:width')).toBe('1200')
    expect(contenuDe(html, 'og:image:height')).toBe('630')
  })

  // Catalogue MIXTE depuis la décision du 2026-08-26 : les nouvelles photos
  // sont générées en 1536×1024, les 104 anciennes restent carrées. Le
  // manifeste porte donc les dimensions RÉELLES de chaque image (mesurées par
  // `npm run prerender:data`) — et les balises les suivent. Sans dimensions
  // dans l'entrée (manifeste pas encore régénéré, sonde en échec) : repli sur
  // le carré historique, jamais sur un mensonge.
  it('photo avec dimensions déclarées → les balises les REPRENNENT (1536×1024)', () => {
    const html = construirePage(GABARIT, { ...AVEC_PHOTO, largeur: 1536, hauteur: 1024 })
    expect(contenuDe(html, 'og:image:width')).toBe('1536')
    expect(contenuDe(html, 'og:image:height')).toBe('1024')
  })

  it('dimensions incomplètes (largeur seule) → repli carré, pas un couple bancal', () => {
    const html = construirePage(GABARIT, { ...AVEC_PHOTO, largeur: 1536 })
    expect(contenuDe(html, 'og:image:width')).toBe('1024')
    expect(contenuDe(html, 'og:image:height')).toBe('1024')
  })

  it("le <img> du corps servi suit les MÊMES dimensions que les balises og", () => {
    const large = corpsRecette({ ...AVEC_PHOTO, largeur: 1536, hauteur: 1024 })
    expect(large).toContain('width="1536"')
    expect(large).toContain('height="1024"')
    const carre = corpsRecette(AVEC_PHOTO)
    expect(carre).toContain('width="1024"')
    expect(carre).toContain('height="1024"')
  })

  it('sans description, produit un texte de repli mentionnant la recette', () => {
    const html = construirePage(GABARIT, { ...SANS_PHOTO, description: null })
    expect(contenuDe(html, 'og:description')).toContain('Affogato')
  })
})

describe('pré-rendu — échappement HTML', () => {
  it("échappe les noms contenant & < > \"", () => {
    // Non théorique : 9 recettes en base ont un `&` dans leur nom.
    const html = construirePage(GABARIT, {
      id: 'mujaddara', nom: 'Riz & lentilles <"maison">', description: 'A & B', image: null,
    })
    expect(html).toContain('<title>Riz &amp; lentilles &lt;&quot;maison&quot;&gt; — Fridge+</title>')
    expect(contenuDe(html, 'og:title')).toBe('Riz &amp; lentilles &lt;&quot;maison&quot;&gt; — Fridge+')
    // L'attribut ne doit pas être refermé prématurément : une seule balise title.
    expect(html.match(/<title>/g)).toHaveLength(1)
  })

  it('echapper() traite les quatre caractères dangereux', () => {
    expect(echapper('a&b<c>d"e')).toBe('a&amp;b&lt;c&gt;d&quot;e')
  })
})

describe('pré-rendu — les garde-fous mordent', () => {
  it('remplacerMeta rend null quand la balise est absente', () => {
    expect(remplacerMeta(GABARIT, 'property', 'og:inexistante', 'x')).toBeNull()
  })

  it('construirePage LÈVE si une balise attendue manque du gabarit', () => {
    // Sans cela, un `index.html` remanié produirait 515 pages génériques —
    // le défaut d'origine, mais en croyant l'avoir corrigé.
    const ampute = GABARIT.replace(/<meta property="og:image"[^>]*\/>/, '')
    expect(() => construirePage(ampute, AVEC_PHOTO)).toThrow(/og:image/)
  })

  it('temoinsManquants repère un gabarit amputé, et valide le gabarit complet', () => {
    expect(temoinsManquants(GABARIT)).toEqual([])
    expect(temoinsManquants(GABARIT.replace(/<title>[\s\S]*?<\/title>/, ''))).toHaveLength(1)
  })

  it("refuse tout id qui n'est pas un slug — un id devient un CHEMIN de fichier", () => {
    expect(idValide('boeuf-bourguignon')).toBe(true)
    expect(idValide('../../etc/passwd')).toBe(false)
    expect(idValide('Salade César')).toBe(false)
    expect(idValide('a/b')).toBe(false)
    expect(idValide('')).toBe(false)
    expect(idValide(null)).toBe(false)
  })
})

describe('pré-rendu — pages statiques', () => {
  // Le défaut mesuré en production le 2026-08-16 : `/legal`, `/changelog` et
  // `/community` servaient toutes le titre générique de l'accueil dans leur
  // HTML. Trois URL indexables se présentant comme la même page.

  it('chaque page statique porte SON titre, SA description et SON canonical', () => {
    for (const page of PAGES_STATIQUES) {
      const html = construirePageStatique(GABARIT, page)
      expect(html).toContain(`<title>${page.titre}</title>`)
      expect(contenuDe(html, 'og:title')).toBe(page.titre)
      expect(contenuDe(html, 'description')).toBe(page.description)
      expect(contenuDe(html, 'twitter:description')).toBe(page.description)
      expect(html).toContain(`<link rel="canonical" href="https://fridgeplus.app${page.chemin}" />`)
      expect(contenuDe(html, 'og:url')).toBe(`https://fridgeplus.app${page.chemin}`)
    }
  })

  it('deux pages statiques ne partagent jamais le même titre', () => {
    // C'est EXACTEMENT le défaut corrigé : des pages distinctes qui se
    // présentent identiquement. Un titre recopié le reproduirait sans bruit.
    const titres = PAGES_STATIQUES.map(p => p.titre)
    expect(new Set(titres).size).toBe(titres.length)
    const descriptions = PAGES_STATIQUES.map(p => p.description)
    expect(new Set(descriptions).size).toBe(descriptions.length)
  })

  it('garde `website` comme og:type — `article` est réservé aux recettes', () => {
    const html = construirePageStatique(GABARIT, PAGES_STATIQUES[0])
    expect(contenuDe(html, 'og:type')).toBe('website')
    expect(contenuDe(construirePage(GABARIT, SANS_PHOTO), 'og:type')).toBe('article')
  })

  it('AUCUNE page statique ne correspond à une route gardée', () => {
    // 🔴 Le garde-fou qui compte. Pré-rendre `/cart` ou `/profile` déposerait
    // dans `dist/` une coquille HTML publique pour un écran dont l'accès est
    // censé dépendre d'une session. Le fichier ne fuiterait aucune donnée — le
    // contenu vient toujours de la BDD sous RLS — mais il annoncerait l'écran
    // à l'indexation, et le sitemap le déclarerait.
    //
    // Ce test attrape l'ajout distrait d'un chemin à `PAGES_STATIQUES`, ET le
    // jour où une route aujourd'hui publique se voit poser un Guard.
    const gardees = new Set(ROUTES.filter(r => r.Guard).map(r => r.path))
    const fautives = PAGES_STATIQUES.filter(p => gardees.has(p.chemin))
    expect(fautives.map(p => p.chemin)).toEqual([])
  })

  it('chaque page statique correspond à une route RÉELLE et sans paramètre', () => {
    // Pré-rendre un chemin qui n'est pas une route produirait un fichier servi
    // à la place du fallback SPA : l'utilisateur verrait une page blanche.
    const cheminsConnus = new Set(ROUTES.map(r => r.path))
    const inconnues = PAGES_STATIQUES.filter(p => !cheminsConnus.has(p.chemin))
    expect(inconnues.map(p => p.chemin)).toEqual([])
    const parametrees = PAGES_STATIQUES.filter(p => p.chemin.includes(':') || p.chemin.includes('*'))
    expect(parametrees).toEqual([])
  })
})

describe('pré-rendu — le gabarit RÉEL est compatible', () => {
  // Les tests ci-dessus valident la logique sur un gabarit de laboratoire.
  // Celui-ci vérifie que le vrai `index.html` a toujours la forme attendue :
  // c'est lui qui préviendra le jour où quelqu'un renommera une balise.
  it('index.html contient toutes les balises que le pré-rendu doit remplacer', () => {
    const reel = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    expect(temoinsManquants(reel)).toEqual([])
  })

  it("index.html n'a ni canonical ni og:url — le pré-rendu les AJOUTE", () => {
    // Cohérence avec `seo-pas-de-canonical-transversal.test.js` : ces balises
    // sont interdites dans le gabarit commun (elles y désigneraient l'accueil
    // pour les 515 recettes) et obligatoires dans chaque page pré-rendue.
    const sansCommentaires = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '')
    expect(sansCommentaires).not.toMatch(/rel=["']canonical["']/i)
    expect(sansCommentaires).not.toMatch(/property=["']og:url["']/i)
  })
})

describe('corps des pages recette — 515 fichiers qui ne servaient qu’un titre', () => {
  // Même défaut que les pages statiques, à une autre échelle : le fichier
  // portait le bon titre et pas une ligne de contenu. Googlebot exécute le JS
  // et voyait tout ; GPTBot, ClaudeBot et PerplexityBot lisent le HTML brut.
  //
  // ⚠️ Volontairement limité à ce que le manifeste porte DÉJÀ : nom,
  // description, image. Mesuré en base le 2026-08-20, y ajouter ingrédients et
  // étapes coûterait ~500 Ko versionnés, régénérés en bloc à chaque ajout de
  // recette. Cette question se tranchera séparément.

  it('rend le nom en titre et la description en paragraphe', () => {
    const html = corpsRecette({ nom: 'Affogato', description: 'Une boule de glace sous un espresso.', image: null })
    expect(html).toContain('<h1>Affogato</h1>')
    expect(html).toContain('<p>Une boule de glace sous un espresso.</p>')
  })

  it('n’émet PAS de paragraphe vide quand la description manque', () => {
    // Servi sur 515 pages, un `<p></p>` est pire que pas d'élément du tout.
    const html = corpsRecette({ nom: 'Sans description', description: null, image: null })
    expect(html).not.toContain('<p>')
    expect(html).toContain('<h1>Sans description</h1>')
  })

  it('n’émet PAS d’image quand la recette n’en a pas', () => {
    // 411 recettes sur 515 n'ont pas encore de photo : une balise `img` vide
    // produirait 411 requêtes mortes.
    expect(corpsRecette({ nom: 'X', description: 'y', image: null })).not.toContain('<img')
  })

  it('décrit l’image par le nom du plat', () => {
    const html = corpsRecette({ nom: 'Tarte Tatin', description: 'z', image: 'https://exemple/tatin.webp' })
    expect(html).toContain('alt="Tarte Tatin"')
    expect(html).toContain('src="https://exemple/tatin.webp"')
  })

  it('échappe ce qui casserait le HTML', () => {
    // 9 noms de recettes contiennent déjà `&`, `"` ou `<`.
    const html = corpsRecette({ nom: 'Pain & "beurre"', description: '<b>gras</b>', image: null })
    expect(html).toContain('<h1>Pain &amp; &quot;beurre&quot;</h1>')
    expect(html).toContain('&lt;b&gt;gras&lt;/b&gt;')
  })

  it('couvre CHAQUE recette du manifeste, sans exception', () => {
    // Le contrôle qui compte : on boucle sur les vraies données livrées, pas
    // sur un exemple choisi. Une recette dont le corps sortirait vide serait
    // une page servie muette, et rien d'autre ne le signalerait.
    const manifeste = JSON.parse(readFileSync(resolve(process.cwd(), 'scripts/data/prerender-manifest.json'), 'utf8'))
    expect(manifeste.recettes.length).toBeGreaterThan(100)
    const muettes = manifeste.recettes.filter(r => !corpsRecette(r).includes(`<h1>`))
    expect(muettes.map(r => r.id)).toEqual([])
    // Et celles qui ont une description doivent la servir.
    const avecDescription = manifeste.recettes.filter(r => r.description)
    const perdues = avecDescription.filter(r => !corpsRecette(r).includes('<p>'))
    expect(perdues.map(r => r.id)).toEqual([])
  })
})

describe('balisage Recipe servi — le seul que Google utilise encore', () => {
  // `FAQPage` a perdu son résultat enrichi en mai 2026. `Recipe`, lui, est bien
  // vivant : c'est lui qui fait apparaître une recette avec sa photo dans les
  // résultats. Il n'était posé qu'au montage — donc invisible pour les moteurs
  // qui n'exécutent pas JavaScript, et vu par Googlebot seulement après passage
  // en file de rendu.

  const AVEC_PHOTO = {
    id: 'affogato',
    nom: 'Affogato',
    description: 'Une boule de glace sous un espresso.',
    image: 'https://exemple/affogato.webp',
  }

  it('produit un balisage Recipe complet quand la recette a une photo', () => {
    const b = jsonLdRecette(AVEC_PHOTO)
    expect(b['@type']).toBe('Recipe')
    expect(b['@context']).toBe('https://schema.org')
    // 🔴 Les DEUX propriétés que Google exige pour le résultat enrichi.
    expect(b.name).toBe('Affogato')
    expect(b.image).toBe('https://exemple/affogato.webp')
  })

  it('déclare l’URL canonique de la recette', () => {
    expect(jsonLdRecette(AVEC_PHOTO).url).toBe('https://fridgeplus.app/recipe/affogato')
  })

  it('ne produit RIEN sans photo — le balisage serait inéligible', () => {
    // 411 recettes sur 515 n'ont pas encore de photo. Un balisage sans `image`
    // ne peut pas aboutir à un résultat enrichi : servi sur 411 pages, il ne
    // ferait que du bruit dans la Search Console.
    expect(jsonLdRecette({ ...AVEC_PHOTO, image: null })).toBeNull()
    expect(jsonLdRecette({ ...AVEC_PHOTO, image: '' })).toBeNull()
  })

  it('ne produit RIEN sans nom', () => {
    expect(jsonLdRecette({ ...AVEC_PHOTO, nom: '' })).toBeNull()
  })

  it('omet la description plutôt que de la déclarer vide', () => {
    const b = jsonLdRecette({ ...AVEC_PHOTO, description: null })
    expect('description' in b).toBe(false)
  })

  it('couvre EXACTEMENT les recettes du manifeste qui ont une photo', () => {
    // Le contrôle qui compte : on boucle sur les vraies données livrées. Une
    // divergence entre « a une photo » et « a un balisage » serait invisible
    // autrement.
    const manifeste = JSON.parse(readFileSync(resolve(process.cwd(), 'scripts/data/prerender-manifest.json'), 'utf8'))
    const avecPhoto = manifeste.recettes.filter(r => r.image)
    const balises = manifeste.recettes.filter(r => jsonLdRecette(r) !== null)
    expect(balises.length).toBe(avecPhoto.length)
    expect(balises.length).toBeGreaterThan(0)
    // Et chaque balisage produit porte bien les deux propriétés requises.
    for (const r of balises.slice(0, 20)) {
      const b = jsonLdRecette(r)
      expect(b.name, r.id).toBeTruthy()
      expect(b.image, r.id).toBeTruthy()
    }
  })

  it('utilise l’identifiant que cherche le composant client', () => {
    // 🔑 `RecipeJsonLd` monte `<JsonLd id="recipe-jsonld">` : il retrouve le
    // nœud servi par son identifiant et le REMPLACE par sa version complète.
    // Un identifiant différent produirait deux balisages Recipe sur la page.
    const script = readFileSync(resolve(process.cwd(), 'scripts/prerender.mjs'), 'utf8')
    const sansCommentaires = script.replace(/^\s*\/\/.*$/gm, '')
    expect(sansCommentaires).toContain('id="recipe-jsonld"')
  })
})

// ── Le balisage Recipe SERVI porte enfin ce que Google AFFICHE ─────────────
//
// Mesuré le 2026-09-12 sur la production : le balisage servi ne déclarait que
// `name`, `image`, `description`, `url`, `author`, `inLanguage`. Google n'exige
// que `name` + `image` pour l'éligibilité, mais ce qu'il AFFICHE dans le
// résultat enrichi — la durée surtout — vient des propriétés recommandées.
// Elles existaient déjà côté client (`recipe-to-schema-org.js`, injecté au
// montage) : encore une garantie présente à UN endroit et perdue par sa copie.
// Les crawlers qui n'exécutent pas JavaScript — la plupart des robots d'IA —
// ne voyaient donc que le socle.
//
// ⚠️ Périmètre volontaire : seulement les champs COURTS. Les ingrédients et les
// étapes dans le manifeste versionné coûtent ~500 Ko (mesure ci-dessus, ligne
// « Volontairement limité ») et restent une décision séparée.
describe('pré-rendu — balisage Recipe enrichi', () => {
  const RICHE = {
    id: 'carbonara',
    nom: 'Pasta Carbonara',
    description: 'Spaghetti, œufs, parmesan.',
    image: 'https://exemple/carbonara.webp',
    dureeTotaleMin: 25,
    preparationMin: 10,
    cuissonMin: 15,
    portions: 4,
    categorie: 'plat',
    cuisine: 'Italienne',
  }

  it('convertit les minutes en durées ISO 8601, les trois', () => {
    const b = jsonLdRecette(RICHE)
    expect(b.totalTime).toBe('PT25M')
    expect(b.prepTime).toBe('PT10M')
    expect(b.cookTime).toBe('PT15M')
  })

  it('passe l’heure en H et M, pas en minutes cumulées', () => {
    const b = jsonLdRecette({ ...RICHE, dureeTotaleMin: 90, preparationMin: 60 })
    expect(b.totalTime).toBe('PT1H30M')
    expect(b.prepTime).toBe('PT1H')
  })

  it('déclare les portions, la catégorie traduite et la cuisine', () => {
    const b = jsonLdRecette(RICHE)
    expect(b.recipeYield).toBe('4 portions')
    expect(b.recipeCategory).toBe('Main Course')
    expect(b.recipeCuisine).toBe('Italienne')
  })

  it('n’invente RIEN : une recette sans durée ni portion n’émet pas ces clés', () => {
    const b = jsonLdRecette({ id: 'x', nom: 'X', image: 'https://exemple/x.webp' })
    for (const cle of ['totalTime', 'prepTime', 'cookTime', 'recipeYield', 'recipeCategory', 'recipeCuisine']) {
      expect(b).not.toHaveProperty(cle)
    }
  })

  it('garde le socle : sans image, pas de balisage du tout', () => {
    expect(jsonLdRecette({ ...RICHE, image: null })).toBeNull()
  })
})

describe('pré-rendu — la table des catégories ne diverge pas de celle du client', () => {
  // 🥇 Classe de défaut dominante de ce dépôt : une garantie qui existe à un
  // endroit et que sa copie a perdue. Ici, DEUX tables type → catégorie
  // Schema.org coexistent (client et pré-rendu). Ce test les compare.
  it('mêmes clés, mêmes valeurs que `recipe-to-schema-org.js`', () => {
    // `readFileSync` + `resolve` comme le reste du fichier : sous vitest, la
    // base d'`import.meta.url` n'est pas un chemin de fichier.
    const source = readFileSync(
      resolve(__dirname, '../../features/recipes/lib/recipe-to-schema-org.js'),
      'utf8',
    )
    const bloc = source.match(/const TYPE_TO_CATEGORY = \{([\s\S]*?)^\}/m)
    expect(bloc, 'TYPE_TO_CATEGORY introuvable côté client').not.toBeNull()
    const duClient = Object.fromEntries(
      [...bloc[1].matchAll(/^\s*'?([^':\r\n]+?)'?:\s*'([^']+)'/gm)].map(m => [m[1], m[2]]),
    )
    expect(TYPE_TO_CATEGORY_PRERENDU).toEqual(duClient)
  })
})

describe('pré-rendu — aucune description servie ne ment sur le nombre d’étapes du guide', () => {
  // 🔴 Récidive exacte de la classe de défaut dominante du dépôt : une garantie
  // qui existe à UN endroit et que sa COPIE a perdue.
  //
  // Le 2026-09-11 la visite est passée de quatre à cinq étapes. `public/llms.txt`
  // a été corrigé le 12/09 et protégé par un cliquet
  // (`llms-txt-coherence.test.js`). Mais la description servie de `/guide` —
  // celle que Google affiche SOUS le titre dans un résultat de recherche —
  // annonçait toujours « Fridge+ en quatre étapes ». Le cliquet ne visitait que
  // son propre fichier.
  //
  // Ce test-ci vaut pour TOUTES les descriptions servies, pas seulement celle du
  // guide : si une autre se met un jour à compter les étapes, elle est couverte.
  const NOMBRES = { 1: 'une', 2: 'deux', 3: 'trois', 4: 'quatre', 5: 'cinq', 6: 'six', 7: 'sept', 8: 'huit' }

  it('la description de chaque page statique compte juste', () => {
    // La visite guidée = les étapes numérotées + l'étape finale, exactement le
    // calcul de `llms-txt-coherence.test.js`. On ne recopie pas un nombre : on
    // le DÉRIVE de la source, sinon ce cliquet deviendrait la prochaine copie
    // à diverger.
    const reel = Object.keys(TOUR_STEPS_I18N.fr).filter(c => !c.startsWith('final')).length + 1
    const attendu = NOMBRES[reel]
    expect(attendu, `Aucun mot pour ${reel} étapes — étendre la table NOMBRES.`).toBeTruthy()

    const menteuses = []
    for (const page of PAGES_STATIQUES) {
      const m = page.description.match(/\b(une|deux|trois|quatre|cinq|six|sept|huit)\s+étapes?\b/i)
      if (!m) continue
      if (m[1].toLowerCase() !== attendu) {
        menteuses.push(`${page.chemin} annonce « ${m[1]} étapes » alors que le guide en compte ${reel}`)
      }
    }
    expect(
      menteuses,
      'Une description SERVIE contredit le nombre réel d’étapes du guide. C’est le texte ' +
      'que Google affiche sous le titre : il ment à tous ceux qui n’ont pas encore ouvert l’app.',
    ).toEqual([])
  })
})
