import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { LuX, LuExternalLink } from 'react-icons/lu'
import Button from '@shared/ui/button'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'

// Attribution CC-BY 4.0 Eurostat + mentions légales prix indicatifs.
// Accessible depuis le footer du panier (icône ℹ️ "Sources des prix").

const I18N = {
  fr: {
    title: 'Sources des prix',
    close: 'Fermer',
    indicativeNote: 'Les prix affichés dans le panier sont des estimations indicatives basées sur des données publiques. Ils ne constituent pas une offre commerciale et peuvent varier selon les enseignes, les régions et les périodes.',
    sourcesTitle: 'Sources de données',
    sources: [
      {
        name: 'Eurostat HICP (Indices des prix à la consommation harmonisés)',
        desc: 'Indices d\'inflation alimentaire par catégorie, moyennes annuelles pour la France.',
        license: 'CC-BY 4.0',
        url: 'https://ec.europa.eu/eurostat/web/hicp/data/database',
      },
      {
        name: 'Relevés grande surface FR 2025-2026',
        desc: 'Prix de référence estimatifs basés sur les conventions grandes surfaces françaises.',
        license: 'Usage interne — estimations',
        url: null,
      },
    ],
    licenseNote: 'Les données Eurostat sont publiées sous licence Creative Commons Attribution 4.0 International (CC-BY 4.0). Fridge+ utilise ces données conformément aux conditions de la licence.',
    openPricesNote: 'Dans une version future, des prix observés en temps réel seront disponibles via Open Prices (Open Food Facts — licence ODbL).',
  },
  en: {
    title: 'Price Sources',
    close: 'Close',
    indicativeNote: 'Prices shown in the basket are indicative estimates based on public data. They do not constitute a commercial offer and may vary by retailer, region, and period.',
    sourcesTitle: 'Data Sources',
    sources: [
      {
        name: 'Eurostat HICP (Harmonised Index of Consumer Prices)',
        desc: 'Food inflation indices by category, annual averages for France.',
        license: 'CC-BY 4.0',
        url: 'https://ec.europa.eu/eurostat/web/hicp/data/database',
      },
      {
        name: 'French supermarket reference prices 2025-2026',
        desc: 'Estimated reference prices based on French supermarket conventions.',
        license: 'Internal use — estimates',
        url: null,
      },
    ],
    licenseNote: 'Eurostat data is published under Creative Commons Attribution 4.0 International (CC-BY 4.0). Fridge+ uses this data in accordance with the license terms.',
    openPricesNote: 'In a future version, real-time observed prices will be available via Open Prices (Open Food Facts — ODbL license).',
  },
}

export default function PricingSourcesModal({ lang = 'fr', darkMode = false, onClose }) {
  const t = I18N[lang] ?? I18N.fr
  const modalRef = useRef(null)
  useFocusTrap(modalRef, true)
  useCloseOnBackButton(true, onClose)

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const bg      = darkMode ? 'rgba(15,25,35,0.94)' : 'rgba(253,246,238,0.96)'
  const border  = darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'
  const textPri = darkMode ? '#E8D5C0' : '#3D2B1F'
  const textSec = darkMode ? '#9AABB8' : '#7A6458'
  const tagBg   = darkMode ? 'rgba(247,168,94,0.15)' : 'rgba(247,168,94,0.12)'
  const tagColor = darkMode ? 'var(--color-brand-400)' : '#C05A10'

  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2100,
        background: 'rgba(18,10,4,0.48)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pricing-sources-title"
        onClick={e => e.stopPropagation()}
        style={{
          background: bg, border: `1px solid ${border}`,
          borderRadius: '16px', padding: '24px',
          maxWidth: '520px', width: '100%',
          maxHeight: 'calc(100dvh - 80px)', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 id="pricing-sources-title" style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: textPri }}>
            {t.title}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t.close}
            className="h-auto w-auto p-1 rounded-md"
            style={{ color: textSec }}
          >
            <LuX size={18} />
          </Button>
        </div>

        {/* Note indicative */}
        <p style={{
          fontSize: '13px', lineHeight: 1.55, color: textSec,
          background: darkMode ? 'rgba(255,200,100,0.07)' : 'rgba(255,200,100,0.10)',
          border: `1px solid ${darkMode ? 'rgba(247,168,94,0.2)' : 'rgba(212,106,16,0.2)'}`,
          borderRadius: '10px', padding: '10px 12px', margin: '0 0 16px',
        }}>
          {t.indicativeNote}
        </p>

        {/* Sources */}
        <p style={{ fontSize: '13px', fontWeight: 700, color: textPri, margin: '0 0 10px' }}>
          {t.sourcesTitle}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          {t.sources.map((src, i) => (
            <div key={i} style={{
              background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              border: `1px solid ${border}`, borderRadius: '10px', padding: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: textPri, lineHeight: 1.4 }}>
                  {src.name}
                </span>
                <span style={{
                  flexShrink: 0, fontSize: '11px', fontWeight: 600,
                  background: tagBg, color: tagColor,
                  padding: '2px 7px', borderRadius: '20px',
                  whiteSpace: 'nowrap',
                }}>
                  {src.license}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: textSec, lineHeight: 1.45 }}>
                {src.desc}
              </p>
              {src.url && (
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    marginTop: '6px', fontSize: '11px', color: tagColor,
                    textDecoration: 'none',
                  }}
                >
                  <LuExternalLink size={11} />
                  {src.url.replace('https://', '')}
                </a>
              )}
            </div>
          ))}
        </div>

        {/* Note licence CC-BY */}
        <p style={{ fontSize: '12px', color: textSec, lineHeight: 1.5, margin: '0 0 8px' }}>
          {t.licenseNote}
        </p>
        <p style={{ fontSize: '12px', color: textSec, lineHeight: 1.5, margin: 0, fontStyle: 'italic' }}>
          {t.openPricesNote}
        </p>
      </div>
    </div>,
    document.body
  )
}
