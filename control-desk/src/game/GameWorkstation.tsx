import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { useLabStore, type EffectPreset } from '../store/useLabStore'
import { GAME_CASES, MANUAL_CASE_COUNT, formatMoney, formatReceiptDate, type GameDecision } from './gameData'
import { requestGameAudioCue } from './gameAudio'
import { useGameStore } from './useGameStore'

import './game.css'

const DECISIONS: Array<{ decision: GameDecision; label: string }> = [
  { decision: 'approve', label: 'Approve' },
  { decision: 'reject', label: 'Reject' },
  { decision: 'investigate', label: 'Investigate' },
]

const EFFECT_FOR_DECISION: Record<GameDecision, EffectPreset> = {
  approve: 'approve',
  investigate: 'fraud',
  reject: 'reject',
}

const MANUAL_SLACK_MESSAGES = [
  ['Finance Manager', 'Need these cleared before lunch. Inbox: 12 and developing ambitions.'],
  ['People Ops', 'Rowan starts Friday. Why is there already a receipt?'],
  ['Rowan', 'The dinner was executive in spirit.'],
  ['Finance Ops', 'A 4,495% tip has entered the chat.'],
  ['Alex', 'The fonts looked consistent on my phone.'],
  ['IT Inventory', 'We cannot locate the laptops or, currently, Sam.'],
] as const

const MANUAL_POLICY_RULES = [
  '$35 per meal attendee',
  'Tips above 25% require review',
  'Receipt amount and date must match',
  'Technology requires inventory records',
]

const RAMP_POLICY_RULES = [
  'Policy automatically checked',
  'Vendor and approval history connected',
  'Travel and inventory linked',
  'Judgment still required',
]

