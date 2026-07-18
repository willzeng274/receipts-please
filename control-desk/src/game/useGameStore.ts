import { create } from 'zustand'
import { GAME_CASES, MANUAL_CASE_COUNT, type GameDecision } from './gameData'

export type GamePhase = 'briefing' | 'complete' | 'ending' | 'manual' | 'migrating' | 'migration-prompt' | 'ramp'

export type DecisionResult = {
  correct: boolean
  decision: GameDecision
  expectedDecision: GameDecision
  explanation: string
  missingActions: string[]
}

type DecisionRecord = DecisionResult & {
  caseId: string
}

type GameState = {
  activeActions: string[]
  caseIndex: number
  decisions: DecisionRecord[]
  elapsedSeconds: number
  feedback: DecisionResult | null
  paused: boolean
  phase: GamePhase
  soundEnabled: boolean
  advanceCase: () => void
  beginMigration: () => void
  completeGame: () => void
  finishMigration: () => void
  performAction: (action: string) => void
  resetGame: () => void
  startGame: () => void
  submitDecision: (decision: GameDecision) => void
  tick: () => void
  togglePause: () => void
  toggleSound: () => void
}

const initialState = {
  activeActions: [] as string[],
  caseIndex: 0,
  decisions: [] as DecisionRecord[],
  elapsedSeconds: 0,
  feedback: null as DecisionResult | null,
  paused: false,
  phase: 'briefing' as GamePhase,
  soundEnabled: true,
}

export const useGameStore = create<GameState>((set, get) => ({
  ...initialState,
  advanceCase: () => set((state) => {
    if (!state.feedback) return state
    const nextIndex = state.caseIndex + 1
    if (nextIndex === MANUAL_CASE_COUNT) {
      return { activeActions: [], feedback: null, phase: 'migration-prompt' }
    }
    if (nextIndex >= GAME_CASES.length) {
      return { activeActions: [], feedback: null, phase: 'ending' }
    }
    return { activeActions: [], caseIndex: nextIndex, feedback: null }
  }),
  beginMigration: () => set({ phase: 'migrating' }),
  completeGame: () => set({ phase: 'complete' }),
  finishMigration: () => set({ activeActions: [], caseIndex: MANUAL_CASE_COUNT, feedback: null, phase: 'ramp' }),
  performAction: (action) => set((state) => state.activeActions.includes(action)
    ? state
    : { activeActions: [...state.activeActions, action] }),
  resetGame: () => set(initialState),
  startGame: () => set((state) => ({ ...initialState, elapsedSeconds: state.elapsedSeconds, phase: 'manual' })),
  submitDecision: (decision) => {
    const state = get()
    if (state.feedback || state.paused || !['manual', 'ramp'].includes(state.phase)) return
    const currentCase = GAME_CASES[state.caseIndex]
    const requiredActions = currentCase.truth.requiredActions ?? []
    const missingActions = requiredActions.filter((action) => !state.activeActions.includes(action))
    const result: DecisionResult = {
      correct: decision === currentCase.truth.expectedDecision && missingActions.length === 0,
      decision,
      expectedDecision: currentCase.truth.expectedDecision,
      explanation: currentCase.truth.explanation,
      missingActions,
    }
    set({
      decisions: [...state.decisions, { ...result, caseId: currentCase.caseId }],
      feedback: result,
    })
  },
  tick: () => set((state) => state.phase === 'complete' || state.paused
    ? state
    : { elapsedSeconds: state.elapsedSeconds + 1 }),
  togglePause: () => set((state) => ({ paused: !state.paused })),
  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
}))
