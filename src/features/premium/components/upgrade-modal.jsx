import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { LuX, LuStar, LuShoppingCart, LuMic, LuList, LuShare2, LuWallet, LuLeaf, LuChartBar } from 'react-icons/lu'
import { useAuth } from '@shared/contexts/auth-provider'
import { redirectToCheckout } from '@shared/lib/payments/stripe'
import { PREMIUM_ENABLED } from '@shared/lib/premium-config'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import Button from '@shared/ui/button'
import { TAGLINES } from '@shared/static/taglines'
import { formatPrix } from '@shared/lib/i18n/prix'

// Économie annuelle : (4.99×12 − 34.99) / (4.99×12) = 41.6 % → 42 %
const MONTHLY_PRICE = 4.99
const ANNUAL_PRICE  = 34.99
// Les prix s'écrivent par `formatPrix` (langue du visiteur : « 4,99 € » /
// « €4.99 » — audit du 2026-10-04, UX-15), au rendu, jamais ici.

const FEATURES = [
  { icon: <LuShoppingCart size={17} />, key: 'basket'  },
  { icon: <LuMic          size={17} />, key: 'voice'   },
  { icon: <LuLeaf         size={17} />, key: 'waste'   },
  { icon: <LuChartBar     size={17} />, key: 'spending' },
  { icon: <LuList         size={17} />, key: 'lists'   },
  { icon: <LuShare2       size={17} />, key: 'share'   },
  { icon: <LuWallet       size={17} />, key: 'budget'  },
]

// Phrases rotatives dans le header (une toutes les 3,5 s) : `@shared/static/taglines`
// (une seule liste avec l'en-tête, UX-10).

const I18N = {
  fr: {
    title:    'Fridge+ Premium',
    monthly:  'Mensuel',
    annual:   'Annuel',
    popular:  '★ Populaire',
    save:     'Économise 42 %',
    perMonth: '/ mois',
    perYear:  '/ an',
    equivMonth:   (prix) => `soit ${prix} / mois`,
    annualUpsell: (prix) => `Annuel : ${prix} / mois — économise 42 %`,
    included: 'Tout le gratuit, plus :',
    features: {
      basket:   'Panier de courses',
      voice:    'Mode cuisine vocal mains libres',
      waste:    'Anti-gaspillage : recettes avec ce que tu as',
      spending: 'Analyse de tes dépenses mensuelles',
      lists:    'Listes de courses sauvegardées',
      share:    'Partage de liste + QR code',
      budget:   'Budget mensuel indicatif',
    },
    cta:          "Commencer l'essai gratuit 7 jours",
    ctaLoading:   'Redirection…',
    comingSoon:   'Prochainement — ces fonctionnalités arrivent très bientôt. Reste à l\'écoute !',
    noCommitment: 'Sans engagement · Annule quand tu veux ·',
    cgv:          'CGV',
    refund:       'Remboursement 14 j si insatisfait',
    errorGeneric: 'Une erreur est survenue. Réessaie plus tard.',
    errorNoKey:   'Paiement non disponible pour le moment.',
    close:        'Fermer',
  },
  en: {
    title:    'Fridge+ Premium',
    monthly:  'Monthly',
    annual:   'Annual',
    popular:  '★ Popular',
    save:     'Save 42%',
    perMonth: '/ month',
    perYear:  '/ year',
    equivMonth:   (prix) => `i.e. ${prix} / month`,
    annualUpsell: (prix) => `Annual: ${prix} / month — save 42%`,
    included: 'Everything free, plus:',
    features: {
      basket:   'Shopping basket',
      voice:    'Hands-free vocal cooking mode',
      waste:    'Waste prevention: recipes from what you have',
      spending: 'Monthly spending analysis',
      lists:    'Saved shopping lists',
      share:    'List sharing + QR code',
      budget:   'Monthly spending tracker',
    },
    cta:          'Start 7-day free trial',
    ctaLoading:   'Redirecting…',
    comingSoon:   'Coming soon — these features are on their way. Stay tuned!',
    noCommitment: 'No commitment · Cancel anytime ·',
    cgv:          'Terms',
    refund:       '14-day money-back guarantee',
    errorGeneric: 'Something went wrong. Please try again.',
    errorNoKey:   'Payment not available right now.',
    close:        'Close',
  },
}

