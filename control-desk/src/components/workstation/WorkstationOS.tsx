import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RAMP_MIGRATION_STEPS } from '../../store/useLabStore'

import './workstation-os.css'

export type WorkstationPhase = 'manual' | 'migrating' | 'ramp'

export type WorkstationEffect =
  | 'paper-drop'
  | 'approve'
  | 'reject'
  | 'fraud'
  | 'printer-jam'
  | 'migration'

export type WorkstationOSProps = {
  effect?: WorkstationEffect
  effectRun?: number
  focused: boolean
  onExit: () => void
  onFocus: () => void
  onAdvanceMigration: () => void
  onTryRamp: () => void
  phase?: WorkstationPhase
  migrationStep?: number
  rampPromptVisible?: boolean
}

type AppId =
  | 'expenses'
  | 'transactions'
  | 'people'
  | 'policy'
  | 'travel'
  | 'inventory'
  | 'vendor'
  | 'cards'
  | 'calculator'

type AppDefinition = {
  id: AppId
  label: string
  shortLabel: string
}

type CalculatorOperator = '+' | '−' | '×' | '÷'

type CalculatorState = {
  display: string
  history: string
  operator: CalculatorOperator | null
  replaceDisplay: boolean
  storedValue: number | null
}

type Notice = {
  app: AppId
  detail: string
  id: string
  title: string
  urgent?: boolean
}

const MANUAL_APPS: AppDefinition[] = [
  { id: 'expenses', label: 'Expense inbox', shortLabel: 'EX' },
  { id: 'transactions', label: 'Transactions', shortLabel: 'TX' },
  { id: 'people', label: 'Employee directory', shortLabel: 'PE' },
  { id: 'policy', label: 'Policy PDF', shortLabel: 'PDF' },
  { id: 'travel', label: 'Travel portal', shortLabel: 'TR' },
  { id: 'inventory', label: 'Inventory sheet', shortLabel: 'IV' },
  { id: 'calculator', label: 'Desk calculator', shortLabel: '42' },
]

const RAMP_APPS: AppDefinition[] = [
  { id: 'expenses', label: 'Case overview', shortLabel: 'EX' },
  { id: 'travel', label: 'Travel', shortLabel: 'TR' },
  { id: 'vendor', label: 'Vendor', shortLabel: 'VN' },
  { id: 'cards', label: 'Cards', shortLabel: 'CD' },
  { id: 'policy', label: 'Policy', shortLabel: 'PO' },
  { id: 'calculator', label: 'Calculator', shortLabel: '42' },
]

const MANUAL_NOTICES: Notice[] = [
  {
    app: 'transactions',
    detail: 'Transaction says $18.40. Receipt says $81.40.',
    id: 'amount-mismatch',
    title: 'Amount mismatch',
    urgent: true,
  },
  {
    app: 'people',
    detail: 'Maya joined three days after this receipt date.',
    id: 'start-date',
    title: 'Directory lookup finished',
  },
  {
    app: 'expenses',
    detail: 'Need these cleared before lunch. Inbox: 47.',
    id: 'manager-message',
    title: 'Finance Ops',
    urgent: true,
  },
]

const RAMP_NOTICES: Notice[] = [
  {
    app: 'expenses',
    detail: 'Receipt, transaction, employee, and policy are connected.',
    id: 'evidence-ready',
    title: 'Case evidence ready',
  },
  {
    app: 'cards',
    detail: 'Seven active cards exceed the intern limit.',
    id: 'card-risk',
    title: 'Card controls suggested',
    urgent: true,
  },
]

const INITIAL_CALCULATOR: CalculatorState = {
  display: '0',
  history: 'Ready',
  operator: null,
  replaceDisplay: false,
  storedValue: null,
}

const EFFECT_COPY: Record<WorkstationEffect, string> = {
  'paper-drop': 'Receipt received · inbox 48',
  approve: 'Case 04 approved · audit trail saved',
  reject: 'Case 04 returned · employee notified',
  fraud: 'High-risk pattern connected · card controls ready',
  'printer-jam': 'Printer queue stopped · 14 jobs waiting',
  migration: 'Migration handshake received · unifying workspace',
}

