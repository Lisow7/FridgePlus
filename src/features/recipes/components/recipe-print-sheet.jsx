import { getIngredientItemsFlat, getIngredientQty } from '@shared/lib/recipes/recipe-ingredients'
import { formatQty } from '@shared/lib/recipes/recipe-utils'
import { DIFFICULTY_LABELS } from '@shared/static/recipe-constants'

// Fiche technique imprimable d'une recette : titre, repères, ingrédients avec
// quantités, préparation numérotée. Indépendante de l'onglet affiché à l'écran,
// sans statut frigo ni progression.
//
// Rendue par `printReactElement` (styles : bloc « Impression » de `index.css`).
// C'est un composant, pas une chaîne HTML : React échappe chaque champ, donc
// aucun ne peut devenir du code (audit du 2026-10-04, SEC-01).
//
// `name` et `steps` sont ceux que la fenêtre de recette AFFICHE : le nom d'une
// recette officielle n'est pas sur l'objet `recipe` (il vient de RECIPE_NAMES),
// et l'ancienne fiche, qui le cherchait là, s'imprimait sans titre.
const I18N = {
  fr: { ingredients: 'Ingrédients', prep: 'Préparation', servings: 'pers.' },
  en: { ingredients: 'Ingredients', prep: 'Preparation', servings: 'servings' },
}

export default function RecipePrintSheet({ recipe, name, steps = [], lang = 'fr' }) {
  const t = I18N[lang] ?? I18N.fr
  const difficulty = (DIFFICULTY_LABELS[lang] ?? DIFFICULTY_LABELS.fr)[recipe.difficulty] ?? recipe.difficulty
  // `recipe.time` est déjà une durée lisible (« 5 min », « 1 h 30 ») : la fiche
  // de recette l'affiche telle quelle, la fiche imprimée aussi.
  const meta = [
    recipe.time ? `⏱ ${recipe.time}` : null,
    difficulty || null,
    recipe.servings ? `👥 ${recipe.servings} ${t.servings}` : null,
  ].filter(Boolean)

  return (
    <article className="fp-print-sheet" lang={lang}>
      <h1>{recipe.emoji ? `${recipe.emoji} ` : ''}{name}</h1>
      <p className="fp-print-meta">
        {meta.map(m => <span key={m}>{m}</span>)}
      </p>

      <h2>{t.ingredients}</h2>
      <ul className="fp-print-list">
        {getIngredientItemsFlat(recipe).map((ing, i) => {
          const q = getIngredientQty(ing)
          const qty = q ? formatQty(q.amount, q.unit, lang) : null
          return (
            <li key={i}>
              <span className="fp-print-box" />
              <span className="fp-print-name">{ing.labels?.[lang] ?? ing.labels?.fr ?? ''}</span>
              {qty && <span className="fp-print-qty">{qty}</span>}
            </li>
          )
        })}
      </ul>

      <h2>{t.prep}</h2>
      <ol className="fp-print-steps">
        {steps.map((step, i) => (
          <li key={i}>
            <span className="fp-print-num">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </article>
  )
}
