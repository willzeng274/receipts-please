import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { WORKSTATION_CASES } from './caseFixtures'
import { EvidencePinButton } from './EvidenceScratchpad'
import type {
  WorkstationCase,
  WorkstationCaseId,
  WorkstationDecision,
  WorkstationReceiptNotification,
  WorkstationRequiredAction,
} from './types'
import { getCasePresentation, POLICY_RULES, type AppId } from './workstationData'
import { WorkstationAppIcon } from './WorkstationAppIcon'

function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'good' | 'neutral' | 'risk' }) {
  return <span className={`wsos-status wsos-status--${tone}`}>{children}</span>
}

function decisionLabel(decision: WorkstationDecision) {
  if (decision === 'request-receipt') return 'corrected receipt requested'
  return decision === 'review' ? 'review' : decision
}

const ACTION_LABELS: Record<WorkstationRequiredAction, string> = {
  'approve-coffee': 'Approve coffee',
  'cancel-ai-vendor': 'Cancel AI vendor',
  'escalate-employee': 'Escalate employee',
  'escalate-approval': 'Escalate CEO approval',
  'flag-transaction': 'Flag transaction',
  'freeze-card': 'Freeze card',
}

function SourceEvidence({
  activeCase,
  app,
  onToggleEvidence,
  pinnedEvidenceIds,
}: {
  activeCase: WorkstationCase
  app: AppId
  onToggleEvidence: (evidenceId: string) => void
  pinnedEvidenceIds: readonly string[]
}) {
  const evidence = activeCase.evidence.filter((item) => item.sourceApp === app)
  if (evidence.length === 0) return null
  return (
    <div className="wsos-source-evidence">
      {evidence.map((item) => (
        <div key={item.id}>
          <span>{item.label}</span><strong>{item.value}</strong>
          <EvidencePinButton evidenceId={item.id} label="Pin evidence" onToggle={onToggleEvidence} pinned={pinnedEvidenceIds.includes(item.id)} />
        </div>
      ))}
    </div>
  )
}

function ReceiptDocument({ activeCase }: { activeCase: WorkstationCase }) {
  const visual = activeCase.receipt.visual
  const style = {
    '--receipt-blur': `${visual.blurPx}px`,
    '--receipt-contrast': visual.contrast,
    '--receipt-fade': visual.thermalFade,
    '--receipt-rotation': `${visual.rotationDegrees}deg`,
  } as CSSProperties

  return (
    <div className={`wsos-receipt-paper wsos-receipt-paper--${visual.templateId}`} style={style}>
      <div aria-hidden="true" className="wsos-receipt-damage">
        {visual.stains.map((stain, index) => (
          <i
            className={`wsos-receipt-stain wsos-receipt-stain--${stain.kind}`}
            key={`${stain.kind}-${index}`}
            style={{
              '--stain-opacity': stain.opacity,
              '--stain-rotation': `${stain.rotation}deg`,
              '--stain-size': `${stain.size}%`,
              '--stain-x': `${stain.x}%`,
              '--stain-y': `${stain.y}%`,
            } as CSSProperties}
          />
        ))}
        {visual.creases.map((crease, index) => (
          <i
            className={`wsos-receipt-crease wsos-receipt-crease--${crease.axis}`}
            key={`${crease.axis}-${index}`}
            style={{
              '--crease-opacity': crease.strength,
              '--crease-position': `${crease.positionRatio * 100}%`,
            } as CSSProperties}
          />
        ))}
      </div>
      <div className="wsos-receipt-content">
        <small>{activeCase.merchant.toUpperCase()} / {activeCase.receipt.issuedAt}</small>
        <strong>{activeCase.receipt.lineItem.toUpperCase()}</strong>
        {activeCase.receipt.lineItems.length > 1 && (
          <ul>{activeCase.receipt.lineItems.slice(0, 5).map((item) => <li key={item}>{item}</li>)}</ul>
        )}
        <dl>
          {activeCase.receipt.rows.map((row) => (
            <div className={row.tone === 'risk' ? 'is-mismatch' : ''} key={`${row.label}-${row.value}`}><dt>{row.label}</dt><dd>{row.value}</dd></div>
          ))}
        </dl>
        <span>VISA **** {activeCase.receipt.cardLast4}</span>
      </div>
    </div>
  )
}

