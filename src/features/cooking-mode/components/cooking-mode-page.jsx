// src/features/cooking-mode/components/cooking-mode-page.jsx
//
// Route /cook/:recipeId — mode cuisine vocal plein écran (Premium).
//
// CookingModePage = couche de garde (loading / not-found / premium / no-steps).
// Quand la recette est prête ET a des étapes, monte <CookingSession> qui
// porte le hook useCookingMode. Ce split est nécessaire : useCookingMode
// initialise totalSteps une seule fois (3e arg de useReducer) — il ne doit
// donc être monté qu'une fois la recette (et ses étapes) résolues, sinon
// totalSteps resterait bloqué à 0 pour les recettes chargées en async.

import { useRef, useState, useEffect } from 'react'
import { track } from '@shared/lib/observability/track'
import { useNavigate, useParams } from 'react-router-dom'
import { LuX, LuPlay, LuPause, LuChevronLeft, LuChevronRight, LuCheck, LuVolume2, LuVolumeX, LuMic, LuMicOff, LuRotateCcw, LuTimer, LuTimerOff, LuCircleHelp } from 'react-icons/lu'
import { useRecipeById } from '@features/recipes/hooks/use-recipe-by-id'
import { useBaseRecipes } from '@shared/contexts/data-provider'
import { useSubscription } from '@shared/hooks/use-subscription'
import { useAuth } from '@shared/contexts/auth-provider'
import { logCooking } from '@shared/api/cooking-logs'
import { useBadgeCelebration } from '@shared/hooks/use-badge-celebration'
import { useSaveErrorToast } from '@shared/hooks/use-save-error-toast'
import { pickLocalizedName } from '@shared/lib/recipes/recipe-i18n'
import { UpgradeGate } from '@shared/ui/upgrade-gate'
import Button from '@shared/ui/button'
import PageSkeleton from '@shared/ui/page-skeleton'
import { Z_INDEX } from '@shared/lib/z-index'
import { useCookingMode } from '../hooks/use-cooking-mode'
import VoiceConsentDialog from '@shared/ui/voice-consent-dialog'
import { playReadyChime } from '../lib/earcon'
import CookingHelpModal from './cooking-help-modal'
import { useDialogue } from '@shared/hooks/use-dialogue'
import CookingStepDisplay from './cooking-step-display'
import CookingTimerWidget from './cooking-timer-widget'
import CookingProgressDots from './cooking-progress-dots'
import CookingVoiceHints from './cooking-voice-hints'
import { useDocumentTitle } from '@shared/hooks/use-document-title'

const I18N = {
  fr: {
    notFound: 'Recette introuvable',
    notFoundSub: 'Cette recette n\'existe pas ou n\'a pas d\'étapes de préparation.',
    back: 'Retour',
    start: 'Commencer',
    ready: 'Prêt à cuisiner ?',
    readySub: 'Garde tes mains libres : pilote chaque étape à la voix.',
    prev: 'Précédent',
    next: 'Suivant',
    exit: 'Quitter',
    done: 'Bravo, c\'est terminé !',
    doneSub: 'Tu as parcouru toutes les étapes.',
    finish: 'Terminer',
    help: 'Aide & confidentialité',
    voiceOn: 'Couper la voix',
    voiceOff: 'Activer la voix',
    micOn: 'Couper le micro',
    micOff: 'Activer le micro',
    micShort: 'Micro',
    voiceShort: 'Voix app',
    statusListening: 'Parle maintenant',
    statusSpeaking: 'J\'explique… attends',
    statusMicOff: 'Micro coupé — touche « Micro » pour parler',
    timerStart: 'Lancer le minuteur',
    timerPause: 'Pause',
    timerResume: 'Reprendre',
    timerStop: 'Couper',
    timerReset: 'Réinitialiser',
  },
  en: {
    notFound: 'Recipe not found',
    notFoundSub: 'This recipe doesn\'t exist or has no preparation steps.',
    back: 'Back',
    start: 'Start',
    ready: 'Ready to cook?',
    readySub: 'Keep your hands free: drive each step with your voice.',
    prev: 'Previous',
    next: 'Next',
    exit: 'Exit',
    done: 'Well done, all finished!',
    doneSub: 'You went through every step.',
    finish: 'Finish',
    help: 'Help & privacy',
    voiceOn: 'Mute voice',
    voiceOff: 'Unmute voice',
    micOn: 'Turn mic off',
    micOff: 'Turn mic on',
    micShort: 'Mic',
    voiceShort: 'App voice',
    statusListening: 'Speak now',
    statusSpeaking: 'Reading… please wait',
    statusMicOff: 'Mic off — tap "Mic" to speak',
    timerStart: 'Start timer',
    timerPause: 'Pause',
    timerResume: 'Resume',
    timerStop: 'Stop',
    timerReset: 'Reset',
  },
}

