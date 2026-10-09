import { useState } from 'react'
import { LuStar, LuShieldCheck } from 'react-icons/lu'
import Button from '@shared/ui/button'
import { useAuth } from '@shared/contexts/auth-provider'
import { useSubscription } from '@shared/hooks/use-subscription'
import { useUpgradeModal } from '@shared/contexts/subscription-modal-provider'
import { PREMIUM_ENABLED } from '@shared/lib/premium-config'
import { redirectToPortal } from '@shared/lib/payments/stripe'
import { SUB_I18N } from '@shared/lib/i18n/subscription-i18n'
import SpecialRoleBadge from '@shared/ui/special-role-badge'

// v3.412 — tag d'état coloré rectangle bords ronds.
// Évite la duplication d'icône (déjà présente dans le header de ProfileSection)
// et donne une lecture immédiate du statut.
const STATUS_COLORS = {
  active:   { bg: 'rgba(22,163,74,0.12)',  fg: '#16A34A', dot: '#16A34A' },
  trial:    { bg: 'rgba(212,106,16,0.14)', fg: '#B45309', dot: '#D46A10' },
  pastDue:  { bg: 'rgba(220,38,38,0.12)',  fg: '#DC2626', dot: '#DC2626' },
  canceled: { bg: 'rgba(120,120,120,0.14)',fg: '#6B7280', dot: '#6B7280' },
  free:     { bg: 'rgba(120,120,120,0.10)',fg: '#6B7280', dot: '#9CA3AF' },
}

function StatusTag({ status, label }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.free
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '5px 11px', borderRadius: '8px',
      background: c.bg, color: c.fg,
      fontSize: '12px', fontWeight: 800,
      textTransform: 'uppercase', letterSpacing: '0.05em',
      lineHeight: 1.2,
    }}>
      <span aria-hidden style={{
        width: '7px', height: '7px', borderRadius: '50%',
        background: c.dot, flexShrink: 0,
      }} />
      {label}
    </span>
  )
}

// SubscriptionTab — gestion abonnement Premium (5 états Stripe).
// Sprint 11 S11.a.5 — extrait depuis profile-modal.jsx pour être réutilisé
// dans la nouvelle page Compte & sécurité (et possiblement ailleurs).
// Code copié à l'identique ; le retrait de la fonction inline dans
// profile-modal.jsx aura lieu en S11.a.6 (cleanup final).

