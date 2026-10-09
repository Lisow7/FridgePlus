import { LuLayoutGrid, LuGlobe, LuLightbulb, LuCircleHelp, LuTrophy, LuMessageSquare } from 'react-icons/lu'

// Thème & helpers partagés de la communauté — extraits de community-page.jsx
// (2026-07-25, audit front §2) pour amorcer le découpage du composant monstre
// (1951 l) : chaque sous-composant (PostCard, ReplyCard, FeedContent…) les
// utilise via le scope module. En les sortant en premier, les extractions
// suivantes importent d'ici sans créer d'import circulaire.
//
// Ce fichier n'exporte QUE des constantes/helpers (pas de composant React) —
// le composant CategoryIcon vit dans community-category-icon.jsx pour respecter
// la règle react-refresh (un fichier n'exporte pas à la fois composants et
// non-composants).

export const CD = {                                   // Dark — cyberpunk nuit
  page:       '#06080D',
  surface:    '#0B0F18',
  surface2:   '#0E1420',
  surfaceUp:  '#141C28',
  border:     '#1A2235',
  borderHi:   '#243050',
  orange:     '#FF6B1A',
  orangeText: '#FF6B1A',
  orangeDim:  'rgba(255,107,26,0.18)',
  cyan:       '#00C8F0',
  cyanText:   '#00C8F0',
  cyanDim:    'rgba(0,200,240,0.16)',
  lime:       '#AAFF00',
  limeText:   '#AAFF00',
  limeDim:    'rgba(170,255,0,0.14)',
  magenta:    '#FF2D78',
  magentaDim: 'rgba(255,45,120,0.17)',
  purple:     '#9747FF',
  // Seul token *Text a differer de son *Dim en sombre : `#9747FF` sur son
  // propre fond ne rendait que 3,87:1. Eclairci du minimum necessaire.
  purpleText: '#A35DFF',
  purpleDim:  'rgba(151,71,255,0.17)',
  hi:         '#D5E3F5',
  // Éclairci de #506080 le 2026-08-23 : sur les trois fonds sombres du fil
  // (#06080d, #0b0f18, #0e1420), le texte secondaire tombait entre 2,91 et
  // 3,17:1 pour un seuil WCAG AA de 4,5 — 9 nœuds en échec sur /community,
  // tous dus à cette seule ligne. Teinte et saturation conservées, seule la
  // luminosité monte, du minimum nécessaire pour franchir le seuil sur le
  // fond le plus clair des trois (le cas contraignant). `CL.mid` n'est pas
  // concerné : sur fond clair il était déjà conforme.
  mid:        '#6B7EA3',
  lo:         '#1E2A3D',
  danger:     '#E84040',
  dangerDim:  'rgba(232,64,64,0.15)',
}

export const CL = {                                   // Light — cyberpunk jour
  page:       '#EEF2FA',
  surface:    '#FFFFFF',
  surface2:   '#F4F7FE',
  surfaceUp:  '#E8EEF8',
  border:     '#D0DAF0',
  borderHi:   '#A8C0E0',
  // ⚠️ Les tokens `*Text` existent parce que ces teintes servent AUSSI de FOND
  // (degrades de `community-compose-modal.jsx` l. 109 et 283) : les assombrir
  // en place repeindrait ces surfaces pour reparer du texte.
  // 🔴 Ces couleurs habillent le filtre de categorie ACTIF, pose sur son propre
  // `*Dim`. axe-core ne les voit JAMAIS : au chargement, seul « Toutes » est
  // actif — les autres n'apparaissent qu'apres un clic. Mesure a la main :
  // tips 3,88 · general 3,86 · questions 3,83 (pride 4,92 et feedback 6,59
  // passaient deja et restent inchanges).
  orange:     '#C84000',
  orangeText: '#B93100',
  orangeDim:  'rgba(200,64,0,0.10)',
  cyan:       '#007AA0',
  cyanText:   '#006B8D',
  cyanDim:    'rgba(0,122,160,0.10)',
  lime:       '#3E8000',
  limeText:   '#377200',
  limeDim:    'rgba(62,128,0,0.10)',
  magenta:    '#B8005A',
  magentaDim: 'rgba(184,0,90,0.10)',
  purple:     '#5818C8',
  purpleText: '#5818C8',
  purpleDim:  'rgba(88,24,200,0.10)',
  hi:         '#0C1525',
  mid:        '#566480',
  lo:         '#DDE5F5',
  danger:     '#C82020',
  dangerDim:  'rgba(200,32,32,0.10)',
}

export function getC(darkMode) { return darkMode ? CD : CL }

export function catColor(cat, darkMode) {
  const C = getC(darkMode)
  return ({
    all:       { color: C.orangeText, dim: C.orangeDim  },
    general:   { color: C.limeText,   dim: C.limeDim    },
    tips:      { color: C.orangeText, dim: C.orangeDim  },
    questions: { color: C.cyanText,   dim: C.cyanDim    },
    pride:     { color: C.magenta,    dim: C.magentaDim },
    feedback:  { color: C.purpleText, dim: C.purpleDim  },
  })[cat] ?? { color: C.orangeText, dim: C.orangeDim }
}

export const CATEGORY_ICONS = {
  all:       LuLayoutGrid,
  general:   LuGlobe,
  tips:      LuLightbulb,
  questions: LuCircleHelp,
  pride:     LuTrophy,
  feedback:  LuMessageSquare,
}
