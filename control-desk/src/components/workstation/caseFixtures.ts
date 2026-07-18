import { RECEIPT_CATALOG, getReceiptCatalogCase } from '../../data/receipts/receiptCatalog'
import type {
  WorkstationCase,
  WorkstationCaseId,
  WorkstationCasePhase,
  WorkstationEvidence,
  WorkstationReceiptVisual,
} from './types'

const CATALOG_ID = 'receipt-cases-v1' as const

type ReceiptProjection = {
  lineItems: readonly string[]
  merchant: string
  receiptId: string
  seed: string
  templateId: string
  variantId: string
  visualTreatment: 'clean' | 'handled' | 'phone-photo' | 'unacceptable-photo'
}

const WORKSTATION_RECEIPT_CASE_IDS = [
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
] as const satisfies readonly WorkstationCaseId[]

function workstationVisualTreatment(value: string): ReceiptProjection['visualTreatment'] {
  if (value === 'clean' || value === 'handled' || value === 'phone-photo' || value === 'unacceptable-photo') return value
  throw new Error(`Unsupported workstation receipt treatment: ${value}`)
}

function receiptProjection(caseId: WorkstationCaseId): ReceiptProjection {
  const receiptCase = getReceiptCatalogCase(caseId)
  const receipt = receiptCase.receipt
  const handwritten = receipt.templateId === 'handwritten-napkin'
  return {
    lineItems: receipt.lineItems.map((line) => handwritten ? line.description : `${line.quantity}x ${line.description}`),
    merchant: receipt.merchant.name,
    receiptId: receipt.receiptId,
    seed: receiptCase.seed,
    templateId: receipt.templateId,
    variantId: receiptCase.variantId,
    visualTreatment: workstationVisualTreatment(receipt.visualTreatmentId),
  }
}

if (RECEIPT_CATALOG.catalogId !== CATALOG_ID) throw new Error(`Unexpected receipt catalog: ${RECEIPT_CATALOG.catalogId}`)

const RECEIPT_PROJECTIONS = Object.fromEntries(
  WORKSTATION_RECEIPT_CASE_IDS.map((caseId) => [caseId, receiptProjection(caseId)]),
) as Record<WorkstationCaseId, ReceiptProjection>

function receiptVisual(projection: ReceiptProjection): WorkstationReceiptVisual {
  const handled = projection.visualTreatment === 'handled'
  const photographed = projection.visualTreatment === 'phone-photo' || projection.visualTreatment === 'unacceptable-photo'
  return {
    blurPx: projection.visualTreatment === 'unacceptable-photo' ? 2.2 : photographed ? 0.65 : 0,
    contrast: projection.visualTreatment === 'unacceptable-photo' ? 0.72 : photographed ? 0.92 : 1,
    creases: handled ? [{ axis: 'diagonal', positionRatio: 0.64, strength: 0.2 }] : [],
    rotationDegrees: projection.visualTreatment === 'unacceptable-photo' ? -3.8 : projection.visualTreatment === 'phone-photo' ? 1.2 : 0,
    stains: handled
      ? [{ kind: 'finger-smudge', opacity: 0.12, rotation: -18, size: 18, x: 78, y: 22 }]
      : projection.visualTreatment === 'unacceptable-photo'
        ? [{ kind: 'grease', opacity: 0.18, rotation: 24, size: 28, x: 72, y: 68 }]
        : [],
    templateId: projection.templateId,
    thermalFade: handled ? 0.12 : projection.visualTreatment === 'unacceptable-photo' ? 0.28 : 0,
  }
}

type LegacyCase = Omit<WorkstationCase, 'receipt' | 'source'> & {
  receipt: Omit<WorkstationCase['receipt'], 'lineItems' | 'rows' | 'visual'>
  source: Pick<WorkstationCase['source'], 'catalogCaseId' | 'catalogId'>
}

function evidence(
  id: string,
  label: string,
  value: string,
  detail: string,
  sourceApp: WorkstationEvidence['sourceApp'],
  tone: WorkstationEvidence['tone'] = 'neutral',
): WorkstationEvidence {
  return { detail, id, label, sourceApp, tone, value }
}

function defineCase(expenseCase: LegacyCase): WorkstationCase {
  const projection = RECEIPT_PROJECTIONS[expenseCase.id]
  const garbageReceipt = expenseCase.id === 'manual-06-garbage-receipt'
  return {
    ...expenseCase,
    merchant: projection.merchant,
    receipt: {
      ...expenseCase.receipt,
      lineItems: projection.lineItems,
      rows: garbageReceipt
        ? projection.lineItems.map((value, index) => ({ label: index === 0 ? 'Document' : '', tone: 'risk' as const, value }))
        : [
            { label: 'Subtotal', value: expenseCase.receipt.subtotal },
            { label: 'Tax + fees', value: expenseCase.receipt.tax },
            { label: 'Total', tone: 'risk' as const, value: expenseCase.receipt.printedTotal },
          ],
      visual: receiptVisual(projection),
    },
    source: {
      ...expenseCase.source,
      receiptId: projection.receiptId,
      seed: projection.seed,
      variantId: projection.variantId,
    },
  }
}