const fullScreen = {
  position: 'fixed',
  inset: 0,
  zIndex: Z_INDEX.TOP_MODAL,
  background: 'var(--color-cream)',
  display: 'flex',
  flexDirection: 'column',
}

function normalizeSteps(recipe, lang) {
  if (!recipe) return []
  // Custom recipes : steps = array (langue de l'auteur).
  // Base recipes : steps = jsonb {fr:[...], en:[...]}.
  return recipe.isCustom ? (recipe.steps ?? []) : (recipe.steps?.[lang] ?? [])
}

export default function CookingModePage({ lang = 'fr', darkMode = false }) {
  const { recipeId } = useParams()
  const navigate = useNavigate()
  const { recipe, status, pending } = useRecipeById(recipeId)
  const { recipeNames, recipes: baseRecipes } = useBaseRecipes()
  const { hasPremiumAccess, profileLoading } = useSubscription()
  const { user } = useAuth()
  const celebrate = useBadgeCelebration()
  const signalerEchec = useSaveErrorToast()
  const t = I18N[lang] ?? I18N.fr

  // Le titre doit dire QUELLE recette on cuisine — le nom du plat, comme sur
  // /recipe/:id, et non le libellé « Mode cuisine » de la route.
  // 🔴 Posé AVANT les retours conditionnels ci-dessous : règle des hooks.
  const nomPourOnglet = !recipe
    ? ''
    : (recipe.isCustom
        ? pickLocalizedName(recipe.name, null, lang, recipe.id)
        : pickLocalizedName(recipeNames?.[recipe.id], null, lang, recipe.id))
  useDocumentTitle(nomPourOnglet ? nomPourOnglet + ' — Fridge+' : '')

  // Profil pas encore là : on attend aussi, sinon un abonné voyait le verrou
  // un instant (audit du 2026-10-04, PREM-06).
  if (status === 'loading' || profileLoading) {
    return <PageSkeleton lang={lang} darkMode={darkMode} />
  }

  // Gate Premium : réutilise le système d'abonnement existant (variant hard).
  if (!hasPremiumAccess) {
    return (
      <div style={fullScreen}>
        <CloseButton onClick={() => navigate(-1)} label={t.exit} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <UpgradeGate feature="voice-cooking" variant="hard" lang={lang} darkMode={darkMode} />
        </div>
      </div>
    )
  }

  const steps = normalizeSteps(recipe, lang)

  // Recette embarquée montrée avant le catalogue : ses étapes arrivent avec sa
  // fiche complète. « Introuvable » serait faux — on attend.
  if (pending && steps.length === 0) {
    return <PageSkeleton lang={lang} darkMode={darkMode} />
  }

  if (status === 'not-found' || !recipe || steps.length === 0) {
    return (
      <div style={fullScreen}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '24px', textAlign: 'center' }}>
          <p style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-charcoal)', margin: 0 }}>{t.notFound}</p>
          <p style={{ fontSize: '15px', color: 'var(--color-muted)', margin: 0, maxWidth: '420px' }}>{t.notFoundSub}</p>
          <Button variant="secondary" onClick={() => navigate(-1)}>{t.back}</Button>
        </div>
      </div>
    )
  }

  const recipeName = recipe.isCustom
    ? pickLocalizedName(recipe.name, null, lang, recipe.id)
    : pickLocalizedName(recipeNames?.[recipe.id], null, lang, recipe.id)

  // Journal de cuisine (connecté uniquement). Même logique de source que
  // recipe-modal. NB : seul le LOG est porté ici ; le retrait interactif des
  // ingrédients du stock (step-2 de recipe-modal) reste hors scope de la
  // route standalone — différé (cf. task migration mode cuisine).
  const recipeSource = recipe.isCustom ? 'custom' : (recipe._isCommunity ? 'community' : 'base')
  const resolveCookCountry = (recipeId, source) =>
    source === 'custom' ? null : (baseRecipes?.find(r => r.id === recipeId)?.country ?? null)
  const onFinish = () => {
    track('cook_completed', { recipeId: recipe.id })
    if (user?.id) {
      // La célébration ne part que si le plat est noté ; sinon on le dit (le
      // message vit au-dessus des pages : il survit au retour en arrière).
      logCooking(user.id, { recipeId: recipe.id, recipeSource, servings: recipe.servings })
        .then((resultat) => {
          if (resultat?.error) { signalerEchec('cooking'); return }
          celebrate(user.id, { resolveCountry: resolveCookCountry, lang })
        })
    }
    navigate(-1)
  }

  // Recette + étapes prêtes → monte la session (useCookingMode init stable).
  return (
    <CookingSession
      recipe={{ ...recipe, steps }}
      recipeName={recipeName}
      lang={lang}
      darkMode={darkMode}
      t={t}
      onExit={() => navigate(-1)}
      onFinish={onFinish}
    />
  )
}

