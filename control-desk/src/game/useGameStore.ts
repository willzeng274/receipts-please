import { create } from 'zustand'
import { GAME_CASES, MANUAL_CASE_COUNT, type GameDecision } from './gameData'

export type GamePhase = 'briefing' | 'complete' | 'ending' | 'manual' | 'migrating' | 'migration-prompt' | 'overload' | 'ramp'

export type DecisionResult = {
  correct: boolean
  decision: GameDecision
  expectedDecision: GameDecision
  explanation: string
  missingEvidence: number[]
  points: number
}

type DecisionRecord = DecisionResult & {
  caseId: string
}

type GameState = {
  caseIndex: number
  decisions: DecisionRecord[]
  elapsedSeconds: number
  feedback: DecisionResult | null
  paused: boolean
  phase: GamePhase
  reviewedEvidence: number[]
  score: number
  soundEnabled: boolean
  acknowledgeOverload: () => void
  advanceCase: () => void
  beginMigration: () => void
  completeGame: () => void
  finishMigration: () => void
  inspectEvidence: (index: number) => void
  resetGame: () => void
  startGame: () => void
  submitDecision: (decision: GameDecision) => void
  tick: () => void
  togglePause: () => void
  toggleSound: () => void
}

const initialState = {
  caseIndex: 0,
  decisions: [] as DecisionRecord[],
  elapsedSeconds: 0,
  feedback: null as DecisionResult | null,
  paused: false,
  phase: 'briefing' as GamePhase,
  reviewedEvidence: [] as number[],
  score: 0,
  soundEnabled: true,
}

export const useGameStore = create<GameState>((set, get) => ({
  ...initialState,
  acknowledgeOverload: () => set({ phase: 'migration-prompt' }),
  advanceCase: () => set((state) => {
    if (!state.feedback) return state
    const nextIndex = state.caseIndex + 1
    if (nextIndex === MANUAL_CASE_COUNT) {
      return {
        feedback: null,
        phase: 'overload',
        reviewedEvidence: [],
      }
    }
    if (nextIndex >= GAME_CASES.length) {
      return { feedback: null, phase: 'ending', reviewedEvidence: [] }
    }
    return { caseIndex: nextIndex, feedback: null, reviewedEvidence: [] }
  }),
  beginMigration: () => set({ phase: 'migrating' }),
  completeGame: () => set({ phase: 'complete' }),
  finishMigration: () => set({
    caseIndex: MANUAL_CASE_COUNT,
    feedback: null,
    phase: 'ramp',
    reviewedEvidence: [],
  }),
  inspectEvidence: (index) => set((state) => state.reviewedEvidence.includes(index)
    ? state
    : { reviewedEvidence: [...state.reviewedEvidence, index] }),
  resetGame: () => set(initialState),
  startGame: () => set((state) => ({ ...initialState, elapsedSeconds: state.elapsedSeconds, phase: 'manual' })),
  submitDecision: (decision) => {
    const state = get()
    if (state.feedback || state.paused || !['manual', 'ramp'].includes(state.phase)) return
    const currentCase = GAME_CASES[state.caseIndex]
    const missingEvidence = currentCase.era === 'manual'
      ? currentCase.evidence.map((_, index) => index).filter((index) => !state.reviewedEvidence.includes(index))
      : []
    const correct = decision === currentCase.truth.expectedDecision
    const points = correct
      ? decision === 'fire' ? 200 : 100
      : decision === 'fire' && currentCase.truth.expectedDecision !== 'fire'
        ? -200
        : -75
    const result: DecisionResult = {
      correct,
      decision,
      expectedDecision: currentCase.truth.expectedDecision,
      explanation: currentCase.truth.explanation,
      missingEvidence,
      points,
    }
    set({
      decisions: [...state.decisions, { ...result, caseId: currentCase.caseId }],
      feedback: result,
      score: state.score + points,
    })
  },
  tick: () => set((state) => state.phase === 'complete' || state.paused
    ? state
    : { elapsedSeconds: state.elapsedSeconds + 1 }),
  togglePause: () => set((state) => ({ paused: !state.paused })),
  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
}))
