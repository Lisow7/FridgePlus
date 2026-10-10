import { suffixS } from '@shared/lib/i18n/pluralize'

export const SUB_I18N = {
  fr: {
    tabLabel: 'Abonnement',
    // Free
    freeTitle: 'Compte gratuit',
    freeDesc:  'Débloque le panier, la voix dans le mode cuisine, tes listes gardées et plus encore.',
    freeCta:   'Démarrer l’essai gratuit 7 jours',
    // Trialing
    trialTitle: 'Essai Premium en cours',
    trialDays:  (n) => `${n} jour${n > 1 ? 's' : ''} restant${n > 1 ? 's' : ''}`,
    trialCta:   'Activer maintenant',
    trialDesc:  'À la fin de l’essai, ton accès sera maintenu uniquement si tu actives un abonnement.',
    // Active
    activeTitle:   'Actif',
    planMonthly:   'Plan mensuel — 4,99 € / mois',
    planAnnual:    'Plan annuel — 34,99 € / an',
    renews:        'Renouvellement le',
    expires:       'Accès jusqu’au',
    manage:        'Gérer mon abonnement',
    manageDesc:    'Annulation, mise à jour CB, factures — géré via le portail Stripe.',
    // Past due
    pastDueTitle: 'Paiement en échec',
    pastDueDesc:  'Ton accès Premium est suspendu. Mets à jour ta carte bancaire pour le rétablir.',
    pastDueCta:   'Mettre à jour ma carte',
    // Canceled
    canceledTitle: 'Abonnement annulé',
    canceledDesc:  (date) => `Ton accès Premium expire le ${date}.`,
    canceledCta:   'Se réabonner',
    // Errors
    portalError: 'Impossible d’ouvrir le portail. Réessaie plus tard.',
  },
  en: {
    tabLabel: 'Subscription',
    freeTitle: 'Free account',
    freeDesc:  'Unlock the cart, voice in cooking mode, your saved lists and more.',
    freeCta:   'Start 7-day free trial',
    trialTitle: 'Premium trial active',
    trialDays:  (n) => `${n} day${suffixS(n, 'en')} remaining`,
    trialCta:   'Activate now',
    trialDesc:  'At the end of the trial, access is maintained only if you activate a subscription.',
    activeTitle:   'Active',
    planMonthly:   'Monthly plan — €4.99 / month',
    planAnnual:    'Annual plan — €34.99 / year',
    renews:        'Renews on',
    expires:       'Access until',
    manage:        'Manage my subscription',
    manageDesc:    'Cancel, update card, invoices — managed via the Stripe portal.',
    pastDueTitle: 'Payment failed',
    pastDueDesc:  'Your Premium access is suspended. Update your card to restore it.',
    pastDueCta:   'Update my card',
    canceledTitle: 'Subscription cancelled',
    canceledDesc:  (date) => `Your Premium access expires on ${date}.`,
    canceledCta:   'Re-subscribe',
    portalError: 'Could not open the portal. Please try again later.',
  },
}