export function ExpenseWorkspace({
  activeCase,
  closedCaseIds,
  completedActions,
  decision,
  onAction,
  onDecision,
  onOpenApp,
  onSelectCase,
  onToggleEvidence,
  phase,
  pinnedEvidenceIds,
  submittedCaseIds,
}: {
  activeCase: WorkstationCase
  closedCaseIds: readonly WorkstationCaseId[]
  completedActions: readonly WorkstationRequiredAction[]
  decision: WorkstationDecision
  onAction: (action: WorkstationRequiredAction) => void
  onDecision: (decision: WorkstationDecision) => void
  onOpenApp: (app: AppId) => void
  onSelectCase: (caseId: WorkstationCaseId) => void
  onToggleEvidence: (evidenceId: string) => void
  phase: 'manual' | 'ramp'
  pinnedEvidenceIds: readonly string[]
  submittedCaseIds: readonly WorkstationCaseId[]
}) {
  const [selectedEvidenceId, setSelectedEvidenceId] = useState(activeCase.evidence[0]?.id ?? '')
  const presentation = getCasePresentation(activeCase.id)
  const activeCaseClosed = closedCaseIds.includes(activeCase.id)

  useEffect(() => setSelectedEvidenceId(activeCase.evidence[0]?.id ?? ''), [activeCase])

  if (phase === 'manual') {
    const submittedCases = WORKSTATION_CASES.filter((expenseCase) => (
      expenseCase.phase === 'manual' && submittedCaseIds.includes(expenseCase.id)
    ))
    return (
      <div className="wsos-manual-grid">
        <section className="wsos-pane wsos-pane--queue">
          <header><span>Expense inbox</span><strong>{submittedCases.length} submitted</strong></header>
          {submittedCases.map((expenseCase) => (
            <button className={`wsos-case-row${expenseCase.id === activeCase.id ? ' is-active' : ''}${closedCaseIds.includes(expenseCase.id) ? ' is-closed' : ''}`} key={expenseCase.id} onClick={() => onSelectCase(expenseCase.id)} type="button">
              <span>{expenseCase.caseNumber}</span><strong>{expenseCase.merchant}</strong><b>{expenseCase.amount}{closedCaseIds.includes(expenseCase.id) ? ' · closed' : ''}</b>
            </button>
          ))}
          <p className="wsos-system-note">New submissions interrupt this queue without warning.</p>
        </section>

        <section className="wsos-pane wsos-pane--receipt">
          <header><span>{activeCase.source.receiptId}.jpg</span><StatusPill tone={activeCaseClosed ? 'good' : 'risk'}>{activeCaseClosed ? 'closed' : 'unmatched'}</StatusPill></header>
          <ReceiptDocument activeCase={activeCase} />
          <div className="wsos-receipt-evidence-actions">
            {activeCase.evidence.filter((item) => item.sourceApp === 'expenses').map((item) => (
              <EvidencePinButton
                evidenceId={item.id}
                key={item.id}
                label={`Pin ${item.label}`}
                onToggle={onToggleEvidence}
                pinned={pinnedEvidenceIds.includes(item.id)}
              />
            ))}
          </div>
        </section>

        <section className="wsos-pane wsos-pane--manual-checks">
          <header><span>Open source systems</span><b>{activeCase.primaryApps.length} separate apps</b></header>
          <p className="wsos-case-hint">The inbox does not connect the evidence. Open each source and compare it to the paper receipt.</p>
          {activeCase.primaryApps.map((app) => (
            <button key={app} onClick={() => onOpenApp(app)} type="button">
              <WorkstationAppIcon app={app} />
              <span>{app === 'people' ? 'PeopleDB' : app}</span>
              <strong>Open separate system</strong><b>Launch</b>
            </button>
          ))}
          <div className="wsos-desk-decision-note"><span>Decision happens on the desk</span><strong>Press Escape, then use a physical stamp.</strong></div>
          <p>Case state: <strong>{decisionLabel(decision)}{activeCaseClosed ? ' · read only' : ''}</strong></p>
        </section>
      </div>
    )
  }

  const selectedEvidence = activeCase.evidence.find((evidence) => evidence.id === selectedEvidenceId) ?? activeCase.evidence[0]
  const rampCases = WORKSTATION_CASES.filter((expenseCase) => expenseCase.phase === 'ramp')

  return (
    <div className="wsos-ramp-workspace">
      <section className="wsos-case-heading">
        <div><span>Case {activeCase.caseNumber} - {activeCase.employee.name}</span><h2>{activeCase.ramp.title}</h2><p>{activeCase.ramp.summary}</p></div>
        <label className="wsos-case-switcher"><span>Review case</span><select aria-label="Select Ramp review case" onChange={(event) => onSelectCase(event.target.value as WorkstationCaseId)} value={activeCase.id}>{rampCases.map((expenseCase) => <option key={expenseCase.id} value={expenseCase.id}>Case {expenseCase.caseNumber} - {expenseCase.title}{closedCaseIds.includes(expenseCase.id) ? ' (closed)' : ''}</option>)}</select></label>
        <StatusPill tone={decision === 'review' ? 'risk' : 'good'}>{decision === 'review' ? 'Needs review' : `${decisionLabel(decision)} · read only`}</StatusPill>
      </section>

      <section aria-label="Connected case evidence" className="wsos-evidence-thread">
        {activeCase.evidence.slice(0, 6).map((evidence) => <button className={`wsos-evidence-card wsos-evidence-card--${evidence.tone}${selectedEvidence.id === evidence.id ? ' is-active' : ''}`} key={evidence.id} onClick={() => setSelectedEvidenceId(evidence.id)} type="button"><span>{evidence.label}</span><strong>{evidence.value}</strong></button>)}
      </section>

      <section className="wsos-evidence-detail">
        <span>Connected evidence</span><h3>{selectedEvidence.label}</h3><p>{selectedEvidence.detail}</p>
        <div className="wsos-match-figure"><div><span>{presentation.comparison.leftLabel}</span><strong>{presentation.comparison.leftValue}</strong></div><b>{presentation.comparison.relation}</b><div><span>{presentation.comparison.rightLabel}</span><strong>{presentation.comparison.rightValue}</strong></div></div>
        <EvidencePinButton evidenceId={selectedEvidence.id} label="Pin this evidence" onToggle={onToggleEvidence} pinned={pinnedEvidenceIds.includes(selectedEvidence.id)} />
        <button className="wsos-text-link" onClick={() => onOpenApp(selectedEvidence.sourceApp)} type="button">Open source record</button>
      </section>

      <section className="wsos-recommendation">
        <span>Suggested next step</span><strong>{activeCase.ramp.recommendation}</strong><p>{activeCase.ramp.explanation}</p>
        {(activeCase.validation.requiredActions ?? []).length > 0 && <div className="wsos-required-actions">{activeCase.validation.requiredActions?.map((action) => <button className={completedActions.includes(action) ? 'is-complete' : ''} disabled={activeCaseClosed} key={action} onClick={() => onAction(action)} type="button">{completedActions.includes(action) ? 'Done: ' : ''}{ACTION_LABELS[action]}</button>)}</div>}
        <div><button className="wsos-action wsos-action--primary" disabled={activeCaseClosed} onClick={() => onDecision(activeCase.suggestedDecision)} type="button">{activeCase.suggestedDecision === 'request-receipt' ? 'Request receipt' : activeCase.suggestedDecision}</button><button className="wsos-action" disabled={activeCaseClosed} onClick={() => onDecision('approve')} type="button">Approve</button><button className="wsos-action" disabled={activeCaseClosed} onClick={() => onDecision('reject')} type="button">Reject</button></div>
        <small>Case state - {decisionLabel(decision)}{activeCaseClosed ? ' · read only' : ''}</small>
      </section>
    </div>
  )
}

