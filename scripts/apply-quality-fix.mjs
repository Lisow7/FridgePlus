/**
 * v3.111.0 — Script one-shot de correction qualité.
 *
 * Applique via Supabase service_role key :
 *   1. UPDATE base_recipes : oeufs-brouilles (country, description, steps, allergens)
 *   2. Tente d'exécuter le DDL (vue recipe_health_check) via l'API REST Supabase.
 *      Si le DDL échoue (pas de fonction exec_sql disponible), affiche le SQL
 *      à copier dans l'éditeur SQL du dashboard Supabase.
 *
 * Usage : node scripts/apply-quality-fix.mjs
 */

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
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── 1. Update oeufs-brouilles ─────────────────────────────────────────────────

console.log('\n🍳  Correction oeufs-brouilles…')

const { error: recipeErr } = await supabase
  .from('base_recipes')
  .update({
    country: 'fr',
    allergens: ['eggs', 'milk'],
    description: {
      fr: 'La recette des œufs brouillés façon française : lente, soyeuse, crémeuse. Le secret est une cuisson à feu très doux avec un remuage constant.',
      en: 'The French method for scrambled eggs: slow, silky, and creamy. The secret is very low heat and constant stirring.',
      es: 'La técnica francesa para los huevos revueltos: lenta, sedosa y cremosa. El secreto es el fuego muy bajo y el movimiento constante.',
      de: 'Die französische Methode für Rührei: langsam, seidig und cremig. Das Geheimnis liegt im sehr niedrigen Feuer und ständigem Rühren.',
      ja: 'フランス式スクランブルエッグ：低温でゆっくり、絹のようにとろりと仕上げる。秘訣はとても弱火と絶え間ない混ぜ続けること。',
    },
    steps: {
      fr: [
        'Casser 4 œufs dans un bol. Assaisonner de sel et poivre. Fouetter légèrement.',
        'Faire fondre 20 g de beurre dans une casserole à fond épais à feu très doux.',
        'Ajouter les œufs et remuer sans cesse à la spatule en traçant des 8. Ne jamais cesser de remuer.',
        "Après 3-4 minutes, quand les œufs commencent à prendre en petits flocons, ajouter les 2 c. à soupe de crème.",
        "Retirer du feu une minute avant la cuisson souhaitée — la chaleur résiduelle finit la cuisson.",
        "Rectifier l'assaisonnement. Servir aussitôt sur du pain grillé, avec une pincée de ciboulette si désiré.",
      ],
      en: [
        'Crack 4 eggs into a bowl. Season with salt and pepper. Lightly beat.',
        'Melt 20 g butter in a heavy-bottomed saucepan over very low heat.',
        'Add eggs and stir constantly with a silicone spatula, drawing figure-8 patterns. Never stop stirring.',
        'After 3-4 minutes, when eggs start to form small soft curds, add the 2 tbsp cream.',
        'Remove from heat one minute before desired doneness — residual heat finishes the cooking.',
        'Adjust seasoning. Serve immediately on toast, with a pinch of chives if desired.',
      ],
      es: [
        'Casca 4 huevos en un bol. Salpimenta. Bate ligeramente.',
        'Derrite 20 g de mantequilla en un cazo de fondo grueso a fuego muy bajo.',
        'Añade los huevos y remueve sin parar con una espátula de silicona haciendo movimientos en 8. No dejes de remover.',
        'Tras 3-4 minutos, cuando los huevos formen pequeñas cuajadas blandas, añade las 2 c. de nata.',
        'Retira del fuego un minuto antes del punto deseado — el calor residual termina la cocción.',
        'Rectifica el punto de sal. Sirve inmediatamente sobre tostadas, con cebollino si lo deseas.',
      ],
      de: [
        '4 Eier in eine Schüssel aufschlagen. Mit Salz und Pfeffer würzen. Leicht verquirlen.',
        '20 g Butter in einem schweren Topf bei sehr niedriger Hitze schmelzen.',
        'Eier hinzufügen und mit einem Silikon-Spatel ständig in Achterbewegungen rühren. Niemals aufhören zu rühren.',
        'Nach 3-4 Minuten, wenn die Eier kleine weiche Stückchen bilden, 2 EL Sahne hinzufügen.',
        'Vom Herd nehmen, bevor die gewünschte Konsistenz erreicht ist — die Resthitze beendet die Garung.',
        'Nachwürzen. Sofort auf Toast servieren, mit einer Prise Schnittlauch nach Belieben.',
      ],
      ja: [
        '卵4個をボウルに割り入れ、塩・コショウで調味し、軽く溶きほぐす。',
        '厚底の鍋に20gのバターを入れ、ごく弱火で溶かす。',
        '卵を加え、シリコンヘラで8の字を描くように絶えず混ぜ続ける。決して止めないこと。',
        '3〜4分後、卵が小さな柔らかい塊を形成し始めたら、クリーム大さじ2を加える。',
        '好みの仕上がりの1分前に火を止める——余熱で火が通る。',
        '味を整え、すぐにトーストに乗せて提供する。好みでチャイブを散らす。',
      ],
    },
  })
  .eq('id', 'oeufs-brouilles')