const AMOUNT_MISMATCH = defineCase({
  amount: '$18.40',
  calculator: {
    evidenceId: 'amount:calculator-difference',
    expression: '81.40 - 18.40',
    finding: 'The photographed receipt is $63.00 above the cleared card charge.',
    result: '$63.00',
    title: 'Receipt difference',
  },
  card: { id: 'card-4812', last4: '4812', monthlyLimit: '$5,000' },
  caseNumber: '01',
  employee: {
    department: 'Product',
    employmentStatus: 'Full time',
    initials: 'MC',
    location: 'New York',
    monthlySpend: '$1,742',
    name: 'Maya Chen',
    role: 'Product designer',
    startDate: 'Sep 8, 2025',
  },
  evidence: [
    evidence('amount:receipt-total', 'Receipt total', '$81.40 photographed', 'The leading digit is overwritten and the line-item arithmetic totals $18.40.', 'expenses', 'risk'),
    evidence('amount:transaction-total', 'Card transaction', '$18.40 cleared', 'Merchant, time, and card ending match the receipt.', 'transactions'),
    evidence('amount:policy-match', 'Policy FIN-04', 'Amount must match', 'Receipts must match the transaction amount, merchant, and date.', 'policy', 'risk'),
    evidence('amount:calculator-difference', 'Calculator tape', '$63.00 difference', 'Subtracting the card amount from the printed total leaves $63.00.', 'calculator', 'risk'),
  ],
  id: 'manual-01-amount-mismatch',
  merchant: 'Chopped',
  notices: [
    { app: 'transactions', detail: 'Transaction says $18.40. Receipt says $81.40.', id: 'amount-mismatch', title: 'Amount mismatch', urgent: true },
    { app: 'slack', detail: 'Need these cleared before lunch.', id: 'manual-manager', title: 'Finance Ops' },
  ],
  phase: 'manual',
  policy: { evidenceId: 'amount:policy-match', rule: 'Receipts must match transaction amount, merchant, and date' },
  primaryApps: ['transactions', 'policy', 'calculator'],
  ramp: {
    explanation: 'The cleared charge and altered receipt are connected automatically.',
    recommendation: 'Reject the altered receipt and ask for a valid replacement.',
    summary: 'Receipt total differs from the cleared card transaction by $63.00.',
    title: 'Amount mismatch at Chopped',
  },
  receipt: { cardLast4: '4812', evidenceId: 'amount:receipt-total', issuedAt: 'Jun 18 - 11:42 AM', lineItem: 'Harvest bowl', printedTotal: '$81.40', subtotal: '$16.40', tax: '$2.00' },
  sequence: 1,
  source: { catalogCaseId: 'manual-01-amount-mismatch', catalogId: CATALOG_ID },
  suggestedDecision: 'reject',
  title: 'Amount mismatch',
  transaction: { amount: '$18.40', category: 'Meals', evidenceId: 'amount:transaction-total', memo: 'Team lunch', occurredAt: 'Jun 18 - 11:42 AM' },
  validation: {
    acceptedDecisions: ['reject'],
    expectedDecision: 'reject',
    explanation: 'The receipt was altered and does not match the cleared transaction.',
    points: 100,
    requiredEvidenceIds: ['amount:receipt-total', 'amount:transaction-total'],
  },
})

const IMPOSSIBLE_DATE = defineCase({
  amount: '$43.99',
  card: { id: 'card-rowan-shaw-1038', last4: '1038', monthlyLimit: '$1,500' },
  caseNumber: '02',
  employee: { department: 'Operations', employmentStatus: 'Not started', initials: 'RS', location: 'Boston', monthlySpend: '$43.99', name: 'Rowan Shaw', role: 'Operations associate', startDate: 'Jun 21, 2026' },
  evidence: [
    evidence('date:receipt', 'Receipt date', 'Jun 18, 2026', 'The purchase occurred three days before employment began.', 'expenses', 'risk'),
    evidence('date:start', 'Employee start date', 'Jun 21, 2026', 'Directory records show card access should begin on the start date.', 'people', 'risk'),
    evidence('date:transaction', 'Card transaction', '$43.99 on Jun 18', 'The card transaction matches the receipt date and amount.', 'transactions'),
  ],
  id: 'manual-02-impossible-date',
  merchant: 'Northstar Office Supply',
  notices: [{ app: 'people', detail: 'Rowan starts on June 21. This charge posted June 18.', id: 'date-start-alert', title: 'Directory mismatch', urgent: true }],
  phase: 'manual',
  policy: { evidenceId: 'date:start', rule: 'Company cards may only be used by active employees' },
  primaryApps: ['transactions', 'people'],
  ramp: { explanation: 'The employee start date falls three days after the card charge.', recommendation: 'Reject the pre-employment expense.', summary: 'Purchase predates employment.', title: 'Charge before start date' },
  receipt: { cardLast4: '1038', evidenceId: 'date:receipt', issuedAt: 'Jun 18 - 8:17 AM', lineItem: 'Breakfast sandwiches and cold brew', printedTotal: '$43.99', subtotal: '$40.40', tax: '$3.59' },
  sequence: 2,
  source: { catalogCaseId: 'manual-02-impossible-date', catalogId: CATALOG_ID },
  suggestedDecision: 'reject',
  title: 'Impossible date',
  transaction: { amount: '$43.99', category: 'Office supplies', evidenceId: 'date:transaction', memo: 'First week setup', occurredAt: 'Jun 18 - 9:14 AM' },
  validation: { acceptedDecisions: ['reject'], expectedDecision: 'reject', explanation: 'The employee was not active when the card was used.', points: 100, requiredEvidenceIds: ['date:receipt', 'date:start'] },
})

