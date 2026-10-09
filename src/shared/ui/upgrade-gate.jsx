import { useState, useRef, useCallback, useEffect } from 'react'
import { LuStar, LuChevronDown } from 'react-icons/lu'
import { useSubscription } from '@shared/hooks/use-subscription'
import { useUpgradeModal } from '@shared/contexts/subscription-modal-provider'
import { useAnchoredPopover } from '@shared/hooks/use-anchored-popover'
import { AnchoredBubble } from '@shared/ui/anchored-popover'
import { PREMIUM_ENABLED } from '@shared/lib/premium-config'
import Button from '@shared/ui/button'

// Données contextuelles par feature
const FEATURE_DATA = {
  basket: {
    emoji: '🛒',
    fr: {
      title: 'Panier de courses',
      accroche: 'Tout ce qu\'il te faut pour faire tes courses sereinement :',
      bullets: [
        'Ingrédients regroupés, quantités calculées automatiquement',
        'Coûts estimés par ingrédient et en total',
        'Coche chaque article au fur et à mesure en magasin',
      ],
    },
    en: {
      title: 'Shopping basket',
      accroche: 'Everything you need for a stress-free shopping trip:',
      bullets: [
        'Ingredients merged, quantities auto-calculated',
        'Costs estimated per ingredient and in total',
        'Check each item off as you shop',
      ],
    },
  },
  // « Mes dépenses » : sans fiche à elle, la page retombait sur celle du panier
  // (relecture du 2026-10-08). Mêmes promesses que la page elle-même.
  spending: {
    emoji: '📊',
    fr: {
      title: 'Analyse des dépenses',
      accroche: 'Tes courses mois par mois, pour mieux tenir ton budget :',
      bullets: [
        'Chaque « J\'ai fait mes courses » compté dans ton suivi',
        'Tes dépenses sur 12 mois, en un graphique',
        'Des recommandations selon tes habitudes',
      ],
    },
    en: {
      title: 'Spending analysis',
      accroche: 'Your shopping month by month, to stay on budget:',
      bullets: [
        'Every « I\'m done shopping » counted in your tracking',
        'Your spending over 12 months, in one chart',
        'Recommendations based on your habits',
      ],
    },
  },
  'voice-cooking': {
    emoji: '🎙️',
    fr: {
      title: 'Mode cuisine vocal',
      accroche: 'Les mains occupées ? Ta voix guide chaque étape. Cuisine sans jamais toucher ton écran.',
    },
    en: {
      title: 'Hands-free cooking mode',
      accroche: 'Hands covered in dough? Your voice guides each step. Cook without ever touching your screen.',
    },
  },
  'shopping-lists': {
    emoji: '📋',
    fr: {
      title: 'Listes sauvegardées',
      accroche: 'Crée et retrouve tes listes à tout moment. Tes courses habituelles accessibles en un clic.',
    },
    en: {
      title: 'Saved shopping lists',
      accroche: 'Create and access your lists anytime. Your usual groceries available in one click.',
    },
  },
  'basket-share': {
    emoji: '🔗',
    fr: {
      title: 'Partage & QR code',
      accroche: 'Envoie ta liste par lien ou QR code. Les courses en famille, sans se répéter deux fois.',
    },
    en: {
      title: 'Share & QR code',
      accroche: 'Send your list via link or QR code. Shopping with family, without repeating yourself.',
    },
  },
  'dlc-alerts': {
    emoji: '🗓️',
    fr: {
      title: 'Alertes anti-gaspillage',
      accroche: 'Reçois un rappel avant la date limite. Moins de gaspillage, plus d\'économies au quotidien.',
    },
    en: {
      title: 'Expiry alerts',
      accroche: 'Get a reminder before items expire. Less waste, more savings every day.',
    },
  },
  'barcode-scan': {
    emoji: '📱',
    fr: {
      title: 'Scan code-barres',
      accroche: 'Scanne un produit pour l\'ajouter instantanément à ton frigo. Zéro saisie manuelle.',
    },
    en: {
      title: 'Barcode scanner',
      accroche: 'Scan a product to add it to your fridge instantly. Zero manual entry.',
    },
  },
  'recipe-cost': {
    emoji: '💰',
    fr: {
      title: 'Coût de la recette',
      accroche: 'Sache combien coûte cette recette avant de faire tes courses. Prix par ingrédient et total estimé, directement sur chaque fiche.',
    },
    en: {
      title: 'Recipe cost',
      accroche: 'Know how much this recipe costs before you shop. Price per ingredient and estimated total, right on every recipe card.',
    },
  },
  'ai-substitutes': {
    emoji: '🔄',
    fr: {
      title: 'Substituts IA',
      accroche: 'Pas l\'ingrédient sous la main ? L\'IA te suggère 3 remplacements adaptés à la recette, avec les bonnes proportions.',
    },
    en: {
      title: 'AI substitutes',
      accroche: 'Missing an ingredient? AI suggests 3 recipe-tailored swaps, with the right proportions.',
    },
  },
}

