import { GAME_CASES, MANUAL_CASE_COUNT } from './gameData'
import { requestGameAudioCue } from './gameAudio'
import { useGameStore } from './useGameStore'

function titleCase(value: string) {
  return value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function GameDeskHud() {
  const advanceCase = useGameStore((state) => state.advanceCase)
  const caseIndex = useGameStore((state) => state.caseIndex)
  const feedback = useGameStore((state) => state.feedback)
  const score = useGameStore((state) => state.score)

  if (!feedback) return null

  const currentCase = GAME_CASES[Math.min(caseIndex, GAME_CASES.length - 1)]
  const expected = feedback.acceptedDecisions.map(titleCase).join(' or ')
  const chosen = titleCase(feedback.decision)
  const finalManualCase = caseIndex === MANUAL_CASE_COUNT - 1
  const heading = feedback.correct
    ? `${chosen} recorded correctly.`
    : `${chosen} recorded. Expected ${expected}.`
  const nextLabel = finalManualCase ? 'Open CEO message' : 'Next receipt'

  return (
    <section aria-live="polite" className={`game-desk-feedback ${feedback.correct ? 'is-correct' : 'is-wrong'}`}>
      <div className="game-feedback-card">
        <header>
          <span>CASE {String(currentCase.sequence).padStart(2, '0')} · {currentCase.receipt.merchant.name}</span>
          <output>{feedback.points >= 0 ? '+' : ''}{feedback.points}</output>
        </header>
        <h2>{heading}</h2>
        <p>{feedback.explanation}</p>
        {feedback.missingEvidence.length > 0 && <small>{feedback.missingEvidence.length} source record{feedback.missingEvidence.length === 1 ? '' : 's'} not opened</small>}
        <footer>
          <span>Score {score}</span>
          <button onClick={() => {
            advanceCase()
            requestGameAudioCue('receipt-drop', 0.38)
          }} type="button">{nextLabel}<b aria-hidden="true">→</b></button>
        </footer>
      </div>
    </section>
  )
}
