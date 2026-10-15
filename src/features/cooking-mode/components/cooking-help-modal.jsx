// src/features/cooking-mode/components/cooking-help-modal.jsx
//
// Guide d'utilisation du mode cuisine vocal, ouvert depuis le bouton "?" du
// header. Explique le flux (1 tap puis mains libres), les commandes vocales,
// et la confidentialité (RGPD : la reconnaissance vocale est assurée par le
// navigateur, l'audio n'est jamais reçu/stocké par Fridge+).
//
// Accessible uniquement aux Premium : le composant n'est rendu que dans la
// page /cook, elle-même derrière le gate Premium (UpgradeGate sinon).

import ReusableModal from '@shared/ui/reusable-modal'

const I18N = {
  fr: {
    title: 'Mode cuisine — guide de la voix',
    howTitle: 'Comment ça marche',
    how: [
      'Touche « Commencer » une seule fois : ça active le micro et la voix de l’app.',
      'Ensuite, garde les mains libres : pilote chaque étape à la voix.',
      'L’app lit l’étape à voix haute, puis t’écoute pour la suite.',
      'Un petit son + le bandeau vert « Parle maintenant » t’indiquent quand c’est à toi (attends la fin de la lecture).',
    ],
    cmdTitle: 'Ce que tu peux dire',
    cmdGroups: [
      { h: 'Naviguer', items: ['« suivant », « précédent »', '« répète » ou « recommence » pour réentendre l’étape', '« étape 3 » pour sauter à une étape', '« depuis le début » pour repartir au début'] },
      { h: 'Minuteur', items: ['« lance » pour démarrer', '« pause », « réinitialise »', '« ajoute 5 minutes »', '« il reste combien ? »'] },
      { h: 'La voix de l’app', items: ['« tais-toi » pour couper la lecture', '« reparle » pour la réactiver'] },
      { h: 'Quitter', items: ['« stop » pour sortir'] },
    ],
    tipsTitle: 'Les deux boutons du header',
    tips: [
      '🎤 Micro : coupe / réactive l’écoute de tes commandes. Une fois coupé, réactive-le en tapant le bouton — à l’arrêt, rien ne peut t’entendre.',
      '🔊 Voix app : coupe / réactive la lecture des étapes. En la réactivant, l’étape courante est relue.',
      'Parle naturellement, une commande à la fois. En milieu bruyant, utilise les boutons à l’écran.',
    ],
    privTitle: 'Confidentialité',
    priv: [
      'La reconnaissance vocale est assurée par ton navigateur. Sur Chrome, l’audio peut être transmis aux serveurs de Google pour être transcrit — cela dépend de ton navigateur, pas de Fridge+.',
      'Fridge+ ne reçoit, n’enregistre et ne stocke jamais ta voix : l’app ne reçoit que le texte reconnu, traité sur ton appareil pour détecter les commandes.',
      'Le micro n’est actif que pendant le mode cuisine. Tu peux couper la voix à tout moment ou retirer l’autorisation micro dans les réglages de ton navigateur.',
      'Aucune donnée vocale n’est utilisée pour de la publicité ou du profilage.',
    ],
    close: 'Compris',
  },
  en: {
    title: 'Cooking mode — voice guide',
    howTitle: 'How it works',
    how: [
      'Tap "Start" once: this turns on the mic and the app’s voice.',
      'Then keep your hands free: drive every step with your voice.',
      'The app reads the step aloud, then listens for what’s next.',
      'A short sound + the green "Speak now" banner tell you when it’s your turn (wait for the reading to finish).',
    ],
    cmdTitle: 'What you can say',
    cmdGroups: [
      { h: 'Navigate', items: ['"next", "previous"', '"repeat" to hear the step again', '"step 3" to jump to a step', '"from start" to go back to step 1'] },
      { h: 'Timer', items: ['"start" to launch', '"pause", "reset"', '"add 5 minutes"', '"how much time left?"'] },
      { h: 'The app’s voice', items: ['"shut up" to mute reading', '"unmute" to bring it back'] },
      { h: 'Exit', items: ['"stop" to leave'] },
    ],
    tipsTitle: 'The two header buttons',
    tips: [
      '🎤 Mic: turns listening on / off. Once off, tap the button to turn it back on — while off, nothing can hear you.',
      '🔊 App voice: turns step reading on / off. When you turn it back on, the current step is read again.',
      'Speak naturally, one command at a time. In a noisy place, use the on-screen buttons.',
    ],
    privTitle: 'Privacy',
    priv: [
      'Voice recognition is handled by your browser. On Chrome, audio may be sent to Google’s servers for transcription — this depends on your browser, not on Fridge+.',
      'Fridge+ never receives, records or stores your voice: the app only gets the recognized text, processed on your device to detect commands.',
      'The mic is only active during cooking mode. You can mute the voice anytime or revoke the mic permission in your browser settings.',
      'No voice data is used for advertising or profiling.',
    ],
    close: 'Got it',
  },
}

const sectionTitle = { fontSize: 14, fontWeight: 700, margin: '18px 0 8px', color: 'var(--color-warm-600)' }
const firstSectionTitle = { ...sectionTitle, marginTop: 0 }
const list = { margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, lineHeight: 1.45 }

export default function CookingHelpModal({ open, onClose, lang = 'fr', darkMode = false }) {
  const t = I18N[lang] ?? I18N.fr

  return (
    <ReusableModal open={open} onClose={onClose} title={t.title} size="md" darkMode={darkMode}>
      <h3 style={firstSectionTitle}>{t.howTitle}</h3>
      <ol style={list}>{t.how.map((s, i) => <li key={i}>{s}</li>)}</ol>

      <h3 style={sectionTitle}>{t.cmdTitle}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {t.cmdGroups.map((g, i) => (
          <div key={i}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 2px' }}>{g.h}</p>
            <ul style={list}>{g.items.map((it, j) => <li key={j}>{it}</li>)}</ul>
          </div>
        ))}
      </div>

      <h3 style={sectionTitle}>{t.tipsTitle}</h3>
      <ul style={list}>{t.tips.map((s, i) => <li key={i}>{s}</li>)}</ul>

      <h3 style={sectionTitle}>🔒 {t.privTitle}</h3>
      <ul style={{ ...list, color: 'var(--color-muted)', fontSize: 13 }}>
        {t.priv.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </ReusableModal>
  )
}
