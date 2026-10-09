// src/features/cooking-mode/lib/intents.js
//
// Intents reconnaissables par matchIntent. Liste exhaustive de formulations
// naturelles FR + EN. Chaque intent peut avoir N phrases qui matchent strict
// (equals / startsWith ' ' / endsWith ' ' — voir intent-matcher.js).
//
// Spec : la conception « cooking-mode-vocal » du 2026-05-19

export const INTENTS_FR = {
  next: ['suivant', 'étape suivante', 'passe', 'continue', 'après', 'avance', 'ensuite'],
  previous: ['précédent', 'étape précédente', 'reviens', 'retour', 'avant', 'recule', 'en arrière'],
  repeat: ['répète', 'redis', 'encore', 'j\'ai pas entendu', 'redis-moi', 'recommence', 'recommencer'],
  firstStep: ['depuis le début', 'première étape'],
  lastStep: ['dernière étape', 'fin', 'saute à la fin'],
  startTimer: ['lance le timer', 'démarre', 'minuteur', 'compte', 'chrono', 'vas-y', 'lance'],
  pauseTimer: ['pause le timer', 'stop minuteur'],
  cancelTimer: ['annule le timer', 'supprime le timer', 'enlève le timer'],
  resetTimer: ['réinitialise', 'réinitialise le timer', 'remets le timer', 'remets le timer à zéro'],
  timeLeft: ['combien de temps', 'il reste combien', 'temps restant'],
  readIngredients: ['ingrédients', 'quels ingrédients', 'liste-moi les ingrédients', 'qu\'est-ce qu\'il faut'],
  currentStep: ['quelle étape', 'où on en est', 'on est où'],
  totalSteps: ['combien d\'étapes', 'il en reste combien'],
  recipeName: ['quel plat', 'c\'est quoi déjà'],
  totalTime: ['durée totale', 'temps total'],
  servings: ['pour combien', 'combien de personnes'],
  pause: ['pause', 'attends', 'stop temporaire'],
  resume: ['reprends', 'continue', 'vas-y'],
  stop: ['quitte', 'ferme', 'stop', 'j\'ai fini', 'termine', 'exit'],
  help: ['aide', 'commandes', 'qu\'est-ce que je peux dire', 'comment je fais'],
  mute: ['tais-toi', 'silence', 'chut', 'muet'],
  resumeSpeech: ['reparle', 'redis tout'],
  alreadyDone: ['c\'est fait', 'j\'ai fait', 'ok fait'],
  markAsCooked: ['j\'ai cuisiné ça', 'marquer fait'],
  confirmYes: ['oui', 'ouais', 'ok', 'confirme', 'confirmé', 'd\'accord'],
  confirmNo: ['non', 'annule', 'pas maintenant', 'attends'],
}

export const INTENTS_EN = {
  next: ['next', 'next step', 'continue', 'forward', 'after'],
  previous: ['previous', 'previous step', 'back', 'backward', 'before'],
  repeat: ['repeat', 'say again', 'again', 'didn\'t hear'],
  firstStep: ['restart', 'from start', 'first step'],
  lastStep: ['last step', 'end', 'skip to end'],
  startTimer: ['start timer', 'start', 'go', 'launch timer'],
  pauseTimer: ['pause timer', 'stop timer'],
  cancelTimer: ['cancel timer', 'remove timer'],
  resetTimer: ['reset', 'reset timer', 'reset the timer'],
  timeLeft: ['how much time', 'time left', 'how long'],
  readIngredients: ['ingredients', 'list ingredients', 'what do I need'],
  currentStep: ['which step', 'where am I'],
  totalSteps: ['how many steps', 'steps left'],
  recipeName: ['what recipe', 'what dish'],
  totalTime: ['total time', 'how long total'],
  servings: ['for how many', 'how many people'],
  pause: ['pause', 'hold on', 'wait'],
  resume: ['resume', 'continue', 'go on'],
  stop: ['quit', 'close', 'stop', 'i\'m done', 'finish', 'exit'],
  help: ['help', 'commands', 'what can i say'],
  mute: ['shut up', 'silence', 'quiet', 'mute'],
  resumeSpeech: ['speak again', 'unmute'],
  alreadyDone: ['done', 'finished', 'ok done'],
  markAsCooked: ['i cooked this', 'mark done'],
  confirmYes: ['yes', 'yeah', 'ok', 'confirm', 'sure'],
  confirmNo: ['no', 'cancel', 'not now', 'wait'],
}

// Patterns regex pour intents paramétrés (matchés séparément dans intent-matcher).
export const REGEX_PATTERNS_FR = {
  jumpToStep: /\bétape (\d+)\b/,
  addTime: /\bajoute (\d+) (minute|seconde)/,
  customTimer: /\btimer (\d+) (minute|seconde)/,
}

export const REGEX_PATTERNS_EN = {
  jumpToStep: /\bstep (\d+)\b/,
  addTime: /\badd (\d+) (minute|second)/,
  customTimer: /\btimer (\d+) (minute|second)/,
}