const OMAKASE_INTERN = defineCase({
  amount: '$684.00',
  calculator: { evidenceId: 'omakase:per-person', expression: '684 / 1', finding: 'One attendee generated $684.00 of meal spend.', result: '$684.00 per attendee', title: 'Per-attendee spend' },
  card: { id: 'card-rowan-kim-1038', last4: '1038', monthlyLimit: '$500' },
  caseNumber: '03',
  employee: { department: 'Strategy', employmentStatus: 'Summer intern', initials: 'RK', location: 'New York', monthlySpend: '$812', name: 'Rowan Kim', role: 'Summer intern', startDate: 'Jun 1, 2026' },
  evidence: [
    evidence('omakase:receipt', 'Dinner receipt', '$684.00', 'The receipt lists one tasting menu and one attendee.', 'expenses', 'risk'),
    evidence('omakase:employee', 'Employee role', 'Summer intern', 'The employee profile has no executive meal exception.', 'people', 'risk'),
    evidence('omakase:policy', 'Meal policy', '$35 per attendee', 'Meals are limited to $35 for every listed attendee.', 'policy', 'risk'),
    evidence('omakase:attendees', 'Attendee list', 'Me', 'The employee confirmed there were no external attendees.', 'slack', 'risk'),
    evidence('omakase:per-person', 'Calculator tape', '$684.00 per attendee', 'The full charge applies to one attendee.', 'calculator', 'risk'),
  ],
  id: 'manual-03-omakase-intern',
  merchant: 'Kumo Omakase',
  notices: [{ app: 'slack', detail: 'Executive relationship dinner. Attendees: me.', id: 'omakase-explanation', title: 'Rowan Kim', urgent: true }],
  phase: 'manual',
  policy: { evidenceId: 'omakase:policy', rule: 'Meals are limited to $35 per attendee' },
  primaryApps: ['people', 'slack', 'policy', 'calculator'],
  ramp: { explanation: 'Employee level, attendee count, and meal policy show no valid exception.', recommendation: 'Reject the out-of-policy dinner.', summary: 'A summer intern submitted a $684 dinner for one.', title: 'Omakase for one' },
  receipt: { cardLast4: '1038', evidenceId: 'omakase:receipt', issuedAt: 'Jun 24 - 9:38 PM', lineItem: 'Omakase and pairing', printedTotal: '$684.00', subtotal: '$570.00', tax: '$114.00' },
  sequence: 3,
  source: { catalogCaseId: 'manual-03-omakase-intern', catalogId: CATALOG_ID },
  suggestedDecision: 'reject',
  title: 'Omakase intern',
  transaction: { amount: '$684.00', category: 'Meals', evidenceId: 'omakase:receipt', memo: 'Executive relationship dinner', occurredAt: 'Jun 19 - 9:48 PM' },
  validation: { acceptedDecisions: ['reject'], expectedDecision: 'reject', explanation: 'The meal exceeds policy and has no business attendees.', points: 125, requiredEvidenceIds: ['omakase:receipt', 'omakase:employee', 'omakase:policy'] },
})

const INFINITE_TIP = defineCase({
  amount: '$1,001.80',
  calculator: { evidenceId: 'tip:percentage', expression: '980 / 21.80 × 100', finding: 'The tip is 4,495.41 percent of the meal subtotal.', result: '4,495.41%', title: 'Tip percentage' },
  card: { id: 'card-6621', last4: '6621', monthlyLimit: '$10,000' },
  caseNumber: '04',
  employee: { department: 'Sales', employmentStatus: 'Full time', initials: 'DL', location: 'New York', monthlySpend: '$8,410', name: 'Devon Lee', role: 'Account executive', startDate: 'Mar 4, 2024' },
  evidence: [
    evidence('tip:receipt', 'Receipt breakdown', '$21.80 food + $980 tip', 'The tip dwarfs the underlying meal.', 'expenses', 'risk'),
    evidence('tip:policy', 'Tip policy', 'Review above 25%', 'Tips above 25 percent require finance review.', 'policy', 'risk'),
    evidence('tip:percentage', 'Calculator tape', '4,495.41%', 'The submitted tip is nearly forty-five times the subtotal.', 'calculator', 'risk'),
    evidence('tip:explanation', 'Employee explanation', 'Investing in the relationship', 'No attendees or business purpose support the amount.', 'slack', 'risk'),
  ],
  id: 'manual-04-infinite-tip',
  merchant: 'Cafe Meridian',
  notices: [{ app: 'calculator', detail: 'Tip entered: $980.00 on a $21.80 meal.', id: 'tip-alert', title: 'Tip review', urgent: true }],
  phase: 'manual',
  policy: { evidenceId: 'tip:policy', rule: 'Tips above 25 percent require review' },
  primaryApps: ['transactions', 'policy', 'calculator', 'slack'],
  ramp: { explanation: 'The tip is 4,495 percent and lacks a supported business purpose.', recommendation: 'Investigate the charge and employee explanation.', summary: 'A $21.80 meal includes a $980 tip.', title: 'Infinite tip' },
  receipt: { cardLast4: '6621', evidenceId: 'tip:receipt', issuedAt: 'Jun 25 - 1:06 PM', lineItem: 'Lunch and tip', printedTotal: '$1,001.80', subtotal: '$21.80', tax: '$980.00' },
  sequence: 4,
  source: { catalogCaseId: 'manual-04-infinite-tip', catalogId: CATALOG_ID },
  suggestedDecision: 'investigate',
  title: 'Infinite tip',
  transaction: { amount: '$1,001.80', category: 'Meals', evidenceId: 'tip:receipt', memo: 'Investing in the relationship', occurredAt: 'Jun 20 - 12:16 PM' },
  validation: { acceptedDecisions: ['investigate', 'reject'], expectedDecision: 'investigate', explanation: 'The charge needs escalation because the extreme tip lacks support.', points: 150, requiredEvidenceIds: ['tip:receipt', 'tip:policy', 'tip:percentage'] },
})

