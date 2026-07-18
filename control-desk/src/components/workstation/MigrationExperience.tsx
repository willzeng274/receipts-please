import { RAMP_MIGRATION_STEPS } from '../../store/useLabStore'

const CAPABILITY_DETAILS = [
  { code: 'CD', detail: 'Limits and card controls linked', label: 'Cards' },
  { code: 'RC', detail: 'Receipts matched to transactions', label: 'Receipts' },
  { code: 'PO', detail: 'Relevant policy rules attached', label: 'Policy' },
  { code: 'TR', detail: 'Itineraries mapped to charges', label: 'Travel' },
  { code: 'VN', detail: 'Vendor context connected', label: 'Vendors' },
  { code: 'TX', detail: 'Five cases ready for judgment', label: 'Transactions' },
] as const

export function MigrationExperience({
  locked,
  migrationStep,
  onAdvance,
  pendingCount = 47,
}: {
  locked: boolean
  migrationStep: number
  onAdvance: () => void
  pendingCount?: number
}) {
  const completedSteps = Math.min(Math.max(migrationStep, 0), RAMP_MIGRATION_STEPS.length)
  const activeStep = Math.min(completedSteps, RAMP_MIGRATION_STEPS.length - 1)

  return (
    <div aria-live="polite" className="wsos-migration" role="status">
      <div className="wsos-migration-logo"><img alt="Ramp" src="/brand/ramp-lockup-white.svg" /></div>
      <span>Expense OS - interactive migration</span>
      <strong>{RAMP_MIGRATION_STEPS[activeStep]}</strong>
      <p>{CAPABILITY_DETAILS[activeStep].detail}</p>

      <div className="wsos-migration-capabilities" aria-label={`${completedSteps} of ${RAMP_MIGRATION_STEPS.length} systems connected`}>
        {RAMP_MIGRATION_STEPS.map((step, index) => (
          <div className={index < completedSteps ? 'is-complete' : index === completedSteps ? 'is-active' : ''} key={step}>
            <i>{CAPABILITY_DETAILS[index].code}</i>
            <span>{CAPABILITY_DETAILS[index].label}</span>
            <small>{index < completedSteps ? 'Connected' : index === completedSteps ? 'Ready' : 'Waiting'}</small>
          </div>
        ))}
      </div>

      <div className="wsos-migration-progress">
        {RAMP_MIGRATION_STEPS.map((step, index) => <i className={index < completedSteps ? 'is-complete' : index === completedSteps ? 'is-active' : ''} key={step} />)}
      </div>
      <small>{completedSteps} / {RAMP_MIGRATION_STEPS.length} systems connected - {pendingCount} expenses waiting</small>
      <button disabled={locked} onClick={onAdvance} type="button">
        {locked ? 'Connecting...' : completedSteps === RAMP_MIGRATION_STEPS.length - 1 ? 'Finish migration' : 'Connect next system'}
      </button>
    </div>
  )
}
