import receiptCatalog from '../data/receipts/receipt-generation.json'

export type GameDecision = 'approve' | 'fire' | 'reject'
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
  source?: string
  tone?: 'good' | 'neutral' | 'risk'
  value: string
}

export type GameWorkflow = {
  automation: string
  connectedSystems: string[]
  exceptionReason: string
  policyCitation?: string
  requiredDeskTool?: 'calculator'
}

export type GameCase = CatalogCase & {
  actionLabels: Record<string, string>
  employee: string
  era: GameEra
  evidence: GameEvidence[]
  queueLabel: string
  workflow: GameWorkflow
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
  workflow: GameWorkflow
}> = {
  'manual-01-amount-mismatch': {
    employee: 'Maya Chen · Product Design',
    queueLabel: 'Amount mismatch',
    workflow: {
      automation: 'Receipt matching',
      connectedSystems: ['Transactions', 'Receipt viewer', 'Calculator'],
      exceptionReason: 'Receipt total and card transaction do not agree.',
      policyCitation: 'Receipts must match transaction amount, merchant, and date.',
    },
    evidence: [
      { source: 'Transactions', label: 'Card transaction', value: '$18.40', detail: 'Chopped · Jun 18 · Visa •••• 4812', tone: 'neutral' },
      { source: 'Receipt viewer', label: 'Submitted receipt', value: '$81.40', detail: 'Chopped · Jun 18 · photographed paper receipt', tone: 'neutral' },
      { source: 'Calculator', label: 'Receipt arithmetic', value: '$16.40 + $2.00', detail: 'Subtotal plus tax shown on the document.', tone: 'neutral' },
    ],
  },
  'manual-02-impossible-date': {
    employee: 'Rowan Kim · Summer Intern',
    queueLabel: 'Impossible date',
    workflow: {
      automation: 'Employee context',
      connectedSystems: ['Receipt viewer', 'People directory'],
      exceptionReason: 'The transaction predates the cardholder’s employment.',
      policyCitation: 'Card transactions must belong to an active employee.',
    },
    evidence: [
      { source: 'Receipt viewer', label: 'Receipt date', value: 'Jun 18', detail: 'Metro Cafe · card and receipt amounts agree.', tone: 'neutral' },
      { source: 'People directory', label: 'Employee profile', value: 'Started Jun 21', detail: 'Rowan Kim · Summer Intern · Active', tone: 'neutral' },
    ],
  },
  'manual-03-omakase-intern': {
    employee: 'Rowan Kim · Summer Intern',
    queueLabel: 'Omakase intern',
    workflow: {
      automation: 'Policy review',
      connectedSystems: ['Receipt viewer', 'Policy PDF', 'People directory'],
      exceptionReason: 'A one-person meal exceeds the company limit by $649.',
      policyCitation: 'Meals are limited to $35 per attendee.',
    },
    evidence: [
      { source: 'Receipt viewer', label: 'Meal receipt', value: '$684.00', detail: 'Omakase tasting menu · attendee: “Me”.', tone: 'neutral' },
      { source: 'Policy PDF', label: 'Meal policy', value: '$35 / attendee', detail: 'Section 4.2 · Business meals', tone: 'neutral' },
      { source: 'People directory', label: 'Employee profile', value: 'Summer Intern', detail: 'Rowan Kim · no direct reports · started Jun 21', tone: 'neutral' },
    ],
  },
  'manual-04-infinite-tip': {
    employee: 'Devon Lee · Partnerships',
    queueLabel: 'Infinite tip',
    workflow: {
      automation: 'Policy calculation',
      connectedSystems: ['Receipt viewer', 'Policy PDF', 'Calculator'],
      exceptionReason: 'The tip exceeds the configured review threshold.',
      policyCitation: 'Tips above 25% require review.',
      requiredDeskTool: 'calculator',
    },
    evidence: [
      { source: 'Receipt viewer', label: 'Meal subtotal', value: '$21.80', detail: 'Corner Diner · lunch special.', tone: 'neutral' },
      { source: 'Receipt viewer', label: 'Written tip', value: '$980.00', detail: 'Memo: “Investing in the relationship.”', tone: 'neutral' },
      { source: 'Policy PDF', label: 'Tip policy', value: 'Review above 25%', detail: 'Section 4.3 · Gratuity', tone: 'neutral' },
    ],
  },
  'manual-05-frankenstein-receipt': {
    employee: 'Alex Morgan · Sales',
    queueLabel: 'Frankenstein receipt',
    workflow: {
      automation: 'Document analysis',
      connectedSystems: ['Receipt viewer', 'Transactions', 'Card details'],
      exceptionReason: 'The submitted document contains inconsistent typography and layout.',
      policyCitation: 'Receipts must be authentic and match the card transaction.',
    },
    evidence: [
      { source: 'Receipt viewer', label: 'Document image', value: 'Zoom 175%', detail: 'Inspect merchant, tax, total, and card digits.', tone: 'neutral' },
      { source: 'Transactions', label: 'Card transaction', value: '$412.88', detail: 'Northstar Bistro · Visa •••• 1044', tone: 'neutral' },
      { source: 'Card details', label: 'Card on file', value: '•••• 1044', detail: 'Alex Morgan · Sales', tone: 'neutral' },
    ],
  },
  'manual-06-garbage-receipt': {
    employee: 'Sam Patel · IT Director',
    queueLabel: 'Garbage receipt',
    workflow: {
      automation: 'Submission requirements',
      connectedSystems: ['Receipt viewer', 'Transactions', 'Policy PDF'],
      exceptionReason: 'The document cannot establish a merchant, payment, or inventory trail.',
      policyCitation: 'Technology purchases require receipts and inventory records.',
    },
    evidence: [
      { source: 'Receipt viewer', label: 'Submitted document', value: 'Napkin photo', detail: '“7 laptop / $14,000 / paid / trust me”.', tone: 'neutral' },
      { source: 'Policy PDF', label: 'Technology policy', value: 'Inventory required', detail: 'Section 7.1 · Equipment purchases', tone: 'neutral' },
      { source: 'Transactions', label: 'Payment record', value: 'No match found', detail: 'Search: Dave · $14,000 · last 30 days', tone: 'neutral' },
    ],
  },
  'ramp-09-it-inventory-theft': {
    employee: 'Sam Patel · IT Director',
    queueLabel: 'Inventory theft',
    workflow: {
      automation: 'Connected exception review',
      connectedSystems: ['Cards', 'Purchase order', 'Inventory integration', 'Vendor records'],
      exceptionReason: 'Ramp connected the purchase trail to missing inventory and a related resale account.',
      policyCitation: 'Technology purchases require inventory records.',
    },
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
    workflow: {
      automation: 'Vendor approval review',
      connectedSystems: ['Vendor management', 'Approvals', 'Card transaction', 'Campaign record'],
      exceptionReason: 'The vendor is new, lacks legal approval, and shares an employee address.',
      policyCitation: 'New vendors above $10,000 require legal and finance approval.',
    },
    evidence: [
      { label: 'Payment', value: '$75,000', detail: 'One vibe-based activation.', tone: 'risk' },
      { label: 'Vendor', value: 'Created yesterday', detail: 'Address matches the director’s apartment.', tone: 'risk' },
      { label: 'Performance', value: '14 followers', detail: 'Campaign report contains three likes.', tone: 'risk' },
    ],
  },
  'ramp-11-travel-impossibility': {
    employee: 'Devon Lee · Partnerships',
    queueLabel: 'Travel impossibility',
    workflow: {
      automation: 'Trip matching',
      connectedSystems: ['Ramp Travel', 'Itinerary', 'Card transactions'],
      exceptionReason: 'Four charges conflict with the approved Chicago itinerary.',
      policyCitation: 'Travel expenses must match an approved trip.',
    },
    evidence: [
      { label: 'Approved trip', value: 'New York → Chicago', detail: 'June 18–20.', tone: 'good' },
      { label: 'Out of trip', value: 'Miami · Tokyo · Monaco', detail: 'Locations and times overlap impossibly.', tone: 'risk' },
      { label: 'Explanation', value: 'Long layover', detail: 'Does not account for four countries.', tone: 'neutral' },
    ],
  },
  'ramp-12-ai-expense-paradox': {
    employee: 'Alex Morgan · Sales',
    queueLabel: 'AI expense paradox',
    workflow: {
      automation: 'Spend analysis',
      connectedSystems: ['Card transaction', 'Vendor charges', 'Subscription controls'],
      exceptionReason: 'Automated review fees cost more than six times the underlying expense.',
      policyCitation: 'Recurring software spend requires a business owner and reviewable value.',
    },
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
    workflow: {
      automation: 'Three-way match',
      connectedSystems: ['Purchase order', 'Invoice', 'Receiving record', 'Inventory'],
      exceptionReason: 'PO, invoice, and delivery quantities do not match.',
      policyCitation: 'Invoices must match approved purchase orders and received goods.',
    },
    evidence: [
      { label: 'Purchase order', value: '100 chairs', detail: 'Approved ergonomic seating request.', tone: 'good' },
      { label: 'Invoice', value: '1,000 chairs', detail: 'Ten times the approved quantity.', tone: 'risk' },
      { label: 'Delivery', value: '1 beanbag', detail: 'Inventory: zero chairs.', tone: 'risk' },
    ],
  },
  'ramp-14-intern-card-catastrophe': {
    employee: 'Rowan Kim · Summer Intern',
    queueLabel: 'Intern card catastrophe',
    workflow: {
      automation: 'Card control exception',
      connectedSystems: ['Cards', 'Spend programs', 'Approval history', 'Transactions'],
      exceptionReason: 'Seven cards and a $40,000 limit conflict with the intern spend program.',
      policyCitation: 'Intern card limits may not exceed $500 per month.',
    },
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
    workflow: presentation.workflow,
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
