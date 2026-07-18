import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  DEFAULT_WORKSTATION_CASE_ID,
  WORKSTATION_CASES,
  WORKSTATION_CASES_BY_ID,
  WORKSTATION_CASE_IDS_BY_PHASE,
} from './caseFixtures'
import type {
  WorkstationAuditEvent,
  WorkstationCardState,
  WorkstationCaseId,
  WorkstationCasePhase,
  WorkstationDecision,
  WorkstationDecisionResult,
  WorkstationFinalDecision,
  WorkstationQueueCounts,
  WorkstationReceiptNotification,
  WorkstationRequiredAction,
  WorkstationSceneEvent,
  WorkstationSceneEventId,
  WorkstationSession,
  WorkstationStampedDecisionRequest,
} from './types'
import type { AppId } from './workstationData'

const SESSION_DURATION_MS = 5 * 60 * 1_000
const STORAGE_VERSION = 7

const APP_IDS: readonly AppId[] = [
  'expenses',
  'transactions',
  'people',
  'slack',
  'policy',
  'travel',
  'inventory',
  'vendor',
  'cards',
  'calculator',
]

const FINAL_DECISIONS: readonly WorkstationFinalDecision[] = [
  'approve',
  'reject',
  'investigate',
  'request-receipt',
]

const REQUIRED_ACTIONS: readonly WorkstationRequiredAction[] = [
  'freeze-card',
  'flag-transaction',
  'escalate-employee',
  'approve-coffee',
  'cancel-ai-vendor',
  'escalate-approval',
]

const decisionLabels: Record<WorkstationDecision, string> = {
  approve: 'Approved expense',
  investigate: 'Escalated for investigation',
  reject: 'Rejected expense',
  'request-receipt': 'Requested corrected receipt',
  review: 'Returned to review',
}

const decisionSceneEvents: Partial<Record<WorkstationDecision, WorkstationSceneEventId>> = {
  approve: 'decision.approve',
  investigate: 'decision.fraud',
  reject: 'decision.reject',
  'request-receipt': 'decision.reject',
}

type WorkstationDataState = {
  activeApp: AppId
  activeCaseId: WorkstationCaseId
  auditTrail: WorkstationAuditEvent[]
  cardStates: Record<string, WorkstationCardState>
  closedCaseIds: WorkstationCaseId[]
  completedActionsByCase: Partial<Record<WorkstationCaseId, WorkstationRequiredAction[]>>
  decisionResults: Partial<Record<WorkstationCaseId, WorkstationDecisionResult>>
  decisions: Partial<Record<WorkstationCaseId, WorkstationDecision>>
  pinnedEvidenceIds: Partial<Record<WorkstationCaseId, string[]>>
  rampUnlocked: boolean
  sceneEvent: WorkstationSceneEvent | null
  receiptNotifications: WorkstationReceiptNotification[]
  receiptNotificationRun: number
  session: WorkstationSession
  submittedCaseIds: WorkstationCaseId[]
  stampedDecisionRequest: WorkstationStampedDecisionRequest | null
  unreadReceiptNotifications: number
}

export type WorkstationState = WorkstationDataState & {
  advanceToNextCase: (phase: WorkstationCasePhase) => WorkstationCaseId | null
  clearPinnedEvidence: () => void
  completeCaseAction: (action: WorkstationRequiredAction, completed?: boolean, caseId?: WorkstationCaseId) => void
  emitSceneEvent: (id: WorkstationSceneEventId) => void
  markRampUnlocked: () => void
  markReceiptNotificationsRead: () => void
  pauseSession: (now?: number) => void
  recordDecision: (decision: WorkstationDecision) => WorkstationDecisionResult | null
  resetWorkstation: () => void
  resumeSession: (now?: number) => void
  requestStampedDecision: (decision: WorkstationFinalDecision) => void
  setActiveApp: (activeApp: AppId) => void
  setActiveCase: (activeCaseId: WorkstationCaseId) => void
  setCardFrozen: (frozen: boolean, caseId?: WorkstationCaseId) => void
  startSession: (now?: number) => void
  submitNextManualReceipt: (now?: number) => WorkstationReceiptNotification | null
  syncSessionClock: (now?: number) => void
  togglePinnedEvidence: (evidenceId: string) => void
}

