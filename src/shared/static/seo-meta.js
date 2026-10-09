// Sprint 7 PR S7.b — Réduction à FR + EN.
// Métadonnées SEO (title, description, OG locale) par langue. Les
// langues ES/DE/JA ont été retirées suite au recentrage sur FR/EN.
//
// `description` reflète la réalité actuelle de l'app : on retire la
// mention « multilingue » qui n'a plus de sens avec 2 langues.
export const SEO_META = {
  fr: {
    title: 'Fridge+ — Gère ton frigo, crée & trouve des recettes',
    tagline: 'Gère ton frigo, crée & trouve des recettes',
    description: 'Fais l\'inventaire de ton frigo et de ton garde-manger, puis crée et découvre instantanément des recettes avec ce que tu as déjà. Gratuit et simple.',
    ogLocale: 'fr_FR',
  },
  en: {
    title: 'Fridge+ — Manage your fridge, create & find recipes',
    tagline: 'Manage your fridge, create & find recipes',
    description: 'Track what\'s in your fridge and pantry, then create and instantly find recipes for ingredients you already have. Free and simple.',
    ogLocale: 'en_US',
  },
}
