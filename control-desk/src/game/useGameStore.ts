import { create } from 'zustand'
import { GAME_CASES, MANUAL_CASE_COUNT, type GameDecision } from './gameData'

export const GAME_DURATION_SECONDS = 5 * 60

export type GamePhase = 'briefing' | 'complete' | 'ending' | 'manual' | 'migrating' | 'migration-prompt' | 'overload' | 'ramp'
export type GameSlackView = 'ceo' | 'finance' | 'travel'

export type GameDesktopWindow = {
  appId: string
  height: number
  maximized: boolean
  minimized: boolean
  width: number
  x: number
  y: number
  z: number
}

export type DecisionResult = {
  acceptedDecisions: GameDecision[]
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
  endingContinueRun: number
  feedback: DecisionResult | null
  desktopWindows: GameDesktopWindow[]
  notificationVisible: boolean
  paused: boolean
  phase: GamePhase
  reviewedEvidence: number[]
  score: number
  slackView: GameSlackView
  soundEnabled: boolean
  timedOut: boolean
  acknowledgeOverload: () => void
  advanceCase: () => void
  beginMigration: () => void
  completeAutomatedQueue: () => void
  completeGame: () => void
  completeManualQueue: () => void
  finishMigration: () => void
  closeDesktopApp: (appId: string) => void
  dismissNotification: () => void
  focusDesktopApp: (appId: string) => void
  inspectEvidence: (index: number) => void
  installRamp: () => void
  minimizeDesktopApp: (appId: string) => void
  moveDesktopApp: (appId: string, x: number, y: number) => void
  openDesktopApp: (appId: string) => void
  resizeDesktopApp: (appId: string, width: number, height: number) => void
  resetGame: () => void
  requestEndingContinue: () => void
  setSlackView: (view: GameSlackView) => void
  startGame: () => void
  submitDecision: (decision: GameDecision) => void
  tick: () => void
  togglePause: () => void
  toggleSound: () => void
  toggleMaximizeDesktopApp: (appId: string) => void
}

const initialState = {
  automationActive: false,
  caseIndex: 0,
  decisions: [] as DecisionRecord[],
  elapsedSeconds: 0,
  endingContinueRun: 0,
  feedback: null as DecisionResult | null,
  desktopWindows: [] as GameDesktopWindow[],
  notificationVisible: true,
  paused: false,
  phase: 'briefing' as GamePhase,
  reviewedEvidence: [] as number[],
  score: 0,
  slackView: 'finance' as GameSlackView,
  soundEnabled: true,
  timedOut: false,
}