const FRANKENSTEIN_RECEIPT = defineCase({
  amount: '$140.45',
  card: { id: 'card-7754', last4: '7754', monthlyLimit: '$7,500' },
  caseNumber: '05',
  employee: { department: 'Partnerships', employmentStatus: 'Full time', initials: 'AP', location: 'San Francisco', monthlySpend: '$4,022', name: 'Avery Park', role: 'Partnerships manager', startDate: 'Jan 9, 2023' },
  evidence: [
    evidence('fonts:merchant', 'Merchant typography', 'Helvetica header', 'The merchant header does not share the receipt printer typeface.', 'expenses', 'risk'),
    evidence('fonts:total', 'Total typography', 'Comic-style total', 'The total uses different weight, spacing, and baseline.', 'expenses', 'risk'),
    evidence('fonts:transaction', 'Card transaction', '$140.45 cleared', 'The amount matches, but matching amount alone does not authenticate the receipt.', 'transactions'),
    evidence('fonts:policy', 'Receipt policy', 'Valid receipt required', 'Edited receipt imagery is not acceptable support.', 'policy', 'risk'),
  ],
  id: 'manual-05-frankenstein-receipt',
  merchant: 'Bistro Union',
  notices: [{ app: 'expenses', detail: 'Image analysis found five unrelated type styles.', id: 'font-alert', title: 'Receipt image', urgent: true }],
  phase: 'manual',
  policy: { evidenceId: 'fonts:policy', rule: 'Receipts must be authentic and match the transaction' },
  primaryApps: ['transactions', 'policy'],
  ramp: { explanation: 'Multiple text regions have incompatible font metrics and image artifacts.', recommendation: 'Reject the edited receipt.', summary: 'The amount matches, but the receipt image was assembled from unrelated text.', title: 'Frankenstein receipt' },
  receipt: { cardLast4: '7754', evidenceId: 'fonts:merchant', issuedAt: 'Jun 26 - 7:24 PM', lineItem: 'Client dinner', printedTotal: '$140.45', subtotal: '$109.00', tax: '$31.45' },
  sequence: 5,
  source: { catalogCaseId: 'manual-05-frankenstein-receipt', catalogId: CATALOG_ID },
  suggestedDecision: 'reject',
  title: 'Frankenstein receipt',
  transaction: { amount: '$140.45', category: 'Meals', evidenceId: 'fonts:transaction', memo: 'Client dinner', occurredAt: 'Jun 20 - 7:08 PM' },
  validation: { acceptedDecisions: ['reject'], expectedDecision: 'reject', explanation: 'Two independent edited regions establish that the support is fabricated.', points: 150, requiredEvidenceIds: ['fonts:merchant', 'fonts:total'] },
})