function calculate(left: number, right: number, operator: CalculatorOperator) {
  if (operator === '+') return left + right
  if (operator === '−') return left - right
  if (operator === '×') return left * right
  return right === 0 ? Number.NaN : left / right
}

function formatCalculatorValue(value: number) {
  if (!Number.isFinite(value)) return 'Error'
  return String(Number(value.toFixed(8))).slice(0, 14)
}

function updateCalculator(state: CalculatorState, input: string): CalculatorState {
  if (input === 'C') return INITIAL_CALCULATOR

  if (input === 'Backspace') {
    if (state.replaceDisplay || state.display === 'Error') return { ...state, display: '0', replaceDisplay: false }
    const display = state.display.length > 1 ? state.display.slice(0, -1) : '0'
    return { ...state, display }
  }

  if (input === '±') {
    if (state.display === '0' || state.display === 'Error') return state
    return { ...state, display: state.display.startsWith('-') ? state.display.slice(1) : `-${state.display}` }
  }

  if (input === '%') {
    const value = Number(state.display)
    if (!Number.isFinite(value)) return state
    return { ...state, display: formatCalculatorValue(value / 100), replaceDisplay: true }
  }

  if (/^\d$/.test(input) || input === '.') {
    if (state.display === 'Error' || state.replaceDisplay) {
      return { ...state, display: input === '.' ? '0.' : input, replaceDisplay: false }
    }
    if (input === '.' && state.display.includes('.')) return state
    if (state.display.length >= 14) return state
    return { ...state, display: state.display === '0' && input !== '.' ? input : `${state.display}${input}` }
  }

  if (input === '+' || input === '−' || input === '×' || input === '÷') {
    const current = Number(state.display)
    if (!Number.isFinite(current)) return INITIAL_CALCULATOR

    if (state.storedValue !== null && state.operator && !state.replaceDisplay) {
      const result = calculate(state.storedValue, current, state.operator)
      const display = formatCalculatorValue(result)
      return {
        display,
        history: `${display} ${input}`,
        operator: input,
        replaceDisplay: true,
        storedValue: result,
      }
    }

    return {
      ...state,
      history: `${state.display} ${input}`,
      operator: input,
      replaceDisplay: true,
      storedValue: current,
    }
  }

  if (input === '=') {
    const current = Number(state.display)
    if (state.storedValue === null || !state.operator || !Number.isFinite(current)) return state
    const result = calculate(state.storedValue, current, state.operator)
    return {
      display: formatCalculatorValue(result),
      history: `${formatCalculatorValue(state.storedValue)} ${state.operator} ${state.display} =`,
      operator: null,
      replaceDisplay: true,
      storedValue: null,
    }
  }

  return state
}

function StatusPill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'good' | 'neutral' | 'risk' }) {
  return <span className={`wsos-status wsos-status--${tone}`}>{children}</span>
}

function EvidenceCard({
  active,
  children,
  label,
  onClick,
  tone = 'neutral',
}: {
  active: boolean
  children: React.ReactNode
  label: string
  onClick: () => void
  tone?: 'good' | 'neutral' | 'risk'
}) {
  return (
    <button
      className={`wsos-evidence-card wsos-evidence-card--${tone}${active ? ' is-active' : ''}`}
      onClick={onClick}
      type="button"
    >
      <span>{label}</span>
      <strong>{children}</strong>
    </button>
  )
}

