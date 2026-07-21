import {
  getPlayableReceiptCases,
  getReceiptCatalogCase,
  type ReceiptCatalogCase,
  type ReceiptDecision,
} from '../data/receipts/receiptCatalog'

export type GameDecision = ReceiptDecision
export type GameEra = 'manual' | 'ramp'

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
}

export type GameCase = ReceiptCatalogCase & {
  employee: string
  era: GameEra
  evidence: GameEvidence[]
  queueLabel: string
  workflow: GameWorkflow
}

const CASE_PRESENTATION: Record<string, {
  employee: string
  evidence: GameEvidence[]
  queueLabel: string
  workflow: GameWorkflow
}> = {
  'manual-01-amount-mismatch': {
    employee: 'Maya Chen · Product Design',
    queueLabel: 'Chopped lunch',
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
    queueLabel: 'Metro Cafe breakfast',
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
    queueLabel: 'Client dinner',
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
    queueLabel: 'Corner Diner lunch',
    workflow: {
      automation: 'Policy calculation',
      connectedSystems: ['Receipt viewer', 'Policy PDF', 'Calculator'],
      exceptionReason: 'The tip exceeds the configured review threshold.',
      policyCitation: 'Tips above 25% require review.',
    },
    evidence: [
      { source: 'Receipt viewer', label: 'Meal subtotal', value: '$21.80', detail: 'Corner Diner · lunch special.', tone: 'neutral' },
      { source: 'Receipt viewer', label: 'Written tip', value: '$980.00', detail: 'Memo: “Investing in the relationship.”', tone: 'neutral' },
      { source: 'Policy PDF', label: 'Tip policy', value: 'Review above 25%', detail: 'Section 4.3 · Gratuity', tone: 'neutral' },
    ],
  },
  'manual-05-frankenstein-receipt': {
    employee: 'Alex Morgan · Sales',
    queueLabel: 'Northstar Bistro dinner',
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
    queueLabel: 'IT equipment purchase',
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
  'manual-07-duplicate-receipt-ring': {
    employee: 'Rowan Kim · Operations Intern',
    queueLabel: 'Duplicate receipt ring',
    workflow: {
      automation: 'Duplicate detection',
      connectedSystems: ['Receipt viewer', 'Transactions', 'Slack'],
      exceptionReason: 'Three submissions reuse one receipt fingerprint with different crops and memos.',
      policyCitation: 'Duplicate receipts are prohibited.',
    },
    evidence: [
      { source: 'Receipt viewer', label: 'Receipt fingerprint', value: '3 exact matches', detail: 'Merchant, time, item lines, tax, and authorization code are identical.', tone: 'risk' },
      { source: 'Transactions', label: 'Submitted by', value: '3 cardholders', detail: 'Each copy uses a different crop, rotation, and memo.', tone: 'neutral' },
      { source: 'Slack', label: 'Finance thread', value: '“same offsite?”', detail: 'The three submitters describe different events.', tone: 'neutral' },
    ],
  },
  'manual-08-ai-generated-receipt': {
    employee: 'Alex Morgan · Sales',
    queueLabel: 'Synthetic receipt',
    workflow: {
      automation: 'Document analysis',
      connectedSystems: ['Receipt viewer', 'Transactions', 'Policy PDF'],
      exceptionReason: 'The receipt combines an impossible date, location, currency, and arithmetic.',
      policyCitation: 'Receipts must be authentic and match the transaction amount, merchant, and date.',
    },
    evidence: [
      { source: 'Receipt viewer', label: 'Printed date', value: 'Feb 31', detail: 'The date cannot exist.', tone: 'risk' },
      { source: 'Receipt viewer', label: 'Merchant address', value: 'Atlantic Ocean', detail: 'Payment copy also contains filler text and two currencies.', tone: 'risk' },
      { source: 'Transactions', label: 'Arithmetic check', value: '$5.00 mismatch', detail: 'The printed total does not equal subtotal plus tax.', tone: 'risk' },
    ],
  },
  'optional-01-taxi-location-mismatch': {
    employee: 'Devon Lee · Partnerships',
    queueLabel: 'Taxi during London trip',
    workflow: {
      automation: 'Travel matching',
      connectedSystems: ['Receipt viewer', 'Travel'],
      exceptionReason: 'The New York taxi charge conflicts with the employee’s approved London itinerary.',
      policyCitation: 'Travel expenses must match an approved trip.',
    },
    evidence: [
      { source: 'Receipt viewer', label: 'Taxi receipt', value: 'New York, NY', detail: 'Charged during the approved travel window.', tone: 'neutral' },
      { source: 'Travel', label: 'Approved itinerary', value: 'London, UK', detail: 'The employee was scheduled in London at the receipt time.', tone: 'risk' },
    ],
  },
  'manual-fire-self-approved-vendor': {
    employee: 'Jordan Blake · Finance Operations',
    queueLabel: 'Independent consultant invoice',
    workflow: {
      automation: 'Vendor ownership review',
      connectedSystems: ['Vendor W-9', 'People directory', 'Approval history'],
      exceptionReason: 'The employee approved a company payment to a vendor and bank account they own.',
      policyCitation: 'Employees may not approve payments to themselves or undisclosed related parties.',
    },
    evidence: [
      { source: 'Vendor W-9', label: 'Beneficial owner', value: 'Jordan Blake', detail: 'Totally Separate Consulting LLC · payout beneficiary: Jordan Blake · account •••• 0670.', tone: 'risk' },
      { source: 'People directory', label: 'Employee record', value: 'Jordan Blake', detail: 'Finance Operations Manager · home address: 44 Ledger Lane.', tone: 'risk' },
      { source: 'Approval history', label: 'Submitted + approved by', value: 'Jordan Blake', detail: 'Approval note: “Looks independent to me.”', tone: 'risk' },
    ],
  },
  'ramp-09-it-inventory-theft': {
    employee: 'William Zeng · IT Director',
    queueLabel: 'Technology supply invoice',
    workflow: {
      automation: 'Connected exception review',
      connectedSystems: ['Cards', 'Purchase order', 'Inventory integration', 'Vendor records'],
      exceptionReason: 'Ramp connected the purchase trail to missing inventory and a related resale account.',
      policyCitation: 'Technology purchases require inventory records.',
    },
    evidence: [
      { label: 'MacBooks', value: '24 bought / 11 found', detail: '13 serial numbers missing.', tone: 'risk' },
      { label: 'Monitors', value: '40 bought / 19 found', detail: '21 units unaccounted for.', tone: 'risk' },
      { label: 'Resale account', value: 'Email match', detail: 'Seller email matches the IT director.', tone: 'risk' },
    ],
  },
  'ramp-10-influencer-marketing-deal': {
    employee: 'William Zeng · Marketing',
    queueLabel: 'Marketing vendor invoice',
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
    queueLabel: 'Chicago business trip',
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
    queueLabel: 'Client coffee',
    workflow: {
      automation: 'Spend analysis',
      connectedSystems: ['Card transaction', 'Vendor charges', 'Subscription controls'],
      exceptionReason: 'Automated review fees cost more than six times the underlying expense.',
      policyCitation: 'Recurring software spend requires a business owner and reviewable value.',
    },
    evidence: [
      { label: 'Coffee', value: '$8.50', detail: 'Legitimate client expense.', tone: 'good' },
      { label: 'AI review cost', value: '$51.50', detail: 'Six automated processing charges.', tone: 'risk' },
      { label: 'Final fee', value: '$3.20', detail: 'Cancellation-confirmation generation.', tone: 'risk' },
    ],
  },
  'ramp-13-procurement-mismatch': {
    employee: 'Priya Shah · Operations',
    queueLabel: 'Office furniture invoice',
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
    queueLabel: 'Employee engagement purchase',
    workflow: {
      automation: 'Card control exception',
      connectedSystems: ['Cards', 'Spend programs', 'Approval history', 'Transactions'],
      exceptionReason: 'Seven cards and a $40,000 limit conflict with the intern spend program.',
      policyCitation: 'Intern card limits may not exceed $500 per month.',
    },
    evidence: [
      { label: 'Card profile', value: '7 active · $40k limit', detail: 'Policy limit is $500 per month.', tone: 'risk' },
      { label: 'Purchases', value: 'Forklift · alpaca', detail: 'Plus 600 hoodies and energy drinks.', tone: 'risk' },
      { label: 'Approval', value: 'CEO', detail: 'Reason: “Let them cook.”', tone: 'neutral' },
    ],
  },
  'manual-02-client-dinner-clean': {
    employee: 'Maya Chen · Product Design',
    queueLabel: 'Birch Table dinner',
    workflow: {
      automation: 'Policy and approval match',
      connectedSystems: ['Card transaction', 'Attendees', 'Approval history', 'Policy'],
      exceptionReason: 'Routine sample selected for verification.',
      policyCitation: 'Client meals are allowed with named attendees, business purpose, and approval.',
    },
    evidence: [
      { source: 'Transactions', label: 'Card match', value: '$319.61', detail: 'Merchant, amount, and card digits match.', tone: 'good' },
      { source: 'Transactions', label: 'Attendees', value: '4 named', detail: '$79.90 per person · below the $100 limit.', tone: 'good' },
      { source: 'Transactions', label: 'Approval', value: 'VP Sales approved', detail: 'Purpose: Acme renewal dinner.', tone: 'good' },
    ],
  },
  'manual-04-laptop-three-way-match': {
    employee: 'Maya Chen · Product Design',
    queueLabel: 'New-hire laptop',
    workflow: {
      automation: 'Three-way match',
      connectedSystems: ['Purchase order', 'Invoice', 'Delivery', 'Inventory'],
      exceptionReason: 'Routine sample selected for verification.',
      policyCitation: 'Equipment invoices must match an approved PO and inventory record.',
    },
    evidence: [
      { label: 'Purchase order', value: '1 laptop · approved', detail: 'PO-24117 · $1,800.', tone: 'good' },
      { label: 'Delivery', value: '1 received', detail: 'Received by Maya Chen.', tone: 'good' },
      { label: 'Inventory', value: 'RP-2048', detail: 'Serial recorded and assigned to Maya.', tone: 'good' },
    ],
  },
  'ramp-15-hotel-trip-match': {
    employee: 'Devon Lee · Partnerships',
    queueLabel: 'Boston hotel stay',
    workflow: {
      automation: 'Trip matching',
      connectedSystems: ['Ramp Travel', 'Hotel booking', 'Card transaction'],
      exceptionReason: 'Routine sample selected for verification.',
      policyCitation: 'Travel expenses must match an approved itinerary and booking.',
    },
    evidence: [
      { label: 'Approved trip', value: 'New York → Boston', detail: 'July 15–17 · approved.', tone: 'good' },
      { label: 'Hotel booking', value: '2 nights · $649.72', detail: 'Harbor Hotel Boston.', tone: 'good' },
      { label: 'Card match', value: '$649.72', detail: 'Merchant, amount, and card digits match.', tone: 'good' },
    ],
  },
}

export const GAME_CASES: readonly GameCase[] = getPlayableReceiptCases().map((source) => {
  const presentation = CASE_PRESENTATION[source.caseId]
  if (!presentation) throw new Error(`Missing playable case presentation for ${source.caseId}`)
  return {
    ...source,
    ...presentation,
    era: source.caseId.startsWith('ramp-') ? 'ramp' : 'manual',
    workflow: presentation.workflow,
  }
})

export const MANUAL_CASE_COUNT = GAME_CASES.filter((entry) => entry.era === 'manual').length
export const RAMP_CASE_COUNT = GAME_CASES.filter((entry) => entry.era === 'ramp').length
export const ENDING_CASE = getReceiptCatalogCase('ending-15-giraffe-executive-hire')

export function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-US', { currency: 'USD', style: 'currency' }).format(cents / 100)
}

export function formatReceiptDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}
