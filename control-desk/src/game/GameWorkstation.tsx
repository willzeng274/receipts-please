import { useEffect, useMemo, useState } from 'react'
import { useLabStore } from '../store/useLabStore'
import { GAME_CASES, MANUAL_CASE_COUNT, formatMoney, formatReceiptDate, type GameCase } from './gameData'
import { requestGameAudioCue } from './gameAudio'
import { useGameStore } from './useGameStore'

import './game.css'

function formatTime(seconds: number) {
  const remaining = Math.max(0, 300 - seconds)
  return `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
}

function titleCase(value: string) {
  return value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function ReceiptDocument({ gameCase }: { gameCase: GameCase }) {
  const frankenstein = gameCase.caseId === 'manual-05-frankenstein-receipt'
  return (
    <article className={`game-receipt game-receipt--${gameCase.receipt.visualTreatmentId}${frankenstein ? ' game-receipt--frankenstein' : ''}`}>
      <span className={frankenstein ? 'is-merchant-font' : ''}>{gameCase.receipt.merchant.name}</span>
      <small>{gameCase.receipt.merchant.addressLines[0]}</small>
      <small>{formatReceiptDate(gameCase.receipt.issuedAt)}</small>
      <hr />
      {gameCase.receipt.lineItems.map((line) => (
        <div key={`${line.description}-${line.quantity}`}><b>{line.quantity}× {line.description}</b><strong>{formatMoney(line.lineTotalCents)}</strong></div>
      ))}
      <hr />
      <div><b>SUBTOTAL</b><strong>{formatMoney(gameCase.receipt.amounts.subtotalCents)}</strong></div>
      {gameCase.receipt.amounts.taxCents > 0 && (
        <div className={frankenstein ? 'is-rotated-tax' : ''}><b>TAX</b><strong>{formatMoney(gameCase.receipt.amounts.taxCents)}</strong></div>
      )}
      {gameCase.receipt.amounts.tipCents > 0 && <div><b>TIP</b><strong>{formatMoney(gameCase.receipt.amounts.tipCents)}</strong></div>}
      <div className={`${gameCase.receipt.amounts.printedTotalCents !== gameCase.receipt.amounts.calculatedTotalCents ? 'is-altered' : ''}${frankenstein ? ' is-comic-total' : ''}`}><b>TOTAL</b><strong>{formatMoney(gameCase.receipt.amounts.printedTotalCents)}</strong></div>
      <hr />
      <small className={frankenstein ? 'is-card-font' : ''}>{gameCase.receipt.payment.method} •••• {gameCase.receipt.payment.cardLast4}</small>
      {typeof gameCase.receipt.copy.memo === 'string' && <p>{gameCase.receipt.copy.memo}</p>}
    </article>
  )
}

function CaseQueue({ currentCase, caseIndex, decisions }: {
  currentCase: GameCase
  caseIndex: number
  decisions: ReturnType<typeof useGameStore.getState>['decisions']
}) {
  const queueCases = useMemo(() => GAME_CASES.filter((entry) => entry.era === currentCase.era), [currentCase.era])
  const correctCount = decisions.filter((decision) => decision.correct).length
  return (
    <aside className="game-queue">
      <header><span>{currentCase.era === 'manual' ? 'Expense inbox' : 'Exceptions only'}</span><b>{currentCase.era === 'manual' ? '12 → 47' : '6 need judgment'}</b></header>
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
      <footer><span>Judgment accuracy</span><strong>{decisions.length ? Math.round(correctCount / decisions.length * 100) : 100}%</strong></footer>
    </aside>
  )
}

function ManualWorkspace({ currentCase }: { currentCase: GameCase }) {
  const inspectEvidence = useGameStore((state) => state.inspectEvidence)
  const reviewedEvidence = useGameStore((state) => state.reviewedEvidence)
  const [selectedEvidence, setSelectedEvidence] = useState(0)
  const selected = currentCase.evidence[selectedEvidence] ?? currentCase.evidence[0]

  useEffect(() => {
    setSelectedEvidence(0)
    inspectEvidence(0)
  }, [currentCase.caseId, inspectEvidence])

  const openRecord = (index: number) => {
    setSelectedEvidence(index)
    inspectEvidence(index)
    requestGameAudioCue('evidence-link', 0.3)
  }

  return (
    <main className="game-case-view game-manual-workspace">
      <header>
        <div><span>CASE {String(currentCase.sequence).padStart(2, '0')} · {currentCase.employee}</span><h1>{currentCase.title}</h1></div>
        <em>MANUAL RECONCILIATION</em>
      </header>

      <div className="game-fragmented-layout">
        <nav aria-label="Fragmented finance applications" className="game-app-dock">
          <span>OPEN APPS</span>
          {currentCase.evidence.map((evidence, index) => (
            <button className={selectedEvidence === index ? 'is-active' : ''} key={`${evidence.source}-${index}`} onClick={() => openRecord(index)} type="button">
              <b>{evidence.source?.slice(0, 2).toUpperCase()}</b>
              <span>{evidence.source}</span>
              {reviewedEvidence.includes(index) && <i>VIEWED</i>}
            </button>
          ))}
          <div className="game-slack-notice"><b>FINANCE MANAGER</b><p>Need these cleared before lunch.</p><small>11:54 AM · unread</small></div>
        </nav>

        <section className="game-manual-document"><ReceiptDocument gameCase={currentCase} /></section>

        <section className="game-record-window">
          <header><span>{selected.source}</span><small>WINDOW {selectedEvidence + 1} OF {currentCase.evidence.length}</small></header>
          <div>
            <span>{selected.label}</span>
            <strong>{selected.value}</strong>
            <p>{selected.detail}</p>
          </div>
          <footer>
            <span>{reviewedEvidence.length}/{currentCase.evidence.length} records checked</span>
            <small>Compare the raw records yourself. Expense OS does not connect them.</small>
          </footer>
        </section>
      </div>
    </main>
  )
}

function RampWorkspace({ currentCase }: { currentCase: GameCase }) {
  const activeActions = useGameStore((state) => state.activeActions)
  const performAction = useGameStore((state) => state.performAction)
  const triggerEffect = useLabStore((state) => state.triggerEffect)
  const requiredActions = currentCase.truth.requiredActions ?? []

  const handleAction = (action: string) => {
    performAction(action)
    requestGameAudioCue('evidence-link', 0.35)
    triggerEffect('paper-drop')
  }

  return (
    <main className="game-case-view game-ramp-workspace">
      <section className="game-ramp-automation">
        <div><span>EXPENSES CHECKED</span><strong>47</strong></div>
        <div><span>AUTO-CLEARED</span><strong>38</strong></div>
        <div><span>RETURNED FOR INFO</span><strong>3</strong></div>
        <div className="is-live"><span>NEED JUDGMENT</span><strong>6</strong></div>
      </section>

      <header>
        <div><span>EXCEPTION {String(currentCase.sequence - MANUAL_CASE_COUNT).padStart(2, '0')} · {currentCase.employee}</span><h1>{currentCase.title}</h1></div>
        <em>RAMP SURFACED</em>
      </header>

      <div className="game-ramp-layout">
        <section className="game-ramp-case-summary">
          <span>RECOMMENDATION</span>
          <strong>{titleCase(currentCase.truth.expectedDecision)}</strong>
          <p>{currentCase.workflow.exceptionReason}</p>
          <small>{currentCase.workflow.automation} · reviewer retains final authority</small>
        </section>

        <section className="game-connected-evidence">
          <header><span>CONNECTED EVIDENCE</span><b>{currentCase.workflow.connectedSystems.length} systems joined</b></header>
          <div>
            {currentCase.evidence.map((evidence) => (
              <article className={`is-${evidence.tone ?? 'neutral'}`} key={evidence.label}>
                <span>{evidence.label}</span><strong>{evidence.value}</strong><p>{evidence.detail}</p>
              </article>
            ))}
          </div>
          <footer><span>POLICY CITATION</span><strong>{currentCase.workflow.policyCitation}</strong></footer>
        </section>
      </div>

      {requiredActions.length > 0 && (
        <section className="game-case-actions">
          <span>CONTROL ACTIONS · COMPLETE BEFORE YOUR FINAL JUDGMENT</span>
          <div>{requiredActions.map((action) => (
            <button
              className={`${activeActions.includes(action) ? 'is-complete' : ''}${action === 'freeze-card' ? ' is-desk-only' : ''}`}
              disabled={action === 'freeze-card'}
              key={action}
              onClick={() => handleAction(action)}
              type="button"
            >
              {activeActions.includes(action) ? '✓ ' : ''}{currentCase.actionLabels[action] ?? titleCase(action)}
              {action === 'freeze-card' && !activeActions.includes(action) ? ' · use physical control' : ''}
            </button>
          ))}</div>
        </section>
      )}
    </main>
  )
}

export function GameWorkstation() {
  const caseIndex = useGameStore((state) => state.caseIndex)
  const decisions = useGameStore((state) => state.decisions)
  const elapsedSeconds = useGameStore((state) => state.elapsedSeconds)
  const paused = useGameStore((state) => state.paused)
  const phase = useGameStore((state) => state.phase)
  const score = useGameStore((state) => state.score)
  const soundEnabled = useGameStore((state) => state.soundEnabled)
  const togglePause = useGameStore((state) => state.togglePause)
  const toggleSound = useGameStore((state) => state.toggleSound)
  const beginMigration = useGameStore((state) => state.beginMigration)
  const beginRampTransition = useLabStore((state) => state.beginRampTransition)
  const workstationFocused = useLabStore((state) => state.workstationFocused)
  const setWorkstationFocused = useLabStore((state) => state.setWorkstationFocused)
  const currentCase = GAME_CASES[Math.min(caseIndex, GAME_CASES.length - 1)]
  const rampActive = phase === 'ramp'
  const inboxCount = rampActive ? Math.max(0, GAME_CASES.length - caseIndex) : Math.max(12, 12 + Math.floor(elapsedSeconds / 18) - Math.floor(decisions.length / 2))
  const cortisol = rampActive ? Math.max(8, 38 - (caseIndex - MANUAL_CASE_COUNT) * 6) : Math.min(97, 69 + Math.floor(elapsedSeconds / 12) + caseIndex * 3)

  const handleTryRamp = () => {
    beginMigration()
    beginRampTransition()
  }

  useEffect(() => {
    if (!workstationFocused) return
    const returnToDesk = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setWorkstationFocused(false)
      requestGameAudioCue('paper-slide', 0.32)
    }
    window.addEventListener('keydown', returnToDesk)
    return () => window.removeEventListener('keydown', returnToDesk)
  }, [setWorkstationFocused, workstationFocused])

  return (
    <div
      aria-label={workstationFocused ? 'Receipt details. Press Escape to return to the desk.' : 'Click to inspect receipt details.'}
      className={`game-workstation game-workstation--${rampActive ? 'ramp' : 'manual'} ${workstationFocused ? 'is-focused' : 'is-preview'}`}
      onClickCapture={(event) => {
        if (workstationFocused) return
        event.preventDefault()
        event.stopPropagation()
        setWorkstationFocused(true)
        requestGameAudioCue('paper-slide', 0.32)
      }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      role="application"
      title={workstationFocused ? 'Press Escape to return to the desk' : 'Click to inspect receipt details'}
    >
      <header className="game-os-bar">
        <div><b>{rampActive ? 'R' : 'R/P'}</b><strong>{rampActive ? 'Ramp · Expenses' : 'Expense OS'}</strong><span>{rampActive ? 'CONNECTED EXCEPTION WORKSPACE' : 'LOCAL FILES · MANUAL MATCHING'}</span></div>
        <div>
          <span>INBOX <strong>{inboxCount}</strong></span>
          <span>SCORE <strong>{score}</strong></span>
          <label><span>LOW CORTISOL</span><i><b style={{ width: `${100 - cortisol}%` }} /></i><em>{100 - cortisol}%</em></label>
          <button aria-label={soundEnabled ? 'Mute game audio' : 'Enable game audio'} onClick={toggleSound} type="button">{soundEnabled ? 'VOL' : 'MUTE'}</button>
          <button onClick={togglePause} type="button">{paused ? 'RESUME' : 'PAUSE'}</button>
          <time>{formatTime(elapsedSeconds)}</time>
        </div>
      </header>

      <div className="game-os-body">
        <CaseQueue caseIndex={caseIndex} currentCase={currentCase} decisions={decisions} />
        {rampActive ? <RampWorkspace currentCase={currentCase} /> : <ManualWorkspace currentCase={currentCase} />}
      </div>

      {phase === 'migration-prompt' && (
        <section aria-labelledby="game-ramp-title" aria-modal="true" className="game-migration-prompt" role="dialog">
          <img alt="Ramp" src="/brand/ramp-lockup-white.svg" />
          <span>Finance Ops · migration ready</span>
          <h2 id="game-ramp-title">Stop reconciling this by hand.</h2>
          <p>Ramp can match receipts, apply policy, connect trips and vendors, and return only the exceptions that still need your judgment.</p>
          <dl><div><dt>Inbox now</dt><dd>47</dd></div><div><dt>Expected exceptions</dt><dd>6</dd></div></dl>
          <button onClick={handleTryRamp} type="button">Try Ramp</button>
          <small>One workspace. The same human judgment. Much less scavenger hunting.</small>
        </section>
      )}

      {paused && <div className="game-pause-screen"><span>SHIFT PAUSED</span><button onClick={togglePause} type="button">Resume reviewing</button></div>}
    </div>
  )
}