function CloseButton({ onClick, label }) {
  return (
    <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 1 }}>
      <Button variant="ghost" size="icon" aria-label={label} onClick={onClick}>
        <LuX size={22} />
      </Button>
    </div>
  )
}

function CookingSession({ recipe, recipeName, lang, darkMode, t, onExit, onFinish }) {
  const { status, currentStep, progress, timer, speaking, muted, micEnabled, voiceConsentOpen, onVoiceConsentAccept, onVoiceConsentRefuse, handlers } = useCookingMode(recipe, lang)
  const [helpOpen, setHelpOpen] = useState(false)
  // Plein écran par-dessus l'application : rôle, nom (le titre), focus piégé
  // (A11Y-14). Pas d'Échap : on ne perd pas une session par accident.
  const dialogue = useDialogue()
  const finishedRef = useRef(false)
  const finishOnce = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    onFinish()
  }
  const isCooking = status === 'speaking' || status === 'listening' || status === 'paused'
  // L'app écoute réellement quand : micro ON, elle ne parle pas, session active.
  const listening = micEnabled && !speaking && isCooking

  // Earcon « à toi de parler » : joué quand l'app passe de parle → écoute,
  // pour signaler le tour de parole SANS regarder l'écran (mains-libres).
  const prevListeningRef = useRef(false)
  useEffect(() => {
    if (listening && !prevListeningRef.current) playReadyChime()
    prevListeningRef.current = listening
  }, [listening])

  return (
    <div {...dialogue.proprietes} style={fullScreen}>
      <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 1 }}>
        <Button variant="ghost" size="icon" aria-label={t.help} title={t.help} onClick={() => setHelpOpen(true)}>
          <LuCircleHelp size={22} />
        </Button>
      </div>
      <CloseButton onClick={() => { handlers.stop(); onExit() }} label={t.exit} />
      <CookingHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} lang={lang} darkMode={darkMode} />
      {voiceConsentOpen && (
        <VoiceConsentDialog
          lang={lang}
          darkMode={darkMode}
          onAccept={onVoiceConsentAccept}
          onRefuse={onVoiceConsentRefuse}
        />
      )}

      {/* Header : nom recette + progression + état micro */}
      <div style={{ padding: '20px 16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <h1 id={dialogue.titreId} style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-charcoal)', margin: 0, textAlign: 'center' }}>
          {recipeName}
        </h1>
        <CookingProgressDots current={progress.current} total={progress.total} />
        {isCooking && (
          <VoiceControls
            micEnabled={micEnabled}
            muted={muted}
            handlers={handlers}
            t={t}
          />
        )}
      </div>

      {/* Statut dynamique : dit clairement à l'utilisateur quoi faire MAINTENANT
          (parler / attendre / réactiver le micro). Élément central et visible. */}
      {isCooking && (
        <CookingVoiceStatus micEnabled={micEnabled} speaking={speaking} listening={listening} t={t} />
      )}

      {/* Corps : varie selon le statut */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', padding: '16px' }}>
        {status === 'idle' && (
          <>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 700, color: 'var(--color-charcoal)', margin: '0 0 8px' }}>{t.ready}</p>
              <p style={{ fontSize: '15px', color: 'var(--color-muted)', margin: 0 }}>{t.readySub}</p>
            </div>
            <Button variant="primary" size="lg" onClick={handlers.start}>
              <LuPlay size={20} /> {t.start}
            </Button>
          </>
        )}

        {isCooking && (
          <>
            <CookingStepDisplay
              stepText={currentStep}
              stepNumber={progress.current}
              totalSteps={progress.total}
              lang={lang}
            />
            {timer && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <CookingTimerWidget timer={timer} lang={lang} />
                <TimerControls timer={timer} handlers={handlers} t={t} />
              </div>
            )}
          </>
        )}

        {status === 'finished' && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', background: 'color-mix(in srgb, var(--color-success) 16%, transparent)', color: 'var(--color-success)' }}>
              <LuCheck size={32} />
            </span>
            <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-charcoal)', margin: 0 }}>{t.done}</p>
            <p style={{ fontSize: '15px', color: 'var(--color-muted)', margin: 0 }}>{t.doneSub}</p>
            <Button variant="primary" size="lg" onClick={finishOnce}>{t.finish}</Button>
          </div>
        )}
      </div>

      {/* Contrôles manuels (fallback tactile au vocal) */}
      {isCooking && (
        <div style={{ padding: '16px', display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '96px' }}>
          <Button variant="secondary" onClick={handlers.previous} disabled={progress.current <= 1}>
            <LuChevronLeft size={18} /> {t.prev}
          </Button>
          <Button variant="primary" onClick={handlers.next}>
            {t.next} <LuChevronRight size={18} />
          </Button>
        </div>
      )}

      {/* Hints vocaux (footer rotatif) — masqués en idle/finished */}
      {isCooking && <CookingVoiceHints lang={lang} />}
    </div>
  )
}

