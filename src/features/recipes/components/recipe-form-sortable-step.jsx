import { useState, useEffect, useLayoutEffect, useRef, useId } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { LuGripVertical, LuMic, LuTrash2, LuArrowUp, LuArrowDown } from 'react-icons/lu'
import { CIBLE_MINIMALE } from '@shared/lib/cible-minimale'
import { LANG_TO_LOCALE } from '@shared/hooks/use-voice-recognition'
import Button from '@shared/ui/button'

// Phase 8 launch (refonte Modales) PR 8.8.a. Extraction de
// RecipeFormModal : étape de recette dans la liste drag&drop. Auto-resize
// du textarea + reconnaissance vocale (mic 5s silence). Pure presentational
// + side-effect mic local.

// Deux flèches ↑ ↓ à côté de la poignée (décision du 2026-10-08 ; WCAG 2.5.7) :
// réordonner sans glisser. Après un déplacement (l'index change), React a pu
// déplacer le nœud et perdre le focus : il revient sur la flèche qui a servi, ou
// sur l'autre si elle s'est éteinte (l'étape est arrivée au bout de la liste).
function FlechesDeLEtape({ stepId, index, total, onMove, t }) {
  const hautRef = useRef(null)
  const basRef = useRef(null)
  const focusApres = useRef(0) // la flèche qui a servi : -1 ↑, 1 ↓
  useLayoutEffect(() => {
    const sens = focusApres.current
    if (!sens) return
    focusApres.current = 0
    const voulu = sens < 0 ? hautRef.current : basRef.current
    const autre = sens < 0 ? basRef.current : hautRef.current
    ;(voulu && !voulu.disabled ? voulu : autre)?.focus()
  }, [index])
  const deplacer = (sens) => { focusApres.current = sens; onMove(stepId, sens) }
  const style = { ...CIBLE_MINIMALE, padding: '2px', color: 'var(--color-muted)' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, marginTop: '4px' }}>
      <Button ref={hautRef} variant="ghost" size="icon" onClick={() => deplacer(-1)} disabled={index === 0}
        aria-label={`${t.moveStepUp} ${index + 1}`} className="h-auto w-auto rounded-md hover:bg-transparent" style={style}>
        <LuArrowUp size={14} />
      </Button>
      <Button ref={basRef} variant="ghost" size="icon" onClick={() => deplacer(1)} disabled={index === total - 1}
        aria-label={`${t.moveStepDown} ${index + 1}`} className="h-auto w-auto rounded-md hover:bg-transparent" style={style}>
        <LuArrowDown size={14} />
      </Button>
    </div>
  )
}

export default function RecipeFormSortableStep({ step, index, total, onChange, onDelete, onMove, darkMode, t, hasError, lang }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id })
  const [micListening, setMicListening] = useState(false)
  const recognitionRef = useRef(null)
  const silenceTimerRef = useRef(null)
  const textareaRef = useRef(null)
  // La pastille numérotée, visible, est le libellé de l'étape (« Étape 3 »).
  const etapeId = useId()
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
        aria-label={t.dragStep}
        {...attributes}
        {...listeners}
        className="h-auto w-auto rounded-none hover:bg-transparent"
        style={{ cursor: 'grab', flexShrink: 0, padding: '8px 4px', color: 'var(--color-muted)', marginTop: '6px', touchAction: 'none' }}
      >
        <LuGripVertical size={16} />
      </Button>
      <FlechesDeLEtape stepId={step.id} index={index} total={total} onMove={onMove} t={t} />
      {/* Orange profond : le blanc sur l'orange vif plafonnait à 3,05:1 (décision du 2026-10-06). */}
      {/* Le libellé entendu (« Étape 3 ») ; la pastille visible en montre le
          numéro — il fait partie du nom (WCAG 2.5.3). */}
      <span id={etapeId} className="sr-only">{`${t.stepAria} ${index + 1}`}</span>
      <span aria-hidden="true" style={{ minWidth: '26px', height: '26px', borderRadius: '50%', background: '#B85000', color: '#fff', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '7px' }}>{index + 1}</span>
      <div style={{ position: 'relative', flex: 1 }}>
        <textarea
          ref={textareaRef}
          value={step.text}
          onChange={e => onChange(step.id, e.target.value)}
          aria-labelledby={etapeId}
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
            aria-label={micListening ? t.stopMic : t.startMic}
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
        aria-label={t.deleteStep}
        className="h-auto w-auto hover:bg-transparent"
        style={{ padding: '6px', color: '#D07070', flexShrink: 0, marginTop: '8px' }}
      >
        <LuTrash2 size={15} />
      </Button>
    </div>
  )
}
