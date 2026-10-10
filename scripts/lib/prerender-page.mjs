/**
 * Logique PURE du pré-rendu : gabarit + métadonnées d'une recette → HTML.
 *
 * Séparée de `scripts/prerender.mjs` (qui ne fait que des entrées/sorties) pour
 * une raison précise : un garde-fou qui se contente de relire le SOURCE du
 * script est faible — on l'a payé le 2026-08-14 avec le cliquet du plafond
 * budgétaire, qui attrapait un appel supprimé mais pas un appel commenté.
 * Ici, les tests appellent la vraie fonction et lisent le vrai HTML produit.
 */

// Module sans import : lu tel quel par Node au build, et par l'app.
import { getIngredientItemsFlat, ligneIngredient } from '../../src/shared/lib/recipes/recipe-ingredients.js'
import { categorieSchemaOrg, cuisineSchemaOrg } from '../../src/shared/lib/recipes/balisage-recette.js'

export const SITE = 'https://fridgeplus.app'

// Dimensions déclarées dans `index.html` pour l'image de partage par défaut.
// Certains crawlers recadrent d'après ces valeurs : annoncer un format qui
// n'est pas celui du fichier est un mensonge actif, pas une approximation.
export const OG_DEFAUT = { largeur: '1200', hauteur: '630' }
// Repli pour une photo de recette SANS dimensions connues : le carré
// historique du bucket `recipe-photos` (les 104 photos d'avant 2026-08-26).
export const OG_PHOTO_RECETTE = { largeur: '1024', hauteur: '1024' }

/**
 * Les dimensions à déclarer pour une entrée du manifeste.
 *
 * Catalogue MIXTE depuis la décision du 2026-08-26 (lot 2, la feuille de route interne) :
 * les nouvelles photos sont générées en 1536×1024, les anciennes restent en
 * 1024×1024. `npm run prerender:data` mesure donc les dimensions RÉELLES de
 * chaque image et les écrit dans le manifeste — cette fonction les reprend.
 *
 * Un couple INCOMPLET (largeur sans hauteur, sonde en échec) retombe sur le
 * carré : mieux vaut un repli honnête qu'une paire bancale.
 */
export function dimsImageRecette({ image, largeur, hauteur }) {
  if (!image) return OG_DEFAUT
  if (largeur && hauteur) return { largeur: String(largeur), hauteur: String(hauteur) }
  return OG_PHOTO_RECETTE
}

// Balises que le gabarit DOIT contenir. Sans ce contrôle, une balise renommée
// dans `index.html` ferait produire 515 pages aux métadonnées génériques —
// le défaut qu'on corrige, mais en croyant l'avoir corrigé.
export const TEMOINS = [
  /<title>[\s\S]*?<\/title>/,
  /<meta\s+name="description"\s+content="[^"]*"/,
  /<meta\s+property="og:title"\s+content="[^"]*"/,
  /<meta\s+property="og:description"\s+content="[^"]*"/,
  /<meta\s+property="og:image"\s+content="[^"]*"/,
  /<meta\s+name="twitter:title"\s+content="[^"]*"/,
]

/** Renvoie la liste des témoins absents du gabarit (vide = gabarit conforme). */
export function temoinsManquants(gabarit) {
  return TEMOINS.filter(re => !re.test(gabarit))
}

/**
 * Un `id` sert de chemin de fichier : tout ce qui n'est pas un slug est refusé,
 * jamais assaini. Les 515 ids actuels sont des slugs — ce contrôle protège des
 * futures recettes, pas des actuelles.
 */
export function idValide(id) {
  return typeof id === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(id)
}

/**
 * Un attribut HTML n'est pas du texte : 9 noms de recettes contiennent déjà
 * `&`, `"` ou `<` (mesuré le 2026-08-15). Sans échappement ils casseraient la
 * balise — d'autant plus silencieusement que la page continue de s'afficher.
 */
