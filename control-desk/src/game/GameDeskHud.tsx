import { useLabStore } from '../store/useLabStore'
import { GAME_CASES, MANUAL_CASE_COUNT } from './gameData'
import { requestGameAudioCue } from './gameAudio'
import { useGameStore } from './useGameStore'

function titleCase(value: string) {
  return value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function GameDeskHud() {
  const acknowledgeOverload = useGameStore((state) => state.acknowledgeOverload)
  const activeActions = useGameStore((state) => state.activeActions)
  const advanceCase = useGameStore((state) => state.advanceCase)
  const calculatorComplete = useGameStore((state) => state.calculatorComplete)
  const caseIndex = useGameStore((state) => state.caseIndex)
  const decisions = useGameStore((state) => state.decisions)
  const feedback = useGameStore((state) => state.feedback)
  const phase = useGameStore((state) => state.phase)
  const reviewedEvidence = useGameStore((state) => state.reviewedEvidence)
  const score = useGameStore((state) => state.score)
  const focused = useLabStore((state) => state.workstationFocused)
  const setFocused = useLabStore((state) => state.setWorkstationFocused)
  const currentCase = GAME_CASES[Math.min(caseIndex, GAME_CASES.length - 1)]

  if (phase === 'overload') {
    return (
      <section className="game-overload-panel">
        <span>2:10 · PROCESS BREAKDOWN</span>
        <h2>47 expenses. One finance person.</h2>
        <div className="game-overload-feed">
          <p><b>FINANCE MANAGER</b> why is the inbox going up</p>
          <p><b>CEO</b> quick question about livestock</p>
          <p><b>PRINTER</b> PAPER JAM · PAPER JAM · PAPER JAM</p>
        </div>
        <dl>
          <div><dt>Inbox</dt><dd>47</dd></div>
          <div><dt>Low Cortisol</dt><dd>3%</dd></div>
        </dl>
        <button onClick={() => {
          acknowledgeOverload()
          setFocused(true)
          requestGameAudioCue('monitor-power-on', 0.5)
        }} type="button">Open migration notification</button>
      </section>
    )
  }

  if (focused || !['manual', 'ramp'].includes(phase)) return null

  const evidenceComplete = phase === 'ramp' || reviewedEvidence.length >= currentCase.evidence.length
  const calculatorRequired = currentCase.workflow.requiredDeskTool === 'calculator'
  const requiredActions = currentCase.truth.requiredActions ?? []
  const actionsComplete = requiredActions.every((action) => activeActions.includes(action))

  if (feedback) {
    const missing: string[] = []
    if (feedback.missingEvidence.length) missing.push(`${feedback.missingEvidence.length} unopened record${feedback.missingEvidence.length === 1 ? '' : 's'}`)
    if (feedback.missingDeskTool) missing.push('calculator tape')
    if (feedback.missingActions.length) missing.push(...feedback.missingActions.map(titleCase))
    const nextLabel = caseIndex === MANUAL_CASE_COUNT - 1
      ? 'Face the backlog'
      : caseIndex === GAME_CASES.length - 1
        ? 'Clear the inbox'
        : 'Load next receipt'

    return (
      <section aria-live="polite" className={`game-desk-feedback ${feedback.correct ? 'is-correct' : 'is-wrong'}`}>
        <span>{feedback.correct ? 'JUDGMENT RECORDED' : 'AUDIT NOTE'} · SCORE {score}</span>
        <h2>{feedback.correct
          ? currentCase.truth.primaryClue
          : feedback.decision === feedback.expectedDecision
            ? 'Complete the required review steps'
            : `Expected: ${titleCase(feedback.expectedDecision)}`}</h2>
        <output className={feedback.points >= 0 ? 'is-positive' : 'is-negative'}>{feedback.points >= 0 ? '+' : ''}{feedback.points} points</output>
        <p>{feedback.explanation}</p>
        {missing.length > 0 && <small>Skipped: {missing.join(' · ')}</small>}
        <button onClick={() => {
          advanceCase()
          requestGameAudioCue('receipt-drop', 0.38)
        }} type="button">{nextLabel}</button>
      </section>
    )
  }

  return (
    <aside className={`game-desk-hud game-desk-hud--${phase}`}>
      <span>{phase === 'manual' ? 'PHYSICAL DESK · MANUAL SHIFT' : 'PHYSICAL DESK · EXCEPTION CONTROL'} · SCORE {score}</span>
      <h2>{currentCase.title}</h2>
      <p>{decisions.length === 0
        ? 'The monitor has the records. Approve, Reject, and Fire are the only decisions on your desk.'
        : phase === 'manual'
          ? 'Review the records, then return here and make one decision.'
          : 'Ramp prepared the exception. Make the final judgment here.'}</p>
      <ol>
        <li className={evidenceComplete ? 'is-complete' : ''}><b>{evidenceComplete ? '✓' : '1'}</b><span>{phase === 'manual' ? `Review records (${reviewedEvidence.length}/${currentCase.evidence.length})` : 'Review connected exception'}</span></li>
        {calculatorRequired && <li className={calculatorComplete ? 'is-complete' : ''}><b>{calculatorComplete ? '✓' : '2'}</b><span>Use the tape calculator</span></li>}
        {requiredActions.length > 0 && <li className={actionsComplete ? 'is-complete' : ''}><b>{actionsComplete ? '✓' : calculatorRequired ? '3' : '2'}</b><span>Complete controls ({activeActions.length}/{requiredActions.length})</span></li>}
        <li><b>{2 + Number(calculatorRequired) + Number(requiredActions.length > 0)}</b><span>Click Approve, Reject, or Fire</span></li>
      </ol>
      <details className="game-score-rules">
        <summary>Scoring rules</summary>
        <p><b>+100</b> correct Approve or Reject · <b>+200</b> correct Fire · <b>−75</b> wrong decision · <b>−200</b> firing the wrong person</p>
      </details>
      <button onClick={() => {
        setFocused(true)
        requestGameAudioCue('paper-slide', 0.32)
      }} type="button">{phase === 'manual' ? 'Open Expense OS' : 'Open Ramp exception'}</button>
      <small>Drag left or right to look across the desk. Glowing labels are anchored to the actual tools.</small>
    </aside>
  )
}
