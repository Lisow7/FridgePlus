// Page pleine de lecture d'un panier partagé public.
//
// S'affiche en overlay full-screen quand ?shared=<uuid> est détecté.
// Layout "document" scannable en magasin : ingrédients par rayon,
// total estimé, QR code client-side (lib `qrcode`, Canvas, aucune donnée
// ne quitte le navigateur).
//
// @media print : header/footer masqués, QR code conservé (utile sur papier),
// layout propre pour Save as PDF.

import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { LuShoppingCart, LuClock, LuPrinter, LuExternalLink } from 'react-icons/lu'
import Button from '@shared/ui/button'
import { getSharedBasket, daysUntilExpiry } from '@features/cart/api/shared-baskets'
import { formatPrix } from '@shared/lib/i18n/prix'

const AISLE_ORDER = [
  'produce','bakery','butcher','fishmonger','dairy',
  'vegan','grocery','condiments','oils','frozen','other',
]
const AISLE_EMOJI = {
  produce:'🥬', bakery:'🥖', butcher:'🥩', fishmonger:'🐟',
  dairy:'🧀', vegan:'🌱', grocery:'🛒', condiments:'🌶️',
  oils:'🫒', frozen:'❄️', other:'📦',
}

const I18N = {
  fr: {
    brand: 'Fridge+',
    title: 'Panier partagé',
    loading: 'Chargement de la liste…',
    notFound: 'Ce lien est introuvable ou a expiré.',
    error: 'Impossible de charger la liste.',
    print: 'Imprimer / Enregistrer en PDF',
    openApp: 'Ouvrir Fridge+',
    expiresIn: (n) => n === 0 ? 'Expire aujourd’hui' : n === 1 ? 'Expire demain' : `Expire dans ${n} jours`,
    total: 'Total estimé',
    items: (n) => `${n} article${n > 1 ? 's' : ''}`,
    qrHint: 'Scanne pour rouvrir sur un autre appareil',
    tagline: 'Liste créée avec Fridge+',
    aisle: {
      produce: 'Fruits & Légumes', bakery: 'Boulangerie',
      butcher: 'Boucherie & Charcuterie', fishmonger: 'Poissonnerie',
      dairy: 'Crèmerie & Œufs', vegan: 'Végé & Bio',
      grocery: 'Épicerie', condiments: 'Condiments & Épices',
      oils: 'Huiles & Vinaigres', frozen: 'Surgelés', other: 'Autres',
    },
  },
  en: {
    brand: 'Fridge+',
    title: 'Shared cart',
    loading: 'Loading list…',
    notFound: 'This link was not found or has expired.',
    error: 'Could not load the list.',
    print: 'Print / Save as PDF',
    openApp: 'Open Fridge+',
    expiresIn: (n) => n === 0 ? 'Expires today' : n === 1 ? 'Expires tomorrow' : `Expires in ${n} days`,
    total: 'Estimated total',
    items: (n) => `${n} item${n !== 1 ? 's' : ''}`,
    qrHint: 'Scan to reopen on another device',
    tagline: 'List created with Fridge+',
    aisle: {
      produce: 'Fruit & Vegetables', bakery: 'Bakery',
      butcher: 'Meat & Deli', fishmonger: 'Fish counter',
      dairy: 'Dairy & Eggs', vegan: 'Vegan & Organic',
      grocery: 'Grocery', condiments: 'Condiments & Spices',
      oils: 'Oils & Vinegars', frozen: 'Frozen', other: 'Other',
    },
  },
}

function formatPriceLocal(value, lang) {
  if (!value || value <= 0) return null
  return formatPrix(value, lang, { approx: true })
}

/**
 * @param {object} props
 * @param {string}   props.sharedId   UUID du panier partagé
 * @param {Function} props.onClose    Retour à l'app normale
 * @param {string}   [props.lang]
 * @param {boolean}  [props.darkMode]
 */
