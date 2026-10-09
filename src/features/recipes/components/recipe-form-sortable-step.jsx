import { useState, useEffect, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { LuGripVertical, LuMic, LuTrash2 } from 'react-icons/lu'
import { LANG_TO_LOCALE } from '@shared/hooks/use-voice-recognition'
import Button from '@shared/ui/button'

// Phase 8 launch (refonte Modales) PR 8.8.a. Extraction de
// RecipeFormModal : étape de recette dans la liste drag&drop. Auto-resize
// du textarea + reconnaissance vocale (mic 5s silence). Pure presentational
// + side-effect mic local.

export default function RecipeFormSortableStep({ step, index, onChange, onDelete, darkMode, t, hasError, lang }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id })
  const [micListening, setMicListening] = useState(false)
  const recognitionRef = useRef(null)
  const silenceTimerRef = useRef(null)
  const textareaRef = useRef(null)
  const hasVoice = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(() => { autoResize() }, [step.text])

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
      const text = e.results[0]?.[0]?.transcript ?? ''
      if (text) onChange(step.id, (step.text ? `${step.text} ${text}` : text).slice(0, 150))
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
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '8px' }}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t.dragStep ?? 'Drag step'}
        {...attributes}
        {...listeners}
        className="h-auto w-auto rounded-none hover:bg-transparent"
        style={{ cursor: 'grab', flexShrink: 0, padding: '8px 4px', color: 'var(--color-muted)', marginTop: '6px', touchAction: 'none' }}
      >
        <LuGripVertical size={16} />
      </Button>
      <span style={{ minWidth: '26px', height: '26px', borderRadius: '50%', background: 'var(--color-brand-500)', color: '#fff', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '7px' }}>{index + 1}</span>
      <div style={{ position: 'relative', flex: 1 }}>
        <textarea
          ref={textareaRef}
          value={step.text}
          onChange={e => onChange(step.id, e.target.value)}
          placeholder={t.placeholderStep}
          maxLength={150}
          rows={1}
          style={{ width: '100%', padding: '9px 36px 9px 10px', borderRadius: '8px', border: hasError ? '1.5px solid #D07070' : (darkMode ? '1.5px solid #1A2A3D' : '1.5px solid #E8E0D4'), background: darkMode ? '#0F1923' : '#FFF', color: 'var(--color-charcoal)', fontSize: '14px', resize: 'none', overflow: 'hidden', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', minHeight: '60px' }}
        />
        {hasVoice && (
          <Button
            variant="ghost"
            size="icon"
            onClick={micListening ? stopMic : startMic}
            aria-label={micListening ? (t.stopMic ?? 'Stop voice') : (t.startMic ?? 'Start voice')}
            aria-pressed={micListening}
            className="h-auto w-auto rounded-md hover:bg-transparent"
            style={{ position: 'absolute', top: '50%', right: '6px', transform: 'translateY(-50%)', padding: '5px', background: micListening ? '#E53535' : 'transparent', color: micListening ? 'white' : (darkMode ? '#7A90A8' : 'var(--color-muted)'), transition: 'all 0.2s', animation: micListening ? 'soft-blink 1s ease-in-out infinite' : 'none' }}
          >
            <LuMic size={16} />
          </Button>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(step.id)}
        aria-label={t.deleteStep ?? 'Delete step'}
        className="h-auto w-auto hover:bg-transparent"
        style={{ padding: '6px', color: '#D07070', flexShrink: 0, marginTop: '8px' }}
      >
        <LuTrash2 size={15} />
      </Button>
    </div>
  )
}
