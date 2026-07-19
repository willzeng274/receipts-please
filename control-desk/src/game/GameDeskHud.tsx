import type { CSSProperties } from 'react'
import { useLabStore } from '../store/useLabStore'
import { GAME_CASES, MANUAL_CASE_COUNT } from './gameData'
import { requestGameAudioCue } from './gameAudio'
import { useGameStore } from './useGameStore'

function titleCase(value: string) {
  return value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const FIRE_GAGS = [
  'Bro asked “what did I do?” Chat said 6. Payroll said 7.',
  'Aura balance: −67,000. Badge access: absolutely cooked.',
  'Unemployment speedrun any% — new office record.',
  'Their worksona just got patched out in v6.7.',
  'POV: the group chat stops typing when HR joins.',
  'This firing has been added to the lore. 💀',
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
  const nextLabel = caseIndex === MANUAL_CASE_COUNT - 1
    ? 'Face the backlog'
    : caseIndex === GAME_CASES.length - 1
      ? 'Clear the inbox'
      : 'Load next receipt'
  const fired = feedback.decision === 'fire'
  const firedName = currentCase.employee.split(' · ')[0]
  const chosenLabel = titleCase(feedback.decision)
  const rejectAcceptedForFire = feedback.correct
    && feedback.expectedDecision === 'fire'
    && feedback.decision === 'reject'
    && feedback.acceptedDecisions.includes('reject')
  const expectedLabel = feedback.acceptedDecisions.map(titleCase).join(' or ')
  const answerLabel = feedback.acceptedDecisions.length > 1 ? 'Accepted answers' : 'Correct answer'
  const feedbackTitle = rejectAcceptedForFire
    ? 'Correct — Reject is an accepted conservative call.'
    : feedback.correct
      ? `Correct — ${expectedLabel} was the right call.`
      : `Wrong — ${expectedLabel} was the right call.`
  const firedTitle = feedback.correct
    ? `Correct — ${firedName} got ratioed by payroll.`
    : `Wrong person — the correct call was ${expectedLabel}.`

  return (
    <section aria-live="polite" className={`game-desk-feedback ${feedback.correct ? 'is-correct' : 'is-wrong'} ${fired ? 'is-fired' : ''}`}>
      {fired && (
        <>
          <div aria-hidden="true" className="game-fire-ticker">
            <span>CHAT IS THIS REAL · 6 7 · AURA −67,000 · BRO GOT PATCHED OUT · EMPLOYMENT ARC ENDED · SKILL ISSUE (RESPECTFULLY) · 💀 · </span>
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
              >{index % 4 === 0 ? '6' : index % 3 === 0 ? '7' : index % 2 === 0 ? '💀' : '😭'}</i>
            ))}
          </div>
          <div aria-hidden="true" className="game-fire-mega-stamp"><span>BRO GOT</span><strong>FIRED 💀</strong></div>
          <div aria-hidden="true" className="game-fire-popups">
            <article className="is-slack"><b>THE GC</b><strong>bro got removed from the function</strong><small>67 people are typing…</small></article>
            <article className="is-linkedin"><b>AURA CHECK</b><strong>−67,000 aura</strong><small>employment diff is actually insane</small></article>
            <article className="is-it"><b>PATCH NOTES v6.7</b><strong>{firedName} removed from the build</strong><small>reason: got cooked</small></article>
            <article className="is-calendar"><b>LORE UPDATE</b><strong>unemployment speedrun any%</strong><small>NEW PB · 0:00.67</small></article>
          </div>
        </>
      )}
      <div className="game-feedback-card">
        <span>{feedback.correct ? 'CORRECT DECISION' : 'WRONG DECISION'}{fired ? ' · CHAT WITNESSED IT 💀' : ''} · SCORE {score}</span>
        <h2>{fired ? firedTitle : feedbackTitle}</h2>
        <div
          aria-label={`You chose ${chosenLabel}. ${answerLabel}: ${expectedLabel}. ${feedback.correct ? 'Correct.' : 'Wrong.'}`}
          className="game-decision-verdict"
          role="group"
        >
          <div>
            <span>You chose</span>
            <strong className={`is-${feedback.decision}`}>{chosenLabel}</strong>
          </div>
          <b className={feedback.correct ? 'is-correct' : 'is-wrong'}>{rejectAcceptedForFire ? '✓ ACCEPTED' : feedback.correct ? '✓ MATCH' : '≠'}</b>
          <div>
            <span>{answerLabel}</span>
            <strong className={`is-${feedback.expectedDecision}`}>{expectedLabel}</strong>
          </div>
        </div>
        <output className={feedback.points >= 0 ? 'is-positive' : 'is-negative'}>{feedback.points >= 0 ? '+' : ''}{feedback.points} points</output>
        <p className="game-feedback-explanation"><b>Why:</b> {feedback.explanation}</p>
        {fired && (
          <div className="game-fire-gag">
            <span aria-hidden="true">💀</span>
            <div>
              <strong>{firedName.toUpperCase()} GOT 6 7’D OUT OF PAYROLL</strong>
              <small>{FIRE_GAGS[caseIndex % FIRE_GAGS.length]}</small>
            </div>
          </div>
        )}
        {fired && <div className="game-fire-payroll"><span>DELETING EMPLOYMENT ARC</span><i><b /></i><strong>BRO IS COOKED</strong></div>}
        {missing.length > 0 && <small>Skipped: {missing.join(' · ')}</small>}
        <button onClick={() => {
          advanceCase()
          requestGameAudioCue('receipt-drop', 0.38)
        }} type="button">{fired ? 'NEXT AURA CHECK' : nextLabel}</button>
      </div>
    </section>
  )
}