if (recipeErr) {
  console.error('  ❌ Erreur update recette :', recipeErr.message)
} else {
  console.log('  ✅ oeufs-brouilles mis à jour (country, description, steps, allergens)')
}

// ── 2. DDL : mise à jour de la vue recipe_health_check ───────────────────────

const DDL = `
CREATE OR REPLACE VIEW public.recipe_health_check AS
SELECT
  r.id,
  r.name->>'fr' AS name_fr,
  r.status,
  r.country,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN jsonb_array_length(r.ingredients) = 0 THEN 'no_ingredients' END,
    CASE WHEN r.servings <= 0 OR r.servings > 20 THEN 'invalid_servings' END,
    CASE WHEN r.time_min <= 0 OR r.time_min > 480 THEN 'invalid_time' END,
    CASE WHEN r.status='published' AND COALESCE(r.description->>'fr','')='' THEN 'missing_desc_fr' END,
    CASE WHEN r.status='published' AND COALESCE(r.description->>'en','')='' THEN 'missing_desc_en' END,
    CASE WHEN r.status='published' AND COALESCE(r.description->>'es','')='' THEN 'missing_desc_es' END,
    CASE WHEN r.status='published' AND COALESCE(r.description->>'de','')='' THEN 'missing_desc_de' END,
    CASE WHEN r.status='published' AND COALESCE(r.description->>'ja','')='' THEN 'missing_desc_ja' END,
    CASE WHEN r.status='published' AND (r.steps='{}' OR r.steps='[]') THEN 'missing_steps' END,
    CASE WHEN r.status='published' AND COALESCE(r.country,'')='' THEN 'missing_country' END,
    CASE WHEN COALESCE(jsonb_array_length(r.diet),0) = 0
         AND COALESCE(jsonb_array_length(r.allergens),0) = 0
         THEN 'missing_diet' END
  ], NULL) AS issues,
  r.updated_at
FROM public.base_recipes r;
`

console.log('\n🔧  Tentative de mise à jour de la vue recipe_health_check…')

// Essai via exec_sql RPC si disponible
let ddlApplied = false

try {
  const { error: ddlErr } = await supabase.rpc('exec_sql', { sql: DDL })
  if (!ddlErr) {
    console.log('  ✅ Vue recipe_health_check mise à jour via exec_sql.')
    ddlApplied = true
  }
} catch {
  // exec_sql non disponible — normal
}

if (!ddlApplied) {
  // Tentative via l'API Management Supabase
  const projectRef = env.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
  const accessToken = env.SUPABASE_ACCESS_TOKEN ?? env.SUPABASE_SERVICE_ROLE_KEY

  if (projectRef) {
    try {
      const resp = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: DDL }),
        }
      )
      const data = await resp.json()
      if (resp.ok && !data.error) {
        console.log('  ✅ Vue mise à jour via Management API.')
        ddlApplied = true
      }
    } catch {
      // Management API non disponible
    }
  }
}

if (!ddlApplied) {
  console.log('\n  ⚠️  Impossible d\'appliquer le DDL automatiquement.')
  console.log('  → Copie ce SQL dans l\'éditeur SQL du dashboard Supabase :')
  console.log('\n' + '─'.repeat(60))
  console.log(DDL)
  console.log('─'.repeat(60))
}

console.log('\n✅  Script terminé.')