export function echapper(texte) {
  return String(texte)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Remplace le contenu d'une `<meta>` déjà présente.
 * Renvoie `null` si la balise est introuvable — l'appelant doit échouer plutôt
 * que de laisser passer une substitution muette.
 */
export function remplacerMeta(html, attribut, cle, valeur) {
  const re = new RegExp(`(<meta\\s+${attribut}="${cle}"\\s+content=")[^"]*(")`)
  if (!re.test(html)) return null
  // Une FONCTION, pas une chaîne : dans une chaîne de remplacement, `$&`, `$'`
  // ou `$1` venus des données sont lus comme des motifs — une description
  // « à 5 $' » recopiait tout le reste du document dans l'attribut.
  return html.replace(re, (_tout, debut, fin) => debut + echapper(valeur) + fin)
}

/**
 * Remplace la première occurrence de `cible` par `contenu`, pris TEL QUEL.
 * `String.replace(cible, chaîne)` interprète les `$` de la chaîne même quand la
 * cible est littérale : tout contenu venu des données passe donc par ici.
 */
export function remplacerLitteral(html, cible, contenu) {
  return html.replace(cible, () => contenu)
}

/**
 * Bloc JSON-LD prêt à poser dans le `<head>`.
 *
 * `JSON.stringify` n'échappe pas `<` : un nom « Tarte</script><script src=…> »
 * fermait le bloc et injectait une balise dans la page servie à tous (audit du
 * 2026-10-04, SEC-03). La séquence `\u003c` est du JSON valide : les données
 * se relisent à l'identique.
 */
export function baliseJsonLd(id, donnees) {
  const json = JSON.stringify(donnees).replace(/</g, '\\u003c')
  return `<script type="application/ld+json" id="${echapper(id)}">${json}</scr` + `ipt>`
}

/**
 * Les recettes qui ont une page publique : officielles, publiées, non
 * supprimées. Le manifeste du pré-rendu et le plan du site passent TOUS LES
 * DEUX par ce filtre — ils lisaient `recipes_unified` sans regarder `origin`,
 * si bien qu'une recette communautaire « publiée » y serait entrée avec le nom
 * et la description choisis par son auteur.
 */
export function filtrerRecettesPubliables(requete) {
  return requete
    .is('deleted_at', null)
    .eq('status', 'published')
    .eq('origin', 'official')
}

/**
 * Cœur commun du pré-rendu : applique un jeu de métadonnées au gabarit, puis
 * pose le `canonical` et `og:url` de la page.
 *
 * Lève une `Error` si une balise attendue manque : mieux vaut casser le build
 * que livrer un pré-rendu inerte.
 *
 * ⚠️ Interne. Les deux fonctions publiques ci-dessous (recette / page statique)
 * l'appellent — elles ne se DUPLIQUENT pas. Une seconde copie de ce corps
 * finirait par diverger, et c'est celle qu'on ne relit plus qui se tromperait.
 */
function appliquerMetadonnees(gabarit, { titre, description, urlPage, image, dims, imageAlt, ogType }) {
  let html = gabarit.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${echapper(titre)}</title>`)

  const substitutions = [
    ['name', 'description', description],
    ['property', 'og:title', titre],
    ['property', 'og:description', description],
    ['name', 'twitter:title', titre],
    ['name', 'twitter:description', description],
    // Sans image PROPRE, la page garde celle du gabarit — adresse, dimensions,
    // texte alternatif — au lieu d'en recopier une : la copie avait perdu le
    // `?v=3` qui purge le cache des réseaux, et décrivait l'image « Fridge+ »
    // (audit du 2026-10-04, SEO-13).
    ...(image ? [
      ['property', 'og:image', image],
      ['property', 'og:image:width', dims.largeur],
      ['property', 'og:image:height', dims.hauteur],
      ['property', 'og:image:alt', imageAlt],
      ['name', 'twitter:image', image],
    ] : []),
  ]
  for (const [attribut, cle, valeur] of substitutions) {
    const suivant = remplacerMeta(html, attribut, cle, valeur)
    if (suivant === null) throw new Error(`Balise ${attribut}="${cle}" introuvable dans le gabarit`)
    html = suivant
  }

  html = html.replace(/(<meta\s+property="og:type"\s+content=")[^"]*(")/, `$1${ogType}$2`)

  // `canonical` et `og:url` sont ABSENTS d'`index.html` : retirés le 2026-08-13
  // parce qu'ils y désignaient l'accueil pour les 515 recettes, et un garde-fou
  // interdit leur retour (`seo-pas-de-canonical-transversal.test.js`).
  // Ici c'est l'inverse exact : chaque page déclare SA propre URL, dans le HTML
  // servi, sans divergence avec un rendu JS. C'est ce que Google demande.
  return html.replace(
    /<\/head>/,
    () => `  <link rel="canonical" href="${urlPage}" />\n` +
    `    <meta property="og:url" content="${urlPage}" />\n` +
    '  </head>',
  )
}

/** Construit le HTML d'une page recette. */
export function construirePage(gabarit, { id, nom, description, image, largeur, hauteur }) {
  return appliquerMetadonnees(gabarit, {
    titre: `${nom} — Fridge+`,
    description: description
      || `Découvre la recette « ${nom} » sur Fridge+ : ingrédients, étapes et valeurs nutritionnelles.`,
    urlPage: `${SITE}/recipe/${id}`,
    // Sans photo : l'image du gabarit, intacte (voir `appliquerMetadonnees`).
    image: image || null,
    dims: dimsImageRecette({ image, largeur, hauteur }),
    imageAlt: `${nom} — recette Fridge+`,
    // Une page recette est un contenu, pas le site : `article` décrit mieux
    // qu'un `website` hérité de l'accueil.
    ogType: 'article',
  })
}

/**
 * Construit le HTML d'une page STATIQUE (`/faq`, `/guide`, `/legal`…).
 *
 * Elles gardent l'image de partage du gabarit, intacte : aucune n'a
 * d'illustration propre, et en inventer une par page serait du travail sans
 * lecteur.
 *
 * `og:type` reste `website` : ce sont des pages du site, pas des contenus
 * éditoriaux datés — le distinguo qui justifie `article` pour une recette ne
 * s'applique pas ici.
 */
export function construirePageStatique(gabarit, { chemin, titre, description }) {
  return appliquerMetadonnees(gabarit, {
    titre,
    description,
    urlPage: `${SITE}${chemin}`,
    image: null,
    ogType: 'website',
  })
}

/**
 * Le corps lisible d'une page recette, à partir des SEULES données que le
 * manifeste porte déjà : nom, description, image.
 *
 * ── Pourquoi si peu, et pourquoi c'est le bon choix ───────────────────────
 * Mesuré le 2026-08-20 en base : ajouter ingrédients et étapes au manifeste
 * coûterait ~500 Ko VERSIONNÉS, régénérés en bloc à chaque ajout de recette —
 * un diff qui noierait toute PR touchant au catalogue, pour toujours.
 *
 * Ces trois champs-ci sont déjà dans le manifeste : les servir ne coûte RIEN
 * et fait passer 515 pages de « un titre » à « un titre, une description et
 * une image » pour les robots qui n'exécutent pas JavaScript — les mêmes qui
 * ne voyaient rien des pages statiques avant hier.
 *
 * Le balisage `Recipe` porte désormais ingrédients et étapes (SEO-06,
 * `prerender-contenu.json`). Le CORPS visible, lui, reste à ces trois champs :
 * il s'affiche avant le premier rendu de React, et l'allonger changerait ce que
 * voit chaque visiteur — une décision d'écran, à part.
 */
export function corpsRecette({ nom, description, image, largeur, hauteur }) {
  const morceaux = [`<h1>${echapper(nom)}</h1>`]

  // Une description absente ne doit pas produire un `<p></p>` : servi sur 515
  // pages, un élément vide est pire que pas d'élément du tout.
  if (description) morceaux.push(`<p>${echapper(description)}</p>`)

  // `alt` = le nom du plat : c'est ce qu'un lecteur d'écran doit entendre, et
  // ce qu'un moteur d'images doit lire. Les dimensions suivent les MÊMES
  // règles que les balises og (catalogue mixte, cf. `dimsImageRecette`).
  if (image) {
    const dims = dimsImageRecette({ image, largeur, hauteur })
    morceaux.push(`<img src="${echapper(image)}" alt="${echapper(nom)}" width="${dims.largeur}" height="${dims.hauteur}" />`)
  }

  return morceaux.join('')
}

/**
 * Le balisage `Recipe` d'une page recette, pour le HTML SERVI.
 *
 * ── Pourquoi celui-ci compte plus que `FAQPage` ───────────────────────────
 * Google a retiré le résultat enrichi FAQ en mai 2026. `Recipe`, lui, est bien
 * vivant : c'est ce qui fait apparaître une recette avec sa photo, son temps et
 * ses étapes dans les résultats. Jusqu'ici il n'était posé qu'au montage, par
 * `recipe-jsonld.jsx` — donc invisible pour tout moteur qui n'exécute pas le
 * JavaScript, et vu par Googlebot seulement après passage en file de rendu.
 *
 * ── Pourquoi `image` décide de tout ───────────────────────────────────────
 * 🔴 Google exige DEUX propriétés pour ce résultat enrichi : `name` et
 * `image`. Sans image, le balisage est inéligible — et servi sur les
 * 411 recettes qui n'ont pas encore de photo, il ne produirait que du bruit
 * dans la Search Console. D'où le `null` : mieux vaut pas de balisage qu'un
 * balisage qui ne peut pas aboutir.
 *
 * Ingrédients et étapes : servis depuis le 2026-10-05 (audit, SEO-06), lus dans
 * `prerender-contenu.json` — un fichier À PART, une ligne par recette
 * (~255 Ko). Google les « recommande » pour le résultat enrichi, et c'est la
 * seule façon pour un robot sans JavaScript de lire la recette. La décision
 * « ~500 Ko versionnés » (2026-08-20) est tranchée : le français seul pèse
 * ~210 Ko, et une recette modifiée ne change qu'une ligne du diff. Le composant
 * client pose ensuite sa version, nutrition comprise.
 *
 * 🔑 L'identifiant du script doit rester `recipe-jsonld` — celui que cherche
 * `RecipeJsonLd`. Le composant retrouve alors CE nœud et le remplace par sa
 * version complète au montage, au lieu d'en ajouter un second.
 *
 * Catégorie et cuisine viennent de `balisage-recette.js`, le module que lit
 * aussi le balisage client : il n'existe plus de table jumelle à comparer.
 */

/** Minutes → durée ISO 8601 (`PT1H30M`). `undefined` plutôt que zéro : une clé
 *  absente est honnête, une durée nulle est un mensonge. */
function minutesEnIso(minutes) {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return undefined
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `PT${h}H${m}M`
  if (h > 0) return `PT${h}H`
  return `PT${m}M`
}

export function jsonLdRecette({
  id, nom, description, image,
  dureeTotaleMin, preparationMin, cuissonMin, portions, categorie, cuisine,
  ingredients, etapes,
}) {
  if (!image || !nom) return null
  const totalTime = minutesEnIso(dureeTotaleMin)
  const prepTime = minutesEnIso(preparationMin)
  const cookTime = minutesEnIso(cuissonMin)
  const recipeCategory = categorieSchemaOrg(categorie)
  // Le manifeste ne garde que le NOM du pays, déjà résolu.
  const recipeCuisine = cuisineSchemaOrg({ nom: cuisine })
  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: nom,
    image,
    ...(description && { description }),
    url: `${SITE}/recipe/${id}`,
    // Même auteur que le balisage client pour les recettes officielles.
    author: { '@type': 'Organization', name: 'Fridge+' },
    // ── Les propriétés que Google AFFICHE (la durée surtout) ────────────────
    // Google n'exige que `name` + `image` pour l'éligibilité ; le reste est
    // « recommandé », et c'est pourtant lui qui fabrique le résultat enrichi.
    // Chaque clé n'apparaît que si la donnée existe : un `recipeYield` vide ou
    // une durée à zéro valent moins que rien — ils décrivent faux.
    ...(totalTime && { totalTime }),
    ...(prepTime && { prepTime }),
    ...(cookTime && { cookTime }),
    ...(portions > 0 && { recipeYield: `${portions} portions` }),
    ...(recipeCategory && { recipeCategory }),
    ...(recipeCuisine && { recipeCuisine }),
    // ── Ingrédients et étapes (audit du 2026-10-04, SEO-06) ─────────────────
    // Lus dans `prerender-contenu.json`. Mêmes formes que le balisage client
    // (`recipe-to-schema-org.js`), qui remplace ce nœud au montage.
    ...(ingredients?.length > 0 && { recipeIngredient: ingredients }),
    ...(etapes?.length > 0 && { recipeInstructions: etapes.map((text) => ({ '@type': 'HowToStep', text })) }),
    inLanguage: 'fr',
  }
}

/**
 * Le contenu d'une fiche — ingrédients et étapes — à partir de sa ligne en
 * base (`{ ingredients, steps }`), pour `generate-prerender-manifest.mjs`.
 *
 * Les ingrédients s'écrivent avec la règle du balisage client
 * (`ligneIngredient`), les étapes sont celles de `lang`, sans les vides —
 * exactement ce que `recipe-to-schema-org.js` pose au montage.
 */
export function contenuRecette(ligne, ingredientsById, lang = 'fr') {
  const ingredients = getIngredientItemsFlat({ ingredients: ligne?.ingredients })
    .map((item) => ligneIngredient(item, ingredientsById, lang))
    .filter(Boolean)
  const steps = ligne?.steps
  const brutes = Array.isArray(steps) ? steps : (steps?.[lang] ?? steps?.fr ?? [])
  const etapes = (Array.isArray(brutes) ? brutes : [])
    .map((s) => (typeof s === 'string' ? s : (s?.text ?? '')))
    .filter(Boolean)
  return { ingredients, etapes }
}

/**
 * Le fichier `prerender-contenu.json`, une ligne par recette.
 *
 * Pourquoi pas `JSON.stringify(…, null, 2)` : chaque étape y prendrait sa
 * ligne, et le fichier ~15 000 lignes. Ici, modifier ou ajouter une recette
 * change UNE ligne du diff — l'objection « un diff qui noierait toute PR »
 * (décision du 2026-08-20) ne tient plus.
 */
export function serialiserContenu({ lang, genereLe, recettes }) {
  const lignes = recettes.map(({ id, ingredients, etapes }) => `    ${JSON.stringify(id)}: ${JSON.stringify({ ingredients, etapes })}`)
  return [
    '{',
    `  "_commentaire": ${JSON.stringify('FICHIER GÉNÉRÉ par `npm run prerender:data` — ne pas éditer à la main. Une ligne par recette.')},`,
    `  "_genere_le": ${JSON.stringify(genereLe)},`,
    `  "lang": ${JSON.stringify(lang)},`,
    '  "recettes": {',
    lignes.join(',\n'),
    '  }',
    '}',
    '',
  ].join('\n')
}

/**
 * Les pages statiques à pré-rendre — LISTE EXPLICITE, jamais dérivée de
 * `ROUTES`.
 *
 * 🔴 Dériver du tableau de routes balaierait tôt ou tard `/cart`, `/profile` ou
 * `/login` : on déploierait une coquille HTML publique pour des écrans dont
 * l'existence même est censée dépendre d'une session. Le jour où quelqu'un
 * ajoute une route, la liste ci-dessous ne bouge pas — et c'est le but.
 *
 * Critère d'entrée : la page est publique, son contenu est dans le bundle (pas
 * de lecture BDD pour l'afficher), et il y a un intérêt à ce qu'elle soit
 * trouvée depuis un moteur de recherche.
 *
 * ⚠️ `/community` en fait partie bien que le feed vienne de la base : la
 * coquille pré-rendue ne porte que titre et description — le contenu, lui,
 * arrive au rendu comme aujourd'hui.
 *
 * Textes en français : le pré-rendu ne produit qu'une langue (même contrainte
 * que les recettes, cf. la note interne sur le pré-rendu SEO). Les pages ajustent
 * leur titre d'onglet à la langue affichée via `useDocumentTitle`.
 */
export const PAGES_STATIQUES = [
  {
    chemin: '/faq',
    titre: 'Questions fréquentes — Fridge+',
    description: 'Comment ajouter ses ingrédients, trouver des recettes, gérer son compte et ses données : les réponses aux questions les plus courantes sur Fridge+.',
  },
  {
    chemin: '/guide',
    titre: 'Comment ça marche — Fridge+',
    description: 'Fridge+ en cinq étapes : remplis ton frigo à la voix ou en photographiant le ticket, vérifie ce qu’il te reste, et découvre les recettes que tu peux cuisiner maintenant.',
  },
  {
    chemin: '/community',
    titre: 'Communauté — Fridge+',
    description: 'Les recettes partagées par la communauté Fridge+ : découvre, commente et publie tes propres créations.',
  },
  {
    chemin: '/changelog',
    titre: 'Nouveautés — Fridge+',
    description: 'Le journal des versions de Fridge+ : les fonctionnalités ajoutées et les corrections apportées, version après version.',
  },
  {
    // 🔴 Exigée par Google Play : une URL PUBLIQUE de demande de suppression de
    // compte, en HTTPS, sans mur de connexion, atteignable par un lien DIRECT.
    // https://support.google.com/googleplay/android-developer/answer/13327111
    // Elle doit être pré-rendue comme les autres : le relecteur de Google — et
    // les robots — peuvent très bien ne pas exécuter le JavaScript, et une page
    // blanche à cette URL vaut une absence de page.
    chemin: '/suppression-compte',
    titre: 'Supprimer mon compte — Fridge+',
    description: 'Comment supprimer votre compte Fridge+ et toutes les données associées, depuis l\'application ou par e-mail si vous ne l\'avez plus : la marche à suivre, ce qui est effacé et sous quel délai.',
  },
  {
    chemin: '/legal',
    titre: 'Mentions légales — Fridge+',
    description: 'Mentions légales, conditions d\'utilisation et politique de confidentialité de Fridge+.',
  },
  {
    chemin: '/accessibilite',
    titre: 'Accessibilité — Fridge+',
    description: 'Ce que Fridge+ fait pour s’utiliser au clavier, avec un lecteur d’écran ou des animations réduites, comment c’est vérifié, ce qui reste à faire, et comment signaler un problème.',
  },
  {
    // Celle que désigne `public/.well-known/security.txt` (Policy, Acknowledgments).
    chemin: '/securite',
    titre: 'Sécurité — Fridge+',
    description: 'Comment signaler une faille de sécurité dans Fridge+, ce que nous nous engageons à faire et dans quels délais, et ce qui entre ou non dans le périmètre.',
  },
]

/**
 * Les pages statiques que le plan du site ANNONCE.
 *
 * Toutes, sauf `/community` tant que son fil n'a aucun message visible : sa
 * page servie est vide, et l'annoncer revient à signaler une page mince
 * (audit du 2026-10-04, SEO-10 — 0 message visible sur 4 au 2026-10-08).
 * Elle reste pré-rendue : seule l'annonce attend du contenu.
 *
 * `messagesCommunaute` est le compte lu par `npm run sitemap` ; `null` (lecture
 * en échec) vaut « pas vu » : on n'annonce que ce qu'on a vu.
 */
export function pagesAuPlanDuSite({ messagesCommunaute }) {
  return PAGES_STATIQUES.filter(p => p.chemin !== '/community' || messagesCommunaute > 0)
}

// ── Le fichier de la page, annoncé dans le HTML (audit du 2026-10-04, PERF-05) ──
// Sans cette annonce, le navigateur ne découvrait le fichier d'une page (par ex.
// `faq-page-*.js`) qu'après avoir exécuté le fichier d'entrée : un aller-retour
// de plus sur le chemin critique (demandé à 593 ms dans la trace, 280 ms après
// la fin de l'entrée). Les noms sont ceux que le build donne aux fichiers des
// pages paresseuses de `src/routes/routes-config.js`.
export const MORCEAUX_PAR_CHEMIN = {
  '/faq': ['faq-page'],
  '/guide': ['guide-page'],
  '/legal': ['legal-page'],
  '/changelog': ['changelog-page'],
  '/suppression-compte': ['account-deletion-page'],
  '/accessibilite': ['accessibility-page'],
  '/securite': ['security-page'],
  '/community': ['community-page-route'],
  // Les fiches : la page, et avec ses imports la modale qui affiche la recette.
  '/recipe': ['recipe-page'],
}

// Le fichier `<nom>-<empreinte de 8 caractères>.js`, et lui seul. Échec BRUYANT
// s'il manque ou s'il y en a plusieurs : un renommage casserait le
// préchargement en silence.
export function trouverLeMorceau(fichiers, nom) {
  const nomEchappe = nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const motif = new RegExp(`^${nomEchappe}-[A-Za-z0-9_-]{8}\\.js$`)
  const trouves = fichiers.filter((f) => motif.test(f))
  if (trouves.length !== 1) {
    throw new Error(`fichier « ${nom}-<empreinte>.js » : ${trouves.length} trouvé(s) dans dist/assets`)
  }
  return trouves[0]
}

// Les imports statiques d'un fichier minifié du build (`from"./x.js"`).
export function dependancesDirectes(contenu) {
  return [...contenu.matchAll(/(?:from|import)\s*"\.\/([A-Za-z0-9_.-]+\.js)"/g)].map((m) => m[1])
}

// Une balise par fichier, sans doublon ni ce que le gabarit précharge déjà.
export function balisesDePrechargement(prefixe, fichiers, gabarit) {
  const vus = new Set()
  return fichiers
    .filter((f) => {
      if (vus.has(f)) return false
      vus.add(f)
      return !gabarit.includes(`${prefixe}${f}"`)
    })
    .map((f) => `<link rel="modulepreload" crossorigin href="${prefixe}${f}">`)
    .join('\n    ')
}
