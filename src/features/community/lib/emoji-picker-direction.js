// Décide où ouvrir le picker de réaction emoji (audit UX 2026-07-17 : le
// picker ouvert vers le haut recouvrait le corps du post sur les posts
// courts). Priorité : ouvrir à droite du bouton (même ligne, dans l'espace
// déjà vide entre le compteur de réponses et les boutons de droite) — ne
// recouvre jamais le texte du post. Fallback vers le haut (comportement
// historique) uniquement si la place à droite est insuffisante (mobile
// étroit, ou bouton proche du bord droit).
export function pickReactionPickerSide(spaceRightPx, pickerWidthEstimate = 200) {
  return spaceRightPx >= pickerWidthEstimate ? 'right' : 'above'
}
