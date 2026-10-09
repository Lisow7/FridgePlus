// Construction des options d'ingrédients du formulaire de recette : liste plate
// (recherche) et liste groupée par emplacement de stockage.
//
// Extrait de `recipe-form-modal.jsx` le 2026-07-30 (§2 audit front). Fonctions
// pures, sans JSX ni état ; `STORAGE_LABELS` ne servait qu'à elles, il descend
// donc ici plutôt que de rester une constante du composant.

const STORAGE_LABELS = {
  frz: { fr: 'Surgelé',    en: 'Frozen',      es: 'Congelado',  de: 'Tiefkühl',      ja: '冷凍'   },
  vg:  { fr: 'Légumes',    en: 'Vegetables',  es: 'Verduras',   de: 'Gemüse',        ja: '野菜'   },
  gp:  { fr: 'Épicerie',   en: 'Pantry',      es: 'Despensa',   de: 'Vorratskammer', ja: '食料品' },
  fr:  { fr: 'Réfrigérateur', en: 'Fridge',   es: 'Nevera',     de: 'Kühlschrank',   ja: '冷蔵'  },
  sp:  { fr: 'Épices',     en: 'Spices',      es: 'Especias',   de: 'Gewürze',       ja: '調味料' },
  bk:  { fr: 'Boulangerie',en: 'Bakery',      es: 'Panadería',  de: 'Bäckerei',      ja: 'パン'   },
}

export function buildFlatIngredients(ingredients, lang) {
  const seen = new Set()
  const list = []
  for (const items of Object.values(ingredients)) {
    for (const item of items) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      const prefix = item.id.split('-')[0]
      const storageLabel = STORAGE_LABELS[prefix]?.[lang] ?? STORAGE_LABELS[prefix]?.fr ?? ''
      list.push({ id: item.id, label: item.labels[lang] ?? item.labels.fr, allLabels: item.labels, emoji: item.emoji, storageLabel })
    }
  }
  return list.sort((a, b) => a.label.localeCompare(b.label, lang))
}

export function buildGroupedIngredients(ingredients, lang, fridgeLayouts) {
  const layout = fridgeLayouts?.[lang] ?? fridgeLayouts?.fr ?? { fridge: [], pantry: [] }
  const allSections = [...(layout.fridge ?? []), ...(layout.pantry ?? [])]
  const groups = []
  for (const section of allSections) {
    for (const sub of section.subcategories ?? []) {
      const items = ingredients[sub.id]
      if (!items?.length) continue
      groups.push({
        id: sub.id,
        label: sub.label,
        emoji: sub.emoji,
        items: items
          .map(item => ({ id: item.id, label: item.labels[lang] ?? item.labels.fr, allLabels: item.labels, emoji: item.emoji }))
          .sort((a, b) => a.label.localeCompare(b.label, lang)),
      })
    }
  }
  return groups
}