// Bandeau de statut TRÈS visible : indique à l'utilisateur quoi faire à
// l'instant T. C'est la clé du mains-libres — sans ça, on ne sait pas quand
// parler (le micro se coupe pendant que l'app lit, pour ne pas s'entendre).
function CookingVoiceStatus({ micEnabled, speaking, listening, t }) {
  let cfg
  if (!micEnabled) {
    cfg = { icon: <LuMicOff size={20} />, text: t.statusMicOff, color: 'var(--color-muted)', pulse: false }
  } else if (speaking) {
    cfg = { icon: <LuVolume2 size={20} />, text: t.statusSpeaking, color: 'var(--color-warm-600)', pulse: false }
  } else if (listening) {
    cfg = { icon: <LuMic size={20} />, text: t.statusListening, color: 'var(--color-success)', pulse: true }
  } else {
    cfg = { icon: <LuMic size={20} />, text: t.statusListening, color: 'var(--color-success)', pulse: false }
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 16px' }}>
      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '10px',
          padding: '10px 20px', borderRadius: '999px',
          background: `color-mix(in srgb, ${cfg.color} 14%, transparent)`,
          color: cfg.color, fontWeight: 700, fontSize: '16px',
          animation: cfg.pulse ? 'voice-pulse 1.4s ease-in-out infinite' : 'none',
        }}
      >
        {cfg.icon}
        {cfg.text}
      </div>
    </div>
  )
}

// Deux toggles distincts et explicites : le Micro (écoute des commandes) et
// la Voix de l'app (lecture TTS des étapes). Ce sont des CONTRÔLES on/off —
// pas de clignotement (le statut "à toi de parler" est porté par le bandeau
// CookingVoiceStatus, sinon doublon visuel).
function VoiceControls({ micEnabled, muted, handlers, t }) {
  const pill = 'h-9 rounded-lg px-3 text-xs font-bold'
  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
      <Button
        variant="secondary"
        className={pill}
        aria-label={micEnabled ? t.micOn : t.micOff}
        onClick={handlers.toggleMic}
        style={{
          color: micEnabled ? 'var(--color-success)' : 'var(--color-muted)',
          borderColor: micEnabled ? 'var(--color-success)' : 'var(--color-border-warm)',
        }}
      >
        {micEnabled ? <LuMic size={15} /> : <LuMicOff size={15} />}
        {t.micShort} : {micEnabled ? 'ON' : 'OFF'}
      </Button>
      <Button
        variant="secondary"
        className={pill}
        aria-label={muted ? t.voiceOff : t.voiceOn}
        onClick={handlers.toggleMute}
        style={{
          color: muted ? 'var(--color-muted)' : 'var(--color-warm-600)',
          borderColor: muted ? 'var(--color-border-warm)' : 'var(--color-warm-400)',
        }}
      >
        {muted ? <LuVolumeX size={15} /> : <LuVolume2 size={15} />}
        {t.voiceShort} : {muted ? 'OFF' : 'ON'}
      </Button>
    </div>
  )
}

// Contrôles tactiles du minuteur (fallback au vocal "lance / pause / annule").
function TimerControls({ timer, handlers, t }) {
  const btn = 'h-8 px-3 text-xs'
  if (timer.state === 'idle') {
    return (
      <Button variant="secondary" className={btn} onClick={handlers.startTimer}>
        <LuTimer size={15} /> {t.timerStart}
      </Button>
    )
  }
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      {timer.state === 'running' && (
        <Button variant="secondary" className={btn} onClick={handlers.pauseTimer}>
          <LuPause size={15} /> {t.timerPause}
        </Button>
      )}
      {timer.state === 'paused' && (
        <Button variant="secondary" className={btn} onClick={handlers.resumeTimer}>
          <LuPlay size={15} /> {t.timerResume}
        </Button>
      )}
      <Button variant="secondary" className={btn} onClick={handlers.resetTimer}>
        <LuRotateCcw size={15} /> {t.timerReset}
      </Button>
      <Button variant="ghost" className={btn} onClick={handlers.cancelTimer}>
        <LuTimerOff size={15} /> {t.timerStop}
      </Button>
    </div>
  )
}