function createInitialSession(): WorkstationSession {
  return {
    bestStreak: 0,
    correctCount: 0,
    durationMs: SESSION_DURATION_MS,
    elapsedMs: 0,
    endedAt: null,
    incorrectCount: 0,
    lastSyncedAt: null,
    remainingMs: SESSION_DURATION_MS,
    score: 0,
    startedAt: null,
    status: 'idle',
    streak: 0,
  }
}

function createInitialState(): WorkstationDataState {
  return {
    activeApp: 'expenses',
    activeCaseId: DEFAULT_WORKSTATION_CASE_ID,
    auditTrail: [],
    cardStates: {},
    closedCaseIds: [],
    completedActionsByCase: {},
    decisionResults: {},
    decisions: {},
    pinnedEvidenceIds: {},
    rampUnlocked: false,
    sceneEvent: null,
    receiptNotifications: [],
    receiptNotificationRun: 0,
    session: createInitialSession(),
    submittedCaseIds: [DEFAULT_WORKSTATION_CASE_ID],
    stampedDecisionRequest: null,
    unreadReceiptNotifications: 0,
  }
}

function isCaseId(value: unknown): value is WorkstationCaseId {
  return typeof value === 'string' && value in WORKSTATION_CASES_BY_ID
}

function isFinalDecision(value: unknown): value is WorkstationFinalDecision {
  return FINAL_DECISIONS.includes(value as WorkstationFinalDecision)
}

function isRequiredAction(value: unknown): value is WorkstationRequiredAction {
  return REQUIRED_ACTIONS.includes(value as WorkstationRequiredAction)
}

function getCompletedActions(state: WorkstationDataState, caseId: WorkstationCaseId) {
  const actions = state.completedActionsByCase[caseId] ?? []
  const expenseCase = WORKSTATION_CASES_BY_ID[caseId]
  const cardFrozen = state.cardStates[expenseCase.card.id]?.frozen ?? false
  return cardFrozen && !actions.includes('freeze-card') ? [...actions, 'freeze-card' as const] : actions
}

export function validateWorkstationDecision(
  state: WorkstationDataState,
  caseId: WorkstationCaseId,
  decision: WorkstationFinalDecision,
  decidedAt = Date.now(),
): WorkstationDecisionResult {
  const expenseCase = WORKSTATION_CASES_BY_ID[caseId]
  const pinnedEvidence = state.pinnedEvidenceIds[caseId] ?? []
  const completedActions = getCompletedActions(state, caseId)
  const missingEvidenceIds = expenseCase.validation.requiredEvidenceIds.filter((id) => !pinnedEvidence.includes(id))
  const missingRequiredActions = (expenseCase.validation.requiredActions ?? []).filter((action) => !completedActions.includes(action))
  const evidenceComplete = missingEvidenceIds.length === 0
  const requiredActionsComplete = missingRequiredActions.length === 0
  const isCorrect = expenseCase.validation.acceptedDecisions.includes(decision)

  return Object.freeze({
    decidedAt,
    decision,
    evidenceComplete,
    isCorrect,
    missingEvidenceIds: Object.freeze([...missingEvidenceIds]),
    missingRequiredActions: Object.freeze([...missingRequiredActions]),
    requiredActionsComplete,
    scoreDelta: evidenceComplete && requiredActionsComplete
      ? isCorrect ? expenseCase.validation.points : -Math.ceil(expenseCase.validation.points / 4)
      : 0,
  })
}

export function getNextUnresolvedCaseId(
  state: Pick<WorkstationDataState, 'closedCaseIds' | 'submittedCaseIds'>,
  phase: WorkstationCasePhase,
): WorkstationCaseId | null {
  return WORKSTATION_CASE_IDS_BY_PHASE[phase].find((caseId) => (
    !state.closedCaseIds.includes(caseId)
      && (phase === 'ramp' || state.submittedCaseIds.includes(caseId))
  )) ?? null
}

export function getWorkstationQueueCounts(
  state: Pick<WorkstationDataState, 'closedCaseIds'>,
  phase: WorkstationCasePhase,
): WorkstationQueueCounts {
  const queue = WORKSTATION_CASE_IDS_BY_PHASE[phase]
  const completed = queue.reduce((count, caseId) => count + Number(state.closedCaseIds.includes(caseId)), 0)
  return { completed, open: queue.length - completed, total: queue.length }
}

