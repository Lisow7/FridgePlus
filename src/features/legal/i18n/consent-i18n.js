// Textes i18n × 5 langues partagés entre le bandeau, le modal et le panneau
// profil. Centralisés ici pour rester cohérents : si on change le wording de
// la catégorie « Fonctionnels », on le change à un seul endroit.

export const I18N = {
  fr: {
    bannerTitle:      '🍪 Cookies et données',
    bannerIntro:      "Fridge+ stocke quelques données sur ton appareil pour fonctionner correctement, te proposer un mode hors-ligne et nous aider à corriger les bugs. Choisis ce que tu acceptes — modifiable à tout moment.",
    bannerSeeMore:    'Voir la politique de confidentialité',
    btnAcceptAll:     'Tout accepter',
    btnRefuseAll:     'Tout refuser',
    btnCustomize:     'Personnaliser',
    btnSave:          'Enregistrer mes choix',
    btnClose:         'Fermer',
    btnReset:         'Réinitialiser mes choix',

    catEssTitle:      '🟢 Essentiels',
    catEssBadge:      'Toujours actifs',
    catEssDesc:       "Strictement nécessaires au fonctionnement de Fridge+ : ta session, ta langue, ton thème, et ton frigo en mode invité. Sans ces données, l'app ne peut pas marcher. Aucun consentement n'est requis (RGPD art. 5).",
    catEssRetention:  "Tant que tu utilises l'app",

    catFuncTitle:     '🟡 Fonctionnels',
    catFuncBadge:     'Recommandé',
    catFuncDesc:      "Permet à Fridge+ d'aller plus vite et de fonctionner hors-ligne en gardant en cache les recettes, les ingrédients et le panier.",
    catFuncBenefit:   '✓ Avec : mode hors-ligne complet, app rapide même en wifi faible',
    catFuncDrawback:  '✗ Sans : recharge à chaque visite, mode hors-ligne dégradé, pas de cache des prix',
    catFuncRetention: '24 heures à 30 jours selon le cache',

    catAudTitle:      '🔵 Mesure d\'audience',
    catAudBadge:      'Anonymisé',
    catAudDesc:       "Nous aide à détecter les bugs et à comprendre comment l'app est utilisée pour l'améliorer. Aucune donnée personnelle, agrégats anonymes uniquement.",
    catAudBenefit:    '✓ Avec : on corrige les bugs plus vite, on sait quelles features améliorer',
    catAudDrawback:   '✗ Sans : on ne saura pas si tu rencontres un bug',
    catAudRetention:  '90 jours',
    catAudVendors:    'Outils utilisés : Sentry (monitoring erreurs)',

    catVoiceTitle:    '🎙️ Reconnaissance vocale',
    catVoiceBadge:    'Au micro',
    catVoiceDesc:     "Permet d'ajouter des ingrédients à ton frigo en parlant. Pour transcrire ta voix, ton navigateur transmet l'audio à un service tiers (Google pour Chrome/Edge, Apple pour Safari). Fridge+ ne conserve ni l'audio ni le texte.",
    catVoiceBenefit:  '✓ Avec : ajoute tes ingrédients à la voix, mains libres',
    catVoiceDrawback: '✗ Sans : ajout des ingrédients au toucher uniquement',
    catVoiceRetention:'Aucune conservation (audio et texte non stockés)',
    catVoiceVendors:  'Destinataires de l\'audio : Google (Chrome/Edge) ou Apple (Safari) selon ton navigateur',

    catReceiptTitle:     '🧾 Scan ticket de caisse',
    catReceiptBadge:     'Par photo',
    catReceiptDesc:      "Permet d'ajouter des ingrédients en photographiant ton ticket de caisse. La photo est envoyée à Google Cloud Vision pour en lire le texte, puis immédiatement supprimée — Fridge+ ne conserve que les noms d'ingrédients que tu valides ensuite.",
    catReceiptBenefit:   '✓ Avec : ajoute plusieurs ingrédients d\'un coup en photographiant ton ticket',
    catReceiptDrawback:  '✗ Sans : ajout des ingrédients un par un, manuellement',
    catReceiptRetention: 'Aucune conservation de la photo (supprimée immédiatement après lecture)',
    catReceiptVendors:   'Destinataire de la photo : Google Cloud Vision (lecture du texte uniquement)',

    catPushTitle:     '🔔 Notifications push',
    catPushBadge:     'Optionnel',
    catPushDesc:      "Reçois une notification native sur ton téléphone ou ton ordinateur (en dehors de l'app) pour les annonces importantes de Fridge+, si un reste arrive à péremption, et si tu n'as pas ouvert l'app depuis un moment.",
    catPushBenefit:   '✓ Avec : annonces importantes + alertes péremption des restes + rappels visibles même quand l\'app est fermée',
    catPushDrawback:  '✗ Sans : aucune notification en dehors de l\'app (ni annonce, ni alerte péremption, ni rappel — juste la cloche interne)',
    catPushRetention: 'Tant que tu ne désactives pas (abonnement supprimé immédiatement à la désactivation)',
    catPushVendors:   'Relayé par le service push de ton navigateur, sans lecture du contenu (chiffré de bout en bout)',
    catPushBlocked:   "Installe d'abord Fridge+ sur ton écran d'accueil pour activer cette option (contrainte iOS).",
    catPushError:     "Impossible d'activer les notifications sur ce navigateur. Si tu es dans le navigateur intégré d'une autre app (ex : app Google), essaie d'ouvrir fridgeplus.app directement dans Chrome.",
    catPushStatusOn:  'Activées',
    catPushStatusOff: 'Désactivées',

    profileTabTitle:  'Confidentialité',
    profileIntro:     "Gère ici les données que Fridge+ stocke sur ton appareil. Tu peux changer tes choix à tout moment, c'est ton droit (RGPD art. 7-3).",
    profileCurrent:   'Dernière mise à jour',
    profileSeePolicy: 'Voir la politique de confidentialité',
    profileResetWarn: "Réinitialiser efface tes préférences cookies et révoque ton acceptation de la charte de la communauté (tu devras la ré-accepter pour interagir à nouveau). Tes données de compte (frigo, recettes, favoris, posts publiés) ne sont pas affectées.",

    statusAccepted:   'Accepté',
    statusRefused:    'Refusé',
    statusAlways:     'Toujours actif',

    footerBtn:        'Cookies',
  },

  en: {
    bannerTitle:      '🍪 Cookies and data',
    bannerIntro:      "Fridge+ stores some data on your device to run properly, offer an offline mode, and help us fix bugs. Choose what you accept — changeable anytime.",
    bannerSeeMore:    'View the privacy policy',
    btnAcceptAll:     'Accept all',
    btnRefuseAll:     'Refuse all',
    btnCustomize:     'Customize',
    btnSave:          'Save my choices',
    btnClose:         'Close',
    btnReset:         'Reset my choices',

    catEssTitle:      '🟢 Essential',
    catEssBadge:      'Always on',
    catEssDesc:       "Strictly required for Fridge+ to work: your session, language, theme, and guest-mode fridge. Without these, the app can't function. No consent required (GDPR art. 5).",
    catEssRetention:  'While you use the app',

    catFuncTitle:     '🟡 Functional',
    catFuncBadge:     'Recommended',
    catFuncDesc:      "Lets Fridge+ run faster and work offline by caching recipes, ingredients and your cart.",
    catFuncBenefit:   '✓ With: full offline mode, fast app even on weak wifi',
    catFuncDrawback:  '✗ Without: reload every visit, degraded offline mode, no price cache',
    catFuncRetention: '24 hours to 30 days depending on cache',

    catAudTitle:      "🔵 Audience measurement",
    catAudBadge:      'Anonymized',
    catAudDesc:       "Helps us detect bugs and understand how the app is used to improve it. No personal data, only anonymous aggregates.",
    catAudBenefit:    '✓ With: faster bug fixes, smarter improvements',
    catAudDrawback:   '✗ Without: we won\'t know if you hit a bug',
    catAudRetention:  '90 days',
    catAudVendors:    'Tools used: Sentry (error monitoring)',

    catVoiceTitle:    '🎙️ Voice recognition',
    catVoiceBadge:    'Microphone',
    catVoiceDesc:     "Lets you add ingredients to your fridge by speaking. To transcribe your voice, your browser sends the audio to a third-party service (Google for Chrome/Edge, Apple for Safari). Fridge+ keeps neither the audio nor the text.",
    catVoiceBenefit:  '✓ With: add ingredients hands-free by voice',
    catVoiceDrawback: '✗ Without: add ingredients by touch only',
    catVoiceRetention:'No retention (audio and text are not stored)',
    catVoiceVendors:  'Audio recipients: Google (Chrome/Edge) or Apple (Safari) depending on your browser',

    catReceiptTitle:     '🧾 Receipt scan',
    catReceiptBadge:     'By photo',
    catReceiptDesc:      "Lets you add ingredients by photographing your grocery receipt. The photo is sent to Google Cloud Vision to read its text, then immediately deleted — Fridge+ only keeps the ingredient names you confirm afterwards.",
    catReceiptBenefit:   '✓ With: add several ingredients at once by photographing your receipt',
    catReceiptDrawback:  '✗ Without: add ingredients one by one, manually',
    catReceiptRetention: 'No photo retention (deleted immediately after reading)',
    catReceiptVendors:   'Photo recipient: Google Cloud Vision (text reading only)',

    catPushTitle:     '🔔 Push notifications',
    catPushBadge:     'Optional',
    catPushDesc:      "Get a native notification on your phone or computer (outside the app) for important Fridge+ announcements, when a leftover is about to expire, and if you haven't opened the app in a while.",
    catPushBenefit:   '✓ With: important announcements + leftover expiry alerts + reminders visible even when the app is closed',
    catPushDrawback:  '✗ Without: no notification outside the app (no announcements, no expiry alerts, no reminders — only the in-app bell)',
    catPushRetention: 'Until you disable it (subscription deleted immediately on disable)',
    catPushVendors:   'Relayed by your browser\'s push service, without reading the content (end-to-end encrypted)',
    catPushBlocked:   'Install Fridge+ to your home screen first to enable this (iOS requirement).',
    catPushError:     "Couldn't enable notifications in this browser. If you're in another app's built-in browser (e.g. the Google app), try opening fridgeplus.app directly in Chrome.",
    catPushStatusOn:  'Enabled',
    catPushStatusOff: 'Disabled',

    profileTabTitle:  'Privacy',
    profileIntro:     "Manage the data Fridge+ stores on your device here. You can change your choices anytime — it's your right (GDPR art. 7-3).",
    profileCurrent:   'Last update',
    profileSeePolicy: 'View the privacy policy',
    profileResetWarn: "Resetting clears your cookie preferences and revokes your acceptance of the community charter (you will need to accept it again to interact). Your account data (fridge, recipes, favorites, published posts) is not affected.",

    statusAccepted:   'Accepted',
    statusRefused:    'Refused',
    statusAlways:     'Always on',

    footerBtn:        'Cookies',
  },



}
