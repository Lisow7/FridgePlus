/**
 * Vercel Cron — audit qualité quotidien (6h UTC).
 * Interroge les vues Supabase recipe_health_check et ingredient_health_check.
 * Logue un avertissement si des problèmes sont détectés (visible dans Vercel logs).
 *
 * Sécurité :
 *   - Protégé par CRON_SECRET (header Authorization: Bearer <secret>).
 *   - Vercel injecte automatiquement ce header pour ses propres cron calls.
 *   - Aucune donnée personnelle traitée : uniquement des métadonnées de qualité.
 *
 * Config : vercel.json → crons[0].schedule = "0 6 * * *"
 */

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'] ?? ''
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )

  const [{ data: recipes, error: recErr }, { data: ingredients, error: ingErr }] = await Promise.all([
    supabase.from('recipe_health_check').select('id, name_fr, issues'),
    supabase.from('ingredient_health_check').select('id, label_fr, issues'),
  ])

  if (recErr || ingErr) {
    console.error('[quality-cron] Erreur Supabase :', recErr?.message ?? ingErr?.message)
    return res.status(500).json({ error: 'supabase_error' })
  }

  const recipeIssues     = (recipes     ?? []).filter(r => r.issues?.length)
  const ingredientIssues = (ingredients ?? []).filter(i => i.issues?.length)
  const total            = recipeIssues.length + ingredientIssues.length

  const summary = {
    ok:          total === 0,
    timestamp:   new Date().toISOString(),
    recipes:     recipeIssues.length,
    ingredients: ingredientIssues.length,
  }

  if (total > 0) {
    console.warn('[quality-cron] ⚠️  Issues détectées', summary)

    if (recipeIssues.length > 0) {
      const byType = {}
      for (const r of recipeIssues) {
        for (const issue of r.issues ?? []) {
          byType[issue] = (byType[issue] ?? 0) + 1
        }
      }
      console.warn('[quality-cron] Recettes par type :', byType)
    }

    if (ingredientIssues.length > 0) {
      const byType = {}
      for (const i of ingredientIssues) {
        for (const issue of i.issues ?? []) {
          byType[issue] = (byType[issue] ?? 0) + 1
        }
      }
      console.warn('[quality-cron] Ingrédients par type :', byType)
    }
  } else {
    console.log('[quality-cron] ✅  Tout est propre', summary)
  }

  return res.status(200).json(summary)
}
