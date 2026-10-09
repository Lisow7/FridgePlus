// Réponses rapides admin (templates) pour le support. Statique, FR + EN.
// Accélère le traitement des tickets récurrents : un clic insère le texte dans
// la zone de réponse, l'admin peut ensuite l'ajuster.

export const SUPPORT_QUICK_REPLIES = [
  {
    id: 'ack',
    label: { fr: 'Accusé réception', en: 'Acknowledge' },
    text: {
      fr: 'Merci pour ton message ! On regarde ça et on revient vers toi rapidement.',
      en: 'Thanks for your message! We\'re looking into it and will get back to you shortly.',
    },
  },
  {
    id: 'info',
    label: { fr: 'Demande d\'infos', en: 'Ask for details' },
    text: {
      fr: 'Peux-tu nous en dire un peu plus (ce que tu faisais, une capture d\'écran si possible) ? Ça nous aidera à t\'aider.',
      en: 'Could you tell us a bit more (what you were doing, a screenshot if possible)? It will help us help you.',
    },
  },
  {
    id: 'bug',
    label: { fr: 'Bug pris en compte', en: 'Bug noted' },
    text: {
      fr: 'Merci pour le signalement, le bug est confirmé. Il sera corrigé dans une prochaine mise à jour.',
      en: 'Thanks for the report, the bug is confirmed. It will be fixed in an upcoming update.',
    },
  },
  {
    id: 'suggestion',
    label: { fr: 'Suggestion notée', en: 'Suggestion noted' },
    text: {
      fr: 'Merci pour la suggestion ! On la note pour de futures améliorations.',
      en: 'Thanks for the suggestion! We\'re noting it for future improvements.',
    },
  },
  {
    id: 'resolved',
    label: { fr: 'Résolu', en: 'Resolved' },
    text: {
      fr: 'C\'est résolu de notre côté. N\'hésite pas à revenir vers nous si besoin !',
      en: 'It\'s resolved on our side. Feel free to reach out again if needed!',
    },
  },
]

/** Texte d'une réponse rapide dans la langue (fallback fr ; '' si id inconnu). */
export function quickReplyText(id, lang = 'fr') {
  const entry = SUPPORT_QUICK_REPLIES.find((q) => q.id === id)
  if (!entry) return ''
  return entry.text[lang] ?? entry.text.fr
}
