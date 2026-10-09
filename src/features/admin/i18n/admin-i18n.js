// i18n × 5 langues partagé entre Dashboard et toutes les sections du
// panel admin. Centralisé pour cohérence — si on change le wording de
// « Journal », on le change à un seul endroit.

export const ADMIN_I18N = {
  fr: {
    dashboardTitle:    'Tableau de bord',
    dashboardSub:      "Vue d'ensemble de l'activité Fridge+",
    backToDashboard:   '← Retour au tableau de bord',
    refresh:           'Rafraîchir',
    closeBtn:          'Fermer',

    // KPI
    kpiUsers:          'Utilisateurs',
    kpiRecipesPending: 'Recettes à modérer',
    kpiTicketsOpen:    'Tickets ouverts',
    kpiTicketsUnread:  'Non lus',
    kpiBaseRecipes:    'Recettes catalogue',
    kpiIngredients:    'Ingrédients',

    // Sections (titres + descriptions courtes)
    secRecipes:        'Recettes',
    secRecipesDesc:    'Modérer les recettes communautaires et gérer le catalogue de base',
    secUsers:          'Utilisateurs',
    secUsersDesc:      'Lister, consulter, bannir — accès aux données sensibles tracé',
    secTickets:        'Tickets de support',
    secTicketsDesc:    "Voir et répondre aux demandes d'aide des utilisateurs",
    secIngredients:    'Ingrédients',
    secIngredientsDesc:'Catalogue des ingrédients du frigo et données nutritionnelles',
    secReports:        'Signalements',
    secReportsDesc:    'Contenus signalés par les utilisateurs',
    secCommunity:      'Communauté',
    secCommunityDesc:  'Modérer posts et réponses, mute des utilisateurs',
    secBaseRecipes:    'Recettes officielles',
    secBaseRecipesDesc:'Catalogue des recettes officielles publiées',
    secQuality:        'Qualité des données',
    secQualityDesc:    'Détecter les recettes / ingrédients incomplets',
    secNotifications:  'Notifications',
    secNotificationsDesc: 'Centre de pilotage : actions à faire, alertes',
    secJournal:        'Journal',
    secJournalDesc:    "Audit des actions admin — append-only, conservé 12 mois",
    secSettings:       'Paramètres',
    secSettingsDesc:   'Rôles, demandes RGPD, retours sur la FAQ (à venir)',

    soonBadge:         'Bientôt',
    pendingBadge:      'à modérer',
    unreadBadge:       'non lus',
  },

  en: {
    dashboardTitle:    'Dashboard',
    dashboardSub:      'Fridge+ activity overview',
    backToDashboard:   '← Back to dashboard',
    refresh:           'Refresh',
    closeBtn:          'Close',

    kpiUsers:          'Users',
    kpiRecipesPending: 'Recipes to moderate',
    kpiTicketsOpen:    'Open tickets',
    kpiTicketsUnread:  'Unread',
    kpiBaseRecipes:    'Catalog recipes',
    kpiIngredients:    'Ingredients',

    secRecipes:        'Recipes',
    secRecipesDesc:    'Moderate community recipes and manage the base catalog',
    secUsers:          'Users',
    secUsersDesc:      'List, view, ban — access to sensitive data is logged',
    secTickets:        'Support tickets',
    secTicketsDesc:    'View and reply to user help requests',
    secIngredients:    'Ingredients',
    secIngredientsDesc:'Fridge ingredients catalog and nutrition data',
    secReports:        'Reports',
    secReportsDesc:    'Content reported by users',
    secCommunity:      'Community',
    secCommunityDesc:  'Moderate posts and replies, mute users',
    secBaseRecipes:    'Official recipes',
    secBaseRecipesDesc:'Catalog of officially published recipes',
    secQuality:        'Data quality',
    secQualityDesc:    'Spot incomplete recipes / ingredients',
    secNotifications:  'Notifications',
    secNotificationsDesc: 'Control center: actions to do, alerts',
    secJournal:        'Journal',
    secJournalDesc:    'Audit of admin actions — append-only, kept for 12 months',
    secSettings:       'Settings',
    secSettingsDesc:   'Roles, GDPR requests, FAQ feedback (coming soon)',

    soonBadge:         'Soon',
    pendingBadge:      'to review',
    unreadBadge:       'unread',
  },



}
