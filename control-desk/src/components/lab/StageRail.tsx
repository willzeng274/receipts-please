import { ASSET_DEFINITIONS } from '../../models/registry'
import type { LabMode } from '../../store/useLabStore'
import { useLabStore } from '../../store/useLabStore'
import { EFFECTS } from './effectOptions'

const COMBINED_SEQUENCES = [
  { id: 'stamp-paper', label: 'Stamp + paper', note: 'pickup · contact · settle' },
  { id: 'receipt-routing', label: 'Receipt routing', note: 'print · inspect · file' },
  { id: 'decision-console', label: 'Decision console', note: 'calculate · decide · stamp' },
  { id: 'fraud-response', label: 'Fraud response', note: 'alert · freeze · recover' },
  { id: 'freeze-card-control', label: 'Freeze card control', note: 'open cover · press · lock card' },
  { id: 'travel-review', label: 'Travel exception', note: 'itinerary · receipt · decision' },
  { id: 'phone-dial', label: 'CEO phone call', note: 'ring · dial 670 · connect' },
  { id: 'giraffe-window', label: 'Giraffe window reveal', note: 'shadow · rise · eye contact' },
]

const COMPOSITION_CUES = {
  'stamp-paper': [
    { id: 'paper-drop', label: 'Place paper' },
    { id: 'approve', label: 'Approve contact' },
    { id: 'migration', label: 'Neaten desk' },
  ],
  'receipt-routing': [
    { id: 'paper-drop', label: 'Feed receipt' },
    { id: 'approve', label: 'Route approved' },
    { id: 'reject', label: 'Route rejected' },
    { id: 'printer-jam', label: 'Overload jam' },
    { id: 'migration', label: 'Clear backlog' },
  ],
  'decision-console': [
    { id: 'paper-drop', label: 'Load values' },
    { id: 'approve', label: 'Approve case' },
    { id: 'reject', label: 'Reject case' },
    { id: 'fraud', label: 'Fraud decision' },
    { id: 'migration', label: 'Unified review' },
  ],
  'fraud-response': [
    { id: 'reject', label: 'Reject vendor' },
    { id: 'fraud', label: 'Freeze + alert' },
    { id: 'migration', label: 'Unify evidence' },
  ],
  'freeze-card-control': [
    { id: 'paper-drop', label: 'Load card' },
    { id: 'fraud', label: 'Open + freeze' },
    { id: 'migration', label: 'Ramp control sync' },
  ],
  'travel-review': [
    { id: 'paper-drop', label: 'Load itinerary' },
    { id: 'reject', label: 'Flag mismatch' },
    { id: 'migration', label: 'Connect travel evidence' },
  ],
  'phone-dial': [
    { id: 'fraud', label: 'Incoming CEO call' },
    { id: 'approve', label: 'Dial extension 670' },
    { id: 'reject', label: 'Hang up' },
  ],
  'giraffe-window': [
    { id: 'paper-drop', label: 'Notice movement' },
    { id: 'fraud', label: 'Double take' },
    { id: 'migration', label: 'Run full reveal' },
  ],
} as const

