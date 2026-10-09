// Libellés du shell de l'application — aujourd'hui le seul lien d'évitement.
//
// ── Pourquoi un fichier, pour deux mots ────────────────────────────────────
// Ce dictionnaire vivait dans `app-shell.jsx`. Il y était **invisible** au
// garde-fou de parité des langues : le glob de `i18n-dictionaries-parity.test.js`
// cible `/src/**/*i18n*.{js,jsx}`, et `app-shell.jsx` ne correspond pas. Une
// 6ᵉ langue ajoutée à moitié n'aurait donc rien déclenché.
//
// 🥇 **Un dictionnaire hors d'un fichier `*i18n*` n'est pas couvert.** Le même
// piège avait été évité le 2026-08-16 en nommant `faq-basics-i18n.js` ; celui-ci
// était passé au travers parce qu'il tenait sur deux lignes.
//
// 5 langues : contrairement aux dictionnaires fr/en du projet, ce libellé sert
// la PREMIÈRE touche de tabulation de chaque page — le traduire coûte moins que
// d'expliquer pourquoi il ne l'est pas.

export const SHELL_I18N = {
  fr: { skipToContent: 'Aller au contenu' },
  en: { skipToContent: 'Skip to content' },
  es: { skipToContent: 'Ir al contenido' },
  de: { skipToContent: 'Zum Inhalt springen' },
  ja: { skipToContent: 'コンテンツへ移動' },
}