export function isWorkstationQueueComplete(
  state: Pick<WorkstationDataState, 'closedCaseIds'>,
  phase: WorkstationCasePhase,
) {
  return getWorkstationQueueCounts(state, phase).open === 0
}

export const selectActiveCardFrozen = (state: WorkstationState) => {
  const cardId = WORKSTATION_CASES_BY_ID[state.activeCaseId].card.id
  return state.cardStates[cardId]?.frozen ?? false
}

export const selectManualQueueComplete = (state: WorkstationState) => isWorkstationQueueComplete(state, 'manual')
export const selectRampQueueComplete = (state: WorkstationState) => isWorkstationQueueComplete(state, 'ramp')
export const selectNextManualCaseId = (state: WorkstationState) => getNextUnresolvedCaseId(state, 'manual')
export const selectNextRampCaseId = (state: WorkstationState) => getNextUnresolvedCaseId(state, 'ramp')
export const selectHasPendingManualSubmissions = (state: WorkstationState) => (
  WORKSTATION_CASE_IDS_BY_PHASE.manual.some((caseId) => !state.submittedCaseIds.includes(caseId))
)
export const selectActivePhaseCounts = (state: WorkstationState) => (
  getWorkstationQueueCounts(state, WORKSTATION_CASES_BY_ID[state.activeCaseId].phase)
)