const GARBAGE_RECEIPT = defineCase({
  amount: '$14,000.00',
  card: { id: 'card-cash-dave', last4: '----', monthlyLimit: '$20,000' },
  caseNumber: '06',
  employee: { department: 'IT', employmentStatus: 'Full time', initials: 'SP', location: 'New York', monthlySpend: '$18,400', name: 'Sam Patel', role: 'IT director', startDate: 'Aug 12, 2021' },
  evidence: [
    evidence('garbage:receipt', 'Submitted napkin', '7 laptop / $14,000 / trust me', 'The support has no merchant identity, date, tax, or item detail.', 'expenses', 'risk'),
    evidence('garbage:transaction', 'Technology charge', '$14,000 cleared', 'The card charge exists but has no recognized vendor record.', 'transactions', 'risk'),
    evidence('garbage:inventory', 'Inventory lookup', '0 serial numbers', 'No receiving or device assignment record exists.', 'inventory', 'risk'),
    evidence('garbage:policy', 'Technology policy', 'Inventory required', 'Technology purchases require receiving and inventory records.', 'policy', 'risk'),
  ],
  id: 'manual-06-garbage-receipt',
  merchant: 'Dave',
  notices: [{ app: 'slack', detail: 'I can send the serials later. Probably.', id: 'garbage-explanation', title: 'IT Inventory', urgent: true }],
  phase: 'manual',
  policy: { evidenceId: 'garbage:policy', rule: 'Technology purchases require inventory records' },
  primaryApps: ['transactions', 'inventory', 'policy', 'slack'],
  ramp: { explanation: 'No vendor, serial number, purchase order, or receiving record supports the charge.', recommendation: 'Investigate the transaction and request formal records.', summary: 'A $14,000 technology charge is supported by a handwritten napkin.', title: 'Seven laptops, trust me' },
  receipt: { cardLast4: '----', evidenceId: 'garbage:receipt', issuedAt: 'Jun 27 - 4:11 PM', lineItem: '7 laptop', printedTotal: '$14,000.00', subtotal: '$14,000.00', tax: '$0.00' },
  sequence: 6,
  source: { catalogCaseId: 'manual-06-garbage-receipt', catalogId: CATALOG_ID },
  suggestedDecision: 'investigate',
  title: 'Garbage receipt',
  transaction: { amount: '$14,000.00', category: 'Technology', evidenceId: 'garbage:transaction', memo: 'Laptop refresh', occurredAt: 'Jun 21 - 4:02 PM' },
  validation: { acceptedDecisions: ['investigate', 'reject'], expectedDecision: 'investigate', explanation: 'The charge requires escalation and real inventory support.', points: 175, requiredEvidenceIds: ['garbage:receipt', 'garbage:inventory', 'garbage:policy'] },
})

const IT_INVENTORY_THEFT = defineCase({
  amount: '$74,000.00',
  calculator: { evidenceId: 'it:variance', expression: '24 - 11', finding: 'Thirteen MacBooks are missing before monitor variance is counted.', result: '13 missing MacBooks', title: 'Inventory variance' },
  card: { activeCardCount: 3, id: 'card-2910', last4: '2910', monthlyLimit: '$100,000' },
  caseNumber: '09',
  employee: { department: 'IT', employmentStatus: 'Full time', initials: 'WZ', location: 'New York', monthlySpend: '$92,400', name: 'William Zeng', role: 'IT director', startDate: 'Aug 12, 2021' },
  evidence: [
    evidence('it:invoice', 'Purchase invoice', '24 MacBooks / 40 monitors', 'The approved invoice establishes the purchased quantities.', 'transactions'),
    evidence('it:inventory', 'Physical inventory', '11 MacBooks / 19 monitors', 'The latest inventory count is missing 34 high-value devices.', 'inventory', 'risk'),
    evidence('it:serials', 'Serial reconciliation', '13 MacBook serials missing', 'Missing serials cannot be matched to assigned employees.', 'inventory', 'risk'),
    evidence('it:resale', 'Resale account', 'Owner email matches employee', 'The seller email is the IT director work address.', 'vendor', 'risk'),
    evidence('it:variance', 'Calculator tape', '13 missing MacBooks', 'The first inventory comparison shows a thirteen-unit variance.', 'calculator', 'risk'),
  ],
  id: 'ramp-09-it-inventory-theft',
  merchant: 'Enterprise Device Supply',
  notices: [{ app: 'vendor', detail: 'A resale account owner matches the employee on this case.', id: 'it-resale-alert', title: 'Related identity', urgent: true }],
  phase: 'ramp',
  policy: { evidenceId: 'it:inventory', rule: 'Technology purchases require inventory records' },
  primaryApps: ['transactions', 'inventory', 'vendor', 'people', 'cards'],
  ramp: { explanation: 'Purchase, inventory, serial, and resale records point to the same employee.', recommendation: 'Freeze the card and investigate the employee.', summary: 'Thirty-four devices are missing and a resale account matches the IT director.', title: 'Inventory theft pattern' },
  receipt: { cardLast4: '2910', evidenceId: 'it:invoice', issuedAt: 'Jun 3 - 10:10 AM', lineItem: 'Corporate device refresh', printedTotal: '$74,000.00', subtotal: '$74,000.00', tax: '$0.00' },
  sequence: 9,
  source: { catalogCaseId: 'ramp-09-it-inventory-theft', catalogId: CATALOG_ID },
  suggestedDecision: 'investigate',
  title: 'IT inventory theft',
  transaction: { amount: '$74,000.00', category: 'Technology', evidenceId: 'it:invoice', memo: 'Annual device refresh', occurredAt: 'Jun 3 - 10:10 AM' },
  validation: { acceptedDecisions: ['investigate'], expectedDecision: 'investigate', explanation: 'The linked resale identity requires escalation and card control.', points: 250, requiredActions: ['freeze-card', 'flag-transaction', 'escalate-employee'], requiredEvidenceIds: ['it:inventory', 'it:resale'] },
})