const CTA_I18N = {
  fr: { cta: 'Commencer l\'essai gratuit 7 jours', noCommitment: 'Sans engagement · Annule quand tu veux' },
  en: { cta: 'Start 7-day free trial',            noCommitment: 'No commitment · Cancel anytime' },
}

const SOFT_I18N = {
  fr: { label: 'Fonctionnalité Premium', upgrade: 'Passer à Premium' },
  en: { label: 'Premium Feature',        upgrade: 'Upgrade to Premium' },
}

// Mode « Launch Free » : le premium est désactivé (PREMIUM_ENABLED=false), les
// features sont teasées « Prochainement » sans parcours d'achat.
const COMING_SOON_I18N = {
  fr: { badge: 'Prochainement', cta: 'Bientôt disponible' },
  en: { badge: 'Coming soon',   cta: 'Coming soon' },
}

/**
 * UpgradeGate — affiche les enfants normalement si l'utilisateur a accès
 * au premium, sinon affiche un gate visuel.
 *
 * variant="soft" : enfants visibles mais grisés, overlay avec CTA
 * variant="hard" : enfants masqués, carte contextuelle Premium affichée
 */
export function UpgradeGate({
  feature,
  variant      = 'soft',
  lang         = 'fr',
  darkMode     = false,
  collapsible  = false,
  onUpgradeClick,
  children,
}) {
  const { hasPremiumAccess } = useSubscription()
  const { openUpgradeModal } = useUpgradeModal()
  const [expanded, setExpanded] = useState(false)
  const anchorRef = useRef(null)
  const popRef = useRef(null)
  const handleUpgrade = onUpgradeClick ?? openUpgradeModal

  const closePopover = useCallback(() => setExpanded(false), [])
  const EnTete = collapsible ? 'button' : 'div'
  // Popover ancré (pas d'expansion inline) : le pill collapsible ne doit
  // jamais changer de taille, pour ne jamais déplacer ses voisins de flex
  // (cf. spec 2026-07-09 — bug remonté sur le pill « Mode cuisine vocal »
  // qui poussait le bouton « J'ai cuisiné » à côté).
  const pos = useAnchoredPopover({ anchorRef, open: collapsible && expanded, onClose: closePopover, width: 320 })

  useEffect(() => {
    if (!collapsible || !expanded) return
    const onPointer = (e) => {
      if (anchorRef.current?.contains(e.target)) return
      if (popRef.current?.contains(e.target)) return
      setExpanded(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [collapsible, expanded])

  if (hasPremiumAccess) return children

  // Mode Launch Free : pas de parcours d'achat → teasing « Prochainement ».
  const comingSoon = !PREMIUM_ENABLED
  const cs         = COMING_SOON_I18N[lang] ?? COMING_SOON_I18N.fr

  if (variant === 'hard') {
    const fd_data   = FEATURE_DATA[feature] ?? FEATURE_DATA.basket
    const fd        = fd_data[lang] ?? fd_data.fr
    const cta       = CTA_I18N[lang] ?? CTA_I18N.fr
    const bodyBg    = darkMode ? '#1C1410' : '#FFFAF6'
    const accroche  = darkMode ? 'rgba(244,224,196,0.75)' : '#5A3A1A'
    const finePrint = darkMode ? '#7A6050' : '#9A8070'

    const cardBody = (
      <>
        {collapsible && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
            <LuStar size={11} fill={darkMode ? '#F7A85E' : 'var(--color-brand-600)'} color={darkMode ? '#F7A85E' : 'var(--color-brand-600)'} />
            <span style={{ fontSize: '10px', fontWeight: 700, color: darkMode ? '#F7A85E' : 'var(--color-brand-600)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {comingSoon ? cs.badge : 'Premium'}
            </span>
          </div>
        )}
        <p style={{ margin: fd.bullets ? '0 0 10px' : '0 0 16px', fontSize: '14px', lineHeight: 1.65, color: accroche }}>
          {fd.accroche}
        </p>
        {fd.bullets && (
          <ul style={{ margin: '0 0 16px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {fd.bullets.map((b, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: accroche, lineHeight: 1.5 }}>
                <span style={{ color: 'var(--color-brand-600)', fontWeight: 700, flexShrink: 0, marginTop: '1px' }}>✓</span>
                {b}
              </li>
            ))}
          </ul>
        )}
        {comingSoon ? (
          <div
            style={{
              width: '100%', borderRadius: '10px',
              padding: '12px', textAlign: 'center',
              background: 'rgba(212,106,16,0.10)',
              border: '1px dashed rgba(212,106,16,0.4)',
              color: 'var(--color-warm-text)', fontWeight: 800, fontSize: '14px',
            }}
          >
            {cs.cta}
          </div>
        ) : (
          <>
            <Button
              type="button"
              onClick={handleUpgrade}
              className="h-auto w-full rounded-[10px] bg-none bg-[#B85000] px-4 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(184,80,0,0.35)] hover:opacity-[0.88]"
              style={{ gap: '6px', transition: 'opacity 0.15s' }}
            >
              <LuStar size={14} fill="white" color="white" />
              {cta.cta}
            </Button>
            <p style={{ margin: '8px 0 0', fontSize: '11px', color: finePrint, textAlign: 'center' }}>
              {cta.noCommitment}
            </p>
          </>
        )}
      </>
    )

    return (
      <div
        ref={anchorRef}
        style={{
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid rgba(212,106,16,0.22)',
          boxShadow: darkMode
            ? '0 4px 24px rgba(0,0,0,0.4)'
            : '0 4px 24px rgba(212,106,16,0.10)',
        }}
      >
        {/* Header — toujours visible. En mode collapsible, reste TOUJOURS
            compact (ne change jamais de taille, ouvert ou fermé) : le
            contenu détaillé vit dans la bulle ancrée, pas ici. */}
        {/* Repliable : un VRAI bouton, qui dit s'il est déplié (lot 9f : c'était
            une `div` cliquable — au clavier, l'explication ne s'ouvrait pas).
            Le contenu est fait de `span` : un bouton n'admet pas de `div`. */}
        <EnTete
          {...(collapsible ? { type: 'button', 'aria-expanded': expanded, onClick: () => setExpanded(p => !p) } : {})}
          style={{
            background: 'var(--gradient-deep)',
            padding: collapsible ? '11px 16px' : '18px 20px 16px',
            display: 'flex', alignItems: 'center', gap: '12px',
            cursor: collapsible ? 'pointer' : 'default',
            ...(collapsible ? { border: 0, width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit' } : {}),
          }}
        >
          <span style={{ fontSize: collapsible ? '22px' : '36px', lineHeight: 1, flexShrink: 0 }}>
            {fd_data.emoji}
          </span>
          <span style={{ display: 'block', flex: 1 }}>
            {!collapsible && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                <LuStar size={11} fill="white" color="white" />
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  {comingSoon ? cs.badge : 'Premium'}
                </span>
              </span>
            )}
            <span style={{
              display: 'block', margin: 0,
              fontSize: collapsible ? '14px' : '17px',
              fontWeight: 800, color: '#fff', lineHeight: 1.2,
            }}>
              {fd.title}
            </span>
          </span>
          {collapsible && (
            <LuChevronDown
              size={16}
              color="rgba(255,255,255,0.85)"
              style={{
                flexShrink: 0,
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s ease',
              }}
            />
          )}
        </EnTete>

        {/* Body : toujours inline pour le cas non-collapsible (comportement
            inchangé). En collapsible, le body vit dans la bulle ancrée
            ci-dessous — jamais dans le flux de page. */}
        {!collapsible && (
          <div style={{ padding: '16px 20px 20px', background: bodyBg }}>
            {cardBody}
          </div>
        )}

        {collapsible && (
          <AnchoredBubble
            pos={pos}
            popRef={popRef}
            darkMode={darkMode}
            role="dialog"
            style={{ padding: '16px 18px 18px', background: bodyBg, borderRadius: '14px' }}
          >
            {cardBody}
          </AnchoredBubble>
        )}
      </div>
    )
  }

  // variant="soft"
  const soft = SOFT_I18N[lang] ?? SOFT_I18N.fr
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ pointerEvents: 'none', userSelect: 'none', filter: 'blur(4px)' }} aria-hidden="true">
        {children}
      </div>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
        borderRadius: '12px',
        background: darkMode ? 'rgba(15,10,5,0.72)' : 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(2px)',
      }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(247,168,94,0.22) 0%, rgba(212,106,16,0.22) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-brand-600)',
        }}>
          <LuStar size={16} />
        </div>
        <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: darkMode ? '#F7C07A' : '#A05010' }}>
          {comingSoon ? cs.badge : soft.label}
        </p>
        {comingSoon ? (
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 800, color: darkMode ? '#F7C07A' : '#A05010' }}>
            {cs.cta}
          </p>
        ) : (
          <Button
            type="button"
            onClick={handleUpgrade}
            className="h-auto rounded-lg bg-none bg-[#B85000] px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_2px_8px_rgba(184,80,0,0.3)]"
            style={{ gap: '5px' }}
          >
            <LuStar size={11} fill="white" color="white" />
            {soft.upgrade}
          </Button>
        )}
      </div>
    </div>
  )
}