function formatTime(seconds: number) {
  const remaining = Math.max(0, 300 - seconds)
  return `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
}

function titleCase(value: string) {
  return value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function GameWorkstation() {
  const activeActions = useGameStore((state) => state.activeActions)
  const advanceCase = useGameStore((state) => state.advanceCase)
  const beginMigration = useGameStore((state) => state.beginMigration)
  const caseIndex = useGameStore((state) => state.caseIndex)
  const decisions = useGameStore((state) => state.decisions)
  const elapsedSeconds = useGameStore((state) => state.elapsedSeconds)
  const feedback = useGameStore((state) => state.feedback)
  const paused = useGameStore((state) => state.paused)
  const performAction = useGameStore((state) => state.performAction)
  const phase = useGameStore((state) => state.phase)
  const soundEnabled = useGameStore((state) => state.soundEnabled)
  const submitDecision = useGameStore((state) => state.submitDecision)
  const togglePause = useGameStore((state) => state.togglePause)
  const toggleSound = useGameStore((state) => state.toggleSound)
  const beginRampTransition = useLabStore((state) => state.beginRampTransition)
  const triggerEffect = useLabStore((state) => state.triggerEffect)
  const [selectedEvidence, setSelectedEvidence] = useState(0)
  const [calculatorVisible, setCalculatorVisible] = useState(false)
  const [receiptDragging, setReceiptDragging] = useState(false)
  const currentCase = GAME_CASES[Math.min(caseIndex, GAME_CASES.length - 1)]
  const correctCount = decisions.filter((decision) => decision.correct).length
  const phaseCaseNumber = currentCase.era === 'manual' ? caseIndex + 1 : caseIndex - MANUAL_CASE_COUNT + 1
  const phaseCaseTotal = currentCase.era === 'manual' ? MANUAL_CASE_COUNT : GAME_CASES.length - MANUAL_CASE_COUNT
  const inboxCount = phase === 'migration-prompt'
    ? 47
    : currentCase.era === 'manual'
      ? Math.max(12, 12 + Math.floor(elapsedSeconds / 18) - Math.floor(decisions.length / 2))
      : Math.max(0, GAME_CASES.length - caseIndex)
  const cortisol = phase === 'migration-prompt'
    ? 97
    : currentCase.era === 'manual'
      ? Math.min(97, 69 + Math.floor(elapsedSeconds / 12) + caseIndex * 3)
      : Math.max(8, 38 - (caseIndex - MANUAL_CASE_COUNT) * 6)
  const selected = currentCase.evidence[selectedEvidence] ?? currentCase.evidence[0]
  const requiredActions = currentCase.truth.requiredActions ?? []
  const nextLabel = caseIndex === MANUAL_CASE_COUNT - 1
    ? 'Face the printer backlog'
    : caseIndex === GAME_CASES.length - 1
      ? 'Clear the inbox'
      : 'Next case'
  const slackMessage = MANUAL_SLACK_MESSAGES[Math.min(caseIndex, MANUAL_SLACK_MESSAGES.length - 1)]

  useEffect(() => {
    setSelectedEvidence(0)
    setCalculatorVisible(false)
    setReceiptDragging(false)
  }, [currentCase.caseId])

  const queueCases = useMemo(() => GAME_CASES.filter((entry) => entry.era === currentCase.era), [currentCase.era])

  const handleDecision = (decision: GameDecision) => {
    requestGameAudioCue('stamp-pickup', 0.46)
    submitDecision(decision)
    triggerEffect(EFFECT_FOR_DECISION[decision])
  }

  const handleReceiptDragStart = (event: DragEvent<HTMLElement>) => {
    if (feedback || paused || !['manual', 'ramp'].includes(phase)) {
      event.preventDefault()
      return
    }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-receipts-please-case', currentCase.caseId)
    setReceiptDragging(true)
    requestGameAudioCue('paper-pickup', 0.4)
  }

  const handleReceiptDrop = (event: DragEvent<HTMLButtonElement>, decision: GameDecision) => {
    event.preventDefault()
    if (event.dataTransfer.getData('application/x-receipts-please-case') !== currentCase.caseId) return
    setReceiptDragging(false)
    requestGameAudioCue('receipt-drop', 0.42)
    handleDecision(decision)
  }

  const handleAction = (action: string) => {
    performAction(action)
    if (action === 'freeze-card') {
      requestGameAudioCue('freeze-cover', 0.5)
      requestGameAudioCue('freeze-button', 0.64)
      triggerEffect('fraud')
      return
    }
    requestGameAudioCue('evidence-link', 0.38)
  }

  const handleEvidence = (index: number) => {
    setSelectedEvidence(index)
    setCalculatorVisible(false)
    requestGameAudioCue('evidence-link', 0.34)
  }

  const handleCalculator = () => {
    const opening = !calculatorVisible
    setCalculatorVisible(opening)
    requestGameAudioCue('calculator-key', 0.36)
    if (opening) requestGameAudioCue('calculator-print', 0.44)
  }

  const handleTryRamp = () => {
    beginMigration()
    beginRampTransition()
  }

  const handleAdvanceCase = () => {
    if (caseIndex === MANUAL_CASE_COUNT - 1) triggerEffect('printer-jam')
    advanceCase()
  }

  return (
    <div
      aria-label="Receipts, Please game workstation"
      className={`game-workstation game-workstation--${currentCase.era}`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      role="application"
    >
      <header className="game-os-bar">
        <div><b>R/P</b><strong>{currentCase.era === 'manual' ? 'Expense OS' : 'Ramp · Expenses'}</strong><span>{currentCase.era === 'manual' ? '0:20–2:10 · LOCAL WORKSPACE' : '2:35–4:40 · CONNECTED WORKSPACE'}</span></div>
        <div>
          <span>INBOX <strong>{inboxCount}</strong></span>
          <label><span>LOW CORTISOL</span><i><b style={{ width: `${100 - cortisol}%` }} /></i><em>{100 - cortisol}%</em></label>
          <button aria-label={soundEnabled ? 'Mute game audio' : 'Enable game audio'} onClick={toggleSound} type="button">{soundEnabled ? 'VOL' : 'MUTE'}</button>
          <button onClick={togglePause} type="button">{paused ? 'RESUME' : 'PAUSE'}</button>
          <time>{formatTime(elapsedSeconds)}</time>
        </div>
      </header>

      <div className="game-os-body">
        <aside className="game-queue">
          <header><span>{currentCase.era === 'manual' ? 'Expense inbox' : 'Needs judgment'}</span><b>{phaseCaseNumber}/{phaseCaseTotal}</b></header>
          {queueCases.map((entry) => {
            const absoluteIndex = GAME_CASES.indexOf(entry)
            return (
              <div className={`${absoluteIndex === caseIndex ? 'is-current' : ''}${absoluteIndex < caseIndex ? ' is-done' : ''}`} key={entry.caseId}>
                <span>{String(entry.sequence).padStart(2, '0')}</span>
                <strong>{entry.queueLabel}</strong>
                <small>{absoluteIndex < caseIndex ? 'reviewed' : absoluteIndex === caseIndex ? entry.receipt.merchant.name : 'waiting'}</small>
              </div>
            )
          })}
          <footer><span>Accuracy</span><strong>{decisions.length ? Math.round(correctCount / decisions.length * 100) : 100}%</strong></footer>
        </aside>

        <main className="game-case-view">
          <header>
            <div><span>CASE {String(currentCase.sequence).padStart(2, '0')} · {currentCase.employee}</span><h1>{currentCase.title}</h1></div>
            <em>{currentCase.era === 'manual' ? 'MANUAL MATCHING' : 'RAMP SURFACED'}</em>
          </header>

          <div className="game-document-stage">
            <article
              className={`game-receipt game-receipt--${currentCase.receipt.visualTreatmentId}${receiptDragging ? ' is-dragging' : ''}`}
              draggable={!feedback && !paused && ['manual', 'ramp'].includes(phase)}
              onDragEnd={() => setReceiptDragging(false)}
              onDragStart={handleReceiptDragStart}
            >
              <span>{currentCase.receipt.merchant.name}</span>
              <small>{currentCase.receipt.merchant.addressLines[0]}</small>
              <small>{formatReceiptDate(currentCase.receipt.issuedAt)}</small>
              <hr />
              {currentCase.receipt.lineItems.map((line) => (
                <div key={`${line.description}-${line.quantity}`}><b>{line.quantity}× {line.description}</b><strong>{formatMoney(line.lineTotalCents)}</strong></div>
              ))}
              <hr />
              <div><b>SUBTOTAL</b><strong>{formatMoney(currentCase.receipt.amounts.subtotalCents)}</strong></div>
              {currentCase.receipt.amounts.taxCents > 0 && <div><b>TAX</b><strong>{formatMoney(currentCase.receipt.amounts.taxCents)}</strong></div>}
              {currentCase.receipt.amounts.tipCents > 0 && <div className="is-risk"><b>TIP</b><strong>{formatMoney(currentCase.receipt.amounts.tipCents)}</strong></div>}
              <div className={currentCase.receipt.amounts.printedTotalCents !== currentCase.receipt.amounts.calculatedTotalCents ? 'is-altered' : ''}><b>TOTAL</b><strong>{formatMoney(currentCase.receipt.amounts.printedTotalCents)}</strong></div>
              <hr />
              <small>{currentCase.receipt.payment.method} •••• {currentCase.receipt.payment.cardLast4}</small>
              {typeof currentCase.receipt.copy.memo === 'string' && <p>{currentCase.receipt.copy.memo}</p>}
              {caseIndex === 0 && !feedback && <em className="game-drag-hint">Drag this receipt to a decision tray</em>}
            </article>

            <section className="game-evidence-inspector">
              <nav aria-label="Case evidence">
                {currentCase.evidence.map((evidence, index) => (
                  <button className={!calculatorVisible && selectedEvidence === index ? 'is-active' : ''} key={evidence.label} onClick={() => handleEvidence(index)} type="button">{evidence.label}</button>
                ))}
                {currentCase.truth.calculatorOperation && <button className={calculatorVisible ? 'is-active' : ''} onClick={handleCalculator} type="button">Calculator</button>}
              </nav>

              {calculatorVisible && currentCase.truth.calculatorOperation ? (
                <div className="game-calculator-tape">
                  <span>CALCULATOR TAPE</span><strong>{currentCase.truth.calculatorOperation.resultDisplay}</strong><small>Attached as evidence</small>
                </div>
              ) : (
                <div className={`game-evidence-card game-evidence-card--${selected.tone ?? 'neutral'}`}>
                  <span>{selected.label}</span><strong>{selected.value}</strong><p>{selected.detail}</p>
                </div>
              )}

              {currentCase.era === 'manual' ? (
                <p className="game-workflow-note">Information is split across records. Inspect the receipt, compare the open evidence, then make the call.</p>
              ) : (
                <div className="game-ramp-summary"><span>Connected evidence</span><strong>{currentCase.evidence.filter((item) => item.tone === 'risk').length} risk signals surfaced</strong><p>Only this case still needs your judgment.</p></div>
              )}
            </section>
          </div>

          <section className={`game-policy-context game-policy-context--${currentCase.era}`}>
            <span>{currentCase.era === 'manual' ? 'POLICY SHEET · PAPER COPY' : 'RAMP · STRUCTURED POLICY'}</span>
            <div>{(currentCase.era === 'manual' ? MANUAL_POLICY_RULES : RAMP_POLICY_RULES).map((rule) => <i key={rule}>{rule}</i>)}</div>
          </section>

          {requiredActions.length > 0 && (
            <section className="game-case-actions">
              <span>Required case actions</span>
              <div>{requiredActions.map((action) => <button className={activeActions.includes(action) ? 'is-complete' : ''} key={action} onClick={() => handleAction(action)} type="button">{activeActions.includes(action) ? '✓ ' : ''}{currentCase.actionLabels[action] ?? titleCase(action)}</button>)}</div>
            </section>
          )}
        </main>
      </div>

      {currentCase.era === 'manual' && phase === 'manual' && !feedback && (
        <aside className="game-slack-toast" aria-live="polite">
          <span>SLACK · NEW MESSAGE</span>
          <strong>{slackMessage[0]}</strong>
          <p>{slackMessage[1]}</p>
        </aside>
      )}

      <footer className="game-decision-bar">
        <div><span>Decision trays</span><small>One main clue · judgment stays with you</small></div>
        {DECISIONS.map(({ decision, label }) => (
          <button
            className={`is-${decision}${receiptDragging ? ' is-drop-ready' : ''}`}
            disabled={Boolean(feedback) || paused}
            key={decision}
            onClick={() => handleDecision(decision)}
            onDragOver={(event) => {
              if (!receiptDragging) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
            }}
            onDrop={(event) => handleReceiptDrop(event, decision)}
            type="button"
          >
            <span>{label}</span><small>{decision === 'investigate' ? 'Hold + escalate' : `Stamp ${label.toLowerCase()}`}</small>
          </button>
        ))}
      </footer>

      {phase === 'migration-prompt' && (
        <section aria-labelledby="game-ramp-title" aria-modal="true" className="game-migration-prompt" role="dialog">
          <img alt="Ramp" src="/brand/ramp-lockup-white.svg" />
          <span>Finance Ops · migration ready</span>
          <h2 id="game-ramp-title">Your Ramp workspace is ready.</h2>
          <p>Receipts, policy, travel, vendors, inventory, and card controls can now meet in one place. Your judgment stays in the loop.</p>
          <dl><div><dt>Expenses checked</dt><dd>47</dd></div><div><dt>Need attention</dt><dd>6</dd></div></dl>
          <div className="game-pressure-stack" aria-label="Finance Ops messages">
            <span><b>Finance Ops</b> Inbox is moving in the wrong direction.</span>
            <span><b>Finance Manager</b> Printer is doing something medically concerning.</span>
            <span><b>Finance Ops</b> Migration is ready. Please click the only button.</span>
          </div>
          <button onClick={handleTryRamp} type="button">Try Ramp</button>
          <small>This is the only way forward.</small>
        </section>
      )}

      {feedback && (
        <section aria-live="polite" className={`game-feedback ${feedback.correct ? 'is-correct' : 'is-wrong'}`}>
          <span>{feedback.correct ? 'CORRECT JUDGMENT' : 'AUDIT NOTE'}</span>
          <h2>{feedback.correct ? currentCase.truth.primaryClue : `Expected: ${titleCase(feedback.expectedDecision)}`}</h2>
          <p>{feedback.explanation}</p>
          {feedback.missingActions.length > 0 && <small>Missing actions: {feedback.missingActions.map((action) => currentCase.actionLabels[action] ?? titleCase(action)).join(', ')}</small>}
          <button onClick={handleAdvanceCase} type="button">{nextLabel}</button>
        </section>
      )}

      {paused && <div className="game-pause-screen"><span>SHIFT PAUSED</span><button onClick={togglePause} type="button">Resume reviewing</button></div>}
    </div>
  )
}
