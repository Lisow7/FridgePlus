import { readFileSync, existsSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  const envFile = join(root, '.env.local')
  if (!existsSync(envFile)) return {}
  const env = {}
  for (const line of readFileSync(envFile, 'utf-8').split(/\r?\n/)) {
    const m = line.trim().match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}

const env = { ...loadEnv(), ...process.env }
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// Lire l'état actuel
const { data } = await supabase.from('base_recipes').select('id, steps, description, country, allergens').eq('id', 'salade-cesar').single()
console.log('État actuel salade-cesar :')
console.log('  country:', data?.country)
console.log('  allergens:', data?.allergens)
console.log('  steps keys:', data?.steps ? Object.keys(data.steps) : '(vide)')
console.log('  description keys:', data?.description ? Object.keys(data.description) : '(vide)')

const { error } = await supabase
  .from('base_recipes')
  .update({
    country: 'us',
    allergens: ['eggs', 'milk', 'gluten', 'fish'],
    description: {
      fr: 'La salade César classique : cœurs de romaine croquants, croûtons dorés, copeaux de parmesan et sauce crémeuse à l\'anchois. Un grand classique américain né à Tijuana.',
      en: 'The classic Caesar salad: crisp romaine hearts, golden croutons, shaved parmesan and creamy anchovy dressing. An American staple born in Tijuana.',
      es: 'La clásica ensalada César: corazones de lechuga romana crujientes, croutons dorados, virutas de parmesano y aderezo cremoso de anchoas. Un clásico americano nacido en Tijuana.',
      de: 'Der klassische Caesar Salat: knackige Romanasalatherzen, goldene Croutons, Parmesanspäne und cremiges Anchovis-Dressing. Ein amerikanischer Klassiker, geboren in Tijuana.',
      ja: 'クラシックなシーザーサラダ：パリッとしたロメインハーツ、黄金色のクルトン、パルメザンチーズの削り節、クリーミーなアンチョビドレッシング。ティフアナ生まれのアメリカの定番。',
    },
    steps: {
      fr: [
        'Préparer les croûtons : couper 2 tranches de pain en dés, les faire dorer à la poêle avec un filet d\'huile d\'olive. Réserver.',
        'Préparer la sauce : écraser 1 gousse d\'ail avec 2 anchois au mortier. Fouetter avec 2 c. à soupe de mayonnaise, 1 c. à soupe de jus de citron, 1 c. à café de sauce Worcestershire et 2 c. à soupe de parmesan râpé.',
        'Laver et sécher les cœurs de romaine. Déchirer les feuilles en morceaux généreux.',
        'Dans un grand saladier, verser la sauce sur la romaine. Mélanger jusqu\'à enrober chaque feuille.',
        'Ajouter les croûtons et les copeaux de parmesan. Poivrer généreusement.',
        'Servir immédiatement pour conserver le croquant des croûtons.',
      ],
      en: [
        'Make croutons: cut 2 bread slices into cubes, toast in a pan with a drizzle of olive oil until golden. Set aside.',
        'Make the dressing: crush 1 garlic clove with 2 anchovies using a mortar. Whisk with 2 tbsp mayonnaise, 1 tbsp lemon juice, 1 tsp Worcestershire sauce and 2 tbsp grated parmesan.',
        'Wash and dry the romaine hearts. Tear the leaves into generous pieces.',
        'In a large bowl, pour the dressing over the romaine. Toss until every leaf is coated.',
        'Add the croutons and parmesan shavings. Season generously with black pepper.',
        'Serve immediately to keep the croutons crispy.',
      ],
      es: [
        'Hacer los croutons: cortar 2 rebanadas de pan en cubos, dorar en una sartén con un chorrito de aceite de oliva. Reservar.',
        'Hacer el aliño: machacar 1 diente de ajo con 2 anchoas en el mortero. Mezclar con 2 c. de mayonesa, 1 c. de zumo de limón, 1 c. de salsa Worcestershire y 2 c. de parmesano rallado.',
        'Lavar y secar los corazones de lechuga romana. Trocear las hojas en trozos generosos.',
        'En un bol grande, verter el aliño sobre la lechuga. Mezclar hasta cubrir bien cada hoja.',
        'Añadir los croutons y las virutas de parmesano. Salpimentar generosamente.',
        'Servir inmediatamente para mantener los croutons crujientes.',
      ],
      de: [
        'Croutons zubereiten: 2 Brotscheiben in Würfel schneiden, in einer Pfanne mit einem Schuss Olivenöl goldbraun rösten. Beiseite stellen.',
        'Dressing zubereiten: 1 Knoblauchzehe mit 2 Sardellen im Mörser zerdrücken. Mit 2 EL Mayonnaise, 1 EL Zitronensaft, 1 TL Worcestershire-Sauce und 2 EL geriebenem Parmesan verrühren.',
        'Die Romanasalatherzen waschen und trocknen. Die Blätter in großzügige Stücke reißen.',
        'In einer großen Schüssel das Dressing über den Salat geben. Wenden, bis jedes Blatt bedeckt ist.',
        'Croutons und Parmesanspäne dazugeben. Großzügig mit schwarzem Pfeffer würzen.',
        'Sofort servieren, damit die Croutons knusprig bleiben.',
      ],
      ja: [
        'クルトンを作る：食パン2枚を角切りにし、オリーブオイルを少量引いたフライパンで黄金色になるまで炒る。取り置く。',
        'ドレッシングを作る：にんにく1片とアンチョビ2尾をすり鉢でつぶす。マヨネーズ大さじ2、レモン汁大さじ1、ウスターソース小さじ1、粉パルメザン大さじ2と混ぜ合わせる。',
        'ロメインハーツを洗って水気を切る。葉を大きめにちぎる。',
        '大きなボウルにドレッシングをロメインにかけ、全体にまんべんなく絡める。',
        'クルトンとパルメザンの削り節を加え、黒こしょうをたっぷりかける。',
        'クルトンのサクサク感を保つためすぐに提供する。',
      ],
    },
  })
  .eq('id', 'salade-cesar')

if (error) {
  console.error('❌ Erreur :', error.message)
} else {
  console.log('\n✅ salade-cesar mis à jour (country, description, steps, allergens)')
}
