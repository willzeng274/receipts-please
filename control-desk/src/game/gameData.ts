import receiptCatalog from '../data/receipts/receipt-generation.json'

export type GameDecision = 'approve' | 'investigate' | 'reject'
export type GameEra = 'manual' | 'ramp'

type ReceiptAmounts = {
  calculatedTotalCents: number
  printedTotalCents: number
  subtotalCents: number
  taxCents: number
  tipCents: number
}

type ReceiptLine = {
  description: string
  lineTotalCents: number
  quantity: number
  unitPriceCents: number
}

type ReceiptDocument = {
  amounts: ReceiptAmounts
  anomalies: Array<{ type: string }>
  copy: Record<string, unknown>
  issuedAt: string
  lineItems: ReceiptLine[]
  merchant: { addressLines: string[]; name: string }
  payment: { cardLast4: string; method: string }
  receiptId: string
  visualTreatmentId: string
}

type CatalogCase = {
  caseId: string
  comparisonRecords: Record<string, unknown>
  receipt: ReceiptDocument
  sequence: number
  title: string
  truth: {
    calculatorOperation?: { resultDisplay: string }
    expectedDecision: GameDecision
    explanation: string
    primaryClue: string
    requiredActions?: string[]
    secondaryClue?: string | null
  }
}

export type GameEvidence = {
  detail: string
  label: string
  tone?: 'good' | 'neutral' | 'risk'
  value: string
}

export type GameCase = CatalogCase & {
  actionLabels: Record<string, string>
  employee: string
  era: GameEra
  evidence: GameEvidence[]
  queueLabel: string
}

const catalogCases = receiptCatalog.cases as CatalogCase[]

const PLAYABLE_CASE_IDS = [
  'manual-01-amount-mismatch',
  'manual-02-impossible-date',
  'manual-03-omakase-intern',
  'manual-04-infinite-tip',
  'manual-05-frankenstein-receipt',
  'manual-06-garbage-receipt',
  'ramp-09-it-inventory-theft',
  'ramp-10-influencer-marketing-deal',
  'ramp-11-travel-impossibility',
  'ramp-12-ai-expense-paradox',
  'ramp-13-procurement-mismatch',
  'ramp-14-intern-card-catastrophe',
] as const

