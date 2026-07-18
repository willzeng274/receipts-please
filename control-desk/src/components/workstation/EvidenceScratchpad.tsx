import type { CalculatorTape } from '../../calculator'
import type { AppId } from './workstationData'
import type { WorkstationAuditEvent, WorkstationCase, WorkstationDecision } from './types'

export function EvidencePinButton({
  evidenceId,
  label = 'Pin evidence',
  onToggle,
  pinned,
  disabled = false,
}: {
  disabled?: boolean
  evidenceId: string
  label?: string
  onToggle: (evidenceId: string) => void
  pinned: boolean
}) {
  return (
    <button
      aria-pressed={pinned}
      className={`wsos-pin-button${pinned ? ' is-pinned' : ''}`}
      disabled={disabled}
      onClick={() => onToggle(evidenceId)}
      type="button"
    >
      {pinned ? 'Pinned' : label}
    </button>
  )
}

export function EvidenceScratchpad({
  auditTrail,
  activeCase,
  calculatorTape,
  decision,
  onClear,
  onOpenApp,
  onToggle,
  pinnedEvidenceIds,
  validationMessage,
}: {
  auditTrail: readonly WorkstationAuditEvent[]
  activeCase: WorkstationCase
  calculatorTape?: CalculatorTape | null
  decision: WorkstationDecision
  onClear: () => void
  onOpenApp: (app: AppId) => void
  onToggle: (evidenceId: string) => void
  pinnedEvidenceIds: readonly string[]
  validationMessage?: string | null
}) {
  const pinnedEvidence = activeCase.evidence
    .filter((evidence) => pinnedEvidenceIds.includes(evidence.id))
    .map((evidence) => evidence.sourceApp === 'calculator' && calculatorTape
      ? {
          ...evidence,
          detail: `${calculatorTape.expression} ${calculatorTape.note}`,
          value: calculatorTape.result,
        }
      : evidence)
  const riskCount = pinnedEvidence.filter((evidence) => evidence.id.startsWith('travel:') && !['travel:policy', 'travel:calculator-total'].includes(evidence.id) && evidence.tone === 'risk').length
  const latestAudit = [...auditTrail].reverse().find((entry) => entry.caseId === activeCase.id)
  const hasAmountComparison = pinnedEvidenceIds.includes('amount:receipt-total')
    && pinnedEvidenceIds.includes('amount:transaction-total')
  const hasTravelComparison = pinnedEvidenceIds.includes('travel:itinerary') && riskCount > 0
  const finding = hasAmountComparison
    ? 'The receipt and card transaction differ by $63.00.'
    : hasTravelComparison
      ? `${riskCount} pinned charge${riskCount === 1 ? '' : 's'} conflict with the approved Chicago trip.`
      : null

  return (
    <aside className="wsos-evidence-rail" aria-label="Pinned case evidence">
      <header>
        <div><span>Evidence scratchpad</span><strong>{pinnedEvidence.length}</strong></div>
        {pinnedEvidence.length > 0 && <button onClick={onClear} type="button">Clear</button>}
      </header>

      <div className="wsos-evidence-rail__case">
        <span>Case {activeCase.caseNumber}</span>
        <strong>{activeCase.title}</strong>
      </div>

      {pinnedEvidence.length === 0 ? (
        <p className="wsos-evidence-empty">Open a record and pin the values you want to compare.</p>
      ) : (
        <div className="wsos-pinned-list">
          {pinnedEvidence.map((evidence) => (
            <article className={`is-${evidence.tone}`} key={evidence.id}>
              <div><span>{evidence.label}</span><button aria-label={`Remove ${evidence.label}`} onClick={() => onToggle(evidence.id)} type="button">x</button></div>
              <strong>{evidence.value}</strong>
              <p>{evidence.detail}</p>
              <button onClick={() => onOpenApp(evidence.sourceApp)} type="button">Open source</button>
            </article>
          ))}
        </div>
      )}

      {finding && <div className="wsos-scratchpad-finding"><span>Comparison found</span><strong>{finding}</strong></div>}
      {validationMessage && <div aria-live="polite" className="wsos-scratchpad-finding" role="status"><span>Decision needs evidence</span><strong>{validationMessage}</strong></div>}

      <footer>
        <span>Case state</span>
        <strong>{decision === 'review' ? 'In review' : latestAudit?.label ?? decision}</strong>
        {latestAudit && <small>Audit event {String(latestAudit.id).padStart(2, '0')}</small>}
      </footer>
    </aside>
  )
}
