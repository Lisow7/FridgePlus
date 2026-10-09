import {
  LuRefrigerator, LuClipboardList, LuChefHat, LuMic, LuCookingPot, LuHeart, LuGlobe,
  LuPencilLine, LuUserRound, LuCamera, LuShoppingCart, LuCoins, LuAudioLines,
} from 'react-icons/lu'

// Une fonctionnalité = une icône, LA MÊME que dans le menu du bouton orange
// quand elle y figure (voix, ticket, recettes, inventaire, restes). Jusqu'au
// 2026-09-11 la modale d'aide employait des emoji (🎙️ 🧾 🧑‍🍳…) là où le menu
// employait Lucide : l'utilisateur lisait une chose et en voyait une autre.
export const FEATURE_ICONS = {
  fridge:    LuRefrigerator,
  inventory: LuClipboardList,   // = menu « Inventaire »
  recipes:   LuChefHat,         // = menu « Recettes »
  voice:     LuMic,             // = menu « À la voix »
  leftovers: LuCookingPot,      // = menu « Restes »
  favorites: LuHeart,
  community: LuGlobe,
  create:    LuPencilLine,
  profile:   LuUserRound,
  receipt:   LuCamera,          // = menu « Photo du ticket »
  cart:      LuShoppingCart,
  costs:     LuCoins,
  cooking:   LuAudioLines,
}
