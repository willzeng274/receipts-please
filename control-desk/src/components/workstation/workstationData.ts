import type { EffectPreset } from '../../store/useLabStore'
import { WORKSTATION_CASES_BY_ID } from './caseFixtures'

export { INITIAL_CALCULATOR, updateCalculator } from '../../calculator'
export type { CalculatorState } from '../../calculator'

export type WorkstationPhase = 'manual' | 'ramp'

export type AppId =
  | 'expenses'
  | 'transactions'
  | 'people'
  | 'slack'
  | 'policy'
  | 'travel'
  | 'inventory'
  | 'vendor'
  | 'cards'
  | 'calculator'

export type AppDefinition = {
  id: AppId
  label: string
  shortLabel: string
}

export type Notice = {
  app: AppId
  detail: string
  id: string
  title: string
  urgent?: boolean
}

export type PresentationTone = 'good' | 'neutral' | 'risk'

export type PresentationField = {
  label: string
  tone?: PresentationTone
  value: string
}

export type SlackMessage = {
  body: string
  sender: string
  time: string
  tone?: PresentationTone
}

export type CasePresentation = {
  appSummaries: Partial<Record<AppId, string>>
  comparison: {
    leftLabel: string
    leftValue: string
    relation: string
    rightLabel: string
    rightValue: string
  }
  employee: {
    activeCards: string
    approvalHistory: string
    manager: string
    recentAnomaly: string
  }
  inventory?: {
    columns: readonly string[]
    note: string
    rows: readonly (readonly PresentationField[])[]
    status: string
    title: string
  }
  queueHint: string
  receiptRows?: readonly PresentationField[]
  slack: {
    channel: string
    messages: readonly SlackMessage[]
  }
  vendor?: {
    fields: readonly PresentationField[]
    status: string
    title: string
    tone: PresentationTone
    warning: string
  }
}

export const MANUAL_APPS: readonly AppDefinition[] = [
  { id: 'expenses', label: 'Expense inbox', shortLabel: 'EX' },
  { id: 'transactions', label: 'Transactions', shortLabel: 'TX' },
  { id: 'people', label: 'Employee directory', shortLabel: 'PE' },
  { id: 'slack', label: 'Slack', shortLabel: 'SL' },
  { id: 'policy', label: 'Policy PDF', shortLabel: 'PDF' },
  { id: 'travel', label: 'Travel portal', shortLabel: 'TR' },
  { id: 'inventory', label: 'Inventory sheet', shortLabel: 'IV' },
  { id: 'calculator', label: 'Desk calculator', shortLabel: '42' },
]

// Ramp keeps source records available. Evidence links never open an app that the dock then closes.
export const RAMP_APPS: readonly AppDefinition[] = [
  { id: 'expenses', label: 'Review queue', shortLabel: 'EX' },
  { id: 'transactions', label: 'Transactions', shortLabel: 'TX' },
  { id: 'people', label: 'Spend profile', shortLabel: 'PE' },
  { id: 'travel', label: 'Travel', shortLabel: 'TR' },
  { id: 'vendor', label: 'Vendors', shortLabel: 'VN' },
  { id: 'inventory', label: 'Procurement', shortLabel: 'PO' },
  { id: 'cards', label: 'Cards', shortLabel: 'CD' },
  { id: 'policy', label: 'Policy', shortLabel: 'PL' },
  { id: 'slack', label: 'Slack summary', shortLabel: 'SL' },
  { id: 'calculator', label: 'Calculator', shortLabel: '42' },
]

export const POLICY_RULES = [
  'Meals are limited to $35 per attendee',
  'Tips above 25 percent require review',
  'Travel expenses must match an approved trip',
  'Technology purchases require inventory records',
  'New vendors above $10,000 require legal and finance approval',
  'Intern card limits may not exceed $500 per month',
  'Receipts must match transaction amount, merchant, and date',
  'Duplicate receipts are prohibited',
  'Personal purchases are prohibited',
  'Livestock requires executive and facilities approval',
] as const

const DEFAULT_PRESENTATION: CasePresentation = {
  appSummaries: {},
  comparison: {
    leftLabel: 'Transaction',
    leftValue: 'Open record',
    relation: 'vs',
    rightLabel: 'Receipt',
    rightValue: 'Inspect document',
  },
  employee: {
    activeCards: '1 active',
    approvalHistory: 'No prior exceptions',
    manager: 'Finance directory',
    recentAnomaly: 'None before this case',
  },
  queueHint: 'Open the source records and pin the evidence that supports your decision.',
  slack: {
    channel: 'finance-ops',
    messages: [{ body: 'Need these cleared before lunch.', sender: 'Finance Ops', time: '11:51' }],
  },
}

