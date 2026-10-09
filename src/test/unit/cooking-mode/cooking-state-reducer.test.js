import { describe, it, expect } from 'vitest'
import { cookingReducer, initialCookingState } from '../../../features/cooking-mode/lib/cooking-state-reducer'

const baseState = initialCookingState({ totalSteps: 5 })

describe('cookingReducer', () => {
  it('initial state', () => {
    expect(baseState.status).toBe('idle')
    expect(baseState.currentStepIndex).toBe(-1)
    expect(baseState.totalSteps).toBe(5)
  })
  it('START → speaking, currentStepIndex=0', () => {
    const next = cookingReducer(baseState, { type: 'START' })
    expect(next.status).toBe('speaking')
    expect(next.currentStepIndex).toBe(0)
  })
  it('STEP_READ → listening', () => {
    const s = { ...baseState, status: 'speaking', currentStepIndex: 0 }
    expect(cookingReducer(s, { type: 'STEP_READ' }).status).toBe('listening')
  })
  it('NEXT_STEP avance currentStepIndex', () => {
    const s = { ...baseState, status: 'listening', currentStepIndex: 1 }
    const next = cookingReducer(s, { type: 'NEXT_STEP' })
    expect(next.currentStepIndex).toBe(2)
    expect(next.status).toBe('speaking')
  })
  it('NEXT_STEP au dernier index → finished', () => {
    const s = { ...baseState, status: 'listening', currentStepIndex: 4 }
    expect(cookingReducer(s, { type: 'NEXT_STEP' }).status).toBe('finished')
  })
  it('PREVIOUS_STEP recule', () => {
    const s = { ...baseState, status: 'listening', currentStepIndex: 3 }
    expect(cookingReducer(s, { type: 'PREVIOUS_STEP' }).currentStepIndex).toBe(2)
  })
  it('PREVIOUS_STEP à 0 reste à 0', () => {
    const s = { ...baseState, status: 'listening', currentStepIndex: 0 }
    expect(cookingReducer(s, { type: 'PREVIOUS_STEP' }).currentStepIndex).toBe(0)
  })
  it('REPEAT_STEP repasse en speaking sans changer index', () => {
    const s = { ...baseState, status: 'listening', currentStepIndex: 2 }
    const next = cookingReducer(s, { type: 'REPEAT_STEP' })
    expect(next.status).toBe('speaking')
    expect(next.currentStepIndex).toBe(2)
  })
  it('JUMP_TO_STEP clamp dans les bornes', () => {
    const s = { ...baseState, status: 'listening' }
    expect(cookingReducer(s, { type: 'JUMP_TO_STEP', step: 10 }).currentStepIndex).toBe(4)
    expect(cookingReducer(s, { type: 'JUMP_TO_STEP', step: -5 }).currentStepIndex).toBe(0)
    expect(cookingReducer(s, { type: 'JUMP_TO_STEP', step: 3 }).currentStepIndex).toBe(2)
  })
  it('PAUSE_SESSION → paused', () => {
    const s = { ...baseState, status: 'listening' }
    expect(cookingReducer(s, { type: 'PAUSE_SESSION' }).status).toBe('paused')
  })
  it('RESUME_SESSION → listening', () => {
    const s = { ...baseState, status: 'paused' }
    expect(cookingReducer(s, { type: 'RESUME_SESSION' }).status).toBe('listening')
  })
  it('STOP → finished', () => {
    const s = { ...baseState, status: 'listening' }
    expect(cookingReducer(s, { type: 'STOP' }).status).toBe('finished')
  })
  it('action inconnue → state inchangé (même référence)', () => {
    expect(cookingReducer(baseState, { type: 'UNKNOWN' })).toBe(baseState)
  })
})
