import Button from '@shared/ui/button'
import { cn } from '@shared/lib/cn'
import { LANGUAGES, FLAGS } from '@shared/ui/lang-theme-prefs'

// Toggle de langue compact pour le header (FR ⇄ EN).
// 2 langues → un seul bouton : affiche la langue COURANTE (drapeau + code),
// le clic bascule directement vers l'autre. L'action est explicitée via
// aria-label/title pour lever l'ambiguïté (on montre l'état, on annonce l'action).
const I18N = {
  fr: { switchTo: 'Passer en anglais', current: 'Langue : Français' },
  en: { switchTo: 'Switch to French', current: 'Language: English' },
}

export default function LanguageToggle({ lang = 'fr', onLangChange, darkMode = false }) {
  const t = I18N[lang] ?? I18N.fr
  const next = lang === 'fr' ? 'en' : 'fr'
  const label = `${t.current} — ${t.switchTo}`

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => onLangChange?.(next)}
      title={label}
      aria-label={label}
      className={cn(
        'h-11 w-auto px-2 rounded-[11px] gap-1.5 text-[var(--color-muted)]',
        darkMode ? 'hover:bg-[#1A2A3D]' : 'hover:bg-[#F5ECE0]',
      )}
    >
      {FLAGS[lang]}
      <span className="text-[11px] font-bold uppercase tracking-wide">{lang}</span>
    </Button>
  )
}

export { LANGUAGES }
