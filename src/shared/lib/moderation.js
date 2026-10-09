import leoProfanity from 'leo-profanity'

leoProfanity.loadDictionary('en')
leoProfanity.add(leoProfanity.getDictionary('fr'))

// Allemand — non couvert nativement par leo-profanity
leoProfanity.add([
  'scheiße', 'scheisse', 'scheiß', 'scheiss',
  'arschloch', 'arsch', 'wichser', 'wichse',
  'fotze', 'hurensohn', 'hurensöhne', 'ficken',
  'fick', 'gefickt', 'verdammte', 'schlampe',
  'dreckau', 'drecksau', 'bastard', 'idiot',
  'vollidiot', 'depp', 'trottel',
])

// Espagnol — non couvert nativement par leo-profanity
leoProfanity.add([
  'puta', 'putas', 'puto', 'putos',
  'mierda', 'mierdas', 'coño', 'joder',
  'hostia', 'hostias', 'cabron', 'cabrón',
  'gilipollas', 'gilipolla', 'pendejo', 'pendeja',
  'chingada', 'chinga', 'verga', 'culo',
  'maricón', 'maricon', 'idiota', 'imbecil',
  'imbécil', 'estupido', 'estúpido',
])

// Japonais — non couvert nativement par leo-profanity
leoProfanity.add([
  'くそ', 'クソ', 'うんこ', 'うんち',
  'ちくしょう', 'ちくしょ', 'バカ', 'ばか',
  'あほ', 'アホ', 'まぬけ', 'マヌケ',
  'きちく', 'きもい', 'キモい', 'キモイ',
  '死ね', 'しね', 'ころせ', '殺せ',
  'ふざけんな', 'うせろ', '消えろ', 'きえろ',
])

export function containsProfanity(text) {
  if (!text || typeof text !== 'string') return false
  return leoProfanity.check(text)
}

export function validateRecipeText(fields) {
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (containsProfanity(item)) return key
      }
    } else {
      if (containsProfanity(value)) return key
    }
  }
  return null
}
