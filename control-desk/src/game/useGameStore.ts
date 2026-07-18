import { create } from 'zustand'
import { GAME_CASES, MANUAL_CASE_COUNT, type GameDecision } from './gameData'

export const GAME_DURATION_SECONDS = 5 * 60

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
  automationActive: boolean
  caseIndex: number
  decisions: DecisionRecord[]
  elapsedSeconds: number
  feedback: DecisionResult | null
  paused: boolean
  phase: GamePhase
  reviewedEvidence: number[]
  score: number
  soundEnabled: boolean
  timedOut: boolean
  acknowledgeOverload: () => void
  advanceCase: () => void
  beginMigration: () => void
  completeAutomatedQueue: () => void
  completeGame: () => void
  completeManualQueue: () => void
  finishMigration: () => void
  inspectEvidence: (index: number) => void
  installRamp: () => void
  resetGame: () => void
  startGame: () => void
  submitDecision: (decision: GameDecision) => void
  tick: () => void
  togglePause: () => void
  toggleSound: () => void
}

const initialState = {
  automationActive: false,
  caseIndex: 0,
  decisions: [] as DecisionRecord[],
  elapsedSeconds: 0,
  feedback: null as DecisionResult | null,
  paused: false,
  phase: 'briefing' as GamePhase,
  reviewedEvidence: [] as number[],
  score: 0,
  soundEnabled: true,
  timedOut: false,
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
  completeAutomatedQueue: () => set({ phase: 'ending' }),
  completeGame: () => set({ automationActive: false, phase: 'complete', timedOut: false }),
  completeManualQueue: () => set({
    caseIndex: MANUAL_CASE_COUNT - 1,
    feedback: null,
    phase: 'overload',
    reviewedEvidence: [],
  }),
  finishMigration: () => set({
    caseIndex: MANUAL_CASE_COUNT,
    feedback: null,
    phase: 'ramp',
    reviewedEvidence: [],
  }),
  inspectEvidence: (index) => set((state) => state.reviewedEvidence.includes(index)
    ? state
    : { reviewedEvidence: [...state.reviewedEvidence, index] }),
  installRamp: () => set({
    automationActive: true,
    feedback: null,
    paused: false,
    phase: 'migrating',
    reviewedEvidence: [],
  }),
  resetGame: () => set(initialState),
  startGame: () => set({ ...initialState, phase: 'manual' }),
  submitDecision: (decision) => {
    const state = get()
    if (state.elapsedSeconds >= GAME_DURATION_SECONDS || state.feedback || state.paused || !['manual', 'ramp'].includes(state.phase)) return
    const currentCase = GAME_CASES[state.caseIndex]
    const missingEvidence = currentCase.era === 'manual'
      ? currentCase.evidence.map((_, index) => index).filter((index) => !state.reviewedEvidence.includes(index))
      : []
    const correct = decision === currentCase.truth.expectedDecision
      || (currentCase.truth.expectedDecision === 'fire' && decision === 'reject')
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
  tick: () => set((state) => {
    if (state.phase === 'briefing' || state.phase === 'complete' || state.paused) return state
    const elapsedSeconds = Math.min(GAME_DURATION_SECONDS, state.elapsedSeconds + 1)
    if (elapsedSeconds === GAME_DURATION_SECONDS) {
      return {
        automationActive: false,
        elapsedSeconds,
        feedback: null,
        paused: false,
        phase: 'complete',
        timedOut: true,
      }
    }
    return { elapsedSeconds }
  }),
  togglePause: () => set((state) => ({ paused: !state.paused })),
  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
}))
