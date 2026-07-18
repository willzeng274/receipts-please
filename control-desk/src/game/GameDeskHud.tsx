import type { CSSProperties } from 'react'
import { useLabStore } from '../store/useLabStore'
import { GAME_CASES, MANUAL_CASE_COUNT } from './gameData'
import { requestGameAudioCue } from './gameAudio'
import { useGameStore } from './useGameStore'

function titleCase(value: string) {
  return value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const FIRE_GAGS = [
  'Their Slack dot has gone spiritually offline. Their lunch is now communal property.',
  'IT has converted their chair into an available resource and their laptop into “refurbished.”',
  'Their calendar is now impressively open through the end of time.',
  'LinkedIn detected a 900% increase in motivational posting.',
]

export function GameDeskHud() {
  const acknowledgeOverload = useGameStore((state) => state.acknowledgeOverload)
  const advanceCase = useGameStore((state) => state.advanceCase)
  const caseIndex = useGameStore((state) => state.caseIndex)
  const feedback = useGameStore((state) => state.feedback)
  const phase = useGameStore((state) => state.phase)
  const score = useGameStore((state) => state.score)
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

  if (!feedback) return null

  const missing: string[] = []
  if (feedback.missingEvidence.length) missing.push(`${feedback.missingEvidence.length} unopened record${feedback.missingEvidence.length === 1 ? '' : 's'}`)
  if (feedback.missingDeskTool) missing.push('calculator tape')
  if (feedback.missingActions.length) missing.push(...feedback.missingActions.map(titleCase))
  const nextLabel = caseIndex === MANUAL_CASE_COUNT - 1
    ? 'Face the backlog'
    : caseIndex === GAME_CASES.length - 1
      ? 'Clear the inbox'
      : 'Load next receipt'
  const fired = feedback.decision === 'fire'
  const firedName = currentCase.employee.split(' · ')[0]
  const feedbackTitle = feedback.correct
    ? currentCase.truth.primaryClue
    : feedback.decision === feedback.expectedDecision
      ? 'Complete the required review steps'
      : `Expected: ${titleCase(feedback.expectedDecision)}`

  return (
    <section aria-live="polite" className={`game-desk-feedback ${feedback.correct ? 'is-correct' : 'is-wrong'} ${fired ? 'is-fired' : ''}`}>
      {fired && (
        <>
          <div aria-hidden="true" className="game-fire-ticker">
            <span>BREAKING NEWS · LOCAL EMPLOYEE DISCOVERS UNLIMITED PTO · HEADCOUNT OPTIMIZED · VIBES: IMMACULATE · PAYROLL HATES THIS ONE WEIRD TRICK · </span>
          </div>
          <div aria-hidden="true" className="game-fire-rain">
            {Array.from({ length: 32 }, (_, index) => (
              <i
                key={index}
                style={{
                  '--fire-delay': `${(index % 9) * -.22}s`,
                  '--fire-drift': `${((index % 3) - 1) * 80}px`,
                  '--fire-duration': `${1.5 + (index % 7) * .18}s`,
                  '--fire-size': `${18 + (index % 5) * 7}px`,
                  '--fire-x': `${(index * 37) % 100}%`,
                } as CSSProperties}
              >{index % 4 === 0 ? '🗑️' : index % 3 === 0 ? '📉' : '🔥'}</i>
            ))}
          </div>
          <div aria-hidden="true" className="game-fire-mega-stamp"><span>YOU’RE</span><strong>FIRED</strong></div>
          <div aria-hidden="true" className="game-fire-popups">
            <article className="is-slack"><b>SLACK</b><strong>{firedName} left the workspace.</strong><small>Everyone reacted with 👀</small></article>
            <article className="is-linkedin"><b>LINKEDIN</b><strong>Profile updated 0.2 seconds ago</strong><small>“Open to work, revenge, and coffee chats.”</small></article>
            <article className="is-it"><b>IT HELPDESK</b><strong>Laptop listed on Facebook Marketplace</strong><small>Condition: emotionally refurbished</small></article>
            <article className="is-calendar"><b>CALENDAR</b><strong>37 recurring meetings deleted</strong><small>This could have been an email. It no longer can.</small></article>
          </div>
        </>
      )}
      <div className="game-feedback-card">
        <span>{fired ? 'HUMAN RESOURCES HAS LEFT THE CHAT' : feedback.correct ? 'JUDGMENT RECORDED' : 'AUDIT NOTE'} · SCORE {score}</span>
        <h2>{fired ? `${firedName} has been promoted to customer.` : feedbackTitle}</h2>
        <output className={feedback.points >= 0 ? 'is-positive' : 'is-negative'}>{feedback.points >= 0 ? '+' : ''}{feedback.points} points</output>
        <p>{feedback.explanation}</p>
        {fired && (
          <div className="game-fire-gag">
            <span aria-hidden="true">🫡</span>
            <div>
              <strong>{firedName.toUpperCase()} HAS BEEN EJECTED FROM THE SPREADSHEET</strong>
              <small>{FIRE_GAGS[caseIndex % FIRE_GAGS.length]}</small>
            </div>
          </div>
        )}
        {fired && <div className="game-fire-payroll"><span>UNSUBSCRIBING FROM PAYROLL</span><i><b /></i><strong>404: EMPLOYEE NOT FOUND</strong></div>}
        {missing.length > 0 && <small>Skipped: {missing.join(' · ')}</small>}
        <button onClick={() => {
          advanceCase()
          requestGameAudioCue('receipt-drop', 0.38)
        }} type="button">{fired ? 'NEXT CORPORATE CASUALTY' : nextLabel}</button>
      </div>
    </section>
  )
}
