import { useEffect } from 'react'
import { WORKSTATION_CASES_BY_ID } from '../workstation/caseFixtures'
import { GameWorkstation } from '../../game/GameWorkstation'
import { useGameStore } from '../../game/useGameStore'
import { useWorkstationStore } from '../workstation/useWorkstationStore'
import { useLabStore } from '../../store/useLabStore'

import './expense-os-lab.css'

type PreviewEra = 'manual' | 'migration-prompt' | 'ramp'

export function ExpenseOSLab() {
  const desktopWindows = useGameStore((state) => state.desktopWindows)
  const completeManualQueue = useGameStore((state) => state.completeManualQueue)
  const finishMigration = useGameStore((state) => state.finishMigration)
  const installRamp = useGameStore((state) => state.installRamp)
  const openDesktopApp = useGameStore((state) => state.openDesktopApp)
  const phase = useGameStore((state) => state.phase)
  const resetGame = useGameStore((state) => state.resetGame)
  const setSlackView = useGameStore((state) => state.setSlackView)
  const startGame = useGameStore((state) => state.startGame)
  const advanceWorkstationCase = useWorkstationStore((state) => state.advanceToNextCase)
  const markRampUnlocked = useWorkstationStore((state) => state.markRampUnlocked)
  const resetWorkstation = useWorkstationStore((state) => state.resetWorkstation)
  const workstationFocused = useLabStore((state) => state.workstationFocused)
  const setWorkstationFocused = useLabStore((state) => state.setWorkstationFocused)
  const previewEra: PreviewEra = phase === 'ramp' ? 'ramp' : ['migration-prompt', 'migrating'].includes(phase) ? 'migration-prompt' : 'manual'

  const loadPreview = (era: PreviewEra) => {
    resetGame()
    resetWorkstation()
    startGame()
    if (era === 'migration-prompt') {
      completeManualQueue()
      setSlackView('ceo')
      openDesktopApp('slack')
    }
    if (era === 'ramp') {
      installRamp()
      markRampUnlocked()
      advanceWorkstationCase('ramp')
      finishMigration()
    }
    setWorkstationFocused(true)
  }

  const advanceRampPreview = () => {
    const workstation = useWorkstationStore.getState()
    const activeCase = WORKSTATION_CASES_BY_ID[workstation.activeCaseId]
    const pinnedEvidence = workstation.pinnedEvidenceIds[activeCase.id] ?? []
    const nextEvidence = activeCase.validation.requiredEvidenceIds.find((id) => !pinnedEvidence.includes(id))
    if (nextEvidence) {
      workstation.togglePinnedEvidence(nextEvidence)
      return
    }
    const completedActions = workstation.completedActionsByCase[activeCase.id] ?? []
    const nextAction = (activeCase.validation.requiredActions ?? []).find((action) => !completedActions.includes(action))
    if (nextAction) {
      if (nextAction === 'freeze-card') workstation.setCardFrozen(true, activeCase.id)
      else workstation.completeCaseAction(nextAction, true, activeCase.id)
      return
    }
    workstation.recordDecision(activeCase.validation.expectedDecision)
  }

  useEffect(() => {
    loadPreview('manual')
    return () => setWorkstationFocused(false)
    // This route owns a deterministic fixture lifecycle; production game state is
    // intentionally reset only when entering or leaving the standalone lab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="os-lab-shell">
      <header className="os-lab-header">
        <div>
          <span>RP / INTERFACE WORKBENCH</span>
          <strong>Expense OS · native surface</strong>
        </div>
        <nav aria-label="Expense OS lab navigation">
          <a href="/control">Production console</a>
          <a href="/">Play game</a>
        </nav>
        <p><i aria-hidden="true" /> 1040 × 585 / LIVE DOM</p>
      </header>

      <section className="os-lab-body">
        <aside className="os-lab-controls">
          <header>
            <span>Fixture state</span>
            <strong>{previewEra === 'manual' ? 'Pre-Ramp' : previewEra === 'migration-prompt' ? 'Install gate' : 'Post-Ramp'}</strong>
          </header>

          <div className="os-lab-era-switch" role="group" aria-label="Preview Expense OS era">
            <button aria-pressed={previewEra === 'manual'} onClick={() => loadPreview('manual')} type="button">
              <span>01</span>
              <strong>Pre-Ramp</strong>
              <small>Fragmented source apps</small>
            </button>
            <button aria-pressed={previewEra === 'migration-prompt'} onClick={() => loadPreview('migration-prompt')} type="button">
              <span>02</span>
              <strong>Install gate</strong>
              <small>CEO DM + pinned installer</small>
            </button>
            <button aria-pressed={previewEra === 'ramp'} onClick={() => loadPreview('ramp')} type="button">
              <span>03</span>
              <strong>Post-Ramp</strong>
              <small>Same shell, unified app</small>
            </button>
          </div>

          <dl>
            <div><dt>React surface</dt><dd>GameWorkstation</dd></div>
            <div><dt>Focus gate</dt><dd>{workstationFocused ? 'Interactive' : 'Click screen'}</dd></div>
            <div><dt>Open windows</dt><dd>{desktopWindows.filter((windowState) => !windowState.minimized).length}</dd></div>
            <div><dt>Store phase</dt><dd>{phase}</dd></div>
          </dl>

          <button className="os-lab-reset" onClick={() => loadPreview(previewEra)} type="button">Reset current fixture</button>
          {previewEra === 'ramp' && <button className="os-lab-reset" onClick={advanceRampPreview} type="button">Advance Ramp animation</button>}
          <p>This switch exists only in the production lab. The game still reaches Ramp through the authored migration.</p>
        </aside>

        <div className="os-lab-scrollport">
          <div className="os-lab-measure os-lab-measure--horizontal" aria-hidden="true"><span>0</span><span>260</span><span>520</span><span>780</span><span>1040</span></div>
          <div className="os-lab-measure os-lab-measure--vertical" aria-hidden="true"><span>0</span><span>146</span><span>293</span><span>439</span><span>585</span></div>
          <section aria-label="Production Expense OS at native monitor resolution" className="os-lab-stage">
            <GameWorkstation />
          </section>
          <footer><span>Native CSS pixels</span><span>No WebGL transform</span><span>Production stores</span></footer>
        </div>
      </section>
    </main>
  )
}
