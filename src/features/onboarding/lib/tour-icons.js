import { LuDoorOpen, LuSearch, LuMic, LuCamera, LuClipboardList, LuCookingPot, LuChefHat } from 'react-icons/lu'

// Une action du menu du bouton orange = une icône, la même dans le menu
// (fridge-fab.jsx), le guide et la visite. Jusqu'au 2026-09-11 le guide
// disait « 🎙️ » et « 🧾 » là où le menu montrait un micro et une caméra Lucide.
export const TOUR_ICONS = {
  door: LuDoorOpen,           // « Ouvrir le frigo »
  search: LuSearch,           // « Chercher un aliment »
  mic: LuMic,                 // « À la voix »
  camera: LuCamera,           // « Photo du ticket »
  inventory: LuClipboardList, // « Inventaire »
  leftovers: LuCookingPot,    // « Restes »
  recipes: LuChefHat,         // « Recettes »
}
