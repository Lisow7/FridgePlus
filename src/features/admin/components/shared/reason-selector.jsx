// ReasonSelector — dropdown de raisons normalisées + champ libre optionnel.
//
// RGPD : toute action admin sur un contenu/utilisateur doit pouvoir être
// justifiée pour la traçabilité. Plutôt qu'un simple champ texte (où l'admin
// peut écrire « ok » et planter l'audit log), on impose un choix dans une
// liste prédéfinie + un champ détails facultatif pour le contexte.
//
// Listes de raisons normalisées :
//   - 'recipe-moderation' : pour modérer recettes communauté
//   - 'user-action'       : pour bannir / dégrader un utilisateur
//   - 'sensitive-data'    : pour justifier l'accès email/IP/historique
//   - 'data-deletion'     : pour exécuter une demande RGPD art.17
//   - 'data-access'       : pour exécuter une demande RGPD art.15
//
// Chaque clé = sous-clé i18n traduite côté composant appelant.

const REASONS = {
  'recipe-moderation': [
    'spam',
    'inappropriate',
    'duplicate',
    'low-quality',
    'plagiarism',
    'misleading',
    'other',
  ],
  'user-action': [
    'spam',
    'harassment',
    'inappropriate-content',
    'multiple-violations',
    'cgu-breach',
    'security-concern',
    'other',
  ],
  'sensitive-data': [
    'support-ticket',
    'security-investigation',
    'rgpd-request',
    'legal-request',
    'other',
  ],
  'data-deletion': [
    'rgpd-art17-request',
    'self-deletion',
    'cgu-breach-deletion',
    'duplicate-account',
    'other',
  ],
  'data-access': [
    'rgpd-art15-request',
    'rgpd-art20-request',
    'support-investigation',
    'other',
  ],
}

const REASON_LABELS = {
  fr: {
    'spam':                     'Spam',
    'inappropriate':            'Contenu inapproprié',
    'duplicate':                'Doublon',
    'low-quality':              'Qualité insuffisante',
    'plagiarism':               'Plagiat',
    'misleading':               'Information trompeuse',
    'harassment':               'Harcèlement',
    'inappropriate-content':    'Contenu inapproprié',
    'multiple-violations':      'Violations répétées',
    'cgu-breach':               'Non-respect des CGU',
    'security-concern':         'Problème de sécurité',
    'support-ticket':           'Suivi d\'un ticket de support',
    'security-investigation':   'Enquête de sécurité',
    'rgpd-request':             'Demande RGPD',
    'legal-request':            'Demande légale',
    'rgpd-art17-request':       'Demande RGPD article 17 (effacement)',
    'rgpd-art15-request':       'Demande RGPD article 15 (accès)',
    'rgpd-art20-request':       'Demande RGPD article 20 (portabilité)',
    'self-deletion':            'Auto-suppression utilisateur',
    'cgu-breach-deletion':      'Suppression pour violation CGU',
    'duplicate-account':        'Compte en doublon',
    'support-investigation':    'Investigation support',
    'other':                    'Autre (préciser)',
  },
  en: {
    'spam':                     'Spam',
    'inappropriate':            'Inappropriate content',
    'duplicate':                'Duplicate',
    'low-quality':              'Insufficient quality',
    'plagiarism':               'Plagiarism',
    'misleading':               'Misleading info',
    'harassment':               'Harassment',
    'inappropriate-content':    'Inappropriate content',
    'multiple-violations':      'Repeated violations',
    'cgu-breach':               'Terms breach',
    'security-concern':         'Security concern',
    'support-ticket':           'Support ticket follow-up',
    'security-investigation':   'Security investigation',
    'rgpd-request':             'GDPR request',
    'legal-request':            'Legal request',
    'rgpd-art17-request':       'GDPR art.17 request (erasure)',
    'rgpd-art15-request':       'GDPR art.15 request (access)',
    'rgpd-art20-request':       'GDPR art.20 request (portability)',
    'self-deletion':            'User self-deletion',
    'cgu-breach-deletion':      'Terms-breach deletion',
    'duplicate-account':        'Duplicate account',
    'support-investigation':    'Support investigation',
    'other':                    'Other (specify)',
  },
  // ES, DE, JA partagent les clés FR par défaut — un admin parle au moins
  // une de ces deux langues. À enrichir plus tard si l'équipe s'élargit.
}

function getLabel(key, lang) {
  return REASON_LABELS[lang]?.[key]
      ?? REASON_LABELS.fr[key]
      ?? key
}

export default function ReasonSelector({
  category,
  value,
  details = '',
  onChange,
  onDetailsChange,
  lang = 'fr',
  required = true,
  darkMode = false,
}) {
  const reasons = REASONS[category] ?? []
  const fg = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted = darkMode ? '#A0A8B8' : '#7A6A52'
  const border = darkMode ? 'var(--color-dark-border)' : '#D4C8B5'
  const inputBg = darkMode ? '#1A2F48' : '#FFFFFF'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: muted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {lang === 'fr' ? 'Raison' : 'Reason'} {required && '*'}
        </label>
        <select
          value={value ?? ''}
          onChange={e => onChange?.(e.target.value)}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8,
            border: `1.5px solid ${border}`, background: inputBg, color: fg,
            fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          <option value="">{lang === 'fr' ? '— Choisir une raison —' : '— Choose a reason —'}</option>
          {reasons.map(key => (
            <option key={key} value={key}>{getLabel(key, lang)}</option>
          ))}
        </select>
      </div>

      {/* Champ détails — apparaît si raison choisie ou « Autre » sélectionné */}
      {value && (
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: muted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {lang === 'fr' ? 'Détails' : 'Details'} {value === 'other' && '*'}
          </label>
          <textarea
            value={details}
            onChange={e => onDetailsChange?.(e.target.value)}
            placeholder={lang === 'fr' ? 'Précisions (optionnel sauf si « Autre »)' : 'Details (optional unless « Other »)'}
            rows={2}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: `1.5px solid ${border}`, background: inputBg, color: fg,
              fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
            }}
          />
        </div>
      )}
    </div>
  )
}

// Helper exporté pour vérifier qu'une combinaison raison+détails est valide
// avant de soumettre une action admin.
export function isReasonValid({ value, details, required = true }) {
  if (!required && !value) return true
  if (!value) return false
  if (value === 'other' && (!details || !details.trim())) return false
  return true
}

// Helper exporté pour formater raison+détails en string lisible (audit log).
export function formatReason({ value, details, lang = 'fr' }) {
  if (!value) return null
  const label = getLabel(value, lang)
  return details && details.trim() ? `${label} — ${details.trim()}` : label
}