export const CASE_PRESENTATIONS: Readonly<Record<string, CasePresentation>> = {
  'manual-01-amount-mismatch': {
    ...DEFAULT_PRESENTATION,
    appSummaries: { calculator: '$81.40 - $18.40', policy: 'Amount, merchant, date', transactions: '$18.40 cleared' },
    comparison: { leftLabel: 'Card', leftValue: '$18.40', relation: 'does not match', rightLabel: 'Receipt', rightValue: '$81.40' },
    queueHint: 'The merchant and time agree. Compare the two totals and inspect the first digit.',
    receiptRows: [
      { label: 'Subtotal', value: '$16.40' },
      { label: 'Tax', value: '$2.00' },
      { label: 'Total', tone: 'risk', value: '$81.40' },
    ],
    slack: { channel: 'finance-ops', messages: [{ body: 'Need these cleared before lunch. Inbox says 47 now.', sender: 'Nora / Finance Ops', time: '11:51', tone: 'risk' }] },
  },
  'manual-02-impossible-date': {
    ...DEFAULT_PRESENTATION,
    appSummaries: { people: 'Start date: Jun 21', slack: 'New-hire thread', transactions: 'Jun 18 purchase' },
    comparison: { leftLabel: 'Purchase', leftValue: 'Jun 18', relation: '3 days before', rightLabel: 'Start date', rightValue: 'Jun 21' },
    employee: { activeCards: '1 newly issued', approvalHistory: 'No prior expenses', manager: 'Avery Stone', recentAnomaly: 'Purchase predates employment' },
    queueHint: 'The receipt and transaction match. Check whether the employee could have made it.',
    receiptRows: [{ label: 'Subtotal', value: '$40.40' }, { label: 'Tax', value: '$3.59' }, { label: 'Total', value: '$43.99' }],
    slack: { channel: 'new-hires', messages: [{ body: 'Rowan starts Monday. Please make sure card access is ready then.', sender: 'People Ops', time: '09:04' }] },
  },
  'manual-03-omakase-intern': {
    ...DEFAULT_PRESENTATION,
    appSummaries: { calculator: '$684 / 1 attendee', people: 'Summer intern', policy: '$35 per attendee', slack: 'Attendees: Me' },
    comparison: { leftLabel: 'Meal total', leftValue: '$684.00', relation: 'exceeds', rightLabel: '1-person limit', rightValue: '$35.00' },
    employee: { activeCards: '1 active', approvalHistory: 'No meal exceptions', manager: 'Avery Stone', recentAnomaly: 'First executive dinner' },
    queueHint: 'Check the employee role, attendee list, and meal limit together.',
    receiptRows: [{ label: 'Food + pairing', value: '$570.00' }, { label: 'Tax + tip', value: '$114.00' }, { label: 'Total / 1 attendee', tone: 'risk', value: '$684.00' }],
    slack: { channel: 'dm-rowan-kim', messages: [{ body: 'Executive relationship dinner. Attendees: me.', sender: 'Rowan Kim', time: '22:01', tone: 'risk' }] },
  },
  'manual-04-infinite-tip': {
    ...DEFAULT_PRESENTATION,
    appSummaries: { calculator: '$980 / $21.80', policy: 'Tips above 25%', transactions: '$1,001.80 cleared' },
    comparison: { leftLabel: 'Tip', leftValue: '4,495%', relation: 'exceeds', rightLabel: 'Review threshold', rightValue: '25%' },
    employee: { activeCards: '2 active', approvalHistory: '3 client meals approved', manager: 'Leah Ward', recentAnomaly: '$980 tip' },
    queueHint: 'The charge is real. Use the calculator to test the tip against policy.',
    receiptRows: [{ label: 'Food', value: '$21.80' }, { label: 'Tip', tone: 'risk', value: '$980.00' }, { label: 'Total', value: '$1,001.80' }],
    slack: { channel: 'dm-devon-lee', messages: [{ body: 'The tip was an investment in the relationship.', sender: 'Devon Lee', time: '13:10', tone: 'risk' }] },
  },
  'manual-05-frankenstein-receipt': {
    ...DEFAULT_PRESENTATION,
    appSummaries: { people: 'Normal spend profile', transactions: '$140.45 cleared' },
    comparison: { leftLabel: 'Transaction', leftValue: '$140.45', relation: 'matches amount, not', rightLabel: 'Document', rightValue: '5 type styles' },
    employee: { activeCards: '1 active', approvalHistory: '12 client meals approved', manager: 'Leah Ward', recentAnomaly: 'Receipt image edited' },
    queueHint: 'The arithmetic matches. Inspect the typography and pin two suspicious regions.',
    receiptRows: [{ label: 'Subtotal / Times', tone: 'risk', value: '$109.00' }, { label: 'Tax / tilted', tone: 'risk', value: '$9.67' }, { label: 'Total / Comic', tone: 'risk', value: '$140.45' }],
    slack: { channel: 'finance-ops', messages: [{ body: 'Why does this receipt have a design system?', sender: 'Nora / Finance Ops', time: '19:30' }] },
  },
  'manual-06-garbage-receipt': {
    ...DEFAULT_PRESENTATION,
    appSummaries: { inventory: 'No serials attached', policy: 'Technology needs inventory', slack: 'IT says trust me', transactions: '$14,000 technology' },
    comparison: { leftLabel: 'Claimed', leftValue: '7 laptops', relation: 'with', rightLabel: 'Inventory records', rightValue: '0 attached' },
    employee: { activeCards: '3 active', approvalHistory: 'IT refresh approved', manager: 'COO', recentAnomaly: 'No serial numbers' },
    inventory: {
      columns: ['Asset', 'Submitted', 'Assigned', 'Serials'],
      note: 'No receiving record or assigned employee was found for this purchase.',
      rows: [[{ label: 'Asset', value: 'Laptop' }, { label: 'Submitted', value: '7' }, { label: 'Assigned', tone: 'risk', value: '0' }, { label: 'Serials', tone: 'risk', value: 'Missing' }]],
      status: 'No match',
      title: 'Technology intake lookup',
    },
    queueHint: 'A napkin is not an inventory record. Check technology intake before deciding.',
    receiptRows: [{ label: 'Item', value: '7 laptop' }, { label: 'Total', tone: 'risk', value: '$14,000' }, { label: 'Payment', tone: 'risk', value: 'paid / trust me' }],
    slack: { channel: 'it-inventory', messages: [{ body: 'I can send serials later. Probably.', sender: 'Sam Patel', time: '16:14', tone: 'risk' }] },
  },
  'ramp-09-it-inventory-theft': {
    ...DEFAULT_PRESENTATION,
    appSummaries: { cards: 'Freeze available', inventory: '34 devices missing', people: 'IT director profile', transactions: '$74,000 invoice', vendor: 'Resale owner matched' },
    comparison: { leftLabel: 'Purchased', leftValue: '24 MacBooks', relation: 'connected to', rightLabel: 'Counted', rightValue: '11 MacBooks' },
    employee: { activeCards: '3 active', approvalHistory: 'IT refresh approved', manager: 'COO', recentAnomaly: 'Resale email match' },
    inventory: {
      columns: ['Asset', 'Purchased', 'Counted', 'Variance'],
      note: 'Keyboard count was imported by weight. Thirteen MacBook serial numbers are missing.',
      rows: [
        [{ label: 'Asset', value: 'MacBooks' }, { label: 'Purchased', value: '24' }, { label: 'Counted', value: '11' }, { label: 'Variance', tone: 'risk', value: '-13' }],
        [{ label: 'Asset', value: 'Monitors' }, { label: 'Purchased', value: '40' }, { label: 'Counted', value: '19' }, { label: 'Variance', tone: 'risk', value: '-21' }],
        [{ label: 'Asset', value: 'Keyboards' }, { label: 'Purchased', value: '90' }, { label: 'Counted', value: '143' }, { label: 'Variance', value: '+53*' }],
      ],
      status: '34 missing',
      title: 'PO 24001 / asset reconciliation',
    },
    queueHint: 'Connect the invoice, physical count, missing serials, and resale account owner.',
    slack: { channel: 'it-inventory', messages: [{ body: 'The keyboard count may have been imported by weight.', sender: 'Inventory Bot', time: '10:18' }] },
    vendor: {
      fields: [{ label: 'Created', tone: 'risk', value: '2 days ago' }, { label: 'Owner email', tone: 'risk', value: 'sam.patel@company.example' }, { label: 'Company spend', value: '$0 prior' }, { label: 'Bank details', tone: 'risk', value: 'Employee match' }],
      status: 'Employee linked',
      title: 'Metro Device Resale',
      tone: 'risk',
      warning: 'The resale account owner email matches the IT director on this case.',
    },
  },
  'ramp-10-influencer-marketing-deal': {
    ...DEFAULT_PRESENTATION,
    appSummaries: { calculator: '$75,000 / 14', people: 'Address match', policy: 'Legal + finance required', vendor: 'Created yesterday' },
    comparison: { leftLabel: 'Campaign spend', leftValue: '$75,000', relation: 'produced', rightLabel: 'Report', rightValue: '3 likes' },
    employee: { activeCards: '1 active', approvalHistory: 'Legal approval missing', manager: 'VP Marketing', recentAnomaly: 'Home address match' },
    queueHint: 'The deliverable is vague. Check vendor identity, approval status, and results.',
    slack: { channel: 'marketing-approvals', messages: [{ body: 'Legal is not blocking the vibe, right?', sender: 'Marketing', time: '09:12', tone: 'risk' }] },
    vendor: {
      fields: [{ label: 'Created', tone: 'risk', value: 'Yesterday' }, { label: 'Address', tone: 'risk', value: 'Employee apartment' }, { label: 'Followers', value: '14 (8 employee-owned)' }, { label: 'Legal approval', tone: 'risk', value: 'Missing' }],
      status: 'High risk',
      title: 'SynergyAlphaWolf Media LLC',
      tone: 'risk',
      warning: 'A new $75,000 vendor shares the marketing director\'s address and has no legal approval.',
    },
  },
  'ramp-11-travel-impossibility': {
    ...DEFAULT_PRESENTATION,
    appSummaries: { calculator: '$4,910.37 out of trip', travel: '5 cities mapped', transactions: '4 out of trip', vendor: 'Merchant locations connected' },
    comparison: { leftLabel: 'Approved trip', leftValue: 'Chicago', relation: 'conflicts with', rightLabel: 'Submitted charges', rightValue: '4 cities' },
    employee: { activeCards: '2 active', approvalHistory: 'Chicago trip approved', manager: 'VP Sales', recentAnomaly: 'Overlapping locations' },
    queueHint: 'Use the itinerary as the anchor, then inspect every out-of-trip charge.',
    slack: { channel: 'travel-help', messages: [{ body: 'Long layover.', sender: 'Alex Rivera', time: '11:47', tone: 'risk' }] },
    vendor: {
      fields: [{ label: 'Merchants', value: '5' }, { label: 'Locations', tone: 'risk', value: '5 cities' }, { label: 'Approved', value: 'Chicago only' }, { label: 'Time overlap', tone: 'risk', value: 'Detected' }],
      status: 'Location risk',
      title: 'Travel merchant network',
      tone: 'risk',
      warning: 'Four known merchants are outside the approved trip location and dates.',
    },
  },
  'ramp-12-ai-expense-paradox': {
    ...DEFAULT_PRESENTATION,
    appSummaries: { calculator: '$51.50 / $8.50', policy: 'Coffee is in policy', transactions: '6 processing charges', vendor: 'Cancel vendor' },
    comparison: { leftLabel: 'Coffee', leftValue: '$8.50', relation: 'generated', rightLabel: 'Review cost', rightValue: '$51.50' },
    employee: { activeCards: '1 active', approvalHistory: 'Coffee spend normal', manager: 'Customer Success VP', recentAnomaly: 'None; vendor is the issue' },
    queueHint: 'Separate the legitimate coffee from the vendor charges created to review it.',
    slack: { channel: 'finance-automation', messages: [{ body: 'The AI agent reviewed the AI summary of the AI review.', sender: 'Automation Bot', time: '10:21' }] },
    vendor: {
      fields: [{ label: 'Original expense', value: '$8.50' }, { label: 'Processing fees', tone: 'risk', value: '$51.50' }, { label: 'Fee ratio', tone: 'risk', value: '6.06x' }, { label: 'Cancel fee', tone: 'risk', value: '$3.20' }],
      status: 'Cost anomaly',
      title: 'AutoExpense Intelligence',
      tone: 'risk',
      warning: 'The coffee is legitimate. This vendor costs six times more than the expense it reviews.',
    },
  },
  'ramp-13-procurement-mismatch': {
    ...DEFAULT_PRESENTATION,
    appSummaries: { calculator: '1,000 - 1', inventory: 'PO / invoice / delivery', policy: 'Technology and inventory', vendor: 'Contract active' },
    comparison: { leftLabel: 'Invoice', leftValue: '1,000 chairs', relation: 'delivered as', rightLabel: 'Receiving', rightValue: '1 beanbag' },
    employee: { activeCards: '1 purchasing card', approvalHistory: 'PO approved for 100', manager: 'Facilities VP', recentAnomaly: '900-unit invoice overage' },
    inventory: {
      columns: ['Record', 'Item', 'Quantity', 'Status'],
      note: 'The memo says "Phased rollout." Inventory currently contains one suspiciously expensive beanbag.',
      rows: [
        [{ label: 'Record', value: 'Purchase order' }, { label: 'Item', value: 'Ergonomic chair' }, { label: 'Quantity', value: '100' }, { label: 'Status', tone: 'good', value: 'Approved' }],
        [{ label: 'Record', value: 'Invoice' }, { label: 'Item', value: 'Ergonomic chair' }, { label: 'Quantity', tone: 'risk', value: '1,000' }, { label: 'Status', tone: 'risk', value: 'Mismatch' }],
        [{ label: 'Record', value: 'Delivery' }, { label: 'Item', tone: 'risk', value: 'Beanbag' }, { label: 'Quantity', tone: 'risk', value: '1' }, { label: 'Status', tone: 'risk', value: 'Received' }],
        [{ label: 'Record', value: 'Inventory' }, { label: 'Item', value: 'Chairs / beanbags' }, { label: 'Quantity', tone: 'risk', value: '0 / 1' }, { label: 'Status', tone: 'risk', value: 'Unreconciled' }],
      ],
      status: '999 missing',
      title: 'PO-CHAIR-100 reconciliation',
    },
    queueHint: 'Compare the request, purchase order, invoice, delivery, and inventory in order.',
    slack: { channel: 'workplace-ops', messages: [{ body: 'The beanbag is phase one.', sender: 'Facilities', time: '09:41', tone: 'risk' }] },
    vendor: {
      fields: [{ label: 'Contract', value: 'Active' }, { label: 'PO quantity', value: '100' }, { label: 'Invoice quantity', tone: 'risk', value: '1,000' }, { label: 'Delivered', tone: 'risk', value: '1 beanbag' }],
      status: 'Quantity risk',
      title: 'Ergodynamic Office Systems',
      tone: 'risk',
      warning: 'The vendor invoice is formally valid but does not match the approved PO or delivery record.',
    },
  },
}

