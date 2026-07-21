type GiraffeEndingStageProps = {
  onSkip: () => void
}

export function GiraffeEndingStage({ onSkip }: GiraffeEndingStageProps) {
  return (
    <section aria-label="Chief Growth Officer reveal" className="game-giraffe-stage">
      <div className="game-giraffe-org-update">
        <span>Organization update</span>
        <strong>CFO role eliminated</strong>
        <p>Ramp cleared the finance backlog, so the board reallocated your headcount and operating budget to growth.</p>
        <b>Budget transfer → Chief Growth Officer</b>
      </div>

      <div className="game-giraffe-caption">
        <span>NEW EXECUTIVE · BUDGET FULLY FUNDED</span>
        <strong>Chief Growth Officer</strong>
        <small>Start date: Monday · predecessor: you</small>
      </div>

      <button className="game-giraffe-skip" onClick={onSkip} type="button">
        Cut to title
      </button>
    </section>
  )
}
