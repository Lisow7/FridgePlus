import { useState, useRef } from 'react'
import { LuClipboard, LuPrinter, LuShare2, LuCheck, LuLink } from 'react-icons/lu'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { createSharedBasket } from '@features/cart/api/shared-baskets'
import { AISLE_ORDER, AISLE_LABELS, AISLE_EMOJI } from '@features/cart/lib/cart-helpers'
import BottomSheet from '@shared/ui/bottom-sheet'

const I18N = {
  fr: {
    title: 'Partager la liste', copy: 'Copier le texte', print: 'Imprimer', share: 'Partager', copied: 'Copié !',
    // Nom accessible du bouton de fermeture : il manquait ici (audit
    // 2026-08-28), c'etait l'un des deux boutons icone anonymes du depot.
    closeLabel: 'Fermer',
    shareLink: 'Partager un lien (page + QR code)', generating: 'Génération du lien…', linkCopied: 'Lien copié !', linkError: 'Lien impossible à créer',
    emptyList: 'Liste vide', listTitle: 'Liste de courses', totalLabel: 'Total estimé',
  },
  en: {
    title: 'Share list', copy: 'Copy text', print: 'Print', share: 'Share', copied: 'Copied!',
    closeLabel: 'Close',
    shareLink: 'Share a link (page + QR code)', generating: 'Generating link…', linkCopied: 'Link copied!', linkError: 'Could not create link',
    emptyList: 'Empty list', listTitle: 'Shopping list', totalLabel: 'Estimated total',
  },
}

// Liste de courses regroupée par RAYON de supermarché (parcours logique en
// magasin), pas par recette. `shareRows` porte déjà `aisle` par ligne
// (cf. shopping-phase). Partagé par copie / partage natif / impression.
function groupShareRowsByAisle(shareRows, lang) {
  const labels = AISLE_LABELS[lang] ?? AISLE_LABELS.fr
  const byAisle = new Map()
  for (const r of shareRows) {
    const a = r.aisle ?? 'other'
    if (!byAisle.has(a)) byAisle.set(a, [])
    byAisle.get(a).push(r)
  }
  return AISLE_ORDER
    .filter(a => byAisle.has(a))
    .map(a => ({ aisle: a, label: labels[a] ?? a, emoji: AISLE_EMOJI[a] ?? '📦', rows: byAisle.get(a) }))
}

function fmtQty(r) {
  return r.amount && r.unit ? `${r.amount} ${r.unit}` : ''
}

// Version texte (copie / partage natif) — titres de rayon + puces.
function aisleListToText(shareRows, lang) {
  const t = I18N[lang] ?? I18N.fr
  const groups = groupShareRowsByAisle(shareRows, lang)
  if (groups.length === 0) return t.emptyList
  const lines = []
  groups.forEach(({ label, emoji, rows }, gi) => {
    if (gi > 0) lines.push('')
    lines.push(`${emoji} ${label.toUpperCase()}`)
    rows.forEach(r => {
      const q = fmtQty(r)
      lines.push(`  ☐ ${r.label}${q ? ` — ${q}` : ''}`)
    })
  })
  return lines.join('\n')
}

