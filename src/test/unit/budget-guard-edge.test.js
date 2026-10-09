import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { applyBudgetGuard, BUDGET_LIMIT_CENTS } from '../../../supabase/functions/_shared/budget-guard.ts'

// Le plafond budgétaire IA ($50/mois, décidé le 2026-05-19) a passé TROIS MOIS
// sans être appelé : le garde vivait dans `src/shared/lib/ai/budget-guard.js`,
// l'IA a déménagé vers les Edge Functions, et le garde n'a pas suivi. La RPC
// `get_monthly_ai_cost_cents()` était pourtant déployée et fonctionnelle.
//
// 🔴 Personne ne l'a vu parce que SUPPRIMER UN APPEL NE CASSE RIEN. Aucun test,
// aucun lint, aucune CI ne signale un garde-fou qu'on n'invoque plus.
//
// D'où le second bloc de ce fichier : il ne teste pas la logique du garde, il
// teste QU'IL EST BRANCHÉ. C'est lui qui aurait attrapé le défaut d'origine.

function faussSupabase(rpcResult) {
  return { rpc: vi.fn().mockResolvedValue(rpcResult) }
}

describe('applyBudgetGuard — logique', () => {
  it('laisse passer sous le plafond', async () => {
    const res = await applyBudgetGuard(faussSupabase({ data: 100, error: null }), 1)
    expect(res).toBeNull()
  })

  it('refuse en 429 quand le plafond serait dépassé', async () => {
    const res = await applyBudgetGuard(faussSupabase({ data: BUDGET_LIMIT_CENTS, error: null }), 1)
    expect(res).not.toBeNull()
    expect(res.status).toBe(429)
    const corps = await res.json()
    expect(corps.error).toBe('ai_budget_exceeded')
    expect(corps.limit_cents).toBe(BUDGET_LIMIT_CENTS)
  })

  it('laisse passer PILE au plafond (le dépassement est strict)', async () => {
    // 4999 + 1 = 5000, pas > 5000 → autorisé. Le cent suivant bloquera.
    const res = await applyBudgetGuard(faussSupabase({ data: BUDGET_LIMIT_CENTS - 1, error: null }), 1)
    expect(res).toBeNull()
  })

  it('FAIL-OPEN si la RPC échoue — une panne de comptage ne coupe pas le service', async () => {
    const res = await applyBudgetGuard(faussSupabase({ data: null, error: { message: 'boom' } }), 1)
    expect(res).toBeNull()
  })

  it('transmet les en-têtes CORS dans la réponse 429', async () => {
    const res = await applyBudgetGuard(
      faussSupabase({ data: BUDGET_LIMIT_CENTS, error: null }), 1,
      { 'Access-Control-Allow-Origin': 'https://fridgeplus.app' },
    )
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://fridgeplus.app')
  })
})

// ── Le garde-fou qui compte : le garde est-il APPELÉ ? ──────────────────────
const FN = resolve(process.cwd(), 'supabase/functions/suggest-substitutes/index.ts')

// ⚠️ Ces assertions lisent du TEXTE, pas un AST : un appel **commenté** reste
// visible dans la source et ferait passer le test à tort. Éprouvé par mutation
// le 2026-08-14 — supprimer la ligne faisait bien échouer, la commenter NON.
// D'où ce dépouillement : le cliquet ne raisonne que sur du code exécutable.
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')            // blocs /* … */
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))   // lignes // …
    .join('\n')
}

describe('le plafond est réellement branché', () => {
  const src = stripComments(readFileSync(FN, 'utf8'))

  it('`suggest-substitutes` importe ET appelle applyBudgetGuard', () => {
    expect(src, "l'import manque").toMatch(/import\s*\{[^}]*applyBudgetGuard[^}]*\}\s*from\s*'\.\.\/_shared\/budget-guard\.ts'/)
    expect(src, "l'appel manque — c'est exactement le défaut d'origine").toMatch(/await\s+applyBudgetGuard\s*\(/)
  })

  it('le plafond est vérifié APRÈS le cache, avant l’appel payant', () => {
    // Un cache hit ne coûte rien : le bloquer serait absurde. L'ORDRE fait
    // partie du garde-fou.
    const posCache = src.indexOf(".from('ai_cache')")
    const posGarde = src.indexOf('applyBudgetGuard(')
    const posOpenai = src.indexOf('api.openai.com')
    expect(posCache, 'le cache lookup a disparu').toBeGreaterThan(-1)
    expect(posGarde).toBeGreaterThan(posCache)
    expect(posOpenai).toBeGreaterThan(posGarde)
  })
})
