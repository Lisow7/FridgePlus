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

import { RAISON_DETAILS_MAX } from '@shared/lib/longueurs-maximales'
import Field from '@shared/ui/field'

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
}

// Français seul : le panneau admin a un seul utilisateur, francophone (décision
// du 2026-10-08). Le libellé est aussi celui qu'écrit le journal d'audit.
function getLabel(key) {
  return REASON_LABELS.fr[key] ?? key
}

export default function ReasonSelector({
  category,
  value,
  details = '',
  onChange,
  onDetailsChange,
  required = true,
  darkMode = false,
}) {
  const reasons = REASONS[category] ?? []
  const fg = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted = darkMode ? '#A0A8B8' : '#7A6A52'
  const border = darkMode ? 'var(--color-dark-border)' : '#D4C8B5'
  const inputBg = darkMode ? '#1A2F48' : '#FFFFFF'

  const libelle = { fontSize: 12, fontWeight: 700, color: muted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Field label={<>{'Raison'} {required && '*'}</>} labelStyle={libelle}>
        <select
          value={value ?? ''}
          onChange={e => onChange?.(e.target.value)}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8,
            border: `1.5px solid ${border}`, background: inputBg, color: fg,
            fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          <option value="">{'— Choisir une raison —'}</option>
          {reasons.map(key => (
            <option key={key} value={key}>{getLabel(key)}</option>
          ))}
        </select>
      </Field>

      {/* Champ détails — apparaît si raison choisie ou « Autre » sélectionné */}
      {value && (
        <Field label={<>{'Détails'} {value === 'other' && '*'}</>} labelStyle={libelle}>
          <textarea
            value={details}
            onChange={e => onDetailsChange?.(e.target.value)}
            placeholder={'Précisions (optionnel sauf si « Autre »)'}
            rows={2}
            maxLength={RAISON_DETAILS_MAX}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: `1.5px solid ${border}`, background: inputBg, color: fg,
              fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
            }}
          />
        </Field>
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
export function formatReason({ value, details }) {
  if (!value) return null
  const label = getLabel(value)
  return details && details.trim() ? `${label} — ${details.trim()}` : label
}