const INFLUENCER_DEAL = defineCase({
  amount: '$75,000.00',
  calculator: { evidenceId: 'vendor:follower-cost', expression: '75000 / 14', finding: 'The campaign costs $5,357.14 per follower.', result: '$5,357.14 per follower', title: 'Audience cost' },
  card: { id: 'card-ach-synergy', last4: '----', monthlyLimit: '$80,000' },
  caseNumber: '10',
  employee: { department: 'Marketing', employmentStatus: 'Full time', initials: 'WZ', location: 'Los Angeles', monthlySpend: '$78,210', name: 'William Zeng', role: 'Marketing director', startDate: 'Apr 2, 2022' },
  evidence: [
    evidence('vendor:payment', 'Vendor payment', '$75,000', 'The payment was submitted one day after vendor creation.', 'transactions', 'risk'),
    evidence('vendor:identity', 'Vendor identity', 'Address matches employee', 'The LLC address is the marketing director apartment.', 'vendor', 'risk'),
    evidence('vendor:approval', 'Approval record', 'Legal approval missing', 'New vendors over $10,000 need legal and finance approval.', 'policy', 'risk'),
    evidence('vendor:performance', 'Campaign report', '14 followers / 3 likes', 'Eight followers are accounts owned by the employee.', 'vendor', 'risk'),
    evidence('vendor:follower-cost', 'Calculator tape', '$5,357.14 per follower', 'The submitted audience makes the campaign economically implausible.', 'calculator', 'risk'),
  ],
  id: 'ramp-10-influencer-marketing-deal',
  merchant: 'SynergyAlphaWolf Media LLC',
  notices: [{ app: 'vendor', detail: 'Vendor was created yesterday and shares the employee address.', id: 'vendor-new-alert', title: 'New vendor risk', urgent: true }],
  phase: 'ramp',
  policy: { evidenceId: 'vendor:approval', rule: 'New vendors above $10,000 require legal and finance approval' },
  primaryApps: ['vendor', 'policy', 'people', 'calculator'],
  ramp: { explanation: 'Vendor identity, missing approval, and campaign performance all conflict with the request.', recommendation: 'Reject the vendor payment.', summary: 'A new employee-linked vendor requested $75,000 for three likes.', title: 'Vibe-based activation' },
  receipt: { cardLast4: '----', evidenceId: 'vendor:payment', issuedAt: 'Jul 10 - 9:00 AM', lineItem: 'Vibe-based activation', printedTotal: '$75,000.00', subtotal: '$75,000.00', tax: '$0.00' },
  sequence: 10,
  source: { catalogCaseId: 'ramp-10-influencer-marketing-deal', catalogId: CATALOG_ID },
  suggestedDecision: 'reject',
  title: 'Influencer marketing deal',
  transaction: { amount: '$75,000.00', category: 'Marketing', evidenceId: 'vendor:payment', memo: 'One vibe-based activation', occurredAt: 'Jun 22 - 9:08 AM' },
  validation: { acceptedDecisions: ['reject', 'investigate'], expectedDecision: 'reject', explanation: 'The payment lacks approval and the vendor is employee-linked.', points: 225, requiredEvidenceIds: ['vendor:identity', 'vendor:approval'] },
})

const TRAVEL_IMPOSSIBILITY = defineCase({
  amount: '$5,759.07',
  calculator: { evidenceId: 'travel:calculator-total', expression: '1250 + 442 + 3200 + 18.37', finding: 'Four out-of-trip charges total $4,910.37.', result: '$4,910.37', title: 'Out-of-trip total' },
  card: { activeCardCount: 2, id: 'card-8022', last4: '8022', monthlyLimit: '$12,000' },
  caseNumber: '11',
  employee: { department: 'Sales', employmentStatus: 'Full time', initials: 'AR', location: 'New York', monthlySpend: '$9,884', name: 'Alex Rivera', role: 'Account executive', startDate: 'Feb 5, 2024' },
  evidence: [
    evidence('travel:itinerary', 'Approved itinerary', 'New York to Chicago', 'The approved trip runs June 18 through June 20.', 'travel', 'good'),
    evidence('travel:chicago', 'Chicago hotel', '$848.70 matched', 'The hotel is the legitimate anchor for the approved trip.', 'transactions', 'good'),
    evidence('travel:miami', 'Miami limousine', '$1,250.00 - Miami', 'The limousine charge posted during the Chicago trip.', 'transactions', 'risk'),
    evidence('travel:tokyo', 'Tokyo room service', '$442.00 - Tokyo', 'The room-service timestamp overlaps another charge.', 'transactions', 'risk'),
    evidence('travel:monaco', 'Monaco transfer', '$3,200.00 - Monaco', 'The helicopter transfer occurs hours after Tokyo.', 'transactions', 'risk'),
    evidence('travel:newark', 'Newark store', '$18.37 - Newark', 'The charge lands after the Chicago folio closes.', 'transactions', 'risk'),
    evidence('travel:policy', 'Travel policy', 'Trip must match', 'Travel expenses must match an approved trip.', 'policy', 'risk'),
    evidence('travel:calculator-total', 'Calculator tape', '$4,910.37 out of trip', 'The four incompatible charges total $4,910.37.', 'calculator', 'risk'),
  ],
  id: 'ramp-11-travel-impossibility',
  itinerary: { destination: 'Chicago', endDate: 'Jun 20', origin: 'New York', startDate: 'Jun 18' },
  merchant: 'Five travel merchants',
  notices: [{ app: 'travel', detail: 'Five locations mapped to one approved Chicago trip.', id: 'travel-connected', title: 'Ramp Travel connected', urgent: true }],
  phase: 'ramp',
  policy: { evidenceId: 'travel:policy', rule: 'Travel expenses must match an approved trip' },
  primaryApps: ['transactions', 'travel', 'policy', 'calculator'],
  ramp: { explanation: 'Four charges are geographically incompatible with the itinerary and overlap in time.', recommendation: 'Investigate the employee and hold out-of-trip charges.', summary: 'Ramp Travel connected five locations to one Chicago trip.', title: 'Five cities, one trip' },
  receipt: { cardLast4: '8022', evidenceId: 'travel:chicago', issuedAt: 'Jun 20 - 8:05 AM', lineItem: 'Room 1812 - two nights', printedTotal: '$848.70', subtotal: '$684.00', tax: '$164.70' },
  sequence: 11,
  source: { catalogCaseId: 'ramp-11-travel-impossibility', catalogId: CATALOG_ID },
  suggestedDecision: 'investigate',
  title: 'Ramp Travel impossibility',
  transaction: { amount: '$5,759.07', category: 'Travel', evidenceId: 'travel:miami', memo: 'Long layover', occurredAt: 'Jun 18-20' },
  travelCharges: [
    { amount: '$848.70', evidenceId: 'travel:chicago', location: 'Chicago', merchant: 'Lakeshore Hotel', status: 'matched', time: 'Jun 20 - 8:05' },
    { amount: '$1,250.00', evidenceId: 'travel:miami', location: 'Miami', merchant: 'Miami Executive Limo', status: 'risk', time: 'Jun 18 - 13:42' },
    { amount: '$442.00', evidenceId: 'travel:tokyo', location: 'Tokyo', merchant: 'Tokyo Grand Room Service', status: 'risk', time: 'Jun 19 - 02:11' },
    { amount: '$3,200.00', evidenceId: 'travel:monaco', location: 'Monaco', merchant: 'Monaco Rotor Transfer', status: 'risk', time: 'Jun 19 - 16:30' },
    { amount: '$18.37', evidenceId: 'travel:newark', location: 'Newark', merchant: 'Newark Airport Convenience', status: 'risk', time: 'Jun 20 - 11:10' },
  ],
  validation: { acceptedDecisions: ['investigate'], expectedDecision: 'investigate', explanation: 'The connected itinerary proves four charges require investigation.', points: 225, requiredEvidenceIds: ['travel:itinerary', 'travel:miami', 'travel:monaco'] },
})

