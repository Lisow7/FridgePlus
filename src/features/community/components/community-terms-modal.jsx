import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LuShield, LuCheck, LuEye } from 'react-icons/lu'
import { COMMUNITY_I18N } from '@shared/lib/i18n/community-i18n'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { Z_INDEX } from '@shared/lib/z-index'
import Button from '@shared/ui/button'

// Modale charte de la communauté.
//
// Affichée au premier accès au panneau communauté (et à chaque ré-accès
// si l'user n'a pas déjà refusé via le drapeau localStorage). Deux
// boutons : « J'accepte » → preuve datée en BDD, accès complet ;
// « Je veux juste lire » → drapeau localStorage seul, mode lecture.
//
// La preuve d'acceptation reste en BDD (community_terms_accepted_at,
// preuve datée RGPD). Le drapeau localStorage sert uniquement à éviter
// de re-spammer la modale après un refus.

export default function CommunityTermsModal({ lang = 'fr', darkMode = false, onAccept, onDecline, onNeverShow, onClose, readOnly = false, submitting = false }) {
  const t = COMMUNITY_I18N[lang] ?? COMMUNITY_I18N.fr
  const [error, setError] = useState(null)
  // v3.409 — readOnly : user a déjà signé, on affiche juste la charte
  // pour relecture. Pas de boutons Accepter/Décliner/Ne plus afficher,
  // juste un Fermer. Escape autorisé puisque non bloquant.
  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, { active: true, onEscape: readOnly ? onClose : undefined })
  // Même garde que le clavier (Escape) : tant que l'utilisateur doit encore
  // accepter/refuser la charte, le retour matériel ne doit pas le dispenser
  // de décider (readOnly = simple consultation, là on peut fermer).
  useCloseOnBackButton(true, readOnly ? onClose : undefined)

  const handleAccept = async () => {
    setError(null)
    try {
      await onAccept()
    } catch (e) {
      setError(e?.message ?? 'error')
    }
  }

  const fg = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted = darkMode ? '#A0A8B8' : '#7A6A52'
  const bg = darkMode ? '#0F1925' : '#FDFAF6'
  const border = darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'
  const accent = 'var(--color-brand-500)'

  const rules = [
    { title: t.termsRule1Title, body: t.termsRule1Body, icon: '🤝' },
    { title: t.termsRule2Title, body: t.termsRule2Body, icon: '🔒' },
    { title: t.termsRule3Title, body: t.termsRule3Body, icon: '🛡️' },
    { title: t.termsRule4Title, body: t.termsRule4Body, icon: '📚' },
    { title: t.termsRule5Title, body: t.termsRule5Body, icon: '🍳' },
  ]

  // createPortal vers document.body : sans ça la modale est
  // contenue dans CommunityPanel parent (backdrop-filter sur le parent
  // crée un nouveau containing block qui contraint position:fixed).
  // Conséquence visible : header + footer hors viewport, contenu tronqué.
  return createPortal(
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="community-terms-title"
      className="fp-modal-backdrop"
      style={{
        // v3.409 — z-TOP_MODAL (1300) au lieu de 65. Avant : la modale
        // était cachée derrière CommunityPage qui est rendu en
        // fixed inset-0 z-120 (route plein écran cyberpunk). Maintenant
        // la modale passe au-dessus pour les nouveaux users non signés.
        position: 'fixed', inset: 0, zIndex: Z_INDEX.TOP_MODAL,
        background: 'rgba(18,10,4,0.65)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}>
      <div className="fp-modal-panel" style={{
        width: '100%', maxWidth: '560px', maxHeight: '90dvh',
        background: bg, color: fg, borderRadius: '20px',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
        overflow: 'hidden',
      }}>
        {/* Header — flexShrink: 0 pour rester visible quand la liste de
            règles déborde et scroll. */}
        <div style={{ flexShrink: 0, padding: '18px 22px 14px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: '10px', background: darkMode ? 'rgba(247,168,94,0.04)' : 'rgba(247,168,94,0.05)' }}>
          <LuShield size={22} style={{ color: accent, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <h2 id="community-terms-title" style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: fg }}>{t.termsTitle}</h2>
          </div>
        </div>

        {/* Intro */}
        <div style={{ flexShrink: 0, padding: '14px 22px', borderBottom: `1px solid ${border}` }}>
          <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: muted }}>{t.termsIntro}</p>
        </div>

        {/* Règles — seule zone qui peut scroller. */}
        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {rules.map((rule, i) => (
            <div key={i} style={{
              display: 'flex', gap: '12px',
              padding: '10px 12px', borderRadius: '10px',
              border: `1px solid ${border}`,
              background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
            }}>
              <span style={{ fontSize: '20px', flexShrink: 0, lineHeight: 1.2 }}>{rule.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: fg }}>
                  {i + 1}. {rule.title}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: muted, lineHeight: 1.4 }}>{rule.body}</p>
              </div>
            </div>
          ))}
          <p style={{ margin: '8px 0 0', fontSize: '11px', lineHeight: 1.5, color: muted, fontStyle: 'italic' }}>
            {t.termsCommit}
          </p>
        </div>

        {/* Erreur */}
        {error && (
          <div style={{ flexShrink: 0, padding: '8px 22px', fontSize: '12px', color: '#D06060', background: 'rgba(208,96,96,0.08)' }}>
            {error}
          </div>
        )}

        {/* Footer actions — toujours visible (flexShrink: 0).
            v3.409 readOnly : un seul bouton Fermer (l'user a déjà signé,
            consultation pure de la charte sans décision à reprendre). */}
        <div style={{ flexShrink: 0, padding: '14px 22px', borderTop: `1px solid ${border}`, display: 'flex', gap: '10px', flexDirection: 'column' }}>
          {readOnly ? (
            <Button
              onClick={onClose}
              type="button"
              className="h-auto w-full rounded-xl px-4 py-3 text-sm font-extrabold text-white"
              style={{
                gap: '8px',
                background: accent,
                boxShadow: '0 3px 14px rgba(224,120,32,0.30)',
                transition: 'filter 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.08)'}
              onMouseLeave={e => e.currentTarget.style.filter = ''}>
              {t.termsClose}
            </Button>
          ) : (
            <>
              <Button
                onClick={handleAccept}
                loading={submitting}
                disabled={submitting}
                type="button"
                className="h-auto w-full rounded-xl px-4 py-3 text-sm font-extrabold text-white"
                style={{
                  gap: '8px',
                  background: accent,
                  boxShadow: '0 3px 14px rgba(224,120,32,0.30)',
                  transition: 'filter 0.15s',
                }}
                onMouseEnter={e => !submitting && (e.currentTarget.style.filter = 'brightness(1.08)')}
                onMouseLeave={e => e.currentTarget.style.filter = ''}>
                <LuCheck size={17} />
                {t.termsAccept}
              </Button>
              <Button
                variant="secondary"
                onClick={onDecline}
                disabled={submitting}
                type="button"
                className="h-auto w-full rounded-xl border-[1.5px] bg-transparent px-4 py-2.5 text-[13px] font-semibold"
                style={{
                  gap: '8px',
                  borderColor: border,
                  color: muted,
                  transition: 'all 0.15s',
                }}>
                <LuEye size={15} />
                {t.termsDecline}
              </Button>
            </>
          )}
          {/* v3.409 — bouton « Ne plus afficher » : permet à l'user de
              désactiver le popup automatique à chaque visite. Reset
              possible depuis Profil > Préférences. Style discret (link)
              pour pas inciter au refus mais offrir l'option respectueuse.
              Caché en readOnly (pas pertinent — user a déjà signé). */}
          {!readOnly && onNeverShow && (
            <Button
              variant="ghost"
              onClick={onNeverShow}
              disabled={submitting}
              type="button"
              className="h-auto w-full bg-transparent px-4 py-1.5 text-[11px] font-medium hover:bg-transparent"
              style={{
                color: muted,
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
                opacity: 0.75,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.75'}
            >
              {t.termsNeverShow}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