export default function SubscriptionTab({ lang, darkMode }) {
  const { supabase, isAdmin } = useAuth()
  const { subscriptionStatus, isPremium, isTrialing, trialDaysLeft, subscriptionEndsAt, plan, isSpecialAccess, specialRole } = useSubscription()
  const { openUpgradeModal } = useUpgradeModal()
  const st = SUB_I18N[lang] ?? SUB_I18N.fr

  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError,   setPortalError]   = useState(null)

  const text   = darkMode ? '#EBE4D8' : '#2d1b00'
  const muted  = darkMode ? '#7A90A8' : '#6A4F45'
  const subtle = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
  const cardBg = darkMode ? 'rgba(255,255,255,0.04)' : '#FAFAFA'
  const cardBorder = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  async function handlePortal() {
    setPortalError(null)
    setPortalLoading(true)
    try { await redirectToPortal(supabase) }
    catch { setPortalError(st.portalError); setPortalLoading(false) }
  }

  const formatDate = (date) => date
    ? date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'ja' ? 'ja-JP' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

  // ── État : admin ──────────────────────────────────────────────────────────
  if (isAdmin) {
    const ADMIN_I18N = {
      fr: { desc: "En tant qu'administrateur Fridge+, tu bénéficies d'un accès complet à toutes les fonctionnalités de l'application." },
      en: { desc: 'As a Fridge+ administrator, you have full access to all application features.' },
    }
    const adm = ADMIN_I18N[lang] ?? ADMIN_I18N.fr
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '4px 10px', borderRadius: '8px',
          background: 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)',
          color: '#FFFFFF', fontSize: '11px', fontWeight: 700,
          letterSpacing: '0.02em',
        }}>
          <LuShieldCheck size={11} aria-hidden="true" />
          Admin
        </span>
        <p style={{ margin: 0, fontSize: '13px', color: muted, lineHeight: 1.5 }}>{adm.desc}</p>
      </div>
    )
  }

  // ── État : accès spécial (comped par l'admin) ─────────────────────────────
  if (isSpecialAccess) {
    const SA_I18N = {
      fr: {
        desc: "Ton accès Fridge+ est offert par l'équipe Fridge+. Il est géré directement par l'administration — tu n'as rien à faire.",
      },
      en: {
        desc: 'Your Fridge+ access is provided by the Fridge+ team. It is managed directly by the administration — no action is required on your part.',
      },
    }
    const sa = SA_I18N[lang] ?? SA_I18N.fr
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
        <SpecialRoleBadge role={specialRole} lang={lang} />
        <p style={{ margin: 0, fontSize: '13px', color: muted, lineHeight: 1.5 }}>{sa.desc}</p>
      </div>
    )
  }

  // ── État : actif ──────────────────────────────────────────────────────────
  if (isPremium) {
    const planLabel = plan === 'annual' ? st.planAnnual : st.planMonthly
    const renewsLabel = subscriptionStatus === 'active' ? st.renews : st.expires
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <StatusTag status="active" label={st.activeTitle} />
          <span style={{ fontSize: '14px', color: text, fontWeight: 600 }}>{planLabel}</span>
        </div>
        {subscriptionEndsAt && (
          <div style={{ background: subtle, borderRadius: '10px', padding: '12px 14px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: muted }}>
              {renewsLabel} <strong style={{ color: text }}>{formatDate(subscriptionEndsAt)}</strong>
            </p>
          </div>
        )}
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '14px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '13px', color: muted }}>{st.manageDesc}</p>
          <Button
            variant="ghost"
            onClick={handlePortal}
            loading={portalLoading}
            disabled={portalLoading}
            className="h-auto rounded-lg border bg-transparent px-4 py-2.5 text-[13px] font-semibold hover:bg-transparent"
            style={{ gap: '6px', borderColor: cardBorder, color: text }}
          >
            {st.manage}
          </Button>
          {portalError && <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#dc2626' }}>{portalError}</p>}
        </div>
      </div>
    )
  }

  // ── État : essai en cours ─────────────────────────────────────────────────
  if (isTrialing) {
    const pct = Math.round(((7 - trialDaysLeft) / 7) * 100)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <StatusTag status="trial" label={st.trialTitle} />
          <span style={{ fontSize: '14px', color: 'var(--color-brand-600)', fontWeight: 700 }}>{st.trialDays(trialDaysLeft)}</span>
        </div>
        <div style={{ height: '6px', background: subtle, borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #F7A85E, #D46A10)', borderRadius: '3px', transition: 'width 0.5s ease' }} />
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: muted }}>{st.trialDesc}</p>
        <Button
          onClick={openUpgradeModal}
          className="h-auto rounded-[10px] bg-none bg-[#B85000] px-3 py-3 text-sm font-bold text-white shadow-[0_3px_12px_rgba(184,80,0,0.35)]"
        >
          {st.trialCta}
        </Button>
      </div>
    )
  }

  // ── État : paiement en échec ──────────────────────────────────────────────
  if (subscriptionStatus === 'past_due') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <StatusTag status="pastDue" label={st.pastDueTitle} />
        <p style={{ margin: 0, fontSize: '13px', color: muted }}>{st.pastDueDesc}</p>
        <Button
          onClick={handlePortal}
          loading={portalLoading}
          disabled={portalLoading}
          className="h-auto rounded-[10px] bg-[#DC2626] px-3 py-3 text-sm font-bold text-white"
        >
          {st.pastDueCta}
        </Button>
        {portalError && <p style={{ margin: 0, fontSize: '12px', color: '#dc2626' }}>{portalError}</p>}
      </div>
    )
  }

  // ── État : annulé mais accès encore actif ─────────────────────────────────
  if (subscriptionStatus === 'canceled' && subscriptionEndsAt && subscriptionEndsAt > new Date()) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <StatusTag status="canceled" label={st.canceledTitle} />
        <p style={{ margin: 0, fontSize: '13px', color: muted }}>{st.canceledDesc(formatDate(subscriptionEndsAt))}</p>
        <Button
          onClick={openUpgradeModal}
          className="h-auto rounded-[10px] bg-none bg-[#B85000] px-3 py-3 text-sm font-bold text-white shadow-[0_3px_12px_rgba(184,80,0,0.35)]"
        >
          {st.canceledCta}
        </Button>
      </div>
    )
  }

  // ── État : Launch Free (premium désactivé) → Prochainement ────────────────
  if (!PREMIUM_ENABLED) {
    const CS_I18N = {
      fr: { title: 'Premium', desc: 'Les fonctionnalités Premium arrivent prochainement. Tu pourras bientôt débloquer le panier, le mode cuisine vocal, les coûts et bien plus.', badge: 'Prochainement' },
      en: { title: 'Premium', desc: 'Premium features are coming soon. You\'ll soon be able to unlock the basket, hands-free cooking mode, costs and much more.', badge: 'Coming soon' },
    }
    const cs = CS_I18N[lang] ?? CS_I18N.fr
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(247,168,94,0.1) 0%, rgba(212,106,16,0.1) 100%)', border: '1px solid rgba(212,106,16,0.2)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <LuStar size={16} color="var(--color-brand-600)" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-brand-600)' }}>{cs.title}</span>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: '13px', color: muted, lineHeight: 1.5 }}>{cs.desc}</p>
          <div style={{
            borderRadius: '10px', padding: '12px', textAlign: 'center',
            background: 'rgba(212,106,16,0.08)', border: '1px dashed rgba(212,106,16,0.4)',
            color: 'var(--color-brand-600)', fontWeight: 800, fontSize: '14px',
          }}>
            {cs.badge}
          </div>
        </div>
      </div>
    )
  }

  // ── État : free (défaut) ──────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ background: 'linear-gradient(135deg, rgba(247,168,94,0.1) 0%, rgba(212,106,16,0.1) 100%)', border: '1px solid rgba(212,106,16,0.2)', borderRadius: '12px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <LuStar size={16} color="var(--color-brand-600)" />
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-brand-600)' }}>Premium</span>
        </div>
        <p style={{ margin: '0 0 14px', fontSize: '13px', color: muted, lineHeight: 1.5 }}>{st.freeDesc}</p>
        <Button
          onClick={openUpgradeModal}
          className="h-auto w-full rounded-[10px] bg-none bg-[#B85000] px-3 py-3 text-sm font-bold text-white shadow-[0_3px_12px_rgba(184,80,0,0.35)]"
        >
          {st.freeCta}
        </Button>
      </div>
    </div>
  )
}
