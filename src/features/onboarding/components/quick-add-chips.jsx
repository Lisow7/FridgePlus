import { INGREDIENTS } from '@shared/static/ingredients'
import { QUICK_ADD_IDS } from '../lib/quick-add-ingredients'

// Index id → { labels, emoji } construit une fois (statique).
const BY_ID = Object.fromEntries(Object.values(INGREDIENTS).flat().map((i) => [i.id, i]))

// Libellés d'affichage surchargés pour certaines puces. On STOCKE une feuille
// concrète (ex. fr-beurre-doux, stockable + matche les recettes via l'expansion
// de groupe fr-beurre) mais on AFFICHE le nom générique (« Beurre ») : plus
// lisible et cohérent avec le picker du frigo (groupe « Beurre »). Cf. demande
// user : éviter « Beurre doux » qui semblait faire doublon avec « Beurre ».
const LABEL_OVERRIDES = {
  'fr-beurre-doux': { fr: 'Beurre', en: 'Butter' },
}

// Puces d'ajout rapide (« Démarre vite »), intégrées DANS la 1ʳᵉ étape de la
// carte « Bien démarrer » (fil rouge). Chaque puce est un TOGGLE : tap = ajoute
// (puce pleine + ✓), re-tap = retire. Le feedback visuel (état ajouté) évite de
// « naviguer à l'aveugle » : on voit immédiatement ce qui est dans le frigo.
// Présentational : reçoit `stock` (Set d'ids), `onQuickAdd(ids[])`,
// `onQuickRemove(ids[])`.
//
// Le bouton « Tout ajouter » est rendu par le parent (GettingStartedCard),
// pas ici : à l'étape s2b une CTA existe déjà (« Voir mes recettes ») et les
// deux boutons doivent s'afficher côte à côte, pas empilés (chantier H,
// 2026-07-09) — le layout des boutons appartient donc à la carte, pas aux puces.
export default function QuickAddChips({ lang = 'fr', stock, onQuickAdd, onQuickRemove }) {
  const has = (id) => stock?.has?.(id) ?? false
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {QUICK_ADD_IDS.map((id) => {
        const ing = BY_ID[id]
        const override = LABEL_OVERRIDES[id]
        const label = override?.[lang] ?? override?.fr ?? ing?.labels?.[lang] ?? ing?.labels?.fr ?? id
        const added = has(id)
        return (
          <button
            key={id}
            type="button"
            aria-pressed={added}
            onClick={() => (added ? onQuickRemove?.([id]) : onQuickAdd?.([id]))}
            className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-all hover:scale-105"
            style={added
              ? { borderColor: '#B85000', background: '#B85000', color: '#fff', fontWeight: 600 }
              : { borderColor: 'rgba(247,168,94,0.55)', background: 'transparent', color: '#3C2D1E' }}
          >
            <span aria-hidden="true">{added ? '✓' : ing?.emoji}</span>
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
