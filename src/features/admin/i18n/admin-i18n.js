// Les mots du tableau de bord et de l'en-tête du Journal, en français et en
// anglais. Chaque section de l'admin a son propre dictionnaire en ligne, comme
// le reste de l'app (ADR 0002) : ce fichier n'est lu que par `dashboard.jsx`
// et `journal-section.jsx`. Il s'est dit « × 5 langues, partagé par tout
// l'admin » et portait 27 clés que rien ne lisait (audit du 2026-10-04,
// ADM-24) ; le garde-fou `admin-nettoyage` vérifie que chaque clé est lue.

export const ADMIN_I18N = {
  fr: {
    dashboardTitle:    'Tableau de bord',
    dashboardSub:      "Vue d'ensemble de l'activité Fridge+",
    refresh:           'Rafraîchir',

    // KPI
    kpiUsers:          'Utilisateurs',
    kpiRecipesPending: 'Recettes à modérer',
    kpiTicketsOpen:    'Tickets ouverts',
    kpiBaseRecipes:    'Recettes catalogue',
    kpiIngredients:    'Ingrédients',

    // Journal
    secJournalDesc:    "Audit des actions admin — append-only, conservé 12 mois",
  },

  en: {
    dashboardTitle:    'Dashboard',
    dashboardSub:      'Fridge+ activity overview',
    refresh:           'Refresh',

    kpiUsers:          'Users',
    kpiRecipesPending: 'Recipes to moderate',
    kpiTicketsOpen:    'Open tickets',
    kpiBaseRecipes:    'Catalog recipes',
    kpiIngredients:    'Ingredients',

    secJournalDesc:    'Audit of admin actions — append-only, kept for 12 months',
  },
}
