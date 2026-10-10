import { SUPPORT_EMAIL } from '@shared/lib/contact'

// Le contenu de la page publique « Accessibilité » (/accessibilite), en UN seul endroit.
//
// Décision du 2026-10-08 : une page courte et honnête, liée au pied de page —
// ce qui est fait, ce qui reste, comment signaler un problème —, préparée à
// l’avance pour les moteurs. La page vivante (`pages/accessibility-page.jsx`)
// et le HTML servi (`src/prerender/corps-statique.js`) lisent ce module.
//
// 🔴 « Honnête » se vérifie : `pages-accessibilite-et-securite.test.jsx`
// confronte chaque promesse à ce qui la tient (critères et largeurs de la passe
// axe de la CI, cibles de 24 px de `Button`, bloc `prefers-reduced-motion`,
// flèches des étapes, chemin du support). Le jour où l’un d’eux tombe, la page
// change avec lui. Et quand un point de « Ce qui reste à faire » est livré (le
// focus au changement de page — audit A11Y-16 —, les petits textes), il passe
// dans « Ce qui est fait » dans la même PR.

const ECRIRE = (objet) => `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(objet)}`

export const PAGE_ACCESSIBILITE = {
  fr: {
    titre: 'Accessibilité',
    intro: 'Fridge+ doit pouvoir servir à tout le monde : au clavier, avec un lecteur d’écran, avec des animations réduites. Voici ce qui est fait, ce qui ne l’est pas encore, et comment nous signaler un problème.',
    sections: [
      {
        id: 'accessibilite-fait',
        titre: 'Ce qui est fait',
        liste: [
          'L’app se parcourt au clavier : le focus reste visible, et chaque fenêtre le garde, se ferme avec Échap et le rend à ce qui l’avait ouverte.',
          'Les boutons, les champs et les fenêtres portent un nom que lisent les lecteurs d’écran, et les messages importants (erreurs, confirmations, nombre de recettes trouvées) sont annoncés.',
          'Les textes atteignent un contraste d’au moins 4,5:1, en thème clair comme en thème sombre.',
          'Les boutons offrent une cible d’au moins 24 pixels de côté.',
          'Aucun message ne disparaît sous tes yeux : les notifications se mettent en pause quand tu les survoles ou que tu y places le focus, et la question « Comment c’était ? » attend que tu quittes la fiche.',
          'Si ton appareil demande de réduire les animations, l’app les coupe.',
          'Les étapes d’une recette se réordonnent aussi avec des boutons ↑ ↓, sans avoir à glisser.',
          'La voix et la photo du ticket ne sont jamais obligatoires : tout peut se saisir au clavier.',
        ],
      },
      {
        id: 'accessibilite-verifie',
        titre: 'Comment c’est vérifié',
        paragraphes: [
          'À chaque modification du code, une analyse automatique (axe-core, critères WCAG 2.2 de niveau AA) passe sur les pages publiques et sur les principaux écrans de l’app, en thème clair et en thème sombre, sur ordinateur et sur téléphone. Un défaut nouveau fait échouer la vérification.',
          'Cette page n’est pas une déclaration de conformité : Fridge+ n’a pas encore été audité par un organisme indépendant.',
        ],
      },
      {
        id: 'accessibilite-reste',
        titre: 'Ce qui reste à faire',
        liste: [
          'Au changement de page, le focus du clavier n’est pas encore replacé en haut de la nouvelle page, et les lecteurs d’écran n’en annoncent pas toujours le titre.',
          'Certains petits textes font encore moins de 12 pixels. Aucun nouveau n’est accepté, et ils sont agrandis au fil des versions.',
        ],
      },
      {
        id: 'accessibilite-signaler',
        titre: 'Signaler un problème',
        paragraphes: [
          'Un obstacle, un bouton sans nom, un texte illisible ? Écris-nous en disant la page, ce que tu essayais de faire et, si tu le veux, l’outil que tu utilises (lecteur d’écran, navigateur). Dans l’app, tu peux aussi passer par « Aide & infos » → « Contacter le support ».',
        ],
        lien: { href: ECRIRE('Accessibilité'), texte: `Écrire à ${SUPPORT_EMAIL}` },
      },
    ],
    miseAJour: 'Page mise à jour le 10 octobre 2026.',
  },
  en: {
    titre: 'Accessibility',
    intro: 'Fridge+ should work for everyone: with a keyboard, with a screen reader, with reduced motion. Here is what is done, what is not done yet, and how to report a problem to us.',
    sections: [
      {
        id: 'accessibilite-fait',
        titre: 'What is done',
        liste: [
          'The app can be used with a keyboard: focus stays visible, and every dialog keeps it, closes with Escape and gives it back to whatever opened it.',
          'Buttons, fields and dialogs have names that screen readers read out, and important messages (errors, confirmations, the number of recipes found) are announced.',
          'Text reaches a contrast ratio of at least 4.5:1, in the light theme as in the dark theme.',
          'Buttons offer a target of at least 24 pixels square.',
          'No message vanishes before you can read it: notifications pause while you hover them or focus them, and the “How was it?” question waits until you leave the recipe.',
          'If your device asks for reduced motion, the app turns its animations off.',
          'The steps of a recipe can also be reordered with ↑ ↓ buttons, without dragging.',
          'Voice and receipt photos are never required: everything can be typed in.',
        ],
      },
      {
        id: 'accessibilite-verifie',
        titre: 'How it is checked',
        paragraphes: [
          'Every change to the code runs an automated analysis (axe-core, WCAG 2.2 level AA criteria) on the public pages and on the main screens of the app, in the light and dark themes, on desktop and on mobile. Any new defect fails the check.',
          'This page is not a statement of conformity: Fridge+ has not yet been audited by an independent body.',
        ],
      },
      {
        id: 'accessibilite-reste',
        titre: 'What remains to be done',
        liste: [
          'When you change page, keyboard focus is not yet moved to the top of the new page, and screen readers do not always announce its title.',
          'Some small text is still under 12 pixels. No new instance is accepted, and they are enlarged release after release.',
        ],
      },
      {
        id: 'accessibilite-signaler',
        titre: 'Report a problem',
        paragraphes: [
          'An obstacle, a button with no name, unreadable text? Write to us with the page, what you were trying to do and, if you like, the tool you use (screen reader, browser). In the app, you can also go through “Help & info” → “Contact support”.',
        ],
        lien: { href: ECRIRE('Accessibility'), texte: `Email ${SUPPORT_EMAIL}` },
      },
    ],
    miseAJour: 'Page updated on 10 October 2026.',
  },
}
