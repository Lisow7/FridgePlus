// src/features/cooking-mode/lib/cooking-state-reducer.js
//
// State machine pure pour orchestrer le mode cuisine.
// État : { status, currentStepIndex, totalSteps }
// Actions : START, STEP_READ, NEXT_STEP, PREVIOUS_STEP, REPEAT_STEP,
//           JUMP_TO_STEP, PAUSE_SESSION, RESUME_SESSION, STOP
//
// Spec : la conception « cooking-mode-vocal » du 2026-05-19

export function initialCookingState({ totalSteps }) {
  return {
    status: 'idle',
    currentStepIndex: -1,
    totalSteps,
  }
}

const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

export function cookingReducer(state, action) {
  switch (action.type) {
    case 'START':
      return { ...state, status: 'speaking', currentStepIndex: 0 }
    case 'STEP_READ':
      return { ...state, status: 'listening' }
    case 'NEXT_STEP': {
      const next = state.currentStepIndex + 1
      if (next >= state.totalSteps) return { ...state, status: 'finished' }
      return { ...state, status: 'speaking', currentStepIndex: next }
    }
    case 'PREVIOUS_STEP':
      return { ...state, status: 'speaking', currentStepIndex: Math.max(0, state.currentStepIndex - 1) }
    case 'REPEAT_STEP':
      return { ...state, status: 'speaking' }
    case 'JUMP_TO_STEP':
      return { ...state, status: 'speaking', currentStepIndex: clamp(action.step - 1, 0, state.totalSteps - 1) }
    case 'PAUSE_SESSION':
      return { ...state, status: 'paused' }
    case 'RESUME_SESSION':
      return { ...state, status: 'listening' }
    case 'STOP':
      return { ...state, status: 'finished' }
    default:
      return state
  }
}
