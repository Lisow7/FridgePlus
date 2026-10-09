# Feature `cooking-mode`

> Mode cuisine **vocal** mains-libres (**Premium**) : guide pas-à-pas une recette en lisant les
> étapes (TTS), en écoutant des commandes vocales (STT), avec minuteurs et écran qui reste allumé.
> Route `/cook/:recipeId`. (Code lu sur `dev` le 2026-06-22.)
> Spec d'origine : la conception « cooking-mode-vocal » du 2026-05-19.

## Rôle
Cuisiner sans toucher l'écran : l'app lit l'étape courante, comprend « suivant / répète / lance le
timer / combien de temps… », gère les minuteurs détectés dans le texte, et empêche l'écran de s'éteindre.

## Architecture
- **`hooks/use-cooking-mode.js`** — **orchestrateur** : compose les sous-hooks et pilote une
  **state-machine** (`lib/cooking-state-reducer.js`). Signature `useCookingMode(recipe, lang)`.
  Gère un mode **« voix coupée »** (TTS off mais l'écoute des commandes continue).
- Sous-hooks composés :
  - `use-voice-listener.js` — **STT** (reconnaissance vocale).
  - `use-speech-synthesis.js` — **TTS** (lecture des étapes).
  - `use-step-timer.js` — minuteurs d'étape.
  - `use-wake-lock.js` — **Wake Lock écran** (empêche la veille) ; auto-release au unmount,
    **ré-acquisition sur `visibilitychange`**.

## Reconnaissance vocale (les pièges à connaître)
- **`lib/intents.js`** — `INTENTS_FR` / `INTENTS_EN` : formulations naturelles par intent
  (`next`, `previous`, `repeat`, `startTimer`, `timeLeft`, `readIngredients`…). **Voix = FR + EN
  uniquement** (pas les 5 langues de l'app).
- **`lib/intent-matcher.js`** — `matchIntent` : **filtre STRICT** (equals / `startsWith 'phrase '` /
  `endsWith ' phrase'`) pour éviter les faux positifs en pleine conversation.
  ⚠️ **Piège documenté** : les patterns regex sont définis **dans le matcher, pas dans `intents.js`**,
  pour contourner le bug `\b` + non-ASCII (`\bétape` ne matche jamais car `é` n'est pas un word-char
  ASCII). Ne pas « factoriser » les patterns vers `intents.js`.
- **`lib/duration-parser.js`** — extrait les durées du texte d'étape (« 10 minutes ») pour alimenter
  le timer. **`lib/earcon.js`** — signaux sonores (feedback non-vocal).

## Composants
`cooking-mode-page` (page `/cook/:recipeId`), `cooking-step-display`, `cooking-progress-dots`,
`cooking-timer-widget`, `cooking-voice-hints`, `cooking-help-modal`.

## Dépendances & accès
- **Premium-gated** (route `/cook/:recipeId`). `@shared/hooks/use-consent` (consentement),
  APIs navigateur : Web Speech (STT/TTS), Wake Lock, Audio (earcons) — **dégrader proprement** si
  non supportées.
- i18n inline → [ADR 0002](../../../docs/adr/0002-i18n-inline-par-composant.md). Vue d'ensemble : `docs/ARCHITECTURE.md`.
