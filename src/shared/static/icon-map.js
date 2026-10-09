import {
  LuSnowflake, LuThermometer, LuBox, LuPackage, LuLeaf,
  LuBeef, LuFish, LuMilk, LuHam,
  LuIceCreamBowl, LuCroissant, LuBean, LuApple,
  LuCalendar, LuCalendarDays,
  LuWheat, LuCandy, LuFlame, LuDroplets, LuUtensils, LuNut,
} from 'react-icons/lu'

export const FOOD_ICONS = {
  // Compartiments frigo
  freezer:       LuSnowflake,
  fresh:         LuThermometer,
  leftovers:     LuBox,
  crisper:       LuLeaf,
  vegetable:     LuLeaf,
  // Sous-catégories frigo — congelés
  'frozen-meat':  LuBeef,
  'frozen-fish':  LuFish,
  'frozen-veg':   LuLeaf,
  'ready-meals':  LuUtensils,
  'ice-cream':    LuIceCreamBowl,
  'frozen-bread': LuCroissant,
  // Sous-catégories frigo — frais
  meat:          LuBeef,
  fish:          LuFish,
  bof:           LuMilk,
  deli:          LuHam,
  today:         LuCalendar,
  thisweek:      LuCalendarDays,
  vegetables:    LuLeaf,
  fruits:        LuApple,
  tofu:          LuBean,
  // Sections garde-manger
  dry:           LuWheat,
  spices:        LuFlame,
  // Sous-catégories garde-manger
  'pasta-rice':  LuWheat,
  canned:        LuPackage,
  cereals:       LuWheat,
  bread:         LuCroissant,
  sweet:         LuCandy,
  'nuts-dried':  LuNut,
  'salt-spices': LuFlame,
  herbs:         LuLeaf,
  sauces:        LuDroplets,
  oils:          LuDroplets,
  // Japonais
  rice:          LuWheat,
  basic:         LuFlame,
}
