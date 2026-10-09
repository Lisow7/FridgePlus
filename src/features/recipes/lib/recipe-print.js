import { getIngredientItemsFlat, getIngredientQty } from '@shared/lib/recipes/recipe-ingredients'
import { formatQty } from '@shared/lib/recipes/recipe-utils'

// Fiche technique imprimable d'une recette — document HTML autonome, propre,
// INDÉPENDANT de l'onglet affiché à l'écran (titre + méta + ingrédients avec
// quantités + préparation numérotée). Aucun statut frigo / progression / UI app.
const esc = s => String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const PRINT_I18N = {
  fr: { ingredients: 'Ingrédients', prep: 'Préparation', servings: 'pers.', min: 'min' },
  en: { ingredients: 'Ingredients', prep: 'Preparation', servings: 'servings', min: 'min' },
}

export function buildRecipePrintHtml(recipe, lang = 'fr') {
  const T = PRINT_I18N[lang] ?? PRINT_I18N.fr
  const name = recipe.isCustom ? (recipe.name ?? '') : (recipe.name?.[lang] ?? recipe.name?.fr ?? '')
  const steps = recipe.isCustom ? (recipe.steps ?? []) : (recipe.steps?.[lang] ?? recipe.steps?.fr ?? [])
  const meta = [
    recipe.time ? `⏱ ${recipe.time} ${T.min}` : null,
    recipe.difficulty || null,
    recipe.servings ? `👥 ${recipe.servings} ${T.servings}` : null,
  ].filter(Boolean)
  const ings = getIngredientItemsFlat(recipe).map(ing => {
    const label = ing.labels?.[lang] ?? ing.labels?.fr ?? ''
    const q = getIngredientQty(ing)
    const qty = q ? formatQty(q.amount, q.unit, lang) : ''
    return `<li><span class="box"></span><span class="n">${esc(label)}</span>${qty ? `<span class="q">${esc(qty)}</span>` : ''}</li>`
  }).join('')
  const stepsHtml = steps.map((s, i) => `<li><span class="num">${i + 1}</span><span>${esc(s)}</span></li>`).join('')
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><title>${esc(name)}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:system-ui,-apple-system,sans-serif;color:#1a0e00;max-width:640px;margin:0 auto;padding:28px 24px;font-size:14px}
      h1{font-size:24px;margin:0 0 6px}
      .meta{color:#7A6458;font-size:13px;margin:0 0 18px;display:flex;gap:14px;flex-wrap:wrap}
      h2{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:#A05020;margin:18px 0 8px;padding-bottom:5px;border-bottom:1.5px solid #E07820}
      ul,ol{list-style:none;margin:0;padding:0}
      .ing li{display:flex;align-items:center;gap:10px;padding:5px 2px;border-bottom:1px solid #eee}
      .ing .box{width:13px;height:13px;border:1.5px solid #999;border-radius:3px;flex-shrink:0}
      .ing .n{flex:1}.ing .q{color:#666;white-space:nowrap;font-variant-numeric:tabular-nums}
      .steps li{display:flex;gap:10px;padding:7px 0;align-items:flex-start}
      .steps .num{flex-shrink:0;width:20px;height:20px;border-radius:50%;background:#E07820;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}
      @media print{@page{margin:1.4cm}}
    </style></head>
    <body>
      <h1>${recipe.emoji ?? ''} ${esc(name)}</h1>
      <div class="meta">${meta.map(m => `<span>${esc(m)}</span>`).join('')}</div>
      <h2>${T.ingredients}</h2><ul class="ing">${ings}</ul>
      <h2>${T.prep}</h2><ol class="steps">${stepsHtml}</ol>
      <script>window.onload=function(){window.print()}<\/script>
    </body></html>`
}