function ExpenseWorkspace({
  decision,
  onDecision,
  onOpenApp,
  phase,
}: {
  decision: string
  onDecision: (decision: string) => void
  onOpenApp: (app: AppId) => void
  phase: 'manual' | 'ramp'
}) {
  const [selectedEvidence, setSelectedEvidence] = useState('receipt')

  if (phase === 'manual') {
    return (
      <div className="wsos-manual-grid">
        <section className="wsos-pane wsos-pane--queue">
          <header>
            <span>Expense inbox</span>
            <strong>47 open</strong>
          </header>
          <button className="wsos-case-row is-active" type="button">
            <span>04</span><strong>Chopped</strong><b>$18.40</b>
          </button>
          <button className="wsos-case-row" type="button">
            <span>05</span><strong>Omakase Room</strong><b>$684.00</b>
          </button>
          <button className="wsos-case-row" type="button">
            <span>06</span><strong>Dave</strong><b>$14,000</b>
          </button>
          <p className="wsos-system-note">12 receipts are missing. This number may be aspirational.</p>
        </section>

        <section className="wsos-pane wsos-pane--receipt">
          <header><span>Receipt_photo_FINAL2.jpg</span><StatusPill tone="risk">unmatched</StatusPill></header>
          <div className="wsos-receipt-paper">
            <small>CHOPPED · 11:42 AM</small>
            <strong>KALE CAESAR</strong>
            <dl>
              <div><dt>Subtotal</dt><dd>$16.90</dd></div>
              <div><dt>Tax</dt><dd>$1.50</dd></div>
              <div className="is-mismatch"><dt>Total</dt><dd><em>8</em>1.40</dd></div>
            </dl>
            <span>VISA •••• 4812</span>
          </div>
          <button className="wsos-quiet-button" onClick={() => onOpenApp('transactions')} type="button">
            Open transaction record
          </button>
        </section>

        <section className="wsos-pane wsos-pane--manual-checks">
          <header><span>Manual checks</span><b>3 apps needed</b></header>
          <button onClick={() => onOpenApp('transactions')} type="button"><span>Transaction</span><strong>$18.40</strong><b>Open ↗</b></button>
          <button onClick={() => onOpenApp('people')} type="button"><span>Employee</span><strong>Maya Chen</strong><b>Open ↗</b></button>
          <button onClick={() => onOpenApp('policy')} type="button"><span>Policy PDF</span><strong>Page 17?</strong><b>Open ↗</b></button>
          <div className="wsos-decision-strip">
            <button onClick={() => onDecision('approved')} type="button">Approve</button>
            <button onClick={() => onDecision('returned')} type="button">Return</button>
            <button onClick={() => onDecision('investigate')} type="button">Investigate</button>
          </div>
          <p>Case state: <strong>{decision}</strong></p>
        </section>
      </div>
    )
  }

  const evidenceCopy: Record<string, { body: string; title: string }> = {
    receipt: { title: 'Receipt match', body: 'Image total $81.40 differs from card transaction $18.40. The leading digit has inconsistent ink density.' },
    policy: { title: 'Policy result', body: 'Receipt amount must match merchant, date, and transaction total. Mismatch requires review.' },
    employee: { title: 'Employee context', body: 'Maya Chen · Product Design · Active · $2,500 monthly card limit.' },
    vendor: { title: 'Merchant profile', body: 'Chopped · Established vendor · No duplicate bank details · 38 prior company transactions.' },
  }
  const detail = evidenceCopy[selectedEvidence]

  return (
    <div className="wsos-ramp-workspace">
      <section className="wsos-case-heading">
        <div>
          <span>Case 04 · Maya Chen</span>
          <h2>Amount mismatch at Chopped</h2>
          <p>Only the evidence that needs judgment is shown.</p>
        </div>
        <StatusPill tone="risk">Needs review</StatusPill>
      </section>

      <section className="wsos-evidence-thread" aria-label="Connected case evidence">
        <EvidenceCard active={selectedEvidence === 'receipt'} label="Receipt" onClick={() => setSelectedEvidence('receipt')} tone="risk">$81.40 photographed</EvidenceCard>
        <EvidenceCard active={selectedEvidence === 'policy'} label="Policy" onClick={() => setSelectedEvidence('policy')} tone="risk">Amount must match</EvidenceCard>
        <EvidenceCard active={selectedEvidence === 'employee'} label="Employee" onClick={() => setSelectedEvidence('employee')}>Maya Chen · active</EvidenceCard>
        <EvidenceCard active={selectedEvidence === 'vendor'} label="Vendor" onClick={() => setSelectedEvidence('vendor')} tone="good">Known merchant</EvidenceCard>
      </section>

      <section className="wsos-evidence-detail">
        <span>Connected evidence</span>
        <h3>{detail.title}</h3>
        <p>{detail.body}</p>
        <div className="wsos-match-figure">
          <div><span>Card</span><strong>$18.40</strong></div>
          <b>≠</b>
          <div><span>Receipt</span><strong>$81.40</strong></div>
        </div>
        <button className="wsos-text-link" onClick={() => onOpenApp(selectedEvidence === 'employee' ? 'people' : selectedEvidence === 'vendor' ? 'vendor' : 'policy')} type="button">
          Open source record ↗
        </button>
      </section>

      <section className="wsos-recommendation">
        <span>Suggested next step</span>
        <strong>Ask Maya for a corrected receipt.</strong>
        <p>Approval remains your decision. The mismatch and policy rule will stay attached to the case.</p>
        <div>
          <button className="wsos-action wsos-action--primary" onClick={() => onDecision('returned')} type="button">Request receipt</button>
          <button className="wsos-action" onClick={() => onDecision('approved')} type="button">Approve anyway</button>
        </div>
        <small>Case state · {decision}</small>
      </section>
    </div>
  )
}

