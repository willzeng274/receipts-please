import { Canvas } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ACESFilmicToneMapping, SRGBColorSpace, type WebGLRenderer } from 'three'
import { getAssetDefinition } from '../../models/registry'
import { RAMP_MIGRATION_STEPS, useLabStore } from '../../store/useLabStore'
import { LabScene } from './LabScene'
import { ScreenEffectPreview } from './ScreenEffectPreview'
import { CanvasErrorBoundary } from './CanvasErrorBoundary'

export function LabViewport() {
  const gameActive = window.location.pathname === '/game'
  const advanceRampMigration = useLabStore((state) => state.advanceRampMigration)
  const assetId = useLabStore((state) => state.assetId)
  const cameraPreset = useLabStore((state) => state.cameraPreset)
  const compositionId = useLabStore((state) => state.compositionId)
  const experiencePhase = useLabStore((state) => state.experiencePhase)
  const exitGiraffeFocus = useLabStore((state) => state.exitGiraffeFocus)
  const giraffeFocused = useLabStore((state) => state.giraffeFocused)
  const mode = useLabStore((state) => state.mode)
  const renderQuality = useLabStore((state) => state.renderQuality)
  const rampMigrationLocked = useLabStore((state) => state.rampMigrationLocked)
  const rampMigrationStep = useLabStore((state) => state.rampMigrationStep)
  const rampTransitionRun = useLabStore((state) => state.rampTransitionRun)
  const setGridVisible = useLabStore((state) => state.setGridVisible)
  const setPerformanceVisible = useLabStore((state) => state.setPerformanceVisible)
  const setRenderQuality = useLabStore((state) => state.setRenderQuality)
  const [webglState, setWebglState] = useState<'ready' | 'restoring' | 'failed'>('ready')
  const [renderer, setRenderer] = useState<WebGLRenderer | null>(null)
  const recoveryAttempts = useRef(0)
  const recoveryTimer = useRef<number | null>(null)
  const rendererStableTimer = useRef<number | null>(null)
  const activeAsset = getAssetDefinition(assetId)
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
  const dpr: [number, number] = renderQuality === 'capture'
    ? [1, 2]
    : renderQuality === 'low' || mode === 'scene'
      ? [1, 1]
      : [1, 1.5]
  const realtimeShadows = renderQuality === 'capture'
    || (renderQuality === 'default' && mode !== 'scene')

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

  const configureRenderer = useCallback(({ gl }: { gl: WebGLRenderer }) => {
    gl.outputColorSpace = SRGBColorSpace
    gl.toneMapping = ACESFilmicToneMapping
    gl.toneMappingExposure = 1.16
    recoveryAttempts.current = 0
    setWebglState('ready')
    setRenderer(gl)
  }, [])

  useEffect(() => {
    if (!renderer) return

    const clearRecoveryTimer = () => {
      if (recoveryTimer.current === null) return
      window.clearTimeout(recoveryTimer.current)
      recoveryTimer.current = null
    }
    const clearStableTimer = () => {
      if (rendererStableTimer.current === null) return
      window.clearTimeout(rendererStableTimer.current)
      rendererStableTimer.current = null
    }
    const onContextLost = (event: Event) => {
      event.preventDefault()
      clearRecoveryTimer()
      clearStableTimer()
      setRenderQuality('low')
      setGridVisible(false)
      setPerformanceVisible(false)
      recoveryAttempts.current += 1
      if (recoveryAttempts.current > 2) {
        setWebglState('failed')
        return
      }
      setWebglState('restoring')
      recoveryTimer.current = window.setTimeout(() => {
        recoveryTimer.current = null
        setWebglState('failed')
      }, 4_000)
    }
    const onContextRestored = () => {
      clearRecoveryTimer()
      setWebglState('ready')
      rendererStableTimer.current = window.setTimeout(() => {
        recoveryAttempts.current = 0
        rendererStableTimer.current = null
      }, 5_000)
    }

    const canvas = renderer.domElement
    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)
    return () => {
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      clearRecoveryTimer()
      clearStableTimer()
    }
  }, [renderer, setGridVisible, setPerformanceVisible, setRenderQuality])

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
          <span>{gameActive ? '2:10–2:35 · ' : ''}Expense OS migration · step {rampMigrationStep + 1} of {RAMP_MIGRATION_STEPS.length}</span>
          <strong>{RAMP_MIGRATION_STEPS[rampMigrationStep]}</strong>
          <small>The workstation and this controller share the same real progress state.</small>
          {gameActive ? (
            <button disabled type="button">{rampMigrationLocked ? 'Connecting automatically…' : 'Preparing next system…'}</button>
          ) : (
            <button disabled={rampMigrationLocked} onClick={advanceRampMigration} type="button">
              {rampMigrationLocked ? 'Connecting…' : rampMigrationStep === RAMP_MIGRATION_STEPS.length - 1 ? 'Finish migration' : 'Connect next system'}
            </button>
          )}
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

      {webglState !== 'ready' && (
        <div className="webgl-recovery" role="status">
          <strong>{webglState === 'failed' ? '3D renderer unavailable' : 'Restoring 3D renderer'}</strong>
          <span>{webglState === 'failed' ? 'Close other 3D tabs, then reload this page.' : 'Switching to the constrained-device render budget.'}</span>
          {webglState === 'failed' && <button onClick={() => window.location.reload()} type="button">Reload</button>}
        </div>
      )}

      <CanvasErrorBoundary resetKeys={[mode, renderQuality, webglState]}>
        <Canvas
          camera={{ fov: 34, near: 0.05, far: 120, position: [3.4, 2.35, 4.3] }}
          dpr={dpr}
          fallback={<div className="webgl-fallback">WebGL is unavailable. Use a current Chrome build with hardware acceleration.</div>}
          gl={{ alpha: false, antialias: false, powerPreference: 'default' }}
          onCreated={configureRenderer}
          shadows={realtimeShadows}
        >
          <LabScene />
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  )
}
