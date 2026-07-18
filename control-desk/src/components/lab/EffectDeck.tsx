import type { CameraPreset, LabMode, LightingPreset, RenderQuality } from '../../store/useLabStore'
import { useLabStore } from '../../store/useLabStore'
import { EFFECTS } from './effectOptions'

const CAMERAS: Record<LabMode, { id: CameraPreset; label: string }[]> = {
  models: [
    { id: 'overview', label: 'All assets' }, { id: 'inspection', label: 'Inspection' },
    { id: 'player', label: 'Front' }, { id: 'profile', label: 'Right' }, { id: 'left', label: 'Left' },
    { id: 'rear', label: 'Rear' }, { id: 'high', label: 'High angle' }, { id: 'low', label: 'Low angle' },
  ],
  animation: [
    { id: 'overview', label: 'Wide stage' }, { id: 'inspection', label: 'Stage detail' },
    { id: 'player', label: 'Front' }, { id: 'profile', label: 'Right' }, { id: 'left', label: 'Left' },
    { id: 'rear', label: 'Rear' }, { id: 'high', label: 'High angle' }, { id: 'low', label: 'Low angle' },
  ],
  scene: [
    { id: 'overview', label: 'Full desk' }, { id: 'inspection', label: 'Desk detail' },
    { id: 'player', label: 'Seated first-person' }, { id: 'profile', label: 'Right aisle' },
    { id: 'left', label: 'Left aisle' }, { id: 'rear', label: 'Employee side' },
    { id: 'high', label: 'Overhead' }, { id: 'low', label: 'Floor check' },
  ],
  effects: [
    { id: 'overview', label: 'All assets' }, { id: 'inspection', label: 'Impact detail' },
    { id: 'player', label: 'Front' }, { id: 'profile', label: 'Right' }, { id: 'left', label: 'Left' },
    { id: 'rear', label: 'Rear' }, { id: 'high', label: 'High angle' }, { id: 'low', label: 'Low angle' },
  ],
}
const LIGHTS: LightingPreset[] = ['manual', 'studio', 'ramp', 'night']
const QUALITY_LEVELS: { id: RenderQuality; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'default', label: 'Default' },
  { id: 'capture', label: 'Capture' },
]

export function EffectDeck() {
  const cameraPreset = useLabStore((state) => state.cameraPreset)
  const effectPreset = useLabStore((state) => state.effectPreset)
  const gridVisible = useLabStore((state) => state.gridVisible)
  const lightingPreset = useLabStore((state) => state.lightingPreset)
  const mode = useLabStore((state) => state.mode)
  const performanceVisible = useLabStore((state) => state.performanceVisible)
  const renderQuality = useLabStore((state) => state.renderQuality)
  const reducedMotion = useLabStore((state) => state.reducedMotion)
  const resetCamera = useLabStore((state) => state.resetCamera)
  const setCameraPreset = useLabStore((state) => state.setCameraPreset)
  const setGridVisible = useLabStore((state) => state.setGridVisible)
  const setLightingPreset = useLabStore((state) => state.setLightingPreset)
  const setPerformanceVisible = useLabStore((state) => state.setPerformanceVisible)
  const setRenderQuality = useLabStore((state) => state.setRenderQuality)
  const setReducedMotion = useLabStore((state) => state.setReducedMotion)
  const triggerEffect = useLabStore((state) => state.triggerEffect)

  return (
    <footer className={mode === 'effects' ? 'effect-deck' : 'effect-deck effect-deck--compact'}>
      {mode === 'effects' && (
        <section className="deck-section deck-section--effects">
          <span className="deck-label">System FX / selected object + screen + camera impulse</span>
          <div className="deck-buttons">
            {EFFECTS.map((effect) => (
              <button
                aria-pressed={effectPreset === effect.id}
                className={effectPreset === effect.id ? 'is-active' : ''}
                key={effect.id}
                onClick={() => triggerEffect(effect.id)}
                type="button"
              >
                <small>{effect.key}</small>
                {effect.label}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="deck-section deck-section--settings">
        <span className="deck-context">{mode === 'models' ? 'Model inspector' : mode === 'animation' ? 'Sequence stage' : mode === 'scene' ? 'Desk environment' : 'System impact'}</span>
        <label>
          <span>Camera</span>
          <select value={cameraPreset} onChange={(event) => setCameraPreset(event.target.value as CameraPreset)}>
            {CAMERAS[mode].map((camera) => <option key={camera.id} value={camera.id}>{camera.label}</option>)}
          </select>
        </label>
        <label>
          <span>Light</span>
          <select value={lightingPreset} onChange={(event) => setLightingPreset(event.target.value as LightingPreset)}>
            {LIGHTS.map((light) => <option key={light}>{light}</option>)}
          </select>
        </label>
        <label>
          <span>Quality</span>
          <select value={renderQuality} onChange={(event) => setRenderQuality(event.target.value as RenderQuality)}>
            {QUALITY_LEVELS.map((quality) => <option key={quality.id} value={quality.id}>{quality.label}</option>)}
          </select>
        </label>
        <label className="lab-toggle">
          <input checked={gridVisible} onChange={(event) => setGridVisible(event.target.checked)} type="checkbox" />
          Grid
        </label>
        <label className="lab-toggle">
          <input checked={performanceVisible} onChange={(event) => setPerformanceVisible(event.target.checked)} type="checkbox" />
          Perf
        </label>
        <label className="lab-toggle">
          <input checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} type="checkbox" />
          Reduced motion
        </label>
        <button className="camera-reset" onClick={resetCamera} type="button">Reset view</button>
      </section>
    </footer>
  )
}