const AI_EXPENSE_PARADOX = defineCase({
  amount: '$60.00',
  calculator: { evidenceId: 'ai:ratio', expression: '51.50 / 8.50', finding: 'Review automation costs 6.06 times the legitimate coffee.', result: '6.06x', title: 'Review-cost ratio' },
  card: { id: 'card-7710', last4: '7710', monthlyLimit: '$4,000' },
  caseNumber: '12',
  employee: { department: 'Customer Success', employmentStatus: 'Full time', initials: 'NO', location: 'Austin', monthlySpend: '$1,104', name: 'Nia Owens', role: 'Customer success manager', startDate: 'Oct 10, 2023' },
  evidence: [
    evidence('ai:coffee', 'Client coffee', '$8.50', 'The original coffee is ordinary and within policy.', 'transactions', 'good'),
    evidence('ai:fees', 'AI processing fees', '$51.50', 'Six automation services charged more than the expense.', 'vendor', 'risk'),
    evidence('ai:policy', 'Meal policy', '$35 per attendee', 'The original coffee is within the meal limit.', 'policy', 'good'),
    evidence('ai:ratio', 'Calculator tape', '6.06x review cost', 'Automation cost is 6.06 times the original expense.', 'calculator', 'risk'),
  ],
  id: 'ramp-12-ai-expense-paradox',
  merchant: 'Coffee + AutoExpense Intelligence',
  notices: [{ app: 'vendor', detail: 'Vendor charged $51.50 to review an $8.50 coffee.', id: 'ai-cost-alert', title: 'Automation cost anomaly', urgent: true }],
  phase: 'ramp',
  policy: { evidenceId: 'ai:policy', rule: 'Meals are limited to $35 per attendee' },
  primaryApps: ['transactions', 'vendor', 'policy', 'calculator'],
  ramp: { explanation: 'The coffee is valid; the attached AI vendor fees are the anomaly.', recommendation: 'Approve the coffee and cancel the AI vendor.', summary: 'Review automation costs six times more than the expense.', title: 'AI expense paradox' },
  receipt: { cardLast4: '7710', evidenceId: 'ai:coffee', issuedAt: 'Jun 23 - 10:03 AM', lineItem: 'Client coffee', printedTotal: '$8.50', subtotal: '$7.80', tax: '$0.70' },
  sequence: 12,
  source: { catalogCaseId: 'ramp-12-ai-expense-paradox', catalogId: CATALOG_ID },
  suggestedDecision: 'approve',
  title: 'AI expense paradox',
  transaction: { amount: '$60.00', category: 'Meals / software', evidenceId: 'ai:fees', memo: 'Automated expense review', occurredAt: 'Jun 23 - 10:03 AM' },
  validation: { acceptedDecisions: ['approve'], expectedDecision: 'approve', explanation: 'Approve the legitimate coffee while the vendor anomaly is separately flagged.', points: 250, requiredActions: ['approve-coffee', 'cancel-ai-vendor'], requiredEvidenceIds: ['ai:coffee', 'ai:fees', 'ai:policy'] },
})

