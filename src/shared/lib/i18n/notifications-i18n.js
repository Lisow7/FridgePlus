// Textes i18n × 5 langues partagés entre cloche, panel user, section admin.
// Centralisés pour cohérence entre toutes les surfaces.
//
// Note : les `title` / `body` des notifs eux-mêmes sont stockés en jsonb
// par les triggers SQL (langue résolue côté affichage selon `lang` user).
// Ce fichier ne couvre que le chrome de l'UI (titres de panel, boutons,
// états vides, formats de date relative).

export const NOTIF_I18N = {
  fr: {
    bellLabel:        'Notifications',
    panelTitle:       'Notifications',
    empty:            'Aucune notification',
    emptyHint:        "Tu seras prévenu·e ici quand l'équipe répondra à un ticket, validera une de tes recettes, ou pour les évènements communauté.",
    markAllRead:      'Tout marquer comme lu',
    markOneRead:      'Marquer comme lu',
    loadError:        'Tes notifications n\'ont pas pu être chargées.',
    retry:            'Réessayer',
    deleteAllRead:    'Effacer les notifications lues',
    catSupport:       'Mes demandes',
    catFridge:        'Ton frigo',
    catRecipes:       'Mes recettes',
    catCommunity:     'Communauté',
    catOther:         'Autres',
    showMore:         'Voir plus',
    showLess:         'Voir moins',
    detailLabel:      'Détail',
    deleteOne:        'Supprimer',
    refresh:          'Rafraîchir',
    seeAll:           'Voir toutes',
    unreadBadge:      'non lu',
    bellUnread:       (n) => n > 1 ? `${n} notifications non lues` : '1 notification non lue',
    just_now:         "à l'instant",
    minutes_ago:      (n) => `il y a ${n} min`,
    hours_ago:        (n) => `il y a ${n} h`,
    days_ago:         (n) => `il y a ${n} j`,
    // Section admin
    adminTitle:       'Notifications & alertes',
    adminSub:         "Centre de pilotage des actions à faire et des évènements de la plateforme",
    adminEmpty:       'Aucun évènement récent',
  },
  en: {
    bellLabel:        'Notifications',
    panelTitle:       'Notifications',
    empty:            'No notifications',
    emptyHint:        'You\'ll see updates here when the team replies to a ticket, approves one of your recipes, or for community events.',
    markAllRead:      'Mark all as read',
    markOneRead:      'Mark as read',
    loadError:        'Your notifications could not be loaded.',
    retry:            'Try again',
    deleteAllRead:    'Clear read notifications',
    catSupport:       'Support',
    catFridge:        'Your fridge',
    catRecipes:       'My recipes',
    catCommunity:     'Community',
    catOther:         'Other',
    showMore:         'Show more',
    showLess:         'Show less',
    detailLabel:      'Detail',
    deleteOne:        'Delete',
    refresh:          'Refresh',
    seeAll:           'See all',
    unreadBadge:      'unread',
    bellUnread:       (n) => n > 1 ? `${n} unread notifications` : '1 unread notification',
    just_now:         'just now',
    minutes_ago:      (n) => `${n} min ago`,
    hours_ago:        (n) => `${n} h ago`,
    days_ago:         (n) => `${n} d ago`,
    adminTitle:       'Notifications & alerts',
    adminSub:         'Control center for pending actions and platform events',
    adminEmpty:       'No recent events',
  },
}

// Rendu du temps relatif (« il y a 3 min ») depuis un timestamp ISO.
export function formatRelativeTime(iso, lang = 'fr') {
  const t = NOTIF_I18N[lang] ?? NOTIF_I18N.fr
  if (!iso) return ''
  const ts = new Date(iso).getTime()
  const diffMs = Date.now() - ts
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1)    return t.just_now
  if (diffMin < 60)   return t.minutes_ago(diffMin)
  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24)   return t.hours_ago(diffHrs)
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 30)  return t.days_ago(diffDays)
  return new Date(ts).toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang)
}

// Récupère le titre/body d'une notif dans la langue user (fallback fr).
export function localizeNotifText(jsonb, lang = 'fr') {
  if (!jsonb) return ''
  return jsonb[lang] ?? jsonb.fr ?? ''
}
