import { LuWallet, LuArrowRight } from 'react-icons/lu'
import { formatPrix } from '@shared/lib/i18n/prix'
import { suffixS } from '@shared/lib/i18n/pluralize'

const I18N = {
  fr: {
    title: 'Bilan budgétaire',
    spent: 'Dépensé',
    items: (n) => `${n} article${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''}`,
    detail: 'Voir le détail des dépenses',
    indicative: 'Prix indicatifs basés sur Open Prices et données locales.',
  },
  en: {
    title: 'Budget summary',
    spent: 'Spent',
    items: (n) => `${n} item${suffixS(n, 'en')} added`,
    detail: 'See spending detail',
    indicative: 'Indicative prices based on Open Prices and local data.',
  },
}

// Carte « Bilan budgétaire » de la phase « Et après ? » — total dépensé (snapshot
// local) + clause prix indicatifs (RGPD). Le CTA détail est optionnel (n'est rendu
// que si onShowDetail fourni).
export default function WhatsNextBudgetCard({ snapshot, lang = 'fr', darkMode = false, onShowDetail }) {
  const t = I18N[lang] ?? I18N.fr
  const total = snapshot?.totalSpent ?? 0
  const muted = darkMode ? '#7A90A8' : '#8A6A60'
  const cardBg = darkMode ? '#131E2C' : '#fff'
  const cardBorder = darkMode ? '#1A2A3D' : 'rgba(0,0,0,0.08)'

  return (
    <div className="rounded-[12px] border p-4 flex flex-col gap-2" style={{ background: cardBg, borderColor: cardBorder }}>
      <div className="flex items-center gap-2">
        <LuWallet size={16} style={{ color: '#D46A10' }} aria-hidden="true" />
        <span className="text-[12px] font-extrabold uppercase tracking-[0.06em]" style={{ color: muted }}>{t.title}</span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px]" style={{ color: muted }}>
          {t.spent}{snapshot?.addedCount ? ` · ${t.items(snapshot.addedCount)}` : ''}
        </span>
        <span className="text-[22px] font-black" style={{ color: '#D46A10' }}>
          {total > 0 ? formatPrix(total, lang, { approx: true }) : '—'}
        </span>
      </div>
      <p className="text-[11px]" style={{ color: muted, opacity: 0.8 }}>{t.indicative}</p>
      {onShowDetail && (
        <button
          onClick={onShowDetail}
          className="flex items-center gap-1 text-[12px] font-bold text-[#D46A10] bg-transparent border-none cursor-pointer self-start min-h-[36px]"
        >
          {t.detail} <LuArrowRight size={13} />
        </button>
      )}
    </div>
  )
}