export function getCasePresentation(caseId: string): CasePresentation {
  return CASE_PRESENTATIONS[caseId] ?? DEFAULT_PRESENTATION
}

export function getCaseNotices(
  caseId: keyof typeof WORKSTATION_CASES_BY_ID,
  phase: WorkstationPhase,
): readonly Notice[]
export function getCaseNotices(
  activeCase: { notices: readonly Notice[]; phase: WorkstationPhase },
  phase: WorkstationPhase,
): readonly Notice[]
export function getCaseNotices(
  caseOrId: keyof typeof WORKSTATION_CASES_BY_ID | { notices: readonly Notice[]; phase: WorkstationPhase },
  phase: WorkstationPhase,
): readonly Notice[] {
  const activeCase = typeof caseOrId === 'string' ? WORKSTATION_CASES_BY_ID[caseOrId] : caseOrId
  return activeCase.phase === phase ? activeCase.notices : []
}

export function getPhaseApps(phase: WorkstationPhase) {
  return phase === 'ramp' ? RAMP_APPS : MANUAL_APPS
}

export function getAppLabel(app: AppId, phase: WorkstationPhase) {
  return getPhaseApps(phase).find((definition) => definition.id === app)?.label
    ?? MANUAL_APPS.find((definition) => definition.id === app)?.label
    ?? app
}

export function resolveEvidenceApp(app: AppId, phase: WorkstationPhase): AppId {
  return getPhaseApps(phase).some((definition) => definition.id === app) ? app : 'expenses'
}

// Compatibility exports for the shell while it migrates to getCaseNotices(activeCase, phase).
export const MANUAL_NOTICES: readonly Notice[] = []
export const RAMP_NOTICES: readonly Notice[] = []

export const EFFECT_COPY: Record<EffectPreset, string> = {
  'paper-drop': 'Receipt received - inbox updated',
  approve: 'Decision saved - audit trail updated',
  reject: 'Expense returned - employee notified',
  fraud: 'High-risk pattern connected - controls ready',
  'printer-jam': 'Printer queue stopped - 14 jobs waiting',
  migration: 'Migration handshake received - unifying workspace',
}
