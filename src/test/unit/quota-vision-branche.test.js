import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Le quota gratuit Google Vision (1000 scans/mois) est protégé par un compteur
// dans `scan-receipt/index.ts` : il lit `ai_usage_log` avant l'appel et rend un
// 429 au-delà. Ce garde marche — et n'était verrouillé par AUCUN test.
//
// 🔴 Pourquoi c'est un manque et pas un détail : le plafond budgétaire IA a
// passé TROIS MOIS débranché sans que rien ne le signale, parce que supprimer
// un appel ne casse rien (cf. `budget-guard-edge.test.js`). Le garde de quota
// est exactement dans la même position : le retirer laisserait la fonction
// marcher, les tests verts, et le dépassement se découvrirait sur une facture.
//
// ⚠️ Ces assertions lisent du TEXTE, pas un AST. Le cliquet du budget-guard a
// montré le piège le 2026-08-14 : un appel simplement COMMENTÉ reste visible
// dans la source et le faisait passer à tort. D'où `sansCommentaires()` dès
// l'écriture de ce fichier-ci, plutôt qu'après s'être fait avoir une fois.

const FN = resolve(process.cwd(), 'supabase/functions/scan-receipt/index.ts')

function sansCommentaires(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(l => !l.trim().startsWith('//'))
    .join('\n')
}

const code = sansCommentaires(readFileSync(FN, 'utf8'))

describe('scan-receipt — le quota mensuel Vision est branché', () => {
  it('déclare un plafond mensuel explicite', () => {
    expect(code, 'MONTHLY_FREE_QUOTA a disparu').toMatch(/const\s+MONTHLY_FREE_QUOTA\s*=\s*\d+/)
  })

  it('compte les appels du mois dans ai_usage_log', () => {
    expect(code).toMatch(/from\(\s*'ai_usage_log'\s*\)/)
    expect(code, "le comptage doit filtrer sur la feature").toMatch(/eq\(\s*'feature'\s*,\s*'receipt_ocr'\s*\)/)
    expect(code, 'le comptage doit être borné au mois en cours').toMatch(/gte\(\s*'created_at'/)
  })

  it('refuse au-delà du plafond, sans appeler Vision', () => {
    expect(code).toMatch(/>=\s*MONTHLY_FREE_QUOTA/)
    expect(code, "le refus doit être explicite pour le client").toMatch(/quota_exceeded/)
  })
})

describe('scan-receipt — l’ORDRE fait partie du garde', () => {
  const posComptage = code.indexOf("eq('feature', 'receipt_ocr')")
  const posRefus = code.indexOf('MONTHLY_FREE_QUOTA')
  const posVision = code.search(/vision\.googleapis\.com|images:annotate/)
  const posInsert = code.search(/insert\(\{[\s\S]{0,120}feature:\s*'receipt_ocr'/)

  it('le repère du comptage et celui de Vision existent (sinon ce bloc serait aveugle)', () => {
    expect(posComptage, 'comptage introuvable').toBeGreaterThan(-1)
    expect(posVision, 'appel Vision introuvable').toBeGreaterThan(-1)
    expect(posInsert, 'écriture du log introuvable').toBeGreaterThan(-1)
  })

  it('le quota est vérifié AVANT de dépenser une unité Vision', () => {
    expect(posComptage).toBeLessThan(posVision)
    expect(posRefus).toBeLessThan(posVision)
  })

  it('🔴 le log est écrit AVANT de savoir si Vision a réussi', () => {
    // Un quota Google se consomme sur la REQUÊTE, pas sur le succès : une
    // erreur 400/500 compte quand même. N'incrémenter qu'en cas de succès
    // sous-compterait le quota — et le dépassement arriverait sans prévenir.
    const posVerifOk = code.search(/!visionResp\.ok/)
    expect(posVerifOk, 'la vérification de réponse Vision a disparu').toBeGreaterThan(-1)
    expect(posInsert).toBeLessThan(posVerifOk)
  })

  it('l’écriture du log est BLOQUANTE, pas best-effort', () => {
    // `suggest-substitutes` écrit ses logs via `runAfterResponse` parce qu'ils
    // sont analytiques. Ici le log EST le compteur de quota : le laisser partir
    // en tâche de fond rendrait le comptage faux.
    expect(code, "l'insert du quota doit être await").toMatch(/await\s+supabaseAdmin\s*\.\s*from\(\s*'ai_usage_log'\s*\)\s*\.\s*insert/)
    expect(code, 'le compteur de quota ne doit pas passer par runAfterResponse')
      .not.toMatch(/runAfterResponse\([\s\S]{0,200}feature:\s*'receipt_ocr'/)
  })
})
