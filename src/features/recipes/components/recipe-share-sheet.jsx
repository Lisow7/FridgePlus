import { useState, useRef } from 'react'
import { LuPrinter, LuLink, LuShare2, LuCheck } from 'react-icons/lu'
import { useQrCode } from '@shared/hooks/use-qr-code'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { buildRecipePrintHtml } from '@features/recipes/lib/recipe-print'
import { printHtmlDocument } from '@shared/lib/print/print-document'
import BottomSheet from '@shared/ui/bottom-sheet'

const I18N = {
  fr: {
    title: 'Partager la recette', print: 'Imprimer la fiche', copy: 'Copier le lien',
    copied: 'Lien copié !', share: 'Partager', closeLabel: 'Fermer',
    qrHint: 'Scanne pour ouvrir la recette',
    publishHint: 'Publie ta recette pour obtenir un lien partageable.',
  },
  en: {
    title: 'Share recipe', print: 'Print recipe sheet', copy: 'Copy link',
    copied: 'Link copied!', share: 'Share', closeLabel: 'Close',
    qrHint: 'Scan to open the recipe',
    publishHint: 'Publish your recipe to get a shareable link.',
  },
}

// RecipeShareSheet — bottom-sheet de partage d'une recette.
// Imprimer (fiche technique) toujours présent ; Copier le lien / Partage natif /
// QR uniquement si la recette est publiquement accessible (`isShareable`).
export default function RecipeShareSheet({ open, lang = 'fr', darkMode = false, onClose, recipe, shareUrl, isShareable }) {
  const t = I18N[lang] ?? I18N.fr
  const [copied, setCopied] = useState(false)
  const qrSrc = useQrCode(isShareable ? shareUrl : null, {
    dark: darkMode ? '#E8EEF5' : '#1A0E06',
    light: darkMode ? '#131E2C' : '#FFFFFF',
  })
  useCloseOnBackButton(open, onClose)
  // Piège de focus + Escape + restitution (audit clavier 2026-08-25) : cette
  // feuille est aria-modal mais son voile n est qu un div cliquable — au
  // clavier, elle était sans issue.
  const sheetRef = useRef(null)
  useFocusTrap(sheetRef, { active: open, onEscape: onClose })
  if (!open) return null

  const muted = darkMode ? '#7A90A8' : '#8A6A60'
  const fg = darkMode ? '#E8EEF5' : '#1a0e00'

  const handlePrint = () => { printHtmlDocument(buildRecipePrintHtml(recipe, lang)); onClose() }
  const handleCopy = async () => {
    let ok = false
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(shareUrl); ok = true } catch { /* fallback */ }
    }
    if (!ok) {
      try {
        const ta = document.createElement('textarea')
        ta.value = shareUrl
        ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
        document.body.appendChild(ta)
        ta.focus(); ta.select()
        ok = document.execCommand('copy')
        document.body.removeChild(ta)
      } catch { /* silently fail */ }
    }
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }
  const handleNativeShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ url: shareUrl, title: t.title }) } catch { /* cancelled */ }
    } else {
      try { await navigator.clipboard.writeText(shareUrl) } catch { /* noop */ }
    }
    onClose()
  }

  const actions = [
    { key: 'print', label: t.print, ActionIcon: LuPrinter, action: handlePrint },
    ...(isShareable ? [
      { key: 'copy', label: copied ? t.copied : t.copy, ActionIcon: copied ? LuCheck : LuLink, action: handleCopy, success: copied },
      { key: 'share', label: t.share, ActionIcon: LuShare2, action: handleNativeShare },
    ] : []),
  ]

  return (
    <BottomSheet title={t.title} closeLabel={t.closeLabel} onClose={onClose} darkMode={darkMode}>
        <div className="flex flex-col gap-2">
          {actions.map(a => {
            const ActionIcon = a.ActionIcon
            const accent = a.success ? '#16A34A' : null
            return (
              <button
                key={a.key}
                onClick={a.action}
                className="flex items-center gap-3 rounded-[10px] px-4 py-3 text-[13px] font-semibold border cursor-pointer text-left min-h-[44px]"
                style={{
                  background: darkMode ? '#131E2C' : '#fff',
                  borderColor: accent ?? (darkMode ? '#1A2A3D' : 'rgba(0,0,0,0.08)'),
                  color: accent ?? fg,
                }}
              >
                <ActionIcon size={16} style={{ color: accent ?? muted }} />
                {a.label}
              </button>
            )
          })}
        </div>
        {isShareable && qrSrc && (
          <div className="flex items-center gap-3 mt-3 rounded-[10px] p-3 border" style={{ borderColor: darkMode ? '#1A2A3D' : 'rgba(0,0,0,0.08)' }}>
            <img src={qrSrc} alt={`QR ${t.title}`} width={80} height={80} style={{ borderRadius: 8, flexShrink: 0 }} />
            <p className="text-[12px]" style={{ color: muted }}>{t.qrHint}</p>
          </div>
        )}
        {!isShareable && (
          <p className="text-[12px] mt-3" style={{ color: muted }}>{t.publishHint}</p>
        )}
    </BottomSheet>
  )
}
