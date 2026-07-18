import type { AppId } from './workstationData'

export type WorkstationCasePhase = 'manual' | 'ramp'

export type WorkstationCaseId =
  | 'manual-01-amount-mismatch'
  | 'manual-02-impossible-date'
  | 'manual-03-omakase-intern'
  | 'manual-04-infinite-tip'
  | 'manual-05-frankenstein-receipt'
  | 'manual-06-garbage-receipt'
  | 'ramp-09-it-inventory-theft'
  | 'ramp-10-influencer-marketing-deal'
  | 'ramp-11-travel-impossibility'
  | 'ramp-12-ai-expense-paradox'
  | 'ramp-13-procurement-mismatch'
  | 'ramp-14-intern-card-catastrophe'

export type WorkstationDecision =
  | 'review'
  | 'approve'
  | 'reject'
  | 'investigate'
  | 'request-receipt'

export type WorkstationFinalDecision = Exclude<WorkstationDecision, 'review'>

export type WorkstationRequiredAction =
  | 'freeze-card'
  | 'flag-transaction'
  | 'escalate-employee'
  | 'approve-coffee'
  | 'cancel-ai-vendor'
  | 'escalate-approval'

export type WorkstationSceneEventId =
  | 'decision.approve'
  | 'decision.reject'
  | 'decision.fraud'
  | 'card.freeze'
  | 'receipt.submitted'

export type EvidenceTone = 'good' | 'neutral' | 'risk'

export type WorkstationEvidence = {
  detail: string
  id: string
  label: string
  sourceApp: AppId
  tone: EvidenceTone
  value: string
}

export type WorkstationCharge = {
  amount: string
  evidenceId: string
  location: string
  merchant: string
  status: 'matched' | 'risk'
  time: string
}

export type WorkstationNotice = {
  app: AppId
  detail: string
  id: string
  title: string
  urgent?: boolean
}

export type WorkstationReceiptStain = {
  kind: 'coffee-ring' | 'finger-smudge' | 'grease' | 'salsa'
  opacity: number
  rotation: number
  size: number
  x: number
  y: number
}

export type WorkstationReceiptVisual = {
  blurPx: number
  contrast: number
  creases: readonly {
    axis: 'diagonal' | 'horizontal' | 'vertical'
    positionRatio: number
    strength: number
  }[]
  rotationDegrees: number
  stains: readonly WorkstationReceiptStain[]
  templateId: string
  thermalFade: number
}

export type WorkstationReceiptNotification = Readonly<{
  amount: string
  caseId: WorkstationCaseId
  createdAt: number
  employeeName: string
  id: number
  merchant: string
  receiptId: string
}>

export type WorkstationCalculatorEvidence = {
  evidenceId: string
  expression: string
  finding: string
  result: string
  title: string
}

export type WorkstationCard = {
  activeCardCount?: number
  id: string
  last4: string
  monthlyLimit: string
}

export type WorkstationDecisionValidation = {
  acceptedDecisions: readonly WorkstationFinalDecision[]
  expectedDecision: WorkstationFinalDecision
  explanation: string
  points: number
  requiredActions?: readonly WorkstationRequiredAction[]
  requiredEvidenceIds: readonly string[]
}

export type WorkstationCase = {
  amount: string
  calculator?: WorkstationCalculatorEvidence
  card: WorkstationCard
  caseNumber: string
  employee: {
    department?: string
    employmentStatus?: string
    initials: string
    location: string
    monthlySpend?: string
    name: string
    role: string
    startDate?: string
  }
  evidence: readonly WorkstationEvidence[]
  id: WorkstationCaseId
  itinerary?: {
    destination: string
    endDate: string
    origin: string
    startDate: string
  }
  merchant: string
  notices: readonly WorkstationNotice[]
  phase: WorkstationCasePhase
  policy: {
    evidenceId: string
    rule: string
  }
  primaryApps: readonly AppId[]
  ramp: {
    explanation: string
    recommendation: string
    summary: string
    title: string
  }
  receipt: {
    cardLast4: string
    evidenceId: string
    issuedAt: string
    lineItem: string
    lineItems: readonly string[]
    printedTotal: string
    rows: readonly {
      label: string
      tone?: EvidenceTone
      value: string
    }[]
    subtotal: string
    tax: string
    visual: WorkstationReceiptVisual
  }
  sequence: number
  source: {
    catalogCaseId: WorkstationCaseId
    catalogId: 'receipt-cases-v1'
    receiptId: string
    seed: string
    variantId: string
  }
  suggestedDecision: WorkstationFinalDecision
  title: string
  transaction: {
    amount: string
    category: string
    evidenceId: string
    memo: string
    occurredAt: string
  }
  travelCharges?: readonly WorkstationCharge[]
  validation: WorkstationDecisionValidation
}

export type WorkstationDecisionResult = Readonly<{
  decidedAt: number
  decision: WorkstationFinalDecision
  evidenceComplete: boolean
  isCorrect: boolean
  missingEvidenceIds: readonly string[]
  missingRequiredActions: readonly WorkstationRequiredAction[]
  requiredActionsComplete: boolean
  scoreDelta: number
}>

export type WorkstationAuditEvent = Readonly<{
  caseId: WorkstationCaseId
  createdAt: number
  decision: WorkstationDecision
  evidenceIds: readonly string[]
  id: number
  isCorrect: boolean | null
  label: string
  scoreDelta: number
}>

export type WorkstationCardState = Readonly<{
  frozen: boolean
  updatedAt: number
}>

export type WorkstationQueueCounts = Readonly<{
  completed: number
  open: number
  total: number
}>

export type WorkstationSessionStatus = 'idle' | 'running' | 'paused' | 'expired' | 'complete'

export type WorkstationSession = {
  bestStreak: number
  correctCount: number
  durationMs: number
  elapsedMs: number
  endedAt: number | null
  incorrectCount: number
  lastSyncedAt: number | null
  remainingMs: number
  score: number
  startedAt: number | null
  status: WorkstationSessionStatus
  streak: number
}

export type WorkstationSceneEvent = {
  id: WorkstationSceneEventId
  run: number
}

export type WorkstationStampedDecisionRequest = Readonly<{
  decision: WorkstationFinalDecision
  run: number
}>