export default function SharedBasketPage({ sharedId, onClose, lang = 'fr', darkMode = false }) {
  const t = I18N[lang] ?? I18N.fr

  const [status, setStatus]   = useState('loading')
  const [payload, setPayload] = useState(null)
  const [expiresAt, setExpiresAt] = useState(null)
  const [qrSrc, setQrSrc]     = useState(null)

  // URL reconstruite depuis le sharedId (l'URL d'origine a déjà été nettoyée
  // par App.jsx avant le premier paint, donc on la reconstruit ici).
  const shareUrl = `${window.location.origin}${window.location.pathname}?shared=${sharedId}`

  // Chargement des données depuis Supabase (RLS public, pas d'auth requise)
  useEffect(() => {
    if (!sharedId) { setStatus('not_found'); return }
    let alive = true
    getSharedBasket(sharedId)
      .then(({ data, error }) => {
        if (!alive) return
        // Deux causes distinctes, et deux messages distincts. Avant, `error`
        // et `!data` etaient confondus en 'not_found' : une panne serveur
        // annoncait « ce lien a expiré », un diagnostic faux et dissuasif —
        // l'utilisateur croit son lien mort et ne réessaie pas.
        if (error) { setStatus('error'); return }
        // `.maybeSingle()` rend null si la ligne n'existe pas OU si la RLS l'a
        // filtrée (lien expiré) : là, le lien est réellement inutilisable.
        if (!data) { setStatus('not_found'); return }
        setPayload(data.payload)
        setExpiresAt(data.expires_at)
        setStatus('ok')
      })
      // ⚠️ Indispensable : sur une requête réseau avortée, supabase-js LÈVE au
      // lieu de renseigner `error`. Sans ce catch, le `.then()` n'était jamais
      // exécuté et l'écran restait bloqué sur « Chargement… » indéfiniment.
      .catch(() => { if (alive) setStatus('error') })
    return () => { alive = false }
  }, [sharedId])

  // Génération QR code côté client uniquement (lib `qrcode`, Canvas API).
  // Aucune donnée ne quitte le navigateur — conforme RGPD.
  useEffect(() => {
    if (!sharedId) return
    const dark  = darkMode ? 'var(--color-bg-warm)' : '#1A0E06'
    const light = darkMode ? '#131E2C' : '#FFFFFF'
    QRCode.toDataURL(shareUrl, { width: 140, margin: 2, color: { dark, light } })
      .then(url => setQrSrc(url))
      .catch(() => {})
    // FAUX POSITIF : la regle reclame `sharedId`, mais `shareUrl` est CONSTRUIT
    // a partir de lui — il change donc avec lui et l'effet se relance bien.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareUrl, darkMode])

  // Couleurs
  const bg      = darkMode ? '#0E1420' : '#F5F0E8'
  const card    = darkMode ? '#131E2C' : '#FFFFFF'
  const fg      = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted   = darkMode ? 'rgba(240,232,220,0.55)' : 'rgba(44,26,14,0.50)'
  const border  = darkMode ? 'rgba(247,168,94,0.20)' : 'rgba(212,106,16,0.16)'
  const accent  = darkMode ? 'var(--color-brand-400)' : '#C05A10'

  const isRecipeMode = payload?.mode === 'recipes'

  const aisleGroups = (() => {
    if (isRecipeMode || !payload?.rows || !Array.isArray(payload.rows)) return []
    const map = new Map()
    for (const row of payload.rows) {
      const a = row.aisle ?? 'other'
      if (!map.has(a)) map.set(a, [])
      map.get(a).push(row)
    }
    return AISLE_ORDER
      .map(a => ({ aisle: a, rows: map.get(a) ?? [] }))
      .filter(g => g.rows.length > 0)
  })()

  const recipeGroups = isRecipeMode ? (payload?.recipes ?? []) : []

  const totalItems = isRecipeMode
    ? recipeGroups.reduce((s, g) => s + (g.items?.length ?? 0), 0)
    : payload?.rows?.length ?? 0
  const hasTotal   = !isRecipeMode && typeof payload?.total === 'number' && payload.total > 0
  const daysLeft   = expiresAt ? daysUntilExpiry(expiresAt) : null
  const listName   = payload?.name

  return (
    <>
      {/* ── CSS global pour cette page ── */}
      <style>{`
        @media print {
          .sbp-no-print { display: none !important; }
          .sbp-wrap { background: #fff !important; }
          .sbp-card { box-shadow: none !important; border: 1px solid #ddd !important; }
          body { margin: 0; }
          @page { margin: 14mm 12mm; }
        }
        .sbp-row-item:last-child { border-bottom: none !important; }
      `}</style>

      <div
        className="sbp-wrap"
        style={{
          position: 'fixed', inset: 0, zIndex: 1300,
          background: bg, overflowY: 'auto',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: fg,
        }}
      >
        {/* ── Header barre ── */}
        <header
          className="sbp-no-print"
          style={{
            position: 'sticky', top: 0, zIndex: 10,
            background: card, borderBottom: `1px solid ${border}`,
            padding: '12px 20px',
            display: 'flex', alignItems: 'center', gap: '10px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
          }}
        >
          <span style={{
            width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
            background: 'linear-gradient(135deg,#F7A85E 0%,#D46A10 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px',
          }}>🧊</span>
          <span style={{ fontWeight: 800, fontSize: '15px', color: accent, flex: 1 }}>
            {t.brand}
          </span>
          <Button
            onClick={onClose}
            className="h-auto gap-1.5 rounded-lg bg-gradient-to-br from-[#F7A85E] to-[#D46A10] px-3.5 py-[7px] text-[13px] font-bold text-[#2C1A0E] hover:opacity-90"
          >
            <LuExternalLink size={14} aria-hidden="true" />
            {t.openApp}
          </Button>
        </header>

        {/* ── Contenu principal ── */}
        {/* <div> et non <main> : le shell fournit déjà le repère main (A11Y-14). */}
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 16px 40px' }}>

          {/* État chargement */}
          {status === 'loading' && (
            <div style={{ padding: '64px 0', textAlign: 'center', color: muted, fontSize: '14px' }}>
              {t.loading}
            </div>
          )}

          {/* État erreur / introuvable */}
          {(status === 'not_found' || status === 'error') && (
            <div style={{
              padding: '48px 24px', textAlign: 'center',
              background: card, borderRadius: '16px', border: `1px solid ${border}`,
            }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔗</div>
              <p style={{ color: muted, fontSize: '15px', margin: 0 }}>
                {status === 'not_found' ? t.notFound : t.error}
              </p>
              <Button
                onClick={onClose}
                className="mt-5 h-auto rounded-[10px] bg-gradient-to-br from-[#F7A85E] to-[#D46A10] px-5 py-2.5 text-sm font-bold text-[#2C1A0E] hover:opacity-90"
              >
                🧊 {t.openApp}
              </Button>
            </div>
          )}

          {status === 'ok' && (
            <>
              {/* ── Titre de la liste ── */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span style={{
                    width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
                    background: 'linear-gradient(135deg,#F7A85E 0%,#D46A10 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#2C1A0E',
                  }}>
                    <LuShoppingCart size={20} aria-hidden="true" />
                  </span>
                  <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: fg }}>
                    {listName || t.title}
                  </h1>
                </div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: muted, paddingLeft: '48px' }}>
                  <span>{t.items(totalItems)}</span>
                  {daysLeft !== null && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <LuClock size={11} aria-hidden="true" />
                      {t.expiresIn(daysLeft)}
                    </span>
                  )}
                </div>
              </div>

              {/* ── Mode liste de courses — groupé par rayon ── */}
              {!isRecipeMode && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {aisleGroups.map(({ aisle, rows }) => (
                    <section key={aisle}>
                      <div style={{
                        fontSize: '11px', fontWeight: 800, textTransform: 'uppercase',
                        letterSpacing: '0.07em', color: muted,
                        marginBottom: '6px',
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}>
                        <span aria-hidden="true">{AISLE_EMOJI[aisle]}</span>
                        {(t.aisle)[aisle] ?? aisle}
                      </div>
                      <div className="sbp-card" style={{
                        background: card, border: `1px solid ${border}`,
                        borderRadius: '12px', overflow: 'hidden',
                        boxShadow: darkMode ? 'none' : '0 1px 6px rgba(0,0,0,0.05)',
                      }}>
                        {rows.map((row, i) => (
                          <div key={i} className="sbp-row-item" style={{
                            padding: '10px 16px',
                            display: 'flex', alignItems: 'center', gap: '12px',
                            borderBottom: `1px solid ${border}`,
                          }}>
                            <span aria-hidden="true" style={{ fontSize: '20px', flexShrink: 0, width: '26px', textAlign: 'center' }}>{row.emoji ?? '🛒'}</span>
                            <span style={{ flex: 1, fontSize: '14px', fontWeight: 500 }}>{row.label}</span>
                            <span style={{ fontSize: '12px', color: muted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{row.amount} {row.unit}</span>
                            {typeof row.price === 'number' && row.price > 0 && (
                              <span style={{ fontSize: '12px', fontWeight: 700, color: darkMode ? '#F0C880' : '#9A5010', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                                {formatPriceLocal(row.price, lang)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}

              {/* ── Mode détail par recette — groupé par recette ── */}
              {isRecipeMode && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {recipeGroups.map((group, gi) => (
                    <section key={gi}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        marginBottom: '6px',
                      }}>
                        <span aria-hidden="true" style={{ fontSize: '20px' }}>{group.emoji}</span>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: fg }}>{group.name}</span>
                      </div>
                      <div className="sbp-card" style={{
                        background: card, border: `1px solid ${border}`,
                        borderRadius: '12px', overflow: 'hidden',
                        boxShadow: darkMode ? 'none' : '0 1px 6px rgba(0,0,0,0.05)',
                      }}>
                        {(group.items ?? []).map((item, i) => (
                          <div key={i} className="sbp-row-item" style={{
                            padding: '10px 16px',
                            display: 'flex', alignItems: 'center', gap: '12px',
                            borderBottom: `1px solid ${border}`,
                          }}>
                            <span aria-hidden="true" style={{ fontSize: '20px', flexShrink: 0, width: '26px', textAlign: 'center' }}>{item.emoji ?? '🛒'}</span>
                            <span style={{ flex: 1, fontSize: '14px', fontWeight: 500 }}>{item.label}</span>
                            <span style={{ fontSize: '12px', color: muted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{item.amount} {item.unit}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}

              {/* ── Total + QR code ── */}
              <div
                className="sbp-card"
                style={{
                  marginTop: '24px',
                  background: card, border: `1px solid ${border}`,
                  borderRadius: '14px', overflow: 'hidden',
                  boxShadow: darkMode ? 'none' : '0 1px 6px rgba(0,0,0,0.05)',
                }}
              >
                {/* Total */}
                {hasTotal && (
                  <div style={{
                    padding: '14px 18px',
                    borderBottom: `1px solid ${border}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: muted }}>
                      {t.total}
                    </span>
                    <span style={{ fontSize: '22px', fontWeight: 800, color: accent }}>
                      {formatPriceLocal(payload.total, lang)}
                    </span>
                  </div>
                )}

                {/* QR code */}
                <div style={{
                  padding: '16px 18px',
                  display: 'flex', alignItems: 'center', gap: '16px',
                }}>
                  {qrSrc ? (
                    <img
                      src={qrSrc}
                      alt={`QR code — ${shareUrl}`}
                      width={80} height={80}
                      style={{ borderRadius: '8px', flexShrink: 0, border: `1px solid ${border}` }}
                    />
                  ) : (
                    <div style={{
                      width: '80px', height: '80px', borderRadius: '8px',
                      background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                      flexShrink: 0, border: `1px solid ${border}`,
                    }} />
                  )}
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 600, color: fg }}>
                      {t.qrHint}
                    </p>
                    <p style={{ margin: 0, fontSize: '11px', color: muted }}>
                      {t.tagline}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Actions ── */}
              <div
                className="sbp-no-print"
                style={{
                  marginTop: '20px',
                  display: 'flex', gap: '10px', flexWrap: 'wrap',
                }}
              >
                <Button
                  variant="secondary"
                  onClick={() => window.print()}
                  className="h-auto flex-1 gap-2 rounded-[10px] px-4 py-3 text-sm font-semibold min-w-[160px]"
                  style={{
                    borderColor: border,
                    background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    color: fg,
                  }}
                >
                  <LuPrinter size={16} aria-hidden="true" />
                  {t.print}
                </Button>
                <Button
                  onClick={onClose}
                  className="h-auto flex-1 gap-2 rounded-[10px] bg-gradient-to-br from-[#F7A85E] to-[#D46A10] px-4 py-3 text-sm font-bold text-[#2C1A0E] shadow-[0_2px_8px_rgba(212,106,16,0.28)] hover:opacity-90 min-w-[160px]"
                >
                  🧊 {t.openApp}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