function syncSession(session: WorkstationSession, now: number): WorkstationSession {
  if (session.status !== 'running' || session.lastSyncedAt === null) return session
  const elapsedMs = Math.min(session.durationMs, session.elapsedMs + Math.max(0, now - session.lastSyncedAt))
  const remainingMs = Math.max(0, session.durationMs - elapsedMs)
  return {
    ...session,
    elapsedMs,
    endedAt: remainingMs === 0 ? now : null,
    lastSyncedAt: remainingMs === 0 ? null : now,
    remainingMs,
    status: remainingMs === 0 ? 'expired' : 'running',
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function sanitizePersistedState(value: unknown): Partial<WorkstationDataState> {
  if (!isRecord(value)) return {}
  const initial = createInitialState()
  const activeCaseId = isCaseId(value.activeCaseId) ? value.activeCaseId : initial.activeCaseId
  const activeApp = APP_IDS.includes(value.activeApp as AppId) ? value.activeApp as AppId : initial.activeApp
  const closedCaseIds = Array.isArray(value.closedCaseIds) ? [...new Set(value.closedCaseIds.filter(isCaseId))] : []
  const submittedCaseIds = Array.isArray(value.submittedCaseIds)
    ? [...new Set(value.submittedCaseIds.filter((caseId): caseId is WorkstationCaseId => (
        isCaseId(caseId) && WORKSTATION_CASES_BY_ID[caseId].phase === 'manual'
      )))]
    : [DEFAULT_WORKSTATION_CASE_ID]
  if (!submittedCaseIds.includes(DEFAULT_WORKSTATION_CASE_ID)) submittedCaseIds.unshift(DEFAULT_WORKSTATION_CASE_ID)

  const receiptNotifications: WorkstationReceiptNotification[] = []
  if (Array.isArray(value.receiptNotifications)) {
    for (const candidate of value.receiptNotifications.slice(-8)) {
      if (!isRecord(candidate) || !isCaseId(candidate.caseId)) continue
      const expenseCase = WORKSTATION_CASES_BY_ID[candidate.caseId]
      receiptNotifications.push(Object.freeze({
        amount: expenseCase.amount,
        caseId: candidate.caseId,
        createdAt: finiteNumber(candidate.createdAt, 0),
        employeeName: expenseCase.employee.name,
        id: finiteNumber(candidate.id, receiptNotifications.length + 1),
        merchant: expenseCase.merchant,
        receiptId: expenseCase.source.receiptId,
      }))
    }
  }

  const decisions: WorkstationDataState['decisions'] = {}
  if (isRecord(value.decisions)) {
    for (const [caseId, decision] of Object.entries(value.decisions)) {
      if (isCaseId(caseId) && (isFinalDecision(decision) || decision === 'review')) decisions[caseId] = decision
    }
  }

  const decisionResults: WorkstationDataState['decisionResults'] = {}
  if (isRecord(value.decisionResults)) {
    for (const [caseId, candidate] of Object.entries(value.decisionResults)) {
      if (!isCaseId(caseId) || !isRecord(candidate) || !isFinalDecision(candidate.decision)) continue
      decisionResults[caseId] = Object.freeze({
        decidedAt: finiteNumber(candidate.decidedAt, 0),
        decision: candidate.decision,
        evidenceComplete: candidate.evidenceComplete === true,
        isCorrect: candidate.isCorrect === true,
        missingEvidenceIds: Object.freeze(Array.isArray(candidate.missingEvidenceIds)
          ? candidate.missingEvidenceIds.filter((id): id is string => typeof id === 'string')
          : []),
        missingRequiredActions: Object.freeze(Array.isArray(candidate.missingRequiredActions)
          ? candidate.missingRequiredActions.filter(isRequiredAction)
          : []),
        requiredActionsComplete: candidate.requiredActionsComplete === true,
        scoreDelta: finiteNumber(candidate.scoreDelta, 0),
      })
    }
  }

  const auditTrail: WorkstationAuditEvent[] = []
  if (Array.isArray(value.auditTrail)) {
    for (const candidate of value.auditTrail) {
      if (!isRecord(candidate) || !isCaseId(candidate.caseId)) continue
      const decision = candidate.decision
      if (!isFinalDecision(decision) && decision !== 'review') continue
      const knownEvidence = new Set(WORKSTATION_CASES_BY_ID[candidate.caseId].evidence.map((item) => item.id))
      auditTrail.push(Object.freeze({
        caseId: candidate.caseId,
        createdAt: finiteNumber(candidate.createdAt, 0),
        decision,
        evidenceIds: Object.freeze(Array.isArray(candidate.evidenceIds)
          ? candidate.evidenceIds.filter((id): id is string => typeof id === 'string' && knownEvidence.has(id))
          : []),
        id: finiteNumber(candidate.id, auditTrail.length + 1),
        isCorrect: typeof candidate.isCorrect === 'boolean' ? candidate.isCorrect : null,
        label: typeof candidate.label === 'string' ? candidate.label : decisionLabels[decision],
        scoreDelta: finiteNumber(candidate.scoreDelta, 0),
      }))
    }
  }

  const pinnedEvidenceIds: WorkstationDataState['pinnedEvidenceIds'] = {}
  if (isRecord(value.pinnedEvidenceIds)) {
    for (const [caseId, ids] of Object.entries(value.pinnedEvidenceIds)) {
      if (!isCaseId(caseId) || !Array.isArray(ids)) continue
      const knownIds = new Set(
        WORKSTATION_CASES_BY_ID[caseId].evidence
          .filter((evidence) => evidence.sourceApp !== 'calculator')
          .map((evidence) => evidence.id),
      )
      pinnedEvidenceIds[caseId] = [...new Set(ids.filter((id): id is string => typeof id === 'string' && knownIds.has(id)))]
    }
  }

  const cardStates: WorkstationDataState['cardStates'] = {}
  if (isRecord(value.cardStates)) {
    const knownCards = new Set(WORKSTATION_CASES.map((expenseCase) => expenseCase.card.id))
    for (const [cardId, cardState] of Object.entries(value.cardStates)) {
      if (!knownCards.has(cardId) || !isRecord(cardState) || typeof cardState.frozen !== 'boolean') continue
      cardStates[cardId] = Object.freeze({
        frozen: cardState.frozen,
        updatedAt: finiteNumber(cardState.updatedAt, 0),
      })
    }
  }

  const completedActionsByCase: WorkstationDataState['completedActionsByCase'] = {}
  if (isRecord(value.completedActionsByCase)) {
    for (const [caseId, actions] of Object.entries(value.completedActionsByCase)) {
      if (isCaseId(caseId) && Array.isArray(actions)) {
        completedActionsByCase[caseId] = [...new Set(actions.filter(isRequiredAction))]
      }
    }
  }

  const sessionRecord = isRecord(value.session) ? value.session : {}
  const durationMs = Math.max(1, finiteNumber(sessionRecord.durationMs, SESSION_DURATION_MS))
  const elapsedMs = Math.min(durationMs, Math.max(0, finiteNumber(sessionRecord.elapsedMs, 0)))
  const persistedStatus = ['idle', 'running', 'paused', 'expired', 'complete'].includes(String(sessionRecord.status))
    ? sessionRecord.status as WorkstationSession['status']
    : 'idle'
  const rampQueueComplete = WORKSTATION_CASE_IDS_BY_PHASE.ramp.every((caseId) => closedCaseIds.includes(caseId))
  const status = rampQueueComplete
    ? 'complete'
    : persistedStatus === 'expired' || elapsedMs >= durationMs
      ? 'expired'
      : persistedStatus === 'complete' ? 'paused' : persistedStatus
  const normalizedElapsedMs = status === 'expired' ? durationMs : elapsedMs
  const session: WorkstationSession = {
    bestStreak: Math.max(0, finiteNumber(sessionRecord.bestStreak, 0)),
    correctCount: Math.max(0, finiteNumber(sessionRecord.correctCount, 0)),
    durationMs,
    elapsedMs: normalizedElapsedMs,
    endedAt: typeof sessionRecord.endedAt === 'number' ? sessionRecord.endedAt : null,
    incorrectCount: Math.max(0, finiteNumber(sessionRecord.incorrectCount, 0)),
    lastSyncedAt: status === 'running' && typeof sessionRecord.lastSyncedAt === 'number' ? sessionRecord.lastSyncedAt : null,
    remainingMs: Math.max(0, durationMs - normalizedElapsedMs),
    score: finiteNumber(sessionRecord.score, 0),
    startedAt: typeof sessionRecord.startedAt === 'number' ? sessionRecord.startedAt : null,
    status,
    streak: Math.max(0, finiteNumber(sessionRecord.streak, 0)),
  }

  return {
    activeApp,
    activeCaseId,
    auditTrail,
    cardStates,
    closedCaseIds,
    completedActionsByCase,
    decisionResults,
    decisions,
    pinnedEvidenceIds,
    rampUnlocked: value.rampUnlocked === true || WORKSTATION_CASE_IDS_BY_PHASE.ramp.some((caseId) => closedCaseIds.includes(caseId)),
    receiptNotifications,
    receiptNotificationRun: Math.max(0, finiteNumber(value.receiptNotificationRun, receiptNotifications.length)),
    session,
    submittedCaseIds,
    unreadReceiptNotifications: Math.max(0, finiteNumber(value.unreadReceiptNotifications, 0)),
  }
}

export const useWorkstationStore = create<WorkstationState>()(
  persist(
    (set, get) => ({
      ...createInitialState(),
      advanceToNextCase: (phase) => {
        const nextCaseId = getNextUnresolvedCaseId(get(), phase)
        if (nextCaseId) set({ activeApp: 'expenses', activeCaseId: nextCaseId })
        return nextCaseId
      },
      clearPinnedEvidence: () => set((state) => ({
        pinnedEvidenceIds: { ...state.pinnedEvidenceIds, [state.activeCaseId]: [] },
      })),
      completeCaseAction: (action, completed = true, caseId) => set((state) => {
        const targetCaseId = caseId ?? state.activeCaseId
        const current = state.completedActionsByCase[targetCaseId] ?? []
        const next = completed
          ? current.includes(action) ? current : [...current, action]
          : current.filter((candidate) => candidate !== action)
        return { completedActionsByCase: { ...state.completedActionsByCase, [targetCaseId]: next } }
      }),
      emitSceneEvent: (id) => set((state) => ({
        sceneEvent: { id, run: (state.sceneEvent?.run ?? 0) + 1 },
      })),
      markRampUnlocked: () => set({ rampUnlocked: true }),
      markReceiptNotificationsRead: () => set({ unreadReceiptNotifications: 0 }),
      pauseSession: (now = Date.now()) => set((state) => {
        const session = syncSession(state.session, now)
        return session.status === 'running'
          ? { session: { ...session, lastSyncedAt: null, status: 'paused' } }
          : { session }
      }),
      recordDecision: (decision) => {
        const state = get()
        const caseId = state.activeCaseId
        if (decision === 'review') {
          if (!state.closedCaseIds.includes(caseId)) return null
          set({
            closedCaseIds: state.closedCaseIds.filter((id) => id !== caseId),
            decisions: { ...state.decisions, [caseId]: 'review' },
          })
          return null
        }

        const existing = state.decisionResults[caseId]
        if (state.closedCaseIds.includes(caseId)) return existing ?? null
        const result = validateWorkstationDecision(state, caseId, decision)
        if (!result.evidenceComplete || !result.requiredActionsComplete) {
          const sceneEventId = decisionSceneEvents[decision]
          set({
            decisionResults: { ...state.decisionResults, [caseId]: result },
            sceneEvent: sceneEventId
              ? { id: sceneEventId, run: (state.sceneEvent?.run ?? 0) + 1 }
              : state.sceneEvent,
          })
          return result
        }

        const expenseCase = WORKSTATION_CASES_BY_ID[caseId]
        const evidenceIds = Object.freeze([...(state.pinnedEvidenceIds[caseId] ?? [])])
        const sceneEventId = decisionSceneEvents[decision]
        const streak = result.isCorrect ? state.session.streak + 1 : 0
        const scoreDelta = result.isCorrect
          ? result.scoreDelta + Math.min(50, Math.max(0, streak - 1) * 10)
          : result.scoreDelta
        const scoredResult = scoreDelta === result.scoreDelta ? result : Object.freeze({ ...result, scoreDelta })
        const auditEvent: WorkstationAuditEvent = Object.freeze({
          caseId,
          createdAt: result.decidedAt,
          decision,
          evidenceIds,
          id: (state.auditTrail.at(-1)?.id ?? 0) + 1,
          isCorrect: result.isCorrect,
          label: decisionLabels[decision],
          scoreDelta,
        })
        const closedCaseIds = [...state.closedCaseIds, caseId]
        const nextCaseId = getNextUnresolvedCaseId({
          closedCaseIds,
          submittedCaseIds: state.submittedCaseIds,
        }, expenseCase.phase)
        const rampComplete = expenseCase.phase === 'ramp'
          && WORKSTATION_CASE_IDS_BY_PHASE.ramp.every((id) => closedCaseIds.includes(id))
        const scoredSession: WorkstationSession = {
          ...state.session,
          bestStreak: Math.max(state.session.bestStreak, streak),
          correctCount: state.session.correctCount + Number(result.isCorrect),
          incorrectCount: state.session.incorrectCount + Number(!result.isCorrect),
          score: Math.max(0, state.session.score + scoreDelta),
          streak,
        }
        const session = rampComplete
          ? { ...scoredSession, endedAt: result.decidedAt, lastSyncedAt: null, status: 'complete' as const }
          : scoredSession

        set({
          activeApp: nextCaseId ? 'expenses' : state.activeApp,
          activeCaseId: nextCaseId ?? caseId,
          auditTrail: [...state.auditTrail, auditEvent],
          closedCaseIds,
          decisionResults: { ...state.decisionResults, [caseId]: scoredResult },
          decisions: { ...state.decisions, [caseId]: decision },
          sceneEvent: sceneEventId
            ? { id: sceneEventId, run: (state.sceneEvent?.run ?? 0) + 1 }
            : state.sceneEvent,
          session,
        })
        return scoredResult
      },
      resetWorkstation: () => set(createInitialState()),
      requestStampedDecision: (decision) => set((state) => ({
        stampedDecisionRequest: {
          decision,
          run: (state.stampedDecisionRequest?.run ?? 0) + 1,
        },
      })),
      resumeSession: (now = Date.now()) => set((state) => (
        state.session.status === 'paused'
          ? { session: { ...state.session, lastSyncedAt: now, status: 'running' } }
          : { session: state.session }
      )),
      setActiveApp: (activeApp) => set({ activeApp }),
      setActiveCase: (activeCaseId) => set({ activeApp: 'expenses', activeCaseId }),
      setCardFrozen: (frozen, caseId) => set((state) => {
        const targetCaseId = caseId ?? state.activeCaseId
        const cardId = WORKSTATION_CASES_BY_ID[targetCaseId].card.id
        const wasFrozen = state.cardStates[cardId]?.frozen ?? false
        const actions = state.completedActionsByCase[targetCaseId] ?? []
        return {
          cardStates: {
            ...state.cardStates,
            [cardId]: Object.freeze({ frozen, updatedAt: Date.now() }),
          },
          completedActionsByCase: {
            ...state.completedActionsByCase,
            [targetCaseId]: frozen
              ? actions.includes('freeze-card') ? actions : [...actions, 'freeze-card']
              : actions.filter((action) => action !== 'freeze-card'),
          },
          sceneEvent: frozen && !wasFrozen
            ? { id: 'card.freeze', run: (state.sceneEvent?.run ?? 0) + 1 }
            : state.sceneEvent,
        }
      }),
      startSession: (now = Date.now()) => set((state) => (
        state.session.status === 'idle'
          ? { session: { ...createInitialSession(), lastSyncedAt: now, startedAt: now, status: 'running' } }
          : { session: state.session }
      )),
      submitNextManualReceipt: (now = Date.now()) => {
        let notification: WorkstationReceiptNotification | null = null
        set((state) => {
          const caseId = WORKSTATION_CASE_IDS_BY_PHASE.manual
            .find((candidate) => !state.submittedCaseIds.includes(candidate))
          if (!caseId) return state

          const expenseCase = WORKSTATION_CASES_BY_ID[caseId]
          const createdNotification = Object.freeze({
            amount: expenseCase.amount,
            caseId,
            createdAt: now,
            employeeName: expenseCase.employee.name,
            id: state.receiptNotificationRun + 1,
            merchant: expenseCase.merchant,
            receiptId: expenseCase.source.receiptId,
          })
          notification = createdNotification
          const currentCaseClosed = state.closedCaseIds.includes(state.activeCaseId)
          return {
            activeApp: currentCaseClosed ? 'expenses' : state.activeApp,
            activeCaseId: currentCaseClosed ? caseId : state.activeCaseId,
            receiptNotifications: [...state.receiptNotifications, createdNotification].slice(-8),
            receiptNotificationRun: state.receiptNotificationRun + 1,
            sceneEvent: { id: 'receipt.submitted', run: (state.sceneEvent?.run ?? 0) + 1 },
            submittedCaseIds: [...state.submittedCaseIds, caseId],
            unreadReceiptNotifications: state.unreadReceiptNotifications + 1,
          }
        })
        return notification
      },
      syncSessionClock: (now = Date.now()) => set((state) => ({ session: syncSession(state.session, now) })),
      togglePinnedEvidence: (evidenceId) => set((state) => {
        const knownEvidence = WORKSTATION_CASES_BY_ID[state.activeCaseId].evidence.some((evidence) => evidence.id === evidenceId)
        if (!knownEvidence) return state
        const current = state.pinnedEvidenceIds[state.activeCaseId] ?? []
        const next = current.includes(evidenceId)
          ? current.filter((id) => id !== evidenceId)
          : [...current, evidenceId]
        return { pinnedEvidenceIds: { ...state.pinnedEvidenceIds, [state.activeCaseId]: next } }
      }),
    }),
    {
      merge: (persisted, current) => ({ ...current, ...sanitizePersistedState(persisted) }),
      migrate: (persisted, version) => version < STORAGE_VERSION
        ? createInitialState()
        : sanitizePersistedState(persisted),
      name: 'receipts-please:workstation',
      partialize: (state) => ({
        activeApp: state.activeApp,
        activeCaseId: state.activeCaseId,
        auditTrail: state.auditTrail,
        cardStates: state.cardStates,
        closedCaseIds: state.closedCaseIds,
        completedActionsByCase: state.completedActionsByCase,
        decisionResults: state.decisionResults,
        decisions: state.decisions,
        pinnedEvidenceIds: state.pinnedEvidenceIds,
        rampUnlocked: state.rampUnlocked,
        receiptNotifications: state.receiptNotifications,
        receiptNotificationRun: state.receiptNotificationRun,
        session: state.session,
        submittedCaseIds: state.submittedCaseIds,
        unreadReceiptNotifications: state.unreadReceiptNotifications,
      }),
      storage: createJSONStorage(() => localStorage),
      version: STORAGE_VERSION,
    },
  ),
)
