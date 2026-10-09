// Pipeline orchestrator — exécute les validators dans l'ordre + collecte erreurs.
// Refonte Recettes Phase 2 — Sprint 18.
//
// Pattern : Chain of Responsibility composable. Chaque validator :
//   - reçoit (parsedData, context)
//   - retourne { ok, errors[], parsedData (possibly enriched) }
//   - ne throw pas (les erreurs sont DATA, pas exceptions)
//
// Hooks lifecycle (extensibilité Sentry / métriques sans toucher core) :
//   - before-validate, validator-failed, after-validate, before-publish, after-publish
//
// Spec source : la conception « recipes-massive-import-and-validation » du 2026-05-18 (section 7)

import { ERROR_CODES, hasBlockingError } from './error-codes.mjs'
import { maxSeverity, SEVERITY } from './severity.mjs'

/** @typedef {{ field: string, code: string, raw: any, suggested: any, severity: string, validator: string }} ValidationError */
/** @typedef {{ ok: boolean, errors: ValidationError[], parsedData: any }} ValidatorResult */
/** @typedef {(parsedData: any, context: any) => Promise<ValidatorResult>|ValidatorResult} Validator */

/**
 * Crée un orchestrator pour le pipeline de validation.
 *
 * @param {Validator[]} validators - Liste ordonnée des validators à exécuter
 * @returns {{ run, on }}
 */
export function createOrchestrator(validators) {
  const listeners = {
    'before-validate': [],
    'validator-failed': [],
    'after-validate': [],
    'before-publish': [],
    'after-publish': [],
  }

  function emit(event, ...args) {
    for (const fn of listeners[event] ?? []) {
      try { fn(...args) } catch (err) {
        // Listener errors don't break the pipeline — log dev only
        if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
          console.error(`[orchestrator] listener ${event} failed`, err)
        }
      }
    }
  }

  return {
    /**
     * Subscribe à un event lifecycle.
     * @param {'before-validate'|'validator-failed'|'after-validate'|'before-publish'|'after-publish'} event
     * @param {Function} fn
     */
    on(event, fn) {
      if (!listeners[event]) throw new Error(`Unknown event: ${event}`)
      listeners[event].push(fn)
    },

    /**
     * Exécute le pipeline complet sur 1 recette parsed.
     *
     * @param {any} parsedData - Recette normalisée
     * @param {any} context - Context (catalogue ingredients, recettes existantes, etc.)
     * @returns {Promise<{ status: 'valid'|'invalid', errors: ValidationError[], parsedData: any, maxSeverity: string|null }>}
     */
    async run(parsedData, context = {}) {
      emit('before-validate', parsedData, context)

      let allErrors = []
      let currentData = parsedData

      for (const validator of validators) {
        const name = validator.name || 'anonymous'
        try {
          const result = await validator(currentData, context)
          if (!result?.ok || result.errors?.length) {
            // Annotate errors with validator name (debugging + admin UI)
            const annotated = (result?.errors ?? []).map(e => ({ ...e, validator: e.validator ?? name }))
            allErrors = allErrors.concat(annotated)
            if (annotated.length) emit('validator-failed', name, annotated)
          }
          if (result?.parsedData) currentData = result.parsedData
        } catch (err) {
          // Un validator qui throw = bug, on log mais on continue (pipeline résilient)
          allErrors.push({
            field: '_pipeline',
            code: 'VALIDATOR_THREW',
            raw: err?.message ?? String(err),
            suggested: null,
            severity: SEVERITY.ERROR,
            validator: name,
          })
          emit('validator-failed', name, [{ code: 'VALIDATOR_THREW', message: err?.message }])
        }
      }

      // Status global : invalid si au moins 1 blocking error, sinon valid
      // (les warnings et errors non-blocking permettent quand même la publication
      // mais avec flag admin_review)
      const status = hasBlockingError(allErrors) ? 'invalid' : 'valid'
      const max = maxSeverity(allErrors)

      const result = { status, errors: allErrors, parsedData: currentData, maxSeverity: max }
      emit('after-validate', result)
      return result
    },
  }
}

/**
 * Factory helper : crée une erreur de validation standardisée.
 * Permet aux validators de produire des erreurs avec shape cohérente.
 */
export function makeError(code, { field, raw, suggested } = {}) {
  const meta = ERROR_CODES[code]
  if (!meta) {
    throw new Error(`Unknown error code: ${code}. Add it to error-codes.mjs first.`)
  }
  return {
    field: field ?? null,
    code,
    raw: raw ?? null,
    suggested: suggested ?? null,
    severity: meta.severity,
  }
}
