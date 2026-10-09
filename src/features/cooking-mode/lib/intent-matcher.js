// src/features/cooking-mode/lib/intent-matcher.js
//
// Reconnaissance d'intents depuis transcript vocal.
// Filtre STRICT : equals OU startsWith 'phrase ' OU endsWith ' phrase'.
// Évite les faux positifs au milieu d'une conversation.
//
// Note : les patterns regex sont définis ici (et non importés depuis intents.js)
// pour éviter le bug \b + caractères non-ASCII (ex: \bétape ne matche jamais
// car é n'est pas un word char ASCII).
//
// Spec : la conception « cooking-mode-vocal » du 2026-05-19

import { INTENTS_FR, INTENTS_EN } from './intents.js'

// Patterns paramétrés sans \b avant les caractères accentués.
// Les pluriels sont normalisés avant matching (minutes → minute, etc.).
const PATTERNS_FR = {
  jumpToStep:  /étape (\d+)/,
  addTime:     /ajoute (\d+) (minute|seconde)/,
  customTimer: /timer (\d+) (minute|seconde)/,
}

const PATTERNS_EN = {
  jumpToStep:  /\bstep (\d+)\b/,
  addTime:     /\badd (\d+) (minute|second)\b/,
  customTimer: /\btimer (\d+) (minute|second)\b/,
}

// Nombres en lettres → chiffres (jusqu'à 12, au-delà rare pour des recettes).
// Permet "étape deux" → "étape 2", "ajoute cinq minutes" → "ajoute 5 minute".
const NUMBER_WORDS_FR = { un: '1', une: '1', deux: '2', trois: '3', quatre: '4', cinq: '5', six: '6', sept: '7', huit: '8', neuf: '9', dix: '10', onze: '11', douze: '12' }
const NUMBER_WORDS_EN = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12' }

function normalizeForRegex(text, lang) {
  const words = lang === 'en' ? NUMBER_WORDS_EN : NUMBER_WORDS_FR
  const re = new RegExp(`\\b(${Object.keys(words).join('|')})\\b`, 'g')
  return text
    .replace(re, (m) => words[m])
    .replace(/\bminutes\b/g, 'minute')
    .replace(/\bsecondes\b/g, 'seconde')
    .replace(/\bseconds\b/g, 'second')
}

function matchPhrase(normalized, phrase) {
  if (normalized === phrase) return true
  if (normalized.startsWith(phrase + ' ')) return true
  if (normalized.endsWith(' ' + phrase)) return true
  return false
}

export function matchIntent(transcript, lang) {
  if (!transcript || typeof transcript !== 'string') return null
  const normalized = transcript.toLowerCase().trim()
  if (!normalized) return null

  const intents = lang === 'en' ? INTENTS_EN : INTENTS_FR
  const patterns = lang === 'en' ? PATTERNS_EN : PATTERNS_FR
  const normalizedForRegex = normalizeForRegex(normalized, lang)

  // PRIORITÉ : saut d'étape explicite ("étape N", "recommence depuis l'étape N").
  // Un numéro d'étape est un signal fort → testé AVANT les phrases, sinon
  // "recommence" (repeat) capterait "recommence depuis l'étape 2".
  const stepMatch = normalizedForRegex.match(patterns.jumpToStep)
  if (stepMatch) return { intent: 'jumpToStep', step: parseInt(stepMatch[1], 10) }

  // Phrases strictes
  for (const [intent, phrases] of Object.entries(intents)) {
    for (const phrase of phrases) {
      if (matchPhrase(normalized, phrase)) {
        return intent
      }
    }
  }

  // Autres patterns paramétrés
  const addTimeMatch = normalizedForRegex.match(patterns.addTime)
  if (addTimeMatch) return { intent: 'addTime', amount: parseInt(addTimeMatch[1], 10), unit: addTimeMatch[2] }

  const customTimerMatch = normalizedForRegex.match(patterns.customTimer)
  if (customTimerMatch) return { intent: 'customTimer', amount: parseInt(customTimerMatch[1], 10), unit: customTimerMatch[2] }

  return null
}
