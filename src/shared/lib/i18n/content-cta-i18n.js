// Libellés du bloc de fin des pages de contenu public (`/faq`, `/guide`).
//
// ── Pourquoi ce bloc existe ────────────────────────────────────────────────
// Depuis que ces pages sont trouvables depuis un moteur de recherche, elles
// sont des portes d'entrée. Quelqu'un qui arrive de Google, lit, et se laisse
// convaincre n'avait pour toute suite qu'un « Retour à l'accueil » en haut de
// page — c'est-à-dire une sortie, pas une invitation.
//
// ── Ce que disent les pratiques établies ──────────────────────────────────
// Un appel à l'action de fin de page se lit en trois mots, reste contextuel
// plutôt que vendeur, et dit ce qui se passe ensuite. D'où « Ouvrir mon
// frigo » suivi de « Gratuit, sans compte » : les deux objections les plus
// probables — ça coûte quelque chose ? il faut s'inscrire ? — tombent avant
// d'être formulées. Et c'est vrai : le frigo, les recettes et le micro
// fonctionnent sans compte.
//
// ⚠️ Si le premium s'allume un jour, « Gratuit, sans compte » devra être
// revérifié — la promesse resterait vraie pour le socle, mais le mot
// « gratuit » seul deviendrait ambigu.
//
// fr + en seulement, comme les pages qu'il sert : elles retombent sur
// l'anglais pour es/de/ja plutôt que de mélanger deux langues.

export const CONTENT_CTA_I18N = {
  fr: {
    title: 'Prêt à cuisiner ?',
    action: 'Ouvrir mon frigo',
    note: 'Gratuit, sans compte',
    guideLink: 'Comment ça marche, étape par étape',
    faqLink: 'Questions fréquentes',
  },
  en: {
    title: 'Ready to cook?',
    action: 'Open my fridge',
    note: 'Free, no account needed',
    guideLink: 'How it works, step by step',
    faqLink: 'Frequently asked questions',
  },
}

// `?? .en` et non `?? .fr` : même cascade que `getFaqBasics` et
// `legal-content.js`, qui font retomber es/de/ja sur l'anglais.
export function getContentCta(lang) {
  return CONTENT_CTA_I18N[lang] ?? CONTENT_CTA_I18N.en
}
