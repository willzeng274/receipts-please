import { Canvas } from '@react-three/fiber'
import { useEffect } from 'react'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import { ASSET_DEFINITIONS } from '../../models/registry'
import { RAMP_MIGRATION_STEPS, useLabStore } from '../../store/useLabStore'
import { LabScene } from './LabScene'
import { ScreenEffectPreview } from './ScreenEffectPreview'
import { CanvasErrorBoundary } from './CanvasErrorBoundary'

export function LabViewport() {
  const advanceRampMigration = useLabStore((state) => state.advanceRampMigration)
  const assetId = useLabStore((state) => state.assetId)
  const cameraPreset = useLabStore((state) => state.cameraPreset)
  const compositionId = useLabStore((state) => state.compositionId)
  const experiencePhase = useLabStore((state) => state.experiencePhase)
  const exitGiraffeFocus = useLabStore((state) => state.exitGiraffeFocus)
  const giraffeFocused = useLabStore((state) => state.giraffeFocused)
  const mode = useLabStore((state) => state.mode)
  const rampMigrationStep = useLabStore((state) => state.rampMigrationStep)
  const rampTransitionRun = useLabStore((state) => state.rampTransitionRun)
  const activeAsset = ASSET_DEFINITIONS.find((asset) => asset.id === assetId) ?? ASSET_DEFINITIONS[0]
  const combinedLabels: Record<string, string> = {
    'stamp-paper': 'Stamp + paper',
    'receipt-routing': 'Receipt routing',
    'decision-console': 'Decision console',
    'fraud-response': 'Fraud response',
    'giraffe-window': 'Giraffe window reveal',
  }
  const label = mode === 'scene'
    ? 'Finance operator desk'
    : mode === 'animation'
      ? compositionId.startsWith('solo:') ? `${activeAsset.label} / solo` : combinedLabels[compositionId] ?? 'Animation composition'
      : activeAsset.label
  const category = mode === 'scene'
    ? 'Integrated environment / real-world assembly'
    : mode === 'animation'
      ? 'Deterministic sequence / replay stage'
      : `${activeAsset.category} / procedural source`

  useEffect(() => {
    if (!giraffeFocused) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      exitGiraffeFocus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [exitGiraffeFocus, giraffeFocused])

  return (
    <div className="lab-viewport">
      <div className="viewport-meta">
        <div>
          <small>{category}</small>
          <strong>{label}</strong>
          <span>{mode === 'animation' ? 'MULTI-MODEL TIMING · EXACT RESET · REDUCED MOTION' : 'REAL-WORLD SCALE · PBR REVIEW · INTERACTION SAFE'}</span>
        </div>
        <span>LIVE WEBGL</span>
      </div>
      <div className="viewport-corners" />
      {mode === 'effects' && <ScreenEffectPreview />}
      {mode === 'scene' && cameraPreset === 'player' && !giraffeFocused && (
        <div className="player-pov-hint"><span>Seated first-person</span><strong>Drag to look left / right</strong><small>Forward office arc · rear view locked</small></div>
      )}
      {giraffeFocused && (
        <button className="giraffe-focus-exit" onClick={exitGiraffeFocus} type="button">
          <span>Chief Growth Officer sighting</span>
          <strong>Click anywhere to exit camera</strong>
          <small>Esc also restores your exact prior view</small>
        </button>
      )}
      {experiencePhase === 'migrating' && (
        <section aria-live="polite" className="ramp-migration-controller">
          <span>Expense OS migration · step {rampMigrationStep + 1} of {RAMP_MIGRATION_STEPS.length}</span>
          <strong>{RAMP_MIGRATION_STEPS[rampMigrationStep]}</strong>
          <small>The workstation and this controller share the same real progress state.</small>
          <button onClick={advanceRampMigration} type="button">
            {rampMigrationStep === RAMP_MIGRATION_STEPS.length - 1 ? 'Finish migration' : 'Connect next system'}
          </button>
        </section>
      )}
      {rampTransitionRun > 0 && experiencePhase === 'ramp' && (
        <div className="low-cortisol-flash" key={rampTransitionRun}>
          <div className="low-cortisol-card">
            <img alt="Low Cortisol meme: a relaxed person beside a smiling green orb" src="/brand/low-cortisol.jpeg" />
            <small>Ramp workspace connected · 47 expenses checked · 6 need judgment</small>
          </div>
        </div>
      )}

      <CanvasErrorBoundary>
        <Canvas
          camera={{ fov: 34, near: 0.05, far: 120, position: [3.4, 2.35, 4.3] }}
          dpr={[1, 2]}
          fallback={<div className="webgl-fallback">WebGL is unavailable. Use a current Chrome build with hardware acceleration.</div>}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.outputColorSpace = SRGBColorSpace
            gl.toneMapping = ACESFilmicToneMapping
            gl.toneMappingExposure = 1.16
          }}
          shadows
        >
          <LabScene />
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  )
}