function CalculatorApp({ calculator, onInput }: { calculator: CalculatorState; onInput: (input: string) => void }) {
  const keys = ['C', 'Backspace', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '±', '0', '.', '=']

  return (
    <div className="wsos-calculator-app">
      <section className="wsos-calculator">
        <div className="wsos-calculator-display">
          <span>{calculator.history}</span>
          <strong>{calculator.display}</strong>
        </div>
        <div className="wsos-calculator-keys">
          {keys.map((key) => (
            <button
              className={key === '=' ? 'is-equals' : ['÷', '×', '−', '+'].includes(key) ? 'is-operator' : ''}
              key={key}
              onClick={() => onInput(key)}
              type="button"
            >
              {key === 'Backspace' ? '⌫' : key}
            </button>
          ))}
        </div>
      </section>
      <aside className="wsos-calculator-tape">
        <span>Evidence tape</span>
        <h3>Infinite tip check</h3>
        <p>$980.00 ÷ $21.80 × 100</p>
        <strong>4,495%</strong>
        <small>Concerning.</small>
        <button onClick={() => onInput('example')} type="button">
          Load example
        </button>
      </aside>
    </div>
  )
}

function RecordsApp({ app, cardFrozen, onCardToggle, phase }: { app: AppId; cardFrozen: boolean; onCardToggle: () => void; phase: 'manual' | 'ramp' }) {
  if (app === 'transactions') {
    return (
      <div className="wsos-record-view">
        <header><div><span>Transactions / 4812</span><h2>Chopped</h2></div><StatusPill>Cleared</StatusPill></header>
        <dl className="wsos-record-grid">
          <div><dt>Amount</dt><dd>$18.40</dd></div><div><dt>Date</dt><dd>Jun 18 · 11:42 AM</dd></div>
          <div><dt>Employee</dt><dd>Maya Chen</dd></div><div><dt>Category</dt><dd>Meals</dd></div>
          <div><dt>Card</dt><dd>Visa •••• 4812</dd></div><div><dt>Memo</dt><dd>Team lunch</dd></div>
        </dl>
        <div className="wsos-record-warning"><strong>Receipt says $81.40</strong><span>Manual comparison required.</span></div>
      </div>
    )
  }

  if (app === 'people') {
    return (
      <div className="wsos-record-view">
        <header><div><span>Employee directory</span><h2>Maya Chen</h2></div><StatusPill tone="good">Active</StatusPill></header>
        <div className="wsos-person-card"><div className="wsos-avatar">MC</div><div><strong>Product designer</strong><span>New York · Manager: Devon Lee</span></div></div>
        <dl className="wsos-record-grid"><div><dt>Start date</dt><dd>Jun 21, 2026</dd></div><div><dt>Monthly limit</dt><dd>$2,500</dd></div><div><dt>Spend this month</dt><dd>$1,742</dd></div><div><dt>Employment</dt><dd>Full time</dd></div></dl>
      </div>
    )
  }

  if (app === 'policy') {
    const rules = ['Meals limited to $35 per attendee', 'Tips above 25% require review', 'Travel must match an approved trip', 'Technology requires inventory records', 'Receipts must match amount, merchant, and date', 'Livestock needs executive and facilities approval']
    return (
      <div className="wsos-policy-view">
        <aside><span>EXPENSE_POLICY_FINAL_v7.pdf</span><b>Page 17 / 46</b><small>{phase === 'manual' ? 'Search unavailable' : 'Case rules highlighted'}</small></aside>
        <section><header><span>FIN-04</span><h2>Company expense policy</h2></header>{rules.map((rule, index) => <p className={index === 4 ? 'is-highlighted' : ''} key={rule}><b>{String(index + 1).padStart(2, '0')}</b>{rule}</p>)}</section>
      </div>
    )
  }

  if (app === 'travel') {
    return (
      <div className="wsos-travel-view">
        <header><div><span>Approved trip · Jun 18–20</span><h2>New York → Chicago</h2></div><StatusPill tone="risk">3 out of trip</StatusPill></header>
        <div className="wsos-travel-line"><span>JFK</span><i /><span>ORD</span><i className="is-risk" /><span>MIA?</span><i className="is-risk" /><span>TYO?</span></div>
        <div className="wsos-travel-events"><div><b>Jun 18 · 9:10</b><span>Chicago hotel · matched</span></div><div className="is-risk"><b>Jun 18 · 13:42</b><span>Miami limousine · 1,191 mi away</span></div><div className="is-risk"><b>Jun 19 · 02:11</b><span>Tokyo room service · impossible overlap</span></div></div>
      </div>
    )
  }

  if (app === 'inventory') {
    return (
      <div className="wsos-sheet-view"><header><span>inventory_REALLY_FINAL.csv</span><b>Autosave failed 8m ago</b></header><table><thead><tr><th>Asset</th><th>Purchased</th><th>Counted</th><th>Variance</th></tr></thead><tbody><tr><td>MacBooks</td><td>24</td><td>11</td><td className="is-risk">−13</td></tr><tr><td>Monitors</td><td>40</td><td>19</td><td className="is-risk">−21</td></tr><tr><td>Keyboards</td><td>90</td><td>143</td><td>+53*</td></tr></tbody></table><p>* Keyboard count may have been imported by weight.</p></div>
    )
  }

  if (app === 'vendor') {
    return (
      <div className="wsos-record-view"><header><div><span>Vendor intelligence</span><h2>SynergyAlphaWolf Media LLC</h2></div><StatusPill tone="risk">High risk</StatusPill></header><div className="wsos-signal-grid"><div><span>Created</span><strong>Yesterday</strong></div><div><span>Address</span><strong>Matches employee</strong></div><div><span>Followers</span><strong>14 total</strong></div><div><span>Approvals</span><strong>Legal missing</strong></div></div><div className="wsos-record-warning"><strong>$5,357 per verified follower</strong><span>Related employee and address are connected to this case.</span></div></div>
    )
  }

  if (app === 'cards') {
    return (
      <div className="wsos-card-view"><header><div><span>Card control · Intern program</span><h2>Operations card •• 0038</h2></div><StatusPill tone={cardFrozen ? 'risk' : 'good'}>{cardFrozen ? 'Frozen' : 'Active'}</StatusPill></header><div className={`wsos-card-graphic${cardFrozen ? ' is-frozen' : ''}`}><span>COMPANY CARD</span><strong>•••• 0038</strong><small>ROWAN · INTERN</small></div><dl><div><dt>Monthly limit</dt><dd>$40,000</dd></div><div><dt>Policy limit</dt><dd>$500</dd></div><div><dt>Active cards</dt><dd>7</dd></div></dl><button className="wsos-action wsos-action--danger" onClick={onCardToggle} type="button">{cardFrozen ? 'Unfreeze card' : 'Freeze card'}</button></div>
    )
  }

  return null
}