export function RecordsApp({
  activeCase,
  app,
  cardFrozen,
  closedCaseIds,
  onCardToggle,
  onSelectCase,
  onToggleEvidence,
  phase,
  pinnedEvidenceIds,
  receiptNotifications,
}: {
  activeCase: WorkstationCase
  app: AppId
  cardFrozen: boolean
  closedCaseIds: readonly WorkstationCaseId[]
  onCardToggle: () => void
  onSelectCase: (caseId: WorkstationCaseId) => void
  onToggleEvidence: (evidenceId: string) => void
  phase: 'manual' | 'ramp'
  pinnedEvidenceIds: readonly string[]
  receiptNotifications: readonly WorkstationReceiptNotification[]
}) {
  const presentation = getCasePresentation(activeCase.id)
  const activeCaseClosed = closedCaseIds.includes(activeCase.id)

  if (app === 'slack') {
    return <div className={`wsos-slack-view wsos-slack-view--${phase}`}><aside><strong>Slack</strong><span>Finance workspace</span><b># {presentation.slack.channel}</b><span># finance-inbox</span><span># policy-help</span></aside><section><header><div><strong># {presentation.slack.channel}</strong><span>{phase === 'manual' ? 'notifications on: every message' : 'grouped summary'}</span></div><StatusPill tone={phase === 'manual' ? 'risk' : 'good'}>{phase === 'manual' ? 'LOUD' : 'Synced'}</StatusPill></header><div className="wsos-slack-thread">{presentation.slack.messages.map((message, index) => <article className={message.tone === 'risk' ? 'is-risk' : ''} key={`${message.sender}-${index}`}><b>{message.sender}</b><time>{message.time}</time><p>{message.body}</p></article>)}{phase === 'manual' ? [...receiptNotifications].reverse().map((notification) => <button className="wsos-slack-receipt" key={notification.id} onClick={() => onSelectCase(notification.caseId)} type="button"><b>Finance Inbox Bot</b><time>{new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time><strong>NEW RECEIPT SUBMITTED</strong><span>{notification.employeeName} / {notification.merchant} / {notification.amount}</span></button>) : receiptNotifications.length > 0 && <article className="wsos-slack-archive"><b>Finance Inbox</b><strong>{receiptNotifications.length} manual submissions archived</strong><p>Receipt history is preserved in the completed manual queue.</p></article>}</div><SourceEvidence activeCase={activeCase} app="slack" onToggleEvidence={onToggleEvidence} pinnedEvidenceIds={pinnedEvidenceIds} /></section></div>
  }

  if (app === 'transactions') {
    if (activeCase.travelCharges) return <div className="wsos-record-view"><header><div><span>Transactions / card {activeCase.receipt.cardLast4}</span><h2>Five cities detected</h2></div><StatusPill tone="risk">4 out of trip</StatusPill></header><div className="wsos-transaction-list">{activeCase.travelCharges.map((charge) => <article className={charge.status === 'risk' ? 'is-risk' : ''} key={charge.evidenceId}><div><span>{charge.location} - {charge.time}</span><strong>{charge.merchant}</strong></div><b>{charge.amount}</b><EvidencePinButton evidenceId={charge.evidenceId} onToggle={onToggleEvidence} pinned={pinnedEvidenceIds.includes(charge.evidenceId)} /></article>)}</div></div>
    return <div className="wsos-record-view"><header><div><span>Transactions / {activeCase.receipt.cardLast4}</span><h2>{activeCase.merchant}</h2></div><StatusPill>Cleared</StatusPill></header><dl className="wsos-record-grid"><div><dt>Amount</dt><dd>{activeCase.transaction.amount}</dd></div><div><dt>Date</dt><dd>{activeCase.transaction.occurredAt}</dd></div><div><dt>Employee</dt><dd>{activeCase.employee.name}</dd></div><div><dt>Category</dt><dd>{activeCase.transaction.category}</dd></div><div><dt>Card</dt><dd>Visa **** {activeCase.receipt.cardLast4}</dd></div><div><dt>Memo</dt><dd>{activeCase.transaction.memo}</dd></div></dl><div className="wsos-record-warning"><strong>Receipt says {activeCase.receipt.printedTotal}</strong><span>Manual comparison required.</span></div><SourceEvidence activeCase={activeCase} app="transactions" onToggleEvidence={onToggleEvidence} pinnedEvidenceIds={pinnedEvidenceIds} /></div>
  }

  if (app === 'people') return <div className="wsos-record-view"><header><div><span>Employee directory</span><h2>{activeCase.employee.name}</h2></div><StatusPill tone="good">{activeCase.employee.employmentStatus ?? 'Active'}</StatusPill></header><div className="wsos-person-card"><div className="wsos-avatar">{activeCase.employee.initials}</div><div><strong>{activeCase.employee.role}</strong><span>{activeCase.employee.location}</span></div></div><dl className="wsos-record-grid"><div><dt>Manager</dt><dd>{presentation.employee.manager}</dd></div><div><dt>Active cards</dt><dd>{presentation.employee.activeCards}</dd></div><div><dt>Start date</dt><dd>{activeCase.employee.startDate ?? 'On file'}</dd></div><div><dt>Recent signal</dt><dd>{presentation.employee.recentAnomaly}</dd></div></dl><SourceEvidence activeCase={activeCase} app="people" onToggleEvidence={onToggleEvidence} pinnedEvidenceIds={pinnedEvidenceIds} /></div>

  if (app === 'policy') return <div className="wsos-policy-view"><aside><span>EXPENSE_POLICY_FINAL_v7.pdf</span><b>Page 17 / 46</b><small>{phase === 'manual' ? 'Search unavailable' : 'Case rule highlighted'}</small></aside><section><header><span>FIN-04</span><h2>Company expense policy</h2></header>{POLICY_RULES.map((rule, index) => <p className={rule === activeCase.policy.rule ? 'is-highlighted' : ''} key={rule}><b>{String(index + 1).padStart(2, '0')}</b>{rule}</p>)}<SourceEvidence activeCase={activeCase} app="policy" onToggleEvidence={onToggleEvidence} pinnedEvidenceIds={pinnedEvidenceIds} /></section></div>

  if (app === 'travel') {
    if (!activeCase.itinerary || !activeCase.travelCharges) return <div className="wsos-record-view"><header><div><span>Travel portal</span><h2>No approved trip attached</h2></div><StatusPill tone="risk">Manual lookup</StatusPill></header><p className="wsos-system-note">Search another portal or ask the employee for an itinerary.</p><SourceEvidence activeCase={activeCase} app="travel" onToggleEvidence={onToggleEvidence} pinnedEvidenceIds={pinnedEvidenceIds} /></div>
    return <div className="wsos-travel-view"><header><div><span>Approved trip - {activeCase.itinerary.startDate} to {activeCase.itinerary.endDate}</span><h2>{activeCase.itinerary.origin} to {activeCase.itinerary.destination}</h2></div><StatusPill tone="risk">4 out of trip</StatusPill></header><div className="wsos-travel-line"><span>NYC</span><i /><span>CHI</span><i className="is-risk" /><span>MIA?</span><i className="is-risk" /><span>TYO?</span></div><SourceEvidence activeCase={activeCase} app="travel" onToggleEvidence={onToggleEvidence} pinnedEvidenceIds={pinnedEvidenceIds} /><div className="wsos-travel-events">{activeCase.travelCharges.map((charge) => <div className={charge.status === 'risk' ? 'is-risk' : ''} key={charge.evidenceId}><b>{charge.time}</b><span>{charge.location} - {charge.merchant}</span><EvidencePinButton evidenceId={charge.evidenceId} label="Pin" onToggle={onToggleEvidence} pinned={pinnedEvidenceIds.includes(charge.evidenceId)} /></div>)}</div></div>
  }

  if (app === 'inventory') {
    const inventory = presentation.inventory
    return <div className="wsos-sheet-view"><header><span>{inventory?.title ?? 'inventory_REALLY_FINAL.csv'}</span><b>{inventory?.status ?? 'Lookup required'}</b></header>{inventory ? <table><thead><tr>{inventory.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{inventory.rows.map((row, index) => <tr key={index}>{row.map((field) => <td className={field.tone === 'risk' ? 'is-risk' : ''} key={field.label}>{field.value}</td>)}</tr>)}</tbody></table> : <p>No linked inventory rows.</p>}<p>{inventory?.note}</p><SourceEvidence activeCase={activeCase} app="inventory" onToggleEvidence={onToggleEvidence} pinnedEvidenceIds={pinnedEvidenceIds} /></div>
  }

  if (app === 'vendor') {
    const vendor = presentation.vendor
    return <div className="wsos-record-view"><header><div><span>Vendor intelligence</span><h2>{vendor?.title ?? activeCase.merchant}</h2></div><StatusPill tone={vendor?.tone ?? 'neutral'}>{vendor?.status ?? 'Known vendor'}</StatusPill></header>{vendor && <dl className="wsos-record-grid">{vendor.fields.map((field) => <div key={field.label}><dt>{field.label}</dt><dd className={field.tone === 'risk' ? 'is-risk' : ''}>{field.value}</dd></div>)}</dl>}<div className="wsos-record-warning"><strong>{vendor?.warning ?? activeCase.ramp.summary}</strong><span>{activeCase.ramp.explanation}</span></div><SourceEvidence activeCase={activeCase} app="vendor" onToggleEvidence={onToggleEvidence} pinnedEvidenceIds={pinnedEvidenceIds} /></div>
  }

  if (app === 'cards') return <div className="wsos-card-view"><header><div><span>Card control - {activeCase.employee.name}</span><h2>Corporate card **** {activeCase.receipt.cardLast4}</h2></div><StatusPill tone={cardFrozen ? 'risk' : 'good'}>{cardFrozen ? 'Frozen' : 'Active'}</StatusPill></header><div className={`wsos-card-graphic${cardFrozen ? ' is-frozen' : ''}`}><span>COMPANY CARD</span><strong>**** {activeCase.receipt.cardLast4}</strong><small>{activeCase.employee.name.toUpperCase()}</small></div><dl><div><dt>Monthly limit</dt><dd>{activeCase.card.monthlyLimit}</dd></div><div><dt>Current case</dt><dd>{activeCase.amount}</dd></div><div><dt>Risk state</dt><dd>{activeCase.ramp.summary}</dd></div></dl><button className="wsos-action wsos-action--danger" disabled={activeCaseClosed} onClick={onCardToggle} type="button">{activeCaseClosed ? 'Case closed' : cardFrozen ? 'Unfreeze card' : 'Freeze card'}</button></div>

  return null
}
