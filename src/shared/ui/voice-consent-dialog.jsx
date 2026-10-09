import { useRef } from 'react'
import { LuMic } from 'react-icons/lu'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import Button from '@shared/ui/button'

// i18n inline (pattern projet : pas de lib i18n globale). FR + EN.
const I18N = {
  fr: {
    voiceConsentTitle:  'Activer la reconnaissance vocale ?',
    voiceConsentBody:   "Pour utiliser la reconnaissance vocale, ton navigateur transmet l'audio à un service tiers (Google pour Chrome/Edge, Apple pour Safari) afin de le transcrire. Fridge+ ne conserve ni l'audio ni le texte.",
    voiceConsentAccept: 'Activer le micro',
    voiceConsentRefuse: 'Non merci',
    voiceConsentManage: 'Gérer mes préférences',
  },
  en: {
    voiceConsentTitle:  'Enable voice recognition?',
    voiceConsentBody:   "To use voice recognition, your browser sends the audio to a third-party service (Google for Chrome/Edge, Apple for Safari) to transcribe it. Fridge+ keeps neither the audio nor the text.",
    voiceConsentAccept: 'Enable microphone',
    voiceConsentRefuse: 'No thanks',
    voiceConsentManage: 'Manage my preferences',
  },
}

// Mini-consentement RGPD avant la reconnaissance vocale (Web Speech).
// Réutilisable : micro frigo (gratuit) ET mode cuisine (premium). Informe
// que l'audio est transmis à un tiers (Google/Apple) et que Fridge+ ne
// conserve rien. Composant pur, gate-agnostique : le choix est persisté par
// le consommateur (use-voice-flow / use-cooking-mode → setVoiceConsent).
// Vit dans shared/ pour être consommable par les deux features sans import
// cross-feature.
export default function VoiceConsentDialog({ lang = 'fr', darkMode = false, onAccept, onRefuse, onManage }) {
  const t = I18N[lang] ?? I18N.fr
  const ref = useRef(null)
  useFocusTrap(ref, { active: true, onEscape: onRefuse })
  useCloseOnBackButton(true, onRefuse)

  const bg = darkMode ? '#0F1925' : '#FFFFFF'
  const fg = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted = darkMode ? '#A0A8B8' : '#7A6A52'
  const border = darkMode ? 'var(--color-dark-border)' : 'var(--color-border-warm)'

  return (
    <div
      role="presentation"
      onClick={onRefuse}
      style={{
        position: 'fixed', inset: 0, zIndex: 10001,
        background: 'rgba(15,8,2,0.78)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={t.voiceConsentTitle}
        onClick={e => e.stopPropagation()}
        className="fp-modal-panel"
        style={{
          background: bg, color: fg, borderRadius: 16, maxWidth: 420, width: '100%',
          padding: '22px 22px 18px', boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{
            display: 'inline-flex', padding: 10, borderRadius: '50%',
            background: 'rgba(224,120,32,0.14)', color: '#E07820',
          }}><LuMic size={20} /></span>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{t.voiceConsentTitle}</h2>
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.55, color: muted, margin: '0 0 18px' }}>
          {t.voiceConsentBody}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button
            onClick={onAccept}
            className="h-auto w-full rounded-lg bg-[#E07820] px-4 py-2.5 text-[14px] font-bold text-white"
          >
            {t.voiceConsentAccept}
          </Button>
          <Button
            variant="secondary"
            onClick={onRefuse}
            className="h-auto w-full rounded-lg border bg-transparent px-4 py-2.5 text-[13px] font-semibold"
            style={{ borderColor: border, color: fg }}
          >
            {t.voiceConsentRefuse}
          </Button>
          {onManage && (
            <Button
              variant="ghost"
              onClick={onManage}
              className="mt-1 h-auto self-center rounded-none bg-transparent p-0 text-[12px] font-semibold underline hover:bg-transparent"
              style={{ color: darkMode ? 'var(--color-brand-400)' : '#C05A10' }}
            >
              {t.voiceConsentManage}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