// Document HTML propre pour l'impression — sections par rayon, cases à cocher,
// total estimé. Scannable au supermarché.
function buildAisleListHtml(shareRows, total, lang) {
  const t = I18N[lang] ?? I18N.fr
  const esc = s => String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const title = t.listTitle
  const totalLabel = t.totalLabel
  const groups = groupShareRowsByAisle(shareRows, lang)
  const sections = groups.map(({ label, emoji, rows }) => `
    <section class="aisle">
      <h2><span class="e">${emoji}</span>${esc(label)}<span class="c">${rows.length}</span></h2>
      <ul>
        ${rows.map(r => {
          const q = fmtQty(r)
          return `<li><span class="box"></span><span class="n">${esc(r.label)}</span>${q ? `<span class="q">${esc(q)}</span>` : ''}</li>`
        }).join('')}
      </ul>
    </section>`).join('')
  const totalRow = total > 0
    ? `<div class="total"><span>${totalLabel}</span><strong>~${total.toFixed(2).replace('.', ',')} €</strong></div>`
    : ''
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><title>${title}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:system-ui,-apple-system,sans-serif;color:#1a0e00;max-width:620px;margin:0 auto;padding:28px 24px;font-size:14px}
      h1{font-size:22px;margin:0 0 18px;display:flex;align-items:center;gap:8px}
      .aisle{margin-top:16px;page-break-inside:avoid}
      .aisle h2{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:#A05020;margin:0 0 6px;padding-bottom:5px;border-bottom:1.5px solid #E07820}
      .aisle h2 .e{font-size:16px}
      .aisle h2 :nth-child(2){flex:1}
      .aisle h2 .c{font-size:13px;font-weight:800;color:#C05010}
      ul{list-style:none;margin:0;padding:0}
      li{display:flex;align-items:center;gap:10px;padding:6px 2px;border-bottom:1px solid #eee}
      li:last-child{border-bottom:none}
      .box{width:14px;height:14px;border:1.5px solid #999;border-radius:3px;flex-shrink:0}
      .n{flex:1}
      .q{color:#666;font-variant-numeric:tabular-nums;white-space:nowrap}
      .total{display:flex;justify-content:space-between;align-items:center;margin-top:22px;padding-top:12px;border-top:2px solid #1a0e00;font-size:15px}
      .total strong{font-size:18px;color:#C05010}
      @media print{@page{margin:1.4cm}}
    </style></head>
    <body><h1>🧊 ${title}</h1>${sections || `<p>${t.emptyList}</p>`}${totalRow}
    <script>window.onload=function(){window.print()}<\/script></body></html>`
}

// CartShareSheet — bottom sheet de partage de la liste de courses.
// Options : copier texte, imprimer dans une fenêtre propre, partage natif.
export default function CartShareSheet({ open, lang = 'fr', darkMode = false, onClose, userId, shareRows = [], shareTotal = 0 }) {
  const t = I18N[lang] ?? I18N.fr
  const [copied, setCopied] = useState(false)
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [linkError, setLinkError] = useState(false)
  useCloseOnBackButton(open, onClose)
  // Piège de focus + Escape + restitution (audit clavier 2026-08-25) : cette
  // feuille est aria-modal mais son voile n est qu un div cliquable — au
  // clavier, elle était sans issue.
  const sheetRef = useRef(null)
  useFocusTrap(sheetRef, { active: open, onEscape: onClose })
  if (!open) return null

  const canShareLink = !!userId && shareRows.length > 0

  const muted = darkMode ? '#7A90A8' : '#8A6A60'
  const fg = darkMode ? '#E8EEF5' : '#1a0e00'

  const handleCopy = async () => {
    const text = aisleListToText(shareRows, lang)
    let ok = false
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(text); ok = true } catch { /* continue */ }
    }
    if (!ok) {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        ok = document.execCommand('copy')
        document.body.removeChild(ta)
      } catch { /* silently fail */ }
    }
    if (ok) {
      setCopied(true)
      setTimeout(() => { setCopied(false); onClose() }, 1200)
    }
  }

  const handlePrint = () => {
    const html = buildAisleListHtml(shareRows, shareTotal, lang)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank', 'width=600,height=800')
    if (win) setTimeout(() => URL.revokeObjectURL(url), 15000)
    onClose()
  }

  const handleNativeShare = async () => {
    const text = aisleListToText(shareRows, lang)
    if (navigator.share) {
      try { await navigator.share({ title: t.listTitle, text }) } catch { /* user cancelled */ }
    } else {
      // Desktop fallback : copier en clipboard silencieusement
      try { await navigator.clipboard.writeText(text) } catch { /* silently fail */ }
    }
    onClose()
  }

  // Lien partageable : snapshot public du panier (table shared_baskets, TTL 7j,
  // sans PII) → la page ?shared=<id> affiche la liste + un QR code client-side.
  const handleShareLink = async () => {
    if (!canShareLink || linkBusy) return
    setLinkBusy(true)
    setLinkError(false)
    try {
      const payload = { mode: 'shopping', rows: shareRows, total: shareTotal, lang }
      const { data, error } = await createSharedBasket(userId, payload)
      if (error || !data?.id) { setLinkError(true); return }
      const url = `${window.location.origin}${window.location.pathname}?shared=${data.id}`
      const isMobile = /Mobi|Android|iPhone|iPad|Tablet/i.test(navigator.userAgent)
        || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
      if (navigator.share && isMobile) {
        try { await navigator.share({ url, title: t.title }) } catch { /* user cancelled */ }
      } else {
        try { await navigator.clipboard.writeText(url) } catch { /* clipboard refusé */ }
      }
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2500)
    } finally {
      setLinkBusy(false)
    }
  }

  const linkLabel = linkBusy ? t.generating : linkError ? t.linkError : linkCopied ? t.linkCopied : t.shareLink
  const actions = [
    ...(canShareLink ? [{
      label: linkLabel,
      ActionIcon: linkCopied ? LuCheck : LuLink,
      action: handleShareLink,
      success: linkCopied,
      error: linkError,
    }] : []),
    { label: copied ? t.copied : t.copy, ActionIcon: copied ? LuCheck : LuClipboard, action: handleCopy, success: copied },
    { label: t.print, ActionIcon: LuPrinter,   action: handlePrint },
    { label: t.share, ActionIcon: LuShare2,    action: handleNativeShare },
  ]

  return (
    <BottomSheet title={t.title} closeLabel={t.closeLabel} onClose={onClose} darkMode={darkMode}>
        <div className="flex flex-col gap-2">
          {actions.map((actionItem, i) => {
            const ActionIcon = actionItem.ActionIcon
            const accent = actionItem.error ? '#DC2626' : actionItem.success ? '#16A34A' : null
            return (
              <button
                key={i}
                onClick={actionItem.action}
                className="flex items-center gap-3 rounded-[10px] px-4 py-3 text-[13px] font-semibold border cursor-pointer text-left min-h-[44px] transition-colors"
                style={{
                  background: actionItem.success ? (darkMode ? 'rgba(22,163,74,0.15)' : 'rgba(22,163,74,0.08)') : (darkMode ? '#131E2C' : '#fff'),
                  borderColor: accent ?? (darkMode ? '#1A2A3D' : 'rgba(0,0,0,0.08)'),
                  color: accent ?? fg,
                }}
              >
                <ActionIcon size={16} style={{ color: accent ?? muted }} />
                {actionItem.label}
              </button>
            )
          })}
        </div>
    </BottomSheet>
  )
}