const CASE_PRESENTATION: Record<string, {
  actionLabels?: Record<string, string>
  employee: string
  evidence: GameEvidence[]
  queueLabel: string
}> = {
  'manual-01-amount-mismatch': {
    employee: 'Maya Chen · Product Design',
    queueLabel: 'Amount mismatch',
    evidence: [
      { label: 'Transaction', value: '$18.40', detail: 'Chopped · Visa •••• 4812', tone: 'neutral' },
      { label: 'Receipt', value: '$81.40', detail: 'Leading digit has different ink density.', tone: 'risk' },
      { label: 'Arithmetic', value: '$18.40', detail: 'Subtotal plus tax without the overwritten digit.', tone: 'good' },
    ],
  },
  'manual-02-impossible-date': {
    employee: 'Rowan Kim · Summer Intern',
    queueLabel: 'Impossible date',
    evidence: [
      { label: 'Receipt date', value: 'Jun 18', detail: 'Metro Cafe · transaction matches.', tone: 'neutral' },
      { label: 'Start date', value: 'Jun 21', detail: 'Employee joined three days after the purchase.', tone: 'risk' },
    ],
  },
  'manual-03-omakase-intern': {
    employee: 'Rowan Kim · Summer Intern',
    queueLabel: 'Omakase intern',
    evidence: [
      { label: 'Meal', value: '$684.00', detail: 'One attendee: “Me”.', tone: 'risk' },
      { label: 'Policy PDF', value: '$35 / person', detail: 'Meals are limited per attendee.', tone: 'risk' },
      { label: 'Memo', value: 'Executive dinner', detail: 'Submitted by a summer intern dining alone.', tone: 'neutral' },
    ],
  },
  'manual-04-infinite-tip': {
    employee: 'Devon Lee · Partnerships',
    queueLabel: 'Infinite tip',
    evidence: [
      { label: 'Food', value: '$21.80', detail: 'Corner Diner lunch special.', tone: 'neutral' },
      { label: 'Tip', value: '$980.00', detail: 'Memo: Investing in the relationship.', tone: 'risk' },
      { label: 'Policy', value: '25%', detail: 'Tips above this threshold require review.', tone: 'risk' },
    ],
  },
  'manual-05-frankenstein-receipt': {
    employee: 'Alex Morgan · Sales',
    queueLabel: 'Frankenstein receipt',
    evidence: [
      { label: 'Merchant type', value: 'Helvetica', detail: 'Merchant uses a different source typeface.', tone: 'risk' },
      { label: 'Total type', value: 'Comic Sans', detail: 'Total and subtotal do not share typography.', tone: 'risk' },
      { label: 'Tax line', value: 'Rotated', detail: 'Baseline and card weight are inconsistent.', tone: 'risk' },
    ],
  },
  'manual-06-garbage-receipt': {
    employee: 'Sam Patel · IT Director',
    queueLabel: 'Garbage receipt',
    evidence: [
      { label: 'Document', value: 'Napkin photo', detail: '“7 laptop / $14,000 / paid / trust me”.', tone: 'risk' },
      { label: 'Policy', value: 'Inventory required', detail: 'Technology purchases need asset records.', tone: 'risk' },
      { label: 'Payment', value: 'Missing', detail: 'No card or authorization details on document.', tone: 'risk' },
    ],
  },
  'ramp-09-it-inventory-theft': {
    employee: 'Sam Patel · IT Director',
    queueLabel: 'Inventory theft',
    actionLabels: {
      'freeze-card': 'Freeze card',
      'flag-transaction': 'Flag transaction',
      'escalate-employee': 'Escalate employee',
    },
    evidence: [
      { label: 'MacBooks', value: '24 bought / 11 found', detail: '13 serial numbers missing.', tone: 'risk' },
      { label: 'Monitors', value: '40 bought / 19 found', detail: '21 units unaccounted for.', tone: 'risk' },
      { label: 'Resale account', value: 'Email match', detail: 'Seller email matches the IT director.', tone: 'risk' },
    ],
  },
  'ramp-10-influencer-marketing-deal': {
    employee: 'Nora Vale · Marketing',
    queueLabel: 'Influencer deal',
    evidence: [
      { label: 'Payment', value: '$75,000', detail: 'One vibe-based activation.', tone: 'risk' },
      { label: 'Vendor', value: 'Created yesterday', detail: 'Address matches the director’s apartment.', tone: 'risk' },
      { label: 'Performance', value: '14 followers', detail: 'Campaign report contains three likes.', tone: 'risk' },
    ],
  },
  'ramp-11-travel-impossibility': {
    employee: 'Devon Lee · Partnerships',
    queueLabel: 'Travel impossibility',
    evidence: [
      { label: 'Approved trip', value: 'New York → Chicago', detail: 'June 18–20.', tone: 'good' },
      { label: 'Out of trip', value: 'Miami · Tokyo · Monaco', detail: 'Locations and times overlap impossibly.', tone: 'risk' },
      { label: 'Explanation', value: 'Long layover', detail: 'Does not account for four countries.', tone: 'neutral' },
    ],
  },
  'ramp-12-ai-expense-paradox': {
    employee: 'Alex Morgan · Sales',
    queueLabel: 'AI expense paradox',
    actionLabels: {
      'approve-coffee': 'Approve coffee',
      'cancel-ai-vendor': 'Cancel AI vendor',
    },
    evidence: [
      { label: 'Coffee', value: '$8.50', detail: 'Legitimate client expense.', tone: 'good' },
      { label: 'AI review cost', value: '$51.50', detail: 'Six automated processing charges.', tone: 'risk' },
      { label: 'Final fee', value: '$3.20', detail: 'Cancellation-confirmation generation.', tone: 'risk' },
    ],
  },
  'ramp-13-procurement-mismatch': {
    employee: 'Priya Shah · Operations',
    queueLabel: 'Procurement mismatch',
    evidence: [
      { label: 'Purchase order', value: '100 chairs', detail: 'Approved ergonomic seating request.', tone: 'good' },
      { label: 'Invoice', value: '1,000 chairs', detail: 'Ten times the approved quantity.', tone: 'risk' },
      { label: 'Delivery', value: '1 beanbag', detail: 'Inventory: zero chairs.', tone: 'risk' },
    ],
  },
  'ramp-14-intern-card-catastrophe': {
    employee: 'Rowan Kim · Summer Intern',
    queueLabel: 'Intern card catastrophe',
    actionLabels: {
      'freeze-card': 'Freeze all seven cards',
      'escalate-approval': 'Escalate CEO approval',
    },
    evidence: [
      { label: 'Card profile', value: '7 active · $40k limit', detail: 'Policy limit is $500 per month.', tone: 'risk' },
      { label: 'Purchases', value: 'Forklift · alpaca', detail: 'Plus 600 hoodies and energy drinks.', tone: 'risk' },
      { label: 'Approval', value: 'CEO', detail: 'Reason: “Let them cook.”', tone: 'neutral' },
    ],
  },
}

export const GAME_CASES: readonly GameCase[] = PLAYABLE_CASE_IDS.map((caseId) => {
  const source = catalogCases.find((entry) => entry.caseId === caseId)
  const presentation = CASE_PRESENTATION[caseId]
  if (!source || !presentation) throw new Error(`Missing playable case data for ${caseId}`)
  return {
    ...source,
    ...presentation,
    actionLabels: presentation.actionLabels ?? {},
    era: caseId.startsWith('manual-') ? 'manual' : 'ramp',
  }
})

export const MANUAL_CASE_COUNT = GAME_CASES.filter((entry) => entry.era === 'manual').length
export const RAMP_CASE_COUNT = GAME_CASES.filter((entry) => entry.era === 'ramp').length
export const ENDING_CASE = catalogCases.find((entry) => entry.caseId === 'ending-15-giraffe-executive-hire')!

export function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-US', { currency: 'USD', style: 'currency' }).format(cents / 100)
}

export function formatReceiptDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}