export function StageRail({ mode }: { mode: Extract<LabMode, 'animation' | 'scene'> }) {
  const assetId = useLabStore((state) => state.assetId)
  const compositionId = useLabStore((state) => state.compositionId)
  const effectPreset = useLabStore((state) => state.effectPreset)
  const fillLightScale = useLabStore((state) => state.fillLightScale)
  const giraffeFocused = useLabStore((state) => state.giraffeFocused)
  const keyLightScale = useLabStore((state) => state.keyLightScale)
  const workstationFocused = useLabStore((state) => state.workstationFocused)
  const setAssetId = useLabStore((state) => state.setAssetId)
  const setCompositionId = useLabStore((state) => state.setCompositionId)
  const setFillLightScale = useLabStore((state) => state.setFillLightScale)
  const setKeyLightScale = useLabStore((state) => state.setKeyLightScale)
  const setWorkstationFocused = useLabStore((state) => state.setWorkstationFocused)
  const queueRampIntroduction = useLabStore((state) => state.queueRampIntroduction)
  const runGiraffeReveal = useLabStore((state) => state.runGiraffeReveal)
  const triggerEffect = useLabStore((state) => state.triggerEffect)

  const cues = mode === 'scene' || compositionId.startsWith('solo:')
    ? EFFECTS
    : COMPOSITION_CUES[compositionId as keyof typeof COMPOSITION_CUES] ?? EFFECTS
  const replayControls = (
    <div className="rail-actions">
      <span>{mode === 'scene' ? 'Desk-wide responses' : 'Replay selected sequence'}</span>
      <div>
        {cues.map((effect) => (
          <button
            aria-pressed={effectPreset === effect.id}
            className={effectPreset === effect.id ? 'is-active' : ''}
            key={effect.id}
            onClick={() => triggerEffect(effect.id)}
            type="button"
          >{effect.label}</button>
        ))}
      </div>
    </div>
  )

  if (mode === 'scene') {
    return (
      <aside className="asset-rail stage-rail" aria-label="Desk scene assembly">
        <div className="rail-heading"><span>Scene assembly</span><strong>01</strong></div>
        <div className="stage-summary">
          <span>S-01 / FULL WORKSTATION</span>
          <strong>Finance operator desk</strong>
          <p>Real-scale objects share one world. Orbit freely, pan with Shift-drag, then compare every saved camera and light preset.</p>
          <dl>
            <div><dt>Camera</dt><dd>Footer presets + free orbit</dd></div>
            <div><dt>Lighting</dt><dd>Manual / studio / Ramp / night</dd></div>
            <div><dt>Motion</dt><dd>Shared intent, unique mechanics</dd></div>
          </dl>
          <div className="scene-light-tuning">
            <span>Live light mix</span>
            <label>Key <input aria-label="Key light intensity" max="1.8" min="0.35" onChange={(event) => setKeyLightScale(Number(event.target.value))} step="0.05" type="range" value={keyLightScale} /><b>{keyLightScale.toFixed(2)}</b></label>
            <label>Fill <input aria-label="Fill light intensity" max="1.8" min="0.35" onChange={(event) => setFillLightScale(Number(event.target.value))} step="0.05" type="range" value={fillLightScale} /><b>{fillLightScale.toFixed(2)}</b></label>
          </div>
          <button className="focus-workstation-button" onClick={() => setWorkstationFocused(!workstationFocused)} type="button">
            {workstationFocused ? 'Exit workstation focus' : 'Focus workstation screen'}
          </button>
          <small className="focus-workstation-note">You can also click the monitor. Press Esc or use the on-screen × to exit.</small>
          <div className="scene-sequence-actions" aria-label="Authored scene sequences">
            <span>Story sequences</span>
            <button onClick={queueRampIntroduction} type="button">Preview Ramp introduction</button>
            <button aria-pressed={giraffeFocused} onClick={runGiraffeReveal} type="button">
              {giraffeFocused ? 'Giraffe camera active' : 'Run giraffe window reveal'}
            </button>
          </div>
        </div>
        {replayControls}
        <div className="rail-note"><span>Integration gate</span><p>Use this view to catch world-scale, contact, occlusion, cable, and camera problems.</p></div>
      </aside>
    )
  }

  return (
    <aside className="asset-rail stage-rail" aria-label="Animation compositions">
      <div className="rail-heading"><span>Sequence list</span><strong>{String(ASSET_DEFINITIONS.length + COMBINED_SEQUENCES.length).padStart(2, '0')}</strong></div>
      <div className="asset-list">
        <div className="stage-group-label">Combined interactions</div>
        {COMBINED_SEQUENCES.map((sequence, index) => (
          <button
            className={compositionId === sequence.id ? 'asset-row is-active' : 'asset-row'}
            key={sequence.id}
            onClick={() => setCompositionId(sequence.id)}
            type="button"
          >
            <span className="asset-index">C-{String(index + 1).padStart(2, '0')}</span>
            <span className="asset-copy"><strong>{sequence.label}</strong><small>{sequence.note}</small></span>
          </button>
        ))}

        <div className="stage-group-label">Solo mechanism checks</div>
        {ASSET_DEFINITIONS.map((asset, index) => {
          const id = `solo:${asset.id}`
          return (
            <button
              className={compositionId === id && assetId === asset.id ? 'asset-row is-active' : 'asset-row'}
              key={id}
              onClick={() => { setAssetId(asset.id); setCompositionId(id) }}
              type="button"
            >
              <span className="asset-index">M-{String(index + 1).padStart(2, '0')}</span>
              <span className="asset-copy"><strong>{asset.label}</strong><small>all effect intents</small></span>
            </button>
          )
        })}
      </div>
      {replayControls}
      <div className="rail-note"><span>Sequence control</span><p>Choose a solo mechanism or a combination scene, then replay only the cues that belong to that setup.</p></div>
    </aside>
  )
}