const PROCUREMENT_MISMATCH = defineCase({
  amount: '$450,000.00',
  calculator: { evidenceId: 'procurement:variance', expression: '1000 - 1', finding: 'Nine hundred ninety-nine invoiced chairs are not represented in delivery.', result: '999 units missing', title: 'Delivery variance' },
  card: { id: 'card-ach-ergodynamic', last4: '----', monthlyLimit: '$1,000,000' },
  caseNumber: '13',
  employee: { department: 'Workplace', employmentStatus: 'Full time', initials: 'CB', location: 'New York', monthlySpend: '$901,240', name: 'Casey Bell', role: 'Facilities director', startDate: 'May 7, 2020' },
  evidence: [
    evidence('procurement:po', 'Purchase order', '100 chairs approved', 'The approved request and PO are for one hundred chairs.', 'inventory', 'good'),
    evidence('procurement:invoice', 'Vendor invoice', '1,000 chairs billed', 'The invoice quantity is ten times the PO.', 'vendor', 'risk'),
    evidence('procurement:delivery', 'Delivery record', '1 beanbag delivered', 'Receiving logged one beanbag and no chairs.', 'inventory', 'risk'),
    evidence('procurement:inventory', 'Inventory record', '0 chairs / 1 beanbag', 'No chair assets were added to inventory.', 'inventory', 'risk'),
    evidence('procurement:variance', 'Calculator tape', '999 units missing', 'Invoice quantity minus delivered quantity leaves 999.', 'calculator', 'risk'),
  ],
  id: 'ramp-13-procurement-mismatch',
  merchant: 'Ergodynamic Office Systems',
  notices: [{ app: 'inventory', detail: 'PO, invoice, delivery, and inventory quantities do not reconcile.', id: 'procurement-alert', title: 'Procurement mismatch', urgent: true }],
  phase: 'ramp',
  policy: { evidenceId: 'procurement:po', rule: 'Invoices and delivery records must match an approved purchase order' },
  primaryApps: ['inventory', 'vendor', 'calculator'],
  ramp: { explanation: 'The PO approved 100 chairs, the invoice bills 1,000, and delivery contains one beanbag.', recommendation: 'Reject the invoice and escalate procurement.', summary: 'Nine hundred ninety-nine billed units are unaccounted for.', title: 'One thousand chairs, one beanbag' },
  receipt: { cardLast4: '----', evidenceId: 'procurement:invoice', issuedAt: 'Jul 12 - 9:30 AM', lineItem: '1,000 ergonomic chairs', printedTotal: '$450,000.00', subtotal: '$450,000.00', tax: '$0.00' },
  sequence: 13,
  source: { catalogCaseId: 'ramp-13-procurement-mismatch', catalogId: CATALOG_ID },
  suggestedDecision: 'reject',
  title: 'Procurement mismatch',
  transaction: { amount: '$450,000.00', category: 'Office furniture', evidenceId: 'procurement:invoice', memo: 'Phased rollout', occurredAt: 'Jul 12 - 9:30 AM' },
  validation: { acceptedDecisions: ['reject', 'investigate'], expectedDecision: 'reject', explanation: 'The invoice cannot be approved against the PO and delivery record.', points: 250, requiredEvidenceIds: ['procurement:po', 'procurement:invoice', 'procurement:delivery'] },
})

export const MANUAL_WORKSTATION_CASES = [
  AMOUNT_MISMATCH,
  IMPOSSIBLE_DATE,
  OMAKASE_INTERN,
  INFINITE_TIP,
  FRANKENSTEIN_RECEIPT,
  GARBAGE_RECEIPT,
] as const

export const RAMP_WORKSTATION_CASES = [
  IT_INVENTORY_THEFT,
  INFLUENCER_DEAL,
  TRAVEL_IMPOSSIBILITY,
  AI_EXPENSE_PARADOX,
  PROCUREMENT_MISMATCH,
] as const

export const WORKSTATION_CASES = [...MANUAL_WORKSTATION_CASES, ...RAMP_WORKSTATION_CASES] as const

export const WORKSTATION_CASE_IDS_BY_PHASE: Readonly<Record<WorkstationCasePhase, readonly WorkstationCaseId[]>> = {
  manual: MANUAL_WORKSTATION_CASES.map((expenseCase) => expenseCase.id),
  ramp: RAMP_WORKSTATION_CASES.map((expenseCase) => expenseCase.id),
}

export const DEFAULT_WORKSTATION_CASE_ID: WorkstationCaseId = AMOUNT_MISMATCH.id

export const WORKSTATION_CASES_BY_ID = Object.fromEntries(
  WORKSTATION_CASES.map((expenseCase) => [expenseCase.id, expenseCase]),
) as Record<WorkstationCaseId, WorkstationCase>

export function getWorkstationCasesForPhase(phase: WorkstationCasePhase) {
  return phase === 'manual' ? MANUAL_WORKSTATION_CASES : RAMP_WORKSTATION_CASES
}

export function getWorkstationEvidence(caseId: WorkstationCaseId, evidenceId: string) {
  return WORKSTATION_CASES_BY_ID[caseId].evidence.find((item) => item.id === evidenceId)
}