export default function UpgradeModal({ isOpen, onClose, lang = 'fr', darkMode = false }) {
  const { supabase } = useAuth()
  const t        = I18N[lang] ?? I18N.fr
  const taglines = TAGLINES[lang] ?? TAGLINES.fr
  // a11y : focus trap + Escape (modale paywall)
  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, { active: isOpen, onEscape: onClose })
  useCloseOnBackButton(isOpen, onClose)

  const [plan,     setPlan]     = useState('annual')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [displayText, setDisplayText] = useState(taglines[0] ?? '')
  const [isTyping,    setIsTyping]    = useState(false)
  const [tagHover,    setTagHover]    = useState(false)
  const tagIdxRef   = useRef(0)
  const animRef     = useRef(null)
  const isAnimRef   = useRef(false)
  const taglinesRef = useRef(taglines)

  useEffect(() => { taglinesRef.current = taglines }, [taglines])

  useEffect(() => {
    clearTimeout(animRef.current)
    tagIdxRef.current = 0
    isAnimRef.current = false
    if (!isOpen) {
      setDisplayText(taglinesRef.current[0] ?? '')
      setIsTyping(false)
      return
    }
    setDisplayText(taglinesRef.current[0] ?? '')
    // eslint-disable-next-line react-hooks/immutability
    scheduleNext(4000)
    return () => clearTimeout(animRef.current)
    // `scheduleNext` est une declaration de fonction, recreee a chaque rendu :
    // l'inclure ferait redemarrer l'animation en permanence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isOpen) return null

  // ── Typewriter helpers (hoistés — accessibles dans useEffect) ──────────────
  function scheduleNext(delay) {
    clearTimeout(animRef.current)
    animRef.current = setTimeout(startCycle, delay)
  }
  function startCycle() {
    const from    = taglinesRef.current[tagIdxRef.current]
    const nextIdx = (tagIdxRef.current + 1) % taglinesRef.current.length
    eraseChar(from, taglinesRef.current[nextIdx], nextIdx, 0)
  }
  function eraseChar(from, to, nextIdx, pos) {
    isAnimRef.current = true
    setIsTyping(false)
    setDisplayText(from.slice(pos))
    if (pos < from.length) {
      animRef.current = setTimeout(() => eraseChar(from, to, nextIdx, pos + 1), 30)
    } else {
      typeChar(to, nextIdx, 0)
    }
  }
  function typeChar(text, nextIdx, pos) {
    setDisplayText(text.slice(0, pos))
    setIsTyping(pos > 0 && pos <= text.length)
    if (pos < text.length) {
      animRef.current = setTimeout(() => typeChar(text, nextIdx, pos + 1), 40)
    } else {
      isAnimRef.current = false
      setIsTyping(false)
      tagIdxRef.current = nextIdx
      scheduleNext(4000)
    }
  }
  function handleTagHover() {
    setTagHover(true)
    if (!isAnimRef.current) {
      clearTimeout(animRef.current)
      startCycle()
    }
  }

  async function handleCheckout() {
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      await redirectToCheckout(plan, supabase)
    } catch (err) {
      setLoading(false)
      const isNoKey = err.message?.includes('VITE_STRIPE_PUBLISHABLE_KEY')
      setError(isNoKey ? t.errorNoKey : t.errorGeneric)
    }
  }

  const bg     = darkMode ? '#1C1410' : '#FFFFFF'
  const border = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const text   = darkMode ? '#F5EDE4' : '#1A1008'
  const muted  = darkMode ? '#8A7060' : '#9A8070'
  const subtle = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'

  return createPortal(
    <div
      onClick={onClose}
      className="fp-modal-backdrop"
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(18,10,4,0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        ref={dialogRef}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t.title}
        className="fp-modal-panel"
        style={{
          width: '100%', maxWidth: '460px',
          background: bg,
          borderRadius: '22px',
          border: `1px solid ${border}`,
          boxShadow: darkMode
            ? '0 24px 70px rgba(0,0,0,0.65)'
            : '0 24px 70px rgba(0,0,0,0.18)',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          background: 'var(--gradient-deep)',
          padding: '26px 26px 22px',
          position: 'relative',
        }}>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t.close}
            className="absolute right-3.5 top-3.5 h-[30px] w-[30px] rounded-lg p-0 text-white hover:bg-transparent"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          >
            <LuX size={16} />
          </Button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '6px' }}>
            <LuStar size={22} fill="white" color="white" />
            <span style={{ fontSize: '22px', fontWeight: 800, color: '#fff' }}>{t.title}</span>
          </div>

          {/* Tagline typewriter — efface lettre par lettre, frappe la suivante */}
          <p
            onMouseEnter={handleTagHover}
            onMouseLeave={() => setTagHover(false)}
            style={{
              margin: 0,
              fontSize: '15px',
              fontWeight: tagHover ? 800 : 600,
              color: isTyping ? 'rgba(255,210,100,1)' : 'rgba(255,255,255,0.95)',
              minHeight: '22px',
              cursor: 'default',
              textDecoration: tagHover ? 'underline' : 'none',
              textDecorationColor: 'rgba(255,255,255,0.55)',
              textUnderlineOffset: '3px',
              transition: 'color 0.7s ease, font-weight 0.15s ease',
              userSelect: 'none',
              letterSpacing: '0.01em',
            }}
          >
            {displayText}
          </p>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '22px 26px 26px' }}>
          {!PREMIUM_ENABLED ? (
            <>
              {/* Mode Launch Free : on tease les features, sans prix ni checkout */}
              <div style={{ marginBottom: '20px' }}>
                <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {t.included}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {FEATURES.map(f => (
                    <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
                        background: 'linear-gradient(135deg, rgba(247,168,94,0.16) 0%, rgba(212,106,16,0.16) 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--color-brand-600)',
                      }}>
                        {f.icon}
                      </div>
                      <span style={{ fontSize: '15px', color: text, fontWeight: 500 }}>
                        {t.features[f.key]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{
                borderRadius: '12px', padding: '14px 16px', textAlign: 'center',
                background: 'rgba(212,106,16,0.08)',
                border: '1px dashed rgba(212,106,16,0.4)',
                color: 'var(--color-warm-text)', fontSize: '14px', fontWeight: 700,
              }}>
                {t.comingSoon}
              </div>
            </>
          ) : (
            <>

          {/* Toggle mensuel / annuel — badge flottant au-dessus de l'option Annuel */}
          <div style={{ position: 'relative', marginBottom: '22px' }}>
            <div style={{
              position: 'absolute',
              top: '-14px', right: '6px',
              background: 'linear-gradient(135deg, #52C97A 0%, #1E8449 100%)',
              color: '#fff',
              fontSize: '11px', fontWeight: 800,
              padding: '3px 11px',
              borderRadius: '8px',
              boxShadow: '0 3px 10px rgba(30,116,73,0.40)',
              transform: 'rotate(3deg)',
              whiteSpace: 'nowrap',
              zIndex: 1,
              letterSpacing: '0.02em',
            }}>
              {t.popular}
            </div>
          <div style={{
            display: 'flex', gap: '8px',
            background: subtle, borderRadius: '13px', padding: '4px',
          }}>
            {['monthly', 'annual'].map(p => (
              <Button
                key={p}
                variant="ghost"
                onClick={() => setPlan(p)}
                role="radio"
                aria-checked={plan === p}
                className="h-auto flex-1 flex-col rounded-[10px] px-1 py-2.5 text-sm font-semibold hover:bg-transparent"
                style={{
                  gap: '3px',
                  background: plan === p
                    ? 'var(--gradient-deep)'
                    : 'transparent',
                  color: plan === p ? '#fff' : muted,
                  boxShadow: plan === p ? '0 2px 10px rgba(212,106,16,0.3)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                <span>{p === 'monthly' ? t.monthly : t.annual}</span>
                {p === 'annual' && (
                  <span style={{
                    fontSize: '11px', fontWeight: 700,
                    color: plan === 'annual' ? 'rgba(255,255,255,0.88)' : 'var(--color-brand-600)',
                  }}>
                    {t.save}
                  </span>
                )}
              </Button>
            ))}
          </div>
          </div>

          {/* Prix */}
          <div style={{ textAlign: 'center', marginBottom: '22px' }}>
            {plan === 'annual' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '40px', fontWeight: 800, color: text }}>
                    {formatPrix(ANNUAL_PRICE, lang)}
                  </span>
                  <span style={{ fontSize: '16px', color: muted }}>{t.perYear}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px', marginTop: '7px' }}>
                  <span style={{ fontSize: '15px', color: muted }}>{t.equivMonth(formatPrix(ANNUAL_PRICE / 12, lang))}</span>
                  <span style={{
                    padding: '4px 10px', borderRadius: '7px',
                    background: 'rgba(212,106,16,0.12)',
                    border: '1px solid rgba(212,106,16,0.25)',
                    color: 'var(--color-brand-600)', fontSize: '12px', fontWeight: 700,
                  }}>-42 %</span>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '40px', fontWeight: 800, color: text }}>
                    {formatPrix(MONTHLY_PRICE, lang)}
                  </span>
                  <span style={{ fontSize: '16px', color: muted }}>{t.perMonth}</span>
                </div>
              </>
            )}
          </div>

          {/* Séparateur */}
          <div style={{ height: '1px', background: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)', marginBottom: '18px' }} />

          {/* Features */}
          <div style={{ marginBottom: '22px' }}>
            <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t.included}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {FEATURES.map(f => (
                <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
                    background: 'linear-gradient(135deg, rgba(247,168,94,0.16) 0%, rgba(212,106,16,0.16) 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-brand-600)',
                  }}>
                    {f.icon}
                  </div>
                  <span style={{ fontSize: '15px', color: text, fontWeight: 500 }}>
                    {t.features[f.key]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Erreur */}
          {error && (
            <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#dc2626', textAlign: 'center' }}>
              {error}
            </p>
          )}

          {/* CTA */}
          <Button
            onClick={handleCheckout}
            loading={loading}
            disabled={loading}
            className="h-auto w-full rounded-[13px] px-4 py-4 text-base font-bold text-white"
            style={{
              gap: '8px',
              background: loading
                ? 'rgba(212,106,16,0.5)'
                : 'var(--gradient-deep)',
              boxShadow: loading ? 'none' : '0 4px 18px rgba(212,106,16,0.4)',
              transition: 'all 0.2s',
            }}
          >
            {loading ? t.ctaLoading : t.cta}
          </Button>

          {/* Fine print */}
          <p style={{ margin: '10px 0 0', fontSize: '12px', color: muted, textAlign: 'center' }}>
            {t.noCommitment}{' '}
            <a
              href="/legal#cgv"
              onClick={onClose}
              style={{ color: 'var(--color-brand-600)', textDecoration: 'underline' }}
            >
              {t.cgv}
            </a>
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: muted, textAlign: 'center' }}>
            {t.refund}
          </p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
