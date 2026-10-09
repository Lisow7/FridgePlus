import { LuCheck } from 'react-icons/lu'
import Button from '@shared/ui/button'

// Phase 7 launch (refonte Profil) — sous-composant extrait de
// ProfileModal lors de la PR 8.6.1. Présentation pure : reçoit l'état +
// les callbacks du parent. Aucune logique métier ici.

const ALLERGEN_RESET_LABEL = {
  fr: 'Tout décocher',
  en: 'Uncheck all',
}

export default function AllergenPicker({
  allergens,        // { key: { icon, labels } } — master data
  allergenKeys,     // string[] — ordre d'affichage
  selectedKeys,     // string[] — sélection actuelle
  onToggle,         // (key) => void
  onReset,          // () => void
  onSave,           // () => void
  isLoading,        // boolean — bouton Save désactivé pendant fetch
  isSaved,          // boolean — affiche check ✓ après save
  t,                // i18n object (allergenTitle, allergenSub, allergenNone, saveBtn)
  lang,
  darkMode,
  isMobile,
  border,
  inputBg,
  textColor,
  mutedColor,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '10px' : '14px' }}>
      {/* Titre + description fournis par le ProfileSection parent — pas de
          duplication ici (cf. profile-preferences-page). */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: isMobile ? '6px' : '8px' }}>
        {allergenKeys.map(key => {
          const a = allergens[key]
          const checked = selectedKeys.includes(key)
          return (
            <Button
              key={key}
              variant="ghost"
              onClick={() => onToggle(key)}
              aria-pressed={checked}
              className="h-full justify-start rounded-[10px] border-[1.5px] text-left hover:bg-transparent"
              style={{
                gap: isMobile ? '8px' : '10px',
                padding: isMobile ? '7px 10px' : '10px 12px',
                borderColor: checked ? 'var(--color-warm-400)' : border,
                background: checked
                  ? (darkMode ? 'rgba(247,168,94,0.12)' : 'rgba(247,168,94,0.10)')
                  : inputBg,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: isMobile ? '17px' : '20px', lineHeight: 1 }}>{a?.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: isMobile ? '13px' : '15px',
                  fontWeight: checked ? 700 : 500,
                  color: checked ? 'var(--color-warm-600)' : textColor,
                  lineHeight: 1.3,
                }}>
                  {a?.labels?.[lang] ?? a?.labels?.fr ?? key}
                </div>
              </div>
              {checked && <LuCheck size={14} style={{ color: 'var(--color-warm-500)', flexShrink: 0 }} />}
            </Button>
          )
        })}
      </div>

      {selectedKeys.length === 0 && (
        <p style={{ fontSize: '12px', color: mutedColor, opacity: 0.7, textAlign: 'center', margin: '4px 0 0' }}>
          {t.allergenNone}
        </p>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '4px', justifyContent: 'flex-start' }}>
        {selectedKeys.length > 0 && (
          <Button
            variant="secondary"
            onClick={onReset}
            className="h-auto rounded-[10px] border-[1.5px] bg-transparent px-4 py-2.5 text-[13px] font-semibold"
            style={{ borderColor: border, color: mutedColor }}
          >
            {ALLERGEN_RESET_LABEL[lang] ?? ALLERGEN_RESET_LABEL.fr}
          </Button>
        )}
        <Button
          onClick={onSave}
          loading={isLoading}
          disabled={isLoading}
          className="h-auto rounded-[10px] bg-none bg-[#B85000] px-4 py-2.5 text-[13px] font-bold text-white"
          style={{ gap: '6px' }}
        >
          {!isLoading && isSaved && <LuCheck size={14} />}
          {t.saveBtn}
        </Button>
      </div>
    </div>
  )
}
