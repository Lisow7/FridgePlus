// Copie HONNÊTE (Blocker A) : READY = « tu peux cuisiner » ; ALMOST = « il te manque X ».
export const AHA_NUDGE_I18N = {
  fr: { ready: (n) => `✨ Tu peux cuisiner ${n} !`, almost: (m, n) => `Il te manque juste ${m} pour ${n}`, dismiss: 'Masquer', aria: 'Suggestion de recette' },
  en: { ready: (n) => `✨ You can cook ${n}!`, almost: (m, n) => `You just need ${m} for ${n}`, dismiss: 'Dismiss', aria: 'Recipe suggestion' },
  es: { ready: (n) => `✨ ¡Puedes cocinar ${n}!`, almost: (m, n) => `Solo te falta ${m} para ${n}`, dismiss: 'Ocultar', aria: 'Sugerencia de receta' },
  de: { ready: (n) => `✨ Du kannst ${n} kochen!`, almost: (m, n) => `Dir fehlt nur ${m} für ${n}`, dismiss: 'Ausblenden', aria: 'Rezeptvorschlag' },
  ja: { ready: (n) => `✨ ${n}を作れます！`, almost: (m, n) => `${n}まであと${m}だけ`, dismiss: '非表示', aria: 'レシピの提案' },
}
