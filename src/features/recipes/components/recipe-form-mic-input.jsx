import { useState, useEffect, useRef } from 'react'
import { LuMic } from 'react-icons/lu'
import { LANG_TO_LOCALE } from '@shared/hooks/use-voice-recognition'
import Button from '@shared/ui/button'

// Phase 8 launch (refonte Modales) PR 8.8.a. Extraction de
// RecipeFormModal : input avec bouton micro intégré (reconnaissance vocale
// 5s timeout, dictée jusqu'à `maxLength` chars). Utilisé pour le nom de
// la recette + autres champs textuels courts.

export default function RecipeFormMicInput({ value, onChange, placeholder, style, lang, darkMode, maxLength, inputProps = {} }) {
  const [micListening, setMicListening] = useState(false)
  const recognitionRef = useRef(null)
  const silenceTimerRef = useRef(null)
  const hasVoice = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  const startMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.lang = LANG_TO_LOCALE[lang] ?? 'fr-FR'
    r.interimResults = false
    r.maxAlternatives = 1
    silenceTimerRef.current = setTimeout(() => r.stop(), 5000)
    r.onspeechstart = () => { clearTimeout(silenceTimerRef.current) }
    r.onresult = (e) => {
      const raw = e.results[0]?.[0]?.transcript ?? ''
      const text = maxLength ? raw.slice(0, maxLength) : raw
      if (text) onChange({ target: { value: text } })
      setMicListening(false)
    }
    r.onend = () => setMicListening(false)
    r.onerror = () => { clearTimeout(silenceTimerRef.current); setMicListening(false) }
    recognitionRef.current = r
    r.start()
    setMicListening(true)
  }

  const stopMic = () => { clearTimeout(silenceTimerRef.current); recognitionRef.current?.stop(); setMicListening(false) }

  useEffect(() => () => { clearTimeout(silenceTimerRef.current); recognitionRef.current?.stop() }, [])

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        {...inputProps}
        maxLength={maxLength}
        style={{ ...style, ...(hasVoice ? { paddingRight: '36px' } : {}) }}
      />
      {hasVoice && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onMouseDown={e => e.preventDefault()}
          onClick={micListening ? stopMic : startMic}
          aria-label={micListening ? 'Stop voice' : 'Start voice'}
          aria-pressed={micListening}
          className="h-auto w-auto rounded-[5px] hover:bg-transparent"
          style={{
            position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
            padding: '4px', background: micListening ? '#E53535' : 'transparent',
            color: micListening ? 'white' : (darkMode ? '#7A90A8' : 'var(--color-muted)'),
            transition: 'all 0.2s',
            animation: micListening ? 'soft-blink 1s ease-in-out infinite' : 'none',
          }}
        >
          <LuMic size={13} />
        </Button>
      )}
    </div>
  )
}
