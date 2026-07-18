import { create } from 'zustand'
import { GAME_CASES, MANUAL_CASE_COUNT, type GameDecision } from './gameData'

export type GamePhase = 'briefing' | 'complete' | 'ending' | 'manual' | 'migrating' | 'migration-prompt' | 'overload' | 'ramp'

export type DecisionResult = {
  correct: boolean
  decision: GameDecision
  expectedDecision: GameDecision
  explanation: string
  missingActions: string[]
  missingDeskTool: boolean
  missingEvidence: number[]
  points: number
}

type DecisionRecord = DecisionResult & {
  caseId: string
}

type GameState = {
  activeActions: string[]
  caseIndex: number
  calculatorComplete: boolean
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
  completeCalculator: () => void
  completeGame: () => void
  finishMigration: () => void
  inspectEvidence: (index: number) => void
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
  calculatorComplete: false,
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
        activeActions: [],
        calculatorComplete: false,
        feedback: null,
        phase: 'overload',
        reviewedEvidence: [],
      }
    }
    if (nextIndex >= GAME_CASES.length) {
      return { activeActions: [], calculatorComplete: false, feedback: null, phase: 'ending', reviewedEvidence: [] }
    }
    return { activeActions: [], calculatorComplete: false, caseIndex: nextIndex, feedback: null, reviewedEvidence: [] }
  }),
  beginMigration: () => set({ activeActions: [], calculatorComplete: false, phase: 'migrating' }),
  completeCalculator: () => set({ calculatorComplete: true }),
  completeGame: () => set({ phase: 'complete' }),
  finishMigration: () => set({
    activeActions: [],
    calculatorComplete: false,
    caseIndex: MANUAL_CASE_COUNT,
    feedback: null,
    phase: 'ramp',
    reviewedEvidence: [],
  }),
  inspectEvidence: (index) => set((state) => state.reviewedEvidence.includes(index)
    ? state
    : { reviewedEvidence: [...state.reviewedEvidence, index] }),
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
    const missingEvidence = currentCase.era === 'manual'
      ? currentCase.evidence.map((_, index) => index).filter((index) => !state.reviewedEvidence.includes(index))
      : []
    const missingDeskTool = currentCase.era === 'manual'
      && currentCase.workflow.requiredDeskTool === 'calculator'
      && !state.calculatorComplete
    const correct = decision === currentCase.truth.expectedDecision
      && missingActions.length === 0
      && missingEvidence.length === 0
      && !missingDeskTool
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
      missingActions,
      missingDeskTool,
      missingEvidence,
      points,
    }
    set({
      decisions: [...state.decisions, { ...result, caseId: currentCase.caseId }],
      feedback: result,
      score: state.score + points,
    })
  },
  tick: () => set((state) => state.phase === 'complete' || state.paused || state.elapsedSeconds >= 300
    ? state
    : { elapsedSeconds: Math.min(300, state.elapsedSeconds + 1) }),
  togglePause: () => set((state) => ({ paused: !state.paused })),
  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
}))
