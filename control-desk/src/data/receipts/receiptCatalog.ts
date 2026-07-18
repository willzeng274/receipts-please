import receiptCatalogJson from './receipt-generation.json'

export type ReceiptDecision = 'approve' | 'fire' | 'reject'

export type ReceiptAmounts = {
  calculatedTotalCents: number
  discountCents: number
  feesCents: number
  printedTotalCents: number
  subtotalCents: number
  taxCents: number
  tipCents: number
}

export type ReceiptLineItem = {
  description: string
  lineTotalCents: number
  quantity: number
  unitPriceCents: number
}

export type GeneratedReceipt = {
  amounts: ReceiptAmounts
  anomalies: Array<{ type: string }>
  copy: Record<string, unknown>
  issuedAt: string
  lineItems: ReceiptLineItem[]
  merchant: { addressLines: string[]; name: string }
  payment: { cardLast4: string; method: string }
  receiptId: string
  templateId: string
  visualTreatmentId: string
}

export type ReceiptCatalogCase = {
  caseId: string
  comparisonRecords: Record<string, unknown>
  difficulty: string
  receipt: GeneratedReceipt
  relatedReceipts?: GeneratedReceipt[]
  seed: string
  sequence: number
  title: string
  truth: {
    calculatorOperation?: { resultDisplay: string }
    expectedDecision: ReceiptDecision
    explanation: string
    primaryClue: string
    secondaryClue?: string | null
  }
  variantId: string
}

type ReceiptCatalog = {
  catalogId: string
  cases: ReceiptCatalogCase[]
  coverage: {
    generatedReceiptArtifacts: number
    totalCases: number
  }
  decisionValues: string[]
  schemaVersion: string
  templates: Record<string, unknown>
  visualTreatments: Record<string, unknown>
}

const catalog = receiptCatalogJson as unknown as ReceiptCatalog
const VALID_DECISIONS = new Set<ReceiptDecision>(['approve', 'fire', 'reject'])

function assertCatalog(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid receipt catalog: ${message}`)
}

function validateReceipt(receipt: GeneratedReceipt, receiptIds: Set<string>) {
  assertCatalog(receipt.receiptId && !receiptIds.has(receipt.receiptId), `duplicate or missing receiptId "${receipt.receiptId}"`)
  receiptIds.add(receipt.receiptId)
  assertCatalog(receipt.templateId in catalog.templates, `unknown template "${receipt.templateId}" on ${receipt.receiptId}`)
  assertCatalog(receipt.visualTreatmentId in catalog.visualTreatments, `unknown visual treatment "${receipt.visualTreatmentId}" on ${receipt.receiptId}`)

  for (const [name, value] of Object.entries(receipt.amounts)) {
    assertCatalog(Number.isInteger(value), `${receipt.receiptId}.${name} must use integer cents`)
  }
  for (const line of receipt.lineItems) {
    assertCatalog(Number.isInteger(line.quantity) && Number.isInteger(line.unitPriceCents) && Number.isInteger(line.lineTotalCents), `${receipt.receiptId} has a non-integer line item`)
    assertCatalog(line.lineTotalCents === line.quantity * line.unitPriceCents, `${receipt.receiptId} has incorrect arithmetic for "${line.description}"`)
  }

  const amounts = receipt.amounts
  const calculatedTotal = amounts.subtotalCents + amounts.taxCents + amounts.tipCents + amounts.feesCents - amounts.discountCents
  assertCatalog(amounts.calculatedTotalCents === calculatedTotal, `${receipt.receiptId} has an incorrect calculated total`)
}

function validateCatalog() {
  assertCatalog(catalog.schemaVersion.startsWith('1.'), `unsupported schema version ${catalog.schemaVersion}`)
  assertCatalog(catalog.catalogId.length > 0, 'catalogId is required')
  assertCatalog(catalog.coverage.totalCases === catalog.cases.length, 'coverage.totalCases does not match cases')
  assertCatalog(catalog.decisionValues.length === VALID_DECISIONS.size && catalog.decisionValues.every((value) => VALID_DECISIONS.has(value as ReceiptDecision)), 'decisionValues must be approve, reject, and fire')

  const caseIds = new Set<string>()
  const receiptIds = new Set<string>()
  let artifactCount = 0
  for (const receiptCase of catalog.cases) {
    assertCatalog(receiptCase.caseId && !caseIds.has(receiptCase.caseId), `duplicate or missing caseId "${receiptCase.caseId}"`)
    caseIds.add(receiptCase.caseId)
    assertCatalog(receiptCase.seed === `${catalog.catalogId}:${receiptCase.caseId}:${receiptCase.variantId}`, `seed does not match the deterministic strategy for ${receiptCase.caseId}`)
    assertCatalog(VALID_DECISIONS.has(receiptCase.truth.expectedDecision), `unknown decision on ${receiptCase.caseId}`)
    validateReceipt(receiptCase.receipt, receiptIds)
    artifactCount += 1
    for (const relatedReceipt of receiptCase.relatedReceipts ?? []) {
      validateReceipt(relatedReceipt, receiptIds)
      artifactCount += 1
    }
  }
  assertCatalog(catalog.coverage.generatedReceiptArtifacts === artifactCount, 'coverage.generatedReceiptArtifacts does not match primary and related receipts')
}

validateCatalog()

export const RECEIPT_CATALOG = catalog
export const RECEIPT_CASES = catalog.cases as readonly ReceiptCatalogCase[]
export const RECEIPT_CASES_BY_ID = new Map(RECEIPT_CASES.map((receiptCase) => [receiptCase.caseId, receiptCase]))

export function getReceiptCatalogCase(caseId: string) {
  const receiptCase = RECEIPT_CASES_BY_ID.get(caseId)
  if (!receiptCase) throw new Error(`Receipt catalog case not found: ${caseId}`)
  return receiptCase
}

export function getReceiptArtifacts(caseId: string) {
  const receiptCase = getReceiptCatalogCase(caseId)
  return [receiptCase.receipt, ...(receiptCase.relatedReceipts ?? [])] as const
}

export function getPlayableReceiptCases() {
  return RECEIPT_CASES
    .filter((receiptCase) => (receiptCase.caseId.startsWith('manual-') && receiptCase.sequence <= 6) || receiptCase.caseId.startsWith('ramp-'))
    .toSorted((left, right) => left.sequence - right.sequence)
}
