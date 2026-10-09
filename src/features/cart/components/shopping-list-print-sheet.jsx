import { groupShareRowsByAisle, formatShareQty } from '@features/cart/lib/share-rows'

// Liste de courses imprimable : sections par rayon, cases à cocher, total
// estimé. Lisible au supermarché.
//
// Rendue par `printReactElement` (styles : bloc « Impression » de `index.css`).
// Composant React, pas chaîne HTML : chaque libellé est échappé par React
// (audit du 2026-10-04 — l'ancienne version assemblait le document à la main).
const I18N = {
  fr: { title: 'Liste de courses', total: 'Total estimé', empty: 'Liste vide' },
  en: { title: 'Shopping list', total: 'Estimated total', empty: 'Empty list' },
}

function formatTotal(total, lang) {
  const montant = total.toFixed(2)
  return `~${lang === 'fr' ? montant.replace('.', ',') : montant} €`
}

export default function ShoppingListPrintSheet({ shareRows = [], total = 0, lang = 'fr' }) {
  const t = I18N[lang] ?? I18N.fr
  const groups = groupShareRowsByAisle(shareRows, lang)

  return (
    <article className="fp-print-sheet" lang={lang}>
      <h1>🧊 {t.title}</h1>
      {groups.length === 0 && <p>{t.empty}</p>}
      {groups.map(({ aisle, label, emoji, rows }) => (
        <section key={aisle} className="fp-print-aisle">
          <h2>
            <span aria-hidden="true">{emoji}</span>
            <span className="fp-print-name">{label}</span>
            <span className="fp-print-count">{rows.length}</span>
          </h2>
          <ul className="fp-print-list">
            {rows.map((r, i) => {
              const qty = formatShareQty(r)
              return (
                <li key={i}>
                  <span className="fp-print-box" />
                  <span className="fp-print-name">{r.label}</span>
                  {qty && <span className="fp-print-qty">{qty}</span>}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      {total > 0 && (
        <p className="fp-print-total">
          <span>{t.total}</span>
          <strong>{formatTotal(total, lang)}</strong>
        </p>
      )}
    </article>
  )
}