function initialDesktopWindow(appId: string, z = 21): GameDesktopWindow {
  if (appId === 'expenses') return { appId, height: 472, maximized: false, minimized: false, width: 984, x: 28, y: 12, z }
  if (appId === 'ramp') return { appId, height: 472, maximized: false, minimized: false, width: 984, x: 28, y: 12, z }
  if (appId === 'calculator') return { appId, height: 420, maximized: false, minimized: false, width: 560, x: 246, y: 24, z }
  return { appId, height: 430, maximized: false, minimized: false, width: 760, x: 240, y: 22, z }
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
        phase: 'migration-prompt',
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
    phase: 'migration-prompt',
    reviewedEvidence: [],
  }),
  finishMigration: () => set((state) => {
    const topZ = Math.max(20, ...state.desktopWindows.map((window) => window.z)) + 1
    const rampWindow = state.desktopWindows.find((window) => window.appId === 'ramp')
    return {
      caseIndex: MANUAL_CASE_COUNT,
      desktopWindows: rampWindow
        ? state.desktopWindows.map((window) => window.appId === 'ramp'
          ? { ...window, minimized: false, z: topZ }
          : { ...window, minimized: true })
        : [
            ...state.desktopWindows.map((window) => ({ ...window, minimized: true })),
            initialDesktopWindow('ramp', topZ),
          ],
      feedback: null,
      phase: 'ramp',
      reviewedEvidence: [],
    }
  }),
  closeDesktopApp: (appId) => set((state) => ({
    desktopWindows: state.desktopWindows.filter((window) => window.appId !== appId),
  })),
  dismissNotification: () => set({ notificationVisible: false }),
  focusDesktopApp: (appId) => set((state) => {
    const topZ = Math.max(20, ...state.desktopWindows.map((window) => window.z)) + 1
    return {
      desktopWindows: state.desktopWindows.map((window) => window.appId === appId
        ? { ...window, minimized: false, z: topZ }
        : window),
    }
  }),
  inspectEvidence: (index) => set((state) => state.reviewedEvidence.includes(index)
    ? state
    : { reviewedEvidence: [...state.reviewedEvidence, index] }),
  installRamp: () => set((state) => {
    const topZ = Math.max(20, ...state.desktopWindows.map((window) => window.z)) + 1
    const rampWindow = state.desktopWindows.find((window) => window.appId === 'ramp')
    return {
      automationActive: true,
      desktopWindows: rampWindow
        ? state.desktopWindows.map((window) => window.appId === 'ramp'
          ? { ...window, minimized: false, z: topZ }
          : { ...window, minimized: true })
        : [
            ...state.desktopWindows.map((window) => ({ ...window, minimized: true })),
            initialDesktopWindow('ramp', topZ),
          ],
      feedback: null,
      notificationVisible: false,
      paused: false,
      phase: 'migrating',
      reviewedEvidence: [],
      slackView: 'ceo',
    }
  }),
  minimizeDesktopApp: (appId) => set((state) => ({
    desktopWindows: state.desktopWindows.map((window) => window.appId === appId
      ? { ...window, minimized: true }
      : window),
  })),
  moveDesktopApp: (appId, x, y) => set((state) => ({
    desktopWindows: state.desktopWindows.map((window) => window.appId === appId
      ? { ...window, maximized: false, x, y }
      : window),
  })),
  openDesktopApp: (appId) => set((state) => {
    const topZ = Math.max(20, ...state.desktopWindows.map((window) => window.z)) + 1
    const existing = state.desktopWindows.find((window) => window.appId === appId)
    if (existing) {
      return {
        desktopWindows: state.desktopWindows.map((window) => window.appId === appId
          ? { ...window, minimized: false, z: topZ }
          : window),
      }
    }
    const offset = state.desktopWindows.filter((window) => window.appId !== 'expenses').length % 5
    const window = initialDesktopWindow(appId, topZ)
    return {
      desktopWindows: [...state.desktopWindows, {
        ...window,
        x: window.x + offset * 18,
        y: window.y + offset * 16,
      }],
    }
  }),
  resizeDesktopApp: (appId, width, height) => set((state) => ({
    desktopWindows: state.desktopWindows.map((window) => window.appId === appId
      ? { ...window, height, maximized: false, width }
      : window),
  })),
  resetGame: () => set(initialState),
  requestEndingContinue: () => set((state) => ({ endingContinueRun: state.endingContinueRun + 1 })),
  setSlackView: (slackView) => set({ slackView }),
  startGame: () => set({ ...initialState, desktopWindows: [initialDesktopWindow('expenses')], phase: 'manual' }),
  submitDecision: (decision) => {
    const state = get()
    if (state.elapsedSeconds >= GAME_DURATION_SECONDS || state.feedback || state.paused || !['manual', 'ramp'].includes(state.phase)) return
    const currentCase = GAME_CASES[state.caseIndex]
    const missingEvidence = currentCase.era === 'manual'
      ? currentCase.evidence.map((_, index) => index).filter((index) => !state.reviewedEvidence.includes(index))
      : []
    const acceptedDecisions = currentCase.truth.acceptedDecisions
      ?? (currentCase.truth.expectedDecision === 'fire' ? ['fire', 'reject'] : [currentCase.truth.expectedDecision])
    const correct = acceptedDecisions.includes(decision)
    const points = correct
      ? decision === 'fire' ? 200 : 100
      : decision === 'fire' && currentCase.truth.expectedDecision !== 'fire'
        ? -200
        : -75
    const result: DecisionResult = {
      acceptedDecisions,
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
  toggleMaximizeDesktopApp: (appId) => set((state) => ({
    desktopWindows: state.desktopWindows.map((window) => window.appId === appId
      ? window.maximized
        ? initialDesktopWindow(appId, window.z)
        : { ...window, height: 482, maximized: true, minimized: false, width: 1024, x: 8, y: 8 }
      : window),
  })),
}))
