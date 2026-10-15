// Textes des catégories de la fenêtre des cookies et du panneau Confidentialité
// (fr, en). À part de `consent-i18n.js` : le bandeau et le pied de page,
// chargés au démarrage, n'en ont pas besoin ; ces deux écrans-ci se chargent à
// la demande (poids de démarrage, 2026-10-06). Version 2 du consentement :
// « Rapports d'erreurs » et « Statistiques d'usage » (décision du 2026-10-06).

export const CATEGORIES = {
  fr: {
    catEssTitle:      '🟢 Essentiels',
    catEssBadge:      'Toujours actifs',
    catEssDesc:       "Strictement nécessaires au fonctionnement de Fridge+ : ta session, ta langue, ton thème, et ton frigo en mode invité. Sans ces données, l’app ne peut pas marcher. Aucun consentement n’est requis (RGPD art. 5).",
    catEssRetention:  "Tant que tu utilises l’app",

    catErrTitle:      "🔵 Rapports d’erreurs",
    catErrBadge:      'Optionnel',
    catErrDesc:       "Quand l’app plante, Sentry reçoit l’erreur et son contexte technique (page, navigateur), rattachées à l’identifiant de ton compte, jamais à ton adresse e-mail. C’est ce qui nous permet de corriger les bugs.",
    catErrBenefit:    '✓ Avec : on voit, et on corrige, les bugs que tu rencontres',
    catErrDrawback:   '✗ Sans : un bug qui te touche peut passer inaperçu',
    catErrRetention:  '90 jours',
    catErrVendors:    'Outil : Sentry (Functional Software, Inc., États-Unis)',

    catUsageTitle:    "🟣 Statistiques d’usage",
    catUsageBadge:    'Optionnel',
    catUsageDesc:     "Les étapes que tu franchis dans l’app (ingrédient ajouté, recette ouverte, plat cuisiné…), rattachées à ton compte, ou à un identifiant anonyme si tu n’es pas connecté. Elles nous disent ce qui sert, pour l’améliorer. Jamais vendues, jamais de publicité.",
    catUsageBenefit:  "✓ Avec : on sait ce qui t’aide vraiment, et ce qu’il faut revoir",
    catUsageDrawback: "✗ Sans : rien ne change pour toi — on améliore l’app à l’aveugle",
    catUsageRetention:'13 mois',
    catUsageVendors:  'Aucun outil tiers : enregistrées dans la base de Fridge+ (Supabase, Union européenne)',

    catVoiceTitle:    '🎙️ Reconnaissance vocale',
    catVoiceBadge:    'Au micro',
    catVoiceDesc:     "Permet d’ajouter des ingrédients à ton frigo en parlant. Pour transcrire ta voix, ton navigateur transmet l’audio à un service tiers (Google pour Chrome/Edge, Apple pour Safari). Fridge+ ne conserve ni l’audio ni le texte.",
    catVoiceBenefit:  '✓ Avec : ajoute tes ingrédients à la voix, mains libres',
    catVoiceDrawback: '✗ Sans : ajout des ingrédients au toucher uniquement',
    catVoiceRetention:'Aucune conservation (audio et texte non stockés)',
    catVoiceVendors:  'Destinataires de l’audio : Google (Chrome/Edge) ou Apple (Safari) selon ton navigateur',

    catReceiptTitle:     '🧾 Photo du ticket',
    catReceiptBadge:     'Par photo',
    catReceiptDesc:      "Permet d’ajouter des ingrédients en photographiant ton ticket de caisse. La photo est envoyée à Google Cloud Vision pour en lire le texte, puis immédiatement supprimée — Fridge+ ne conserve que les noms d’ingrédients que tu valides ensuite.",
    catReceiptBenefit:   '✓ Avec : ajoute plusieurs ingrédients d’un coup en photographiant ton ticket',
    catReceiptDrawback:  '✗ Sans : ajout des ingrédients un par un, manuellement',
    catReceiptRetention: 'Aucune conservation de la photo (supprimée immédiatement après lecture)',
    catReceiptVendors:   'Destinataire de la photo : Google Cloud Vision (lecture du texte uniquement)',
  },

  en: {
    catEssTitle:      '🟢 Essential',
    catEssBadge:      'Always on',
    catEssDesc:       "Strictly required for Fridge+ to work: your session, language, theme, and guest-mode fridge. Without these, the app can’t function. No consent required (GDPR art. 5).",
    catEssRetention:  'While you use the app',

    catErrTitle:      '🔵 Error reports',
    catErrBadge:      'Optional',
    catErrDesc:       "When the app crashes, Sentry receives the error and its technical context (page, browser), linked to your account’s identifier, never to your email address. That is how we fix bugs.",
    catErrBenefit:    '✓ With: we see, and fix, the bugs you run into',
    catErrDrawback:   '✗ Without: a bug that affects you may go unnoticed',
    catErrRetention:  '90 days',
    catErrVendors:    'Tool: Sentry (Functional Software, Inc., USA)',

    catUsageTitle:    '🟣 Usage statistics',
    catUsageBadge:    'Optional',
    catUsageDesc:     "The steps you take in the app (ingredient added, recipe opened, dish cooked…), linked to your account, or to an anonymous identifier if you are not signed in. They tell us what is useful, to improve it. Never sold, never used for ads.",
    catUsageBenefit:  '✓ With: we know what really helps you, and what needs work',
    catUsageDrawback: '✗ Without: nothing changes for you — we improve the app blindly',
    catUsageRetention:'13 months',
    catUsageVendors:  "No third-party tool: stored in Fridge+'s database (Supabase, European Union)",

    catVoiceTitle:    '🎙️ Voice recognition',
    catVoiceBadge:    'Microphone',
    catVoiceDesc:     "Lets you add ingredients to your fridge by speaking. To transcribe your voice, your browser sends the audio to a third-party service (Google for Chrome/Edge, Apple for Safari). Fridge+ keeps neither the audio nor the text.",
    catVoiceBenefit:  '✓ With: add ingredients hands-free by voice',
    catVoiceDrawback: '✗ Without: add ingredients by touch only',
    catVoiceRetention:'No retention (audio and text are not stored)',
    catVoiceVendors:  'Audio recipients: Google (Chrome/Edge) or Apple (Safari) depending on your browser',

    catReceiptTitle:     '🧾 Receipt photo',
    catReceiptBadge:     'By photo',
    catReceiptDesc:      "Lets you add ingredients by photographing your grocery receipt. The photo is sent to Google Cloud Vision to read its text, then immediately deleted — Fridge+ only keeps the ingredient names you confirm afterwards.",
    catReceiptBenefit:   '✓ With: add several ingredients at once by photographing your receipt',
    catReceiptDrawback:  '✗ Without: add ingredients one by one, manually',
    catReceiptRetention: 'No photo retention (deleted immediately after reading)',
    catReceiptVendors:   'Photo recipient: Google Cloud Vision (text reading only)',
  },
}
