// i18n du RecipeModal — extrait de recipe-modal.jsx (2026-07-22, audit front §2).
// Données pures, aucun accès au scope du composant : déplacées ici pour alléger
// le composant monstre (2315 l) sans changer le comportement. Suit le pattern
// feature-i18n du projet (dictionnaire par feature).
import { DIFFICULTY_LABELS, TYPE_LABELS } from '@shared/static/recipe-constants'
import { suffixS } from '@shared/lib/i18n/pluralize'

export const MODAL_I18N = {
  fr: {
    servings:         (n) => `${n} pers.`,
    lockedServingsLabel: (n, name) => `Quantité pour ${n} pers. de ${name}`,
    matchCount:       (m, total) => `${m}/${total} ingrédient${total > 1 ? 's' : ''}`,
    matchInfo:        'Part des ingrédients requis de la recette que tu as déjà dans ton frigo. Les ingrédients optionnels (marqués *) ne comptent pas.',
    ingredientsLabel: 'Ingrédients',
    preparationLabel: 'Préparation',
    cookingMode:      'Mode cuisine',
    legendLabel:      'Légende',
    inFridge:         'Dans ton frigo',
    missing:          'Manquant',
    optional:         'Optionnel',
    clickTip:         'Touche un ingrédient pour l’ajouter ou le retirer de ton frigo.',
    addFav:           'Ajouter aux favoris',
    removeFav:        'Retirer des favoris',
    shareRecipe:      'Partager la recette',
    close:            'Fermer',
    fewerServings:    'Moins de portions',
    moreServings:     'Plus de portions',
    difficultyMap:    DIFFICULTY_LABELS.fr,
    typeMap:          TYPE_LABELS.fr,
    cookRecipe:       "J’ai cuisiné cette recette",
    editRecipe:       'Modifier la recette',
    deleteRecipe:     'Supprimer la recette',
    confirmDeleteTitle: 'Supprimer définitivement cette recette ?',
    confirmDeleteBody:  'Cette action est irréversible.',
    confirmDeleteOk:    'Supprimer',
    confirmDeleteCancel:'Annuler',
    withdrawTitle:    'Quoi retirer du frigo ?',
    withdrawSub:      "Décoche ce que tu as gardé",
    selectAll:        'Tout sélectionner',
    deselectAll:      'Tout désélectionner',
    confirm:          'Retirer du frigo',
    back:             'Retour',
    cookWithout:      'Cuisiné sans',
    willRemoveFridge: 'Sera retiré du frigo',
    willRemovePantry: 'Sera retiré du garde-manger',
    keepInFridge:     'Conservé dans le frigo',
    keepInPantry:     'Conservé dans le garde-manger',
    chooseUsed:       'Lequel as-tu utilisé ?',
    cancel:           'Annuler',
    feedbackDone:     (n) => n === 0 ? 'Recette finalisée !' : `${n} ingrédient${n > 1 ? 's' : ''} retiré${n > 1 ? 's' : ''} du frigo`,
    feedbackCookedLogged: 'Ajoutée à ton journal de cuisine',
    inSeason:         'De saison ce mois-ci',
    feedbackSplit:    (fridge, pantry) => {
      const parts = []
      if (fridge > 0) parts.push(`${fridge} du frigo`)
      if (pantry > 0) parts.push(`${pantry} du garde-manger`)
      return parts.length > 0 ? `${fridge + pantry} retirés (${parts.join(' · ')})` : 'Recette finalisée !'
    },
    adminModifiedNotice: 'Un administrateur a apporté des modifications à cette recette.',
    nutritionLabel: 'Nutrition (par portion)',
    nutritionInfo: 'Valeurs estimées à partir des ingrédients, par portion, à titre indicatif.',
    calLabel: 'Calories', protLabel: 'Protéines', carbLabel: 'Glucides', fatLabel: 'Lipides', fibLabel: 'Fibres',
    allergenWarning: 'Contient tes allergènes :', allergenInRecipe: 'Allergènes présents :',
    allergenSectionLabel: 'Allergènes', allergenBannerTitle: 'Cette recette contient tes allergènes déclarés',
    costLabel: 'Coût estimé', costTotal: 'Recette complète', costMissing: 'Ingrédients manquants',
    costModeTotal: 'Total', costModePerServing: 'Par portion', costModeMarginal: 'À acheter',
    costPerServingLabel: 'Coût par portion', costMarginalLabel: 'En plus de ton frigo',
    costLoginHint: 'Connecte-toi pour ajouter au panier', addToCart: 'Ajouter au panier',
    alreadyInCart: 'Déjà dans le panier', cartAdded: 'Recette ajoutée au panier !', cartAllInFridge: 'Tous les ingrédients sont déjà dans ton frigo !',
    noNutrition: 'Données indisponibles',
    tabSteps: 'Étapes', tabCost: 'Coût', tabNutrition: 'Nutrition', tabReviews: 'Avis',
    reviewsBadgeTitle: (avg, n) => `${avg}/5 — ${n} avis`,
    withdrawPickWarning: '⚠ Choisis un ingrédient pour chaque ligne en orange avant de confirmer',
    // 🔴 Nom accessible du groupe d onglets de la fiche recette.
    //
    // Le conteneur porte `role="tablist"` (recipe-detail-body.jsx) : c est
    // OBLIGATOIRE, sans lui les `role="tab"` n ont pas le parent qu ARIA exige.
    // axe-core le signalait en **critical** (`aria-required-parent`) sur les
    // **515 pages de recette** en production, constate le 2026-08-25 — elles
    // echappaient au garde-fou `e2e/a11y.spec.js`, qui ne visite que 6 pages.
    // Concretement, un lecteur d ecran annoncait des boutons isolés au lieu d un
    // groupe d onglets : ni « 2 sur 4 », ni navigation aux fleches.
    //
    // ⚠️ Le commentaire vit ICI et non dans le composant : ce dernier est sous
    // budget de taille (`component-size-budget.test.js`, plafond 622 lignes) et
    // trois lignes de plus le faisaient echouer. Le garde-fou dit « reduire le
    // fichier, ou extraire ailleurs » — c est ce qui est fait.
    tabsLabel: 'Sections de la recette',
    usingBaseLabel: 'Recettes qui utilisent cette recette',
    costBreakdownLabel: 'Coût par ingrédient', costOptionalNote: '* optionnel', costNoData: 'Prix non disponibles',
    costRecipeNote: 'Ce coût est calculé sur les quantités exactes de la recette (ex. 150 g de beurre).\n\nDans le panier, le prix correspond à ce que tu paies réellement en caisse : un pack entier grande surface (ex. 250 g de beurre = 3,40 €).',
    costRefreshBtn: '↻ Actualiser', costRefreshing: 'Actualisation…',
    costLiveSource: 'Open Prices', costLiveBadge: 'live',
    costEstimated: 'Estimé (RNM 2026)', costLastUpdated: (hm) => `Actualisé à ${hm}`,
    aiSubstitutes: 'Substituts IA',
    inFridgeChip: 'frigo',
    allRecipes: 'Toutes les recettes',
    lockedRecipe: 'Recette verrouillée', lockedBadge: 'Verrouillée',
    lockedTooltip: 'Verrouillée — cette recette a été validée par la modération. Seuls les admins peuvent la modifier.',
  },
  en: {
    servings:         (n) => `${n} serv.`,
    lockedServingsLabel: (n, name) => `Amount for ${n} servings of ${name}`,
    matchCount:       (m, total) => `${m}/${total} ingredient${suffixS(total, 'en')}`,
    matchInfo:        'Share of the recipe’s required ingredients you already have in your fridge. Optional ingredients (marked *) don’t count.',
    ingredientsLabel: 'Ingredients',
    preparationLabel: 'Preparation',
    cookingMode:      'Cooking mode',
    legendLabel:      'Legend',
    inFridge:         'In your fridge',
    missing:          'Missing',
    optional:         'Optional',
    clickTip:         'Tap an ingredient to add or remove it from your fridge.',
    addFav:           'Add to favourites',
    removeFav:        'Remove from favourites',
    shareRecipe:      'Share recipe',
    close:            'Close',
    fewerServings:    'Fewer servings',
    moreServings:     'More servings',
    difficultyMap:    DIFFICULTY_LABELS.en,
    typeMap:          TYPE_LABELS.en,
    cookRecipe:       'I cooked this recipe',
    editRecipe:       'Edit recipe',
    deleteRecipe:     'Delete recipe',
    confirmDeleteTitle: 'Delete this recipe permanently?',
    confirmDeleteBody:  'This action cannot be undone.',
    confirmDeleteOk:    'Delete',
    confirmDeleteCancel:'Cancel',
    withdrawTitle:    'What to remove from fridge?',
    withdrawSub:      'Uncheck what you kept',
    selectAll:        'Select all',
    deselectAll:      'Deselect all',
    confirm:          'Remove from fridge',
    back:             'Back',
    cookWithout:      'Cooked without',
    willRemoveFridge: 'Will be removed from fridge',
    willRemovePantry: 'Will be removed from pantry',
    keepInFridge:     'Kept in fridge',
    keepInPantry:     'Kept in pantry',
    chooseUsed:       'Which one did you use?',
    cancel:           'Cancel',
    feedbackDone:     (n) => n === 0 ? 'Recipe done!' : `${n} ingredient${suffixS(n, 'en')} removed from fridge`,
    feedbackCookedLogged: 'Added to your cooking journal',
    inSeason:         'In season this month',
    feedbackSplit:    (fridge, pantry) => {
      const parts = []
      if (fridge > 0) parts.push(`${fridge} from fridge`)
      if (pantry > 0) parts.push(`${pantry} from pantry`)
      return parts.length > 0 ? `${fridge + pantry} removed (${parts.join(' · ')})` : 'Recipe done!'
    },
    adminModifiedNotice: 'An administrator has made changes to this recipe.',
    nutritionLabel: 'Nutrition (per serving)',
    nutritionInfo: 'Estimated from the ingredients, per serving, for guidance only.',
    calLabel: 'Calories', protLabel: 'Protein', carbLabel: 'Carbs', fatLabel: 'Fat', fibLabel: 'Fiber',
    allergenWarning: 'Contains your allergens:', allergenInRecipe: 'Allergens present:',
    allergenSectionLabel: 'Allergens', allergenBannerTitle: 'This recipe contains your declared allergens',
    costLabel: 'Estimated cost', costTotal: 'Full recipe', costMissing: 'Missing ingredients',
    costModeTotal: 'Total', costModePerServing: 'Per serving', costModeMarginal: 'To buy',
    costPerServingLabel: 'Cost per serving', costMarginalLabel: 'On top of your fridge',
    costLoginHint: 'Sign in to add to cart', addToCart: 'Add to cart',
    alreadyInCart: 'Already in cart', cartAdded: 'Recipe added to cart!', cartAllInFridge: 'All ingredients are already in your fridge!',
    noNutrition: 'Data unavailable',
    tabSteps: 'Steps', tabCost: 'Cost', tabNutrition: 'Nutrition', tabReviews: 'Reviews',
    reviewsBadgeTitle: (avg, n) => `${avg}/5 — ${n} review${suffixS(n, 'en')}`,
    withdrawPickWarning: '⚠ Pick an ingredient for every orange line before confirming',
    tabsLabel: 'Recipe sections',
    usingBaseLabel: 'Recipes that use this one',
    costBreakdownLabel: 'Cost per ingredient', costOptionalNote: '* optional', costNoData: 'Prices unavailable',
    costRecipeNote: 'This cost is calculated on the exact recipe quantities (e.g. 150 g butter).\n\nIn the cart, the price reflects what you actually pay at the checkout: a full supermarket pack (e.g. 250 g butter = €3.40).',
    costRefreshBtn: '↻ Refresh', costRefreshing: 'Refreshing…',
    costLiveSource: 'Open Prices', costLiveBadge: 'live',
    costEstimated: 'Estimated (RNM 2026)', costLastUpdated: (hm) => `Updated at ${hm}`,
    aiSubstitutes: 'AI substitutes',
    inFridgeChip: 'fridge',
    allRecipes: 'All recipes',
    lockedRecipe: 'Locked recipe', lockedBadge: 'Locked',
    lockedTooltip: 'Locked — this recipe has been validated by moderation. Only admins can edit it.',
  },
}
