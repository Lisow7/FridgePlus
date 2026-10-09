import { useState } from 'react'
import { LuClipboard, LuPrinter, LuShare2, LuCheck, LuLink } from 'react-icons/lu'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { createSharedBasket } from '@features/cart/api/shared-baskets'
import { groupShareRowsByAisle, formatShareQty } from '@features/cart/lib/share-rows'
import { printReactElement } from '@shared/lib/print/print-element'
import BottomSheet from '@shared/ui/bottom-sheet'
import ShoppingListPrintSheet from './shopping-list-print-sheet'

const I18N = {
  fr: {
    title: 'Partager la liste', copy: 'Copier le texte', print: 'Imprimer', share: 'Partager', copied: 'Copié !',
    // Nom accessible du bouton de fermeture : il manquait ici (audit
    // 2026-08-28), c'etait l'un des deux boutons icone anonymes du depot.
    closeLabel: 'Fermer',
    shareLink: 'Partager un lien (page + QR code)', generating: 'Génération du lien…', linkCopied: 'Lien copié !', linkError: 'Lien impossible à créer',
    emptyList: 'Liste vide', listTitle: 'Liste de courses',
  },
  en: {
    title: 'Share list', copy: 'Copy text', print: 'Print', share: 'Share', copied: 'Copied!',
    closeLabel: 'Close',
    shareLink: 'Share a link (page + QR code)', generating: 'Generating link…', linkCopied: 'Link copied!', linkError: 'Could not create link',
    emptyList: 'Empty list', listTitle: 'Shopping list',
  },
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
      const q = formatShareQty(r)
      lines.push(`  ☐ ${r.label}${q ? ` — ${q}` : ''}`)
    })
  })
  return lines.join('\n')
}

// CartShareSheet — bottom sheet de partage de la liste de courses.
// Options : copier texte, imprimer, partage natif.
export default function CartShareSheet({ open, lang = 'fr', darkMode = false, onClose, userId, shareRows = [], shareTotal = 0 }) {
  const t = I18N[lang] ?? I18N.fr
  const [copied, setCopied] = useState(false)
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [linkError, setLinkError] = useState(false)
  useCloseOnBackButton(open, onClose)
  // Le piège de focus, Échap et la restitution sont ceux de BottomSheet : un
  // second `useFocusTrap(sheetRef)` vivait ici sans ref posée, donc sans effet
  // (audit du 2026-10-04, A11Y-08).
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
    printReactElement(<ShoppingListPrintSheet shareRows={shareRows} total={shareTotal} lang={lang} />)
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