export function WorkstationOS({
  effect,
  effectRun = 0,
  focused,
  migrationStep = 0,
  onAdvanceMigration,
  onExit,
  onFocus,
  onTryRamp,
  phase = 'manual',
  rampPromptVisible = false,
}: WorkstationOSProps) {
  const settledPhase = phase === 'ramp' ? 'ramp' : 'manual'
  const apps = settledPhase === 'ramp' ? RAMP_APPS : MANUAL_APPS
  const [activeApp, setActiveApp] = useState<AppId>('expenses')
  const [cardFrozen, setCardFrozen] = useState(false)
  const [calculator, setCalculator] = useState(INITIAL_CALCULATOR)
  const [decision, setDecision] = useState('review')
  const [dismissedNotices, setDismissedNotices] = useState<string[]>([])
  const [noticeRailOpen, setNoticeRailOpen] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const rampAction = useRef<HTMLButtonElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const rampPromptActive = phase === 'manual' && rampPromptVisible

  const notices = useMemo(
    () => (settledPhase === 'ramp' ? RAMP_NOTICES : MANUAL_NOTICES).filter((notice) => !dismissedNotices.includes(notice.id)),
    [dismissedNotices, settledPhase],
  )

  useEffect(() => {
    if (!apps.some((app) => app.id === activeApp)) setActiveApp('expenses')
  }, [activeApp, apps])

  useEffect(() => {
    if (!effect || effectRun < 1) return
    setToast(EFFECT_COPY[effect])
    const timeout = window.setTimeout(() => setToast(null), effect === 'migration' ? 2100 : 1500)
    return () => window.clearTimeout(timeout)
  }, [effect, effectRun])

  const openApp = useCallback((app: AppId) => {
    setActiveApp(app)
    setToast(null)
  }, [])

  const sendCalculatorInput = useCallback((input: string) => {
    if (input === 'example') {
      setCalculator({
        display: '4495.412844',
        history: '980 ÷ 21.8 × 100 =',
        operator: null,
        replaceDisplay: true,
        storedValue: null,
      })
      return
    }
    setCalculator((state) => updateCalculator(state, input))
  }, [])

  useEffect(() => {
    if (!focused) return
    root.current?.focus({ preventScroll: true })
  }, [focused])

  useEffect(() => {
    if (!rampPromptActive) return
    rampAction.current?.focus({ preventScroll: true })
  }, [rampPromptActive])

  const containInput = useCallback((event: React.SyntheticEvent) => {
    event.stopPropagation()
  }, [])

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!focused) return
    event.stopPropagation()

    if (rampPromptActive) {
      if (event.key === 'Escape' || event.key === 'Tab') event.preventDefault()
      if (event.key === 'Tab') rampAction.current?.focus({ preventScroll: true })
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      onExit()
      return
    }

    const shortcutIndex = Number(event.key) - 1
    if ((event.metaKey || event.ctrlKey) && shortcutIndex >= 0 && shortcutIndex < apps.length) {
      event.preventDefault()
      openApp(apps[shortcutIndex].id)
      return
    }

    if ((event.metaKey || event.ctrlKey) && event.key === 'Tab') {
      event.preventDefault()
      const currentIndex = apps.findIndex((app) => app.id === activeApp)
      openApp(apps[(currentIndex + 1) % apps.length].id)
      return
    }

    if (activeApp !== 'calculator' || event.metaKey || event.ctrlKey || event.altKey) return

    if (event.key === 'Enter' && event.target instanceof HTMLElement && event.target.closest('button, a, input, select, textarea')) {
      return
    }

    const keyMap: Record<string, string> = {
      '*': '×',
      '/': '÷',
      '-': '−',
      Enter: '=',
      '=': '=',
      Backspace: 'Backspace',
      Delete: 'C',
      c: 'C',
      C: 'C',
    }
    const input = /^\d$/.test(event.key) || ['.', '+', '%'].includes(event.key) ? event.key : keyMap[event.key]
    if (input) {
      event.preventDefault()
      sendCalculatorInput(input)
    }
  }, [activeApp, apps, focused, onExit, openApp, rampPromptActive, sendCalculatorInput])

  const activeDefinition = apps.find((app) => app.id === activeApp) ?? apps[0]

  return (
    <div
      aria-label="Expense OS finance workstation"
      className={`wsos-root wsos-root--${settledPhase}${focused ? ' is-focused' : ''}`}
      data-phase={phase}
      onClick={containInput}
      onContextMenu={containInput}
      onDoubleClick={containInput}
      onKeyDown={handleKeyDown}
      onPointerCancel={containInput}
      onPointerDown={containInput}
      onPointerMove={containInput}
      onPointerUp={containInput}
      onWheel={containInput}
      ref={root}
      role="application"
      tabIndex={focused && !rampPromptActive ? 0 : -1}
    >
      <div
        aria-hidden={rampPromptActive ? true : undefined}
        className="wsos-interactive-surface"
        inert={rampPromptActive || !focused ? true : undefined}
      >
        <header className="wsos-menu-bar">
          <div className="wsos-menu-left">
            <button aria-label="Open expense workspace" className="wsos-os-mark" onClick={() => openApp('expenses')} type="button">R/P</button>
            <strong>Expense OS</strong>
            <span>Case</span><span>Evidence</span><span>Window</span>
          </div>
          <div className="wsos-menu-right">
            <span className="wsos-case-number">CASE 04 / 47</span>
            <label className="wsos-cortisol"><span>Cortisol</span><i><b /></i><em>{settledPhase === 'ramp' ? '22%' : '88%'}</em></label>
            <button aria-label={soundEnabled ? 'Mute workstation sounds' : 'Enable workstation sounds'} onClick={() => setSoundEnabled((value) => !value)} type="button">{soundEnabled ? 'VOL' : 'MUTE'}</button>
            <button aria-label="Toggle notifications" className={notices.length ? 'has-notices' : ''} onClick={() => setNoticeRailOpen((value) => !value)} type="button">NTF {notices.length}</button>
            <time>11:54 AM</time>
            {!rampPromptVisible && <button aria-label="Exit workstation focus" className="wsos-exit" onClick={onExit} type="button">×</button>}
          </div>
        </header>

        <main className="wsos-desktop">
        <div className="wsos-wallpaper-copy" aria-hidden="true"><span>FINANCE OPERATIONS</span><strong>{settledPhase === 'ramp' ? 'Connected judgment' : 'Quarter close / day 19'}</strong></div>

        <section className={`wsos-window${noticeRailOpen ? ' has-notice-rail' : ''}`}>
          <header className="wsos-window-bar">
            <div aria-hidden="true"><i /><i /><i /></div>
            <strong>{activeDefinition.label}</strong>
            <span>{settledPhase === 'ramp' ? 'SYNCED · 6 NEED ATTENTION' : 'LOCAL · AUTOSAVE UNRELIABLE'}</span>
          </header>

          <div className="wsos-window-body">
            {activeApp === 'expenses' ? (
              <ExpenseWorkspace decision={decision} onDecision={setDecision} onOpenApp={openApp} phase={settledPhase} />
            ) : activeApp === 'calculator' ? (
              <CalculatorApp calculator={calculator} onInput={sendCalculatorInput} />
            ) : (
              <RecordsApp app={activeApp} cardFrozen={cardFrozen} onCardToggle={() => setCardFrozen((value) => !value)} phase={settledPhase} />
            )}
          </div>

          {noticeRailOpen && (
            <aside className="wsos-notice-rail" aria-label="Workstation notifications">
              <header><span>Notifications</span>{notices.length > 0 && <button onClick={() => setDismissedNotices((current) => [...current, ...notices.map((notice) => notice.id)])} type="button">Clear</button>}</header>
              {notices.length === 0 ? <p className="wsos-notice-empty">Nothing waiting. Enjoy the suspicious silence.</p> : notices.map((notice) => (
                <article className={notice.urgent ? 'is-urgent' : ''} key={notice.id}>
                  <div><span>{notice.title}</span><button aria-label={`Dismiss ${notice.title}`} onClick={() => setDismissedNotices((current) => [...current, notice.id])} type="button">×</button></div>
                  <p>{notice.detail}</p>
                  <button onClick={() => openApp(notice.app)} type="button">Open</button>
                </article>
              ))}
            </aside>
          )}
        </section>

        <nav className="wsos-dock" aria-label="Workstation applications">
          {apps.map((app, index) => (
            <button
              aria-label={`Open ${app.label}. Shortcut ${index + 1}`}
              className={activeApp === app.id ? 'is-active' : ''}
              key={app.id}
              onClick={() => openApp(app.id)}
              title={`${app.label} · ${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+${index + 1}`}
              type="button"
            >
              <span>{app.shortLabel}</span>
              <small>{app.label}</small>
            </button>
          ))}
        </nav>

        <div className="wsos-focus-hint"><kbd>Esc</kbd> exit screen <span>·</span> <kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} 1–{apps.length}</kbd> switch apps</div>
        </main>
      </div>

      {rampPromptActive && (
        <section aria-labelledby="ramp-intro-title" aria-modal="true" className="wsos-ramp-prompt" role="dialog">
          <div className="wsos-ramp-prompt__eyebrow">
            <img alt="Ramp" src="/brand/ramp-lockup-white.svg" />
            <span>Finance Ops · migration ready</span>
          </div>
          <strong id="ramp-intro-title">Your Ramp workspace is ready.</strong>
          <p>Receipts, policy, travel, vendors, and card controls can now meet in one workspace. Your judgment stays in the loop.</p>
          <dl>
            <div><dt>Expenses checked</dt><dd>47</dd></div>
            <div><dt>Need attention</dt><dd>6</dd></div>
          </dl>
          <button onClick={onTryRamp} ref={rampAction} type="button">Try Ramp</button>
          <small>This is the only way forward.</small>
        </section>
      )}

      {phase === 'migrating' && (
        <div aria-live="polite" className="wsos-migration" role="status">
          <div className="wsos-migration-logo"><img alt="Ramp" src="/brand/ramp-lockup-white.svg" /></div>
          <span>Expense OS · interactive migration</span>
          <strong>{RAMP_MIGRATION_STEPS[Math.min(migrationStep, RAMP_MIGRATION_STEPS.length - 1)]}</strong>
          <div className="wsos-migration-progress" aria-label={`${migrationStep} of ${RAMP_MIGRATION_STEPS.length} systems connected`}>
            {RAMP_MIGRATION_STEPS.map((step, index) => (
              <i className={index < migrationStep ? 'is-complete' : index === migrationStep ? 'is-active' : ''} key={step} />
            ))}
          </div>
          <small>{migrationStep} / {RAMP_MIGRATION_STEPS.length} systems connected · 47 expenses waiting</small>
          <button onClick={onAdvanceMigration} type="button">
            {migrationStep === RAMP_MIGRATION_STEPS.length - 1 ? 'Finish migration' : 'Connect next system'}
          </button>
        </div>
      )}

      {toast && <div aria-live="polite" className="wsos-toast">{toast}</div>}

      {!focused && phase === 'manual' && !rampPromptActive && (
        <button className="wsos-focus-gate" onClick={onFocus} type="button">
          <span>Interactive workstation</span>
          <strong>Click to focus screen</strong>
          <small>Keyboard input and app controls become active</small>
        </button>
      )}
    </div>
  )
}
