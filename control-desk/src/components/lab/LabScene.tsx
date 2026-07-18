import { ContactShadows, Grid, Html, OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing'
import gsap from 'gsap'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AmbientLight, DirectionalLight, Group, PerspectiveCamera, PointLight, SpotLight } from 'three'
import { Color, Vector3 } from 'three'
import { BlendFunction } from 'postprocessing'
import { Perf } from 'r3f-perf'
import { SCENE_LAYOUT_MANIFEST, type SceneAssetPlacement } from '../../config/sceneManifest'
import { ASSET_DEFINITIONS, findAssetDefinition, getAssetDefinition } from '../../models/registry'
import { DESK_COMPUTER_SCREEN } from '../../models/procedural/DeskComputer'
import { useLabStore, type EffectPreset, type LabMode, type LightingPreset } from '../../store/useLabStore'
import { WorkstationOS } from '../workstation/WorkstationOS'
import { GAME_CASES, type GameDecision } from '../../game/gameData'
import { requestGameAudioCue } from '../../game/gameAudio'
import { GameWorkstation } from '../../game/GameWorkstation'
import { useGameStore } from '../../game/useGameStore'

const DESK_COMPUTER_POSITION = SCENE_LAYOUT_MANIFEST.desk.computerPosition
const WORKSTATION_SCREEN_WORLD = [
  DESK_COMPUTER_POSITION[0] + DESK_COMPUTER_SCREEN.position[0],
  DESK_COMPUTER_POSITION[1] + DESK_COMPUTER_SCREEN.position[1],
  DESK_COMPUTER_POSITION[2] + DESK_COMPUTER_SCREEN.position[2],
] as const

const MODEL_CAMERA_VIEWS = {
  overview: { position: [0, 5.5, 8.2], target: [0, 0.16, 0] },
  inspection: { position: [3.4, 2.35, 4.3], target: [0, 0.58, 0] },
  player: { position: [0, 1.5, 4.35], target: [0, 0.68, 0] },
  profile: { position: [4.7, 1.65, 0.1], target: [0, 0.62, 0] },
  left: { position: [-4.7, 1.65, 0.1], target: [0, 0.62, 0] },
  rear: { position: [0, 1.5, -4.35], target: [0, 0.62, 0] },
  high: { position: [3.1, 4.8, 3.35], target: [0, 0.42, 0] },
  low: { position: [3.2, 0.34, 3.55], target: [0, 0.45, 0] },
} as const

const ANIMATION_CAMERA_VIEWS = {
  overview: { position: [0, 3.15, 5.5], target: [0, 0.34, 0] },
  inspection: { position: [1.65, 1.12, 2.05], target: [0, 0.28, 0] },
  player: { position: [0, 0.9, 2.05], target: [0, 0.28, 0] },
  profile: { position: [2.15, 0.92, 0.05], target: [0, 0.28, 0] },
  left: { position: [-2.15, 0.92, 0.05], target: [0, 0.28, 0] },
  rear: { position: [0, 0.92, -2.05], target: [0, 0.28, 0] },
  high: { position: [1.65, 2.5, 1.85], target: [0, 0.18, 0] },
  low: { position: [1.75, 0.24, 1.9], target: [0, 0.3, 0] },
} as const

const GIRAFFE_ANIMATION_CAMERA_VIEWS = {
  overview: { position: [0, 2.85, 6.45], target: [0, 1.14, 0.04] },
  inspection: { position: [1.35, 1.72, 4.45], target: [0, 1.18, 0.02] },
  player: { position: [0, 1.48, 4.15], target: [0, 1.2, 0.02] },
  profile: { position: [4.35, 1.6, 0.18], target: [0, 1.22, -0.12] },
  left: { position: [-4.35, 1.6, 0.18], target: [0, 1.22, -0.12] },
  rear: { position: [0, 1.7, -4.15], target: [0, 1.18, -0.18] },
  high: { position: [3.2, 3.45, 4.15], target: [0, 1.12, -0.08] },
  low: { position: [2.65, 0.42, 3.7], target: [0, 1.05, 0.02] },
} as const

const SCENE_CAMERA_VIEWS = {
  overview: SCENE_LAYOUT_MANIFEST.camera.overview,
  inspection: SCENE_LAYOUT_MANIFEST.camera.inspection,
  player: SCENE_LAYOUT_MANIFEST.camera.player,
  profile: SCENE_LAYOUT_MANIFEST.camera.profile,
  left: SCENE_LAYOUT_MANIFEST.camera.left,
  rear: SCENE_LAYOUT_MANIFEST.camera.rear,
  high: SCENE_LAYOUT_MANIFEST.camera.high,
  low: SCENE_LAYOUT_MANIFEST.camera.low,
} as const

function cameraViewsForMode(mode: LabMode, compositionId: string) {
  if (mode === 'animation') {
    return compositionId === 'giraffe-window' ? GIRAFFE_ANIMATION_CAMERA_VIEWS : ANIMATION_CAMERA_VIEWS
  }
  if (mode === 'scene') return SCENE_CAMERA_VIEWS
  return MODEL_CAMERA_VIEWS
}

const EFFECT_PROFILE: Record<EffectPreset, { duration: number; position: number; rotation: number }> = {
  'paper-drop': { duration: 0.16, position: 0.012, rotation: 0.002 },
  approve: { duration: 0.26, position: 0.05, rotation: 0.012 },
  reject: { duration: 0.28, position: 0.065, rotation: 0.018 },
  fraud: { duration: 0.48, position: 0.11, rotation: 0.035 },
  'printer-jam': { duration: 0.62, position: 0.13, rotation: 0.042 },
  migration: { duration: 1.15, position: 0.075, rotation: 0.022 },
}

function CameraRig() {
  const cameraPreset = useLabStore((state) => state.cameraPreset)
  const cameraRun = useLabStore((state) => state.cameraRun)
  const compositionId = useLabStore((state) => state.compositionId)
  const effectPreset = useLabStore((state) => state.effectPreset)
  const effectRun = useLabStore((state) => state.effectRun)
  const giraffeFocused = useLabStore((state) => state.giraffeFocused)
  const mode = useLabStore((state) => state.mode)
  const reducedMotion = useLabStore((state) => state.reducedMotion)
  const workstationFocused = useLabStore((state) => state.workstationFocused)
  const controls = useRef<React.ElementRef<typeof OrbitControls>>(null)
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const modeRef = useRef(mode)
  const compositionIdRef = useRef(compositionId)
  const focusMode = giraffeFocused ? 'giraffe' : workstationFocused ? 'workstation' : null
  const focusModeRef = useRef(focusMode)
  const playerLookRef = useRef({ pitch: -0.282, yaw: 0 })
  const shakeRef = useRef({ lastRoll: 0, lastX: 0, lastY: 0, startedAt: -1 })
  const restoredView = useRef<{ fov: number; position: [number, number, number]; target: [number, number, number] } | null>(null)
  modeRef.current = mode
  compositionIdRef.current = compositionId
  focusModeRef.current = focusMode
  const firstPersonActive = mode === 'scene' && cameraPreset === 'player' && focusMode === null

  useEffect(() => {
    if (effectRun < 1) return
    shakeRef.current.startedAt = performance.now() / 1000
  }, [effectRun])

  useFrame(() => {
    const shake = shakeRef.current
    camera.position.x -= shake.lastX
    camera.position.y -= shake.lastY
    camera.rotation.z -= shake.lastRoll
    shake.lastX = 0
    shake.lastY = 0
    shake.lastRoll = 0
    if (shake.startedAt < 0) return

    const profile = EFFECT_PROFILE[effectPreset]
    const elapsed = performance.now() / 1000 - shake.startedAt
    if (elapsed >= profile.duration) {
      shake.startedAt = -1
      return
    }
    const progress = elapsed / profile.duration
    const envelope = (1 - progress) ** 2.6
    const motionScale = reducedMotion ? 0.08 : 1
    const phase = elapsed * (effectPreset === 'migration' ? 42 : 58)
    shake.lastX = Math.sin(phase * 1.13) * profile.position * 0.22 * envelope * motionScale
    shake.lastY = Math.sin(phase * 1.89) * profile.position * 0.16 * envelope * motionScale
    shake.lastRoll = Math.sin(phase) * profile.rotation * 0.38 * envelope * motionScale
    camera.position.x += shake.lastX
    camera.position.y += shake.lastY
    camera.rotation.z += shake.lastRoll
  })

  useEffect(() => {
    if (focusModeRef.current) return
    const currentMode = modeRef.current
    const view = cameraViewsForMode(currentMode, compositionIdRef.current)[cameraPreset]
    const perspectiveCamera = camera as PerspectiveCamera
    const targetFov = 'fov' in view
      ? view.fov
      : cameraPreset === 'overview'
        ? 42
        : 34
    gsap.killTweensOf(camera.position)
    gsap.killTweensOf(perspectiveCamera)
    if (controls.current) gsap.killTweensOf(controls.current.target)
    const positionTween = gsap.to(camera.position, {
      duration: 0.78,
      ease: 'power3.inOut',
      overwrite: true,
      x: view.position[0],
      y: view.position[1],
      z: view.position[2],
      onUpdate: () => controls.current?.update(),
    })
    const targetTween = controls.current
      ? gsap.to(controls.current.target, {
          duration: 0.78,
          ease: 'power3.inOut',
          overwrite: true,
          x: view.target[0],
          y: view.target[1],
          z: view.target[2],
          onUpdate: () => controls.current?.update(),
        })
      : undefined
    const fovTween = gsap.to(perspectiveCamera, {
      duration: 0.78,
      ease: 'power3.inOut',
      fov: targetFov,
      overwrite: true,
      onUpdate: () => perspectiveCamera.updateProjectionMatrix(),
    })

    return () => {
      positionTween.kill()
      targetTween?.kill()
      fovTween.kill()
    }
  }, [camera, cameraPreset, cameraRun])

  useEffect(() => {
    const perspectiveCamera = camera as PerspectiveCamera
    const orbit = controls.current
    const fallbackTarget = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(5).add(camera.position)
    const activeTarget = orbit?.target ?? fallbackTarget

    if (focusMode && !restoredView.current) {
      const restoredTarget = modeRef.current === 'scene' && cameraPreset === 'player'
        ? new Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(5).add(camera.position)
        : activeTarget
      restoredView.current = {
        fov: perspectiveCamera.fov,
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [restoredTarget.x, restoredTarget.y, restoredTarget.z],
      }
    }

    const destination = focusMode === 'workstation'
      ? {
          fov: SCENE_LAYOUT_MANIFEST.camera.workstation.fov,
          position: [
            WORKSTATION_SCREEN_WORLD[0] + SCENE_LAYOUT_MANIFEST.camera.workstation.offset[0],
            WORKSTATION_SCREEN_WORLD[1] + SCENE_LAYOUT_MANIFEST.camera.workstation.offset[1],
            WORKSTATION_SCREEN_WORLD[2] + SCENE_LAYOUT_MANIFEST.camera.workstation.offset[2],
          ] as [number, number, number],
          target: [...WORKSTATION_SCREEN_WORLD] as [number, number, number],
        }
      : focusMode === 'giraffe'
        ? SCENE_LAYOUT_MANIFEST.camera.giraffe
        : restoredView.current
    if (!destination) return

    gsap.killTweensOf(camera.position)
    gsap.killTweensOf(activeTarget)
    gsap.killTweensOf(perspectiveCamera)
    const updateFocusCamera = () => {
      if (orbit) orbit.update()
      else camera.lookAt(activeTarget)
    }
    const positionTween = gsap.to(camera.position, {
      duration: 0.62,
      ease: 'power3.inOut',
      overwrite: true,
      x: destination.position[0],
      y: destination.position[1],
      z: destination.position[2],
      onUpdate: updateFocusCamera,
    })
    const targetTween = gsap.to(activeTarget, {
      duration: 0.62,
      ease: 'power3.inOut',
      overwrite: true,
      x: destination.target[0],
      y: destination.target[1],
      z: destination.target[2],
      onUpdate: updateFocusCamera,
    })
    const fovTween = gsap.to(perspectiveCamera, {
      duration: 0.62,
      ease: 'power3.inOut',
      fov: destination.fov,
      overwrite: true,
      onUpdate: () => perspectiveCamera.updateProjectionMatrix(),
    })

    if (!focusMode) restoredView.current = null
    return () => {
      positionTween.kill()
      targetTween.kill()
      fovTween.kill()
    }
  }, [camera, cameraPreset, focusMode])

  useEffect(() => {
    if (!firstPersonActive) return

    const canvas = gl.domElement
    let draggingPointer: number | null = null
    const look = playerLookRef.current
    look.pitch = -0.282
    look.yaw = 0

    const applyLook = () => {
      camera.rotation.order = 'YXZ'
      camera.rotation.set(look.pitch, look.yaw, 0)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      draggingPointer = event.pointerId
      canvas.setPointerCapture(event.pointerId)
      canvas.style.cursor = 'grabbing'
    }
    const onPointerMove = (event: PointerEvent) => {
      if (draggingPointer !== event.pointerId) return
      look.yaw = Math.max(
        -SCENE_LAYOUT_MANIFEST.playerLook.maxYaw,
        Math.min(SCENE_LAYOUT_MANIFEST.playerLook.maxYaw, look.yaw - event.movementX * 0.0035),
      )
      look.pitch = Math.max(
        SCENE_LAYOUT_MANIFEST.playerLook.minPitch,
        Math.min(SCENE_LAYOUT_MANIFEST.playerLook.maxPitch, look.pitch - event.movementY * 0.0026),
      )
      applyLook()
    }
    const onPointerUp = (event: PointerEvent) => {
      if (draggingPointer !== event.pointerId) return
      draggingPointer = null
      canvas.releasePointerCapture(event.pointerId)
      canvas.style.cursor = 'grab'
    }

    canvas.style.cursor = 'grab'
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    return () => {
      canvas.style.cursor = ''
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
    }
  }, [camera, cameraRun, firstPersonActive, gl])

  return (
    <OrbitControls
      ref={controls}
      dampingFactor={0.075}
      enableDamping
      enablePan
      enabled={focusMode === null && !firstPersonActive}
      makeDefault
      maxDistance={32}
      maxPolarAngle={Math.PI * 0.86}
      minDistance={0.35}
      minPolarAngle={Math.PI * 0.025}
      screenSpacePanning
      target={[0, 0.55, 0]}
    />
  )
}

function Lighting({ preset }: { preset: LightingPreset }) {
  const fillLightScale = useLabStore((state) => state.fillLightScale)
  const keyLightScale = useLabStore((state) => state.keyLightScale)
  const renderQuality = useLabStore((state) => state.renderQuality)
  const ambientRef = useRef<AmbientLight>(null)
  const fillRef = useRef<DirectionalLight>(null)
  const keyRef = useRef<DirectionalLight>(null)
  const pointRef = useRef<PointLight>(null)
  const spotRef = useRef<SpotLight>(null)
  const setup = useMemo(() => ({
    manual: { ambient: '#d8c693', key: '#ffd18a', fill: '#85462e', background: '#251f19', intensity: 1.2 },
    studio: { ambient: '#d9eee4', key: '#fff2d8', fill: '#87b7b0', background: '#17201e', intensity: 1.55 },
    ramp: { ambient: '#d8ecff', key: '#ffffff', fill: '#70ac9b', background: '#142522', intensity: 1.7 },
    night: { ambient: '#5a6e85', key: '#91b4cf', fill: '#b14e34', background: '#090d10', intensity: 0.92 },
  })[preset], [preset])
  const initialSetup = useRef(setup)
  const initialSpotIntensity = useRef(preset === 'night' ? 13 : 2.6)
  const shadowMapSize = renderQuality === 'capture' ? 2048 : renderQuality === 'low' ? 512 : 1024

  const scene = useThree((state) => state.scene)
  useEffect(() => {
    const targets = [
      [ambientRef.current, setup.ambient, 0.58],
      [keyRef.current, setup.key, setup.intensity * keyLightScale],
      [fillRef.current, '#e9fff5', 0.62 * fillLightScale],
      [pointRef.current, setup.fill, setup.intensity * 1.45 * fillLightScale],
      [spotRef.current, '#e96a3c', (preset === 'night' ? 13 : 2.6) * keyLightScale],
    ] as const
    const tweens = targets.flatMap(([light, color, intensity]) => {
      if (!light) return []
      const targetColor = new Color(color)
      return [
        gsap.to(light, { duration: 0.9, ease: 'power2.inOut', intensity }),
        gsap.to(light.color, {
          b: targetColor.b,
          duration: 0.9,
          ease: 'power2.inOut',
          g: targetColor.g,
          r: targetColor.r,
        }),
      ]
    })
    const currentBackground = scene.background instanceof Color ? scene.background : new Color(setup.background)
    scene.background = currentBackground
    const targetBackground = new Color(setup.background)
    tweens.push(gsap.to(currentBackground, {
      b: targetBackground.b,
      duration: 0.9,
      ease: 'power2.inOut',
      g: targetBackground.g,
      r: targetBackground.r,
    }))
    return () => tweens.forEach((tween) => tween.kill())
  }, [fillLightScale, keyLightScale, preset, scene, setup])

  return (
    <>
      <ambientLight ref={ambientRef} color={initialSetup.current.ambient} intensity={0.58} />
      <directionalLight
        ref={keyRef}
        castShadow
        color={initialSetup.current.key}
        intensity={initialSetup.current.intensity}
        position={[4, 7, 5]}
        shadow-bias={-0.00015}
        shadow-mapSize-height={shadowMapSize}
        shadow-mapSize-width={shadowMapSize}
      />
      <directionalLight ref={fillRef} color="#e9fff5" intensity={0.62} position={[0, 3, 5]} />
      <pointLight ref={pointRef} color={initialSetup.current.fill} intensity={initialSetup.current.intensity * 1.45} position={[-2.7, 2.8, 1.5]} distance={9} decay={2} />
      <spotLight ref={spotRef} color="#e96a3c" intensity={initialSpotIntensity.current} position={[0, 5, -5]} angle={0.45} penumbra={0.8} distance={15} />
    </>
  )
}

function AssetFloor() {
  const assetId = useLabStore((state) => state.assetId)
  const cameraPreset = useLabStore((state) => state.cameraPreset)
  const effectPreset = useLabStore((state) => state.effectPreset)
  const effectRun = useLabStore((state) => state.effectRun)
  const setAssetId = useLabStore((state) => state.setAssetId)
  const overview = cameraPreset === 'overview'

  const visibleAssets = overview
    ? ASSET_DEFINITIONS
    : ASSET_DEFINITIONS.filter((asset) => asset.id === assetId)

  return (
    <>
      {visibleAssets.map((asset, index) => {
        const Asset = asset.component
        const columns = Math.min(5, ASSET_DEFINITIONS.length)
        const rows = Math.ceil(ASSET_DEFINITIONS.length / columns)
        const row = Math.floor(index / columns)
        const column = index % columns
        const position: [number, number, number] = overview
          ? [(column - (columns - 1) / 2) * 1.35, 0.02, (row - (rows - 1) / 2) * 1.35]
          : [0, 0.02, 0]

        return (
          <group key={asset.id} onClick={(event) => { event.stopPropagation(); setAssetId(asset.id) }} position={position}>
            <Asset
              effectPreset={effectPreset}
              effectRun={effectRun}
              scale={overview ? asset.scale * 0.33 : asset.scale}
              selected={assetId === asset.id}
            />
            <mesh position={[0, -0.11, 0]} receiveShadow>
              <cylinderGeometry args={[overview ? 0.55 : 1.28, overview ? 0.6 : 1.36, 0.18, 64]} />
              <meshStandardMaterial color={assetId === asset.id ? '#39423a' : '#29322f'} metalness={0.28} roughness={0.72} />
            </mesh>
          </group>
        )
      })}
    </>
  )
}

type RegisteredAssetProps = {
  children?: ReactNode
  id: string
  onActivate?: () => void
  onGameAction?: (action: 'calculator-complete' | 'freeze-card') => void
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  selected?: boolean
  visible?: boolean
}

const DESK_ASSET_PLACEMENTS: SceneAssetPlacement[] = [...SCENE_LAYOUT_MANIFEST.assets]

function RegisteredAsset({ children, id, onActivate, onGameAction, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, selected = false, visible = true }: RegisteredAssetProps) {
  const definition = findAssetDefinition(id)
  const effectPreset = useLabStore((state) => state.effectPreset)
  const effectRun = useLabStore((state) => state.effectRun)
  if (!definition) return null
  const Asset = definition.component
  const asset = (
    <Asset {...(onGameAction ? { onGameAction } : {})} effectPreset={effectPreset} effectRun={effectRun} position={position} rotation={rotation} scale={scale} selected={selected} visible={visible}>
      {children}
    </Asset>
  )
  if (!onActivate) return asset
  return (
    <group
      onClick={(event) => {
        event.stopPropagation()
        onActivate()
      }}
      onPointerOver={(event) => {
        event.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => { document.body.style.cursor = '' }}
    >
      {asset}
    </group>
  )
}

function ReceiptPaper({ position = [0, 0.005, 0], rotation = [0, 0, 0] }: Omit<RegisteredAssetProps, 'id' | 'scale'>) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.23, 0.003, 0.145]} />
        <meshStandardMaterial color="#e6dec8" metalness={0.01} roughness={0.82} />
      </mesh>
      {[-0.042, -0.019, 0.004, 0.027].map((z, index) => (
        <mesh key={z} position={[index === 3 ? -0.035 : 0, 0.002, z]}>
          <boxGeometry args={[index === 3 ? 0.11 : 0.17, 0.0008, 0.003]} />
          <meshStandardMaterial color={index === 3 ? '#b54d37' : '#76766c'} roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

function WorkstationScreen() {
  const advanceRampMigration = useLabStore((state) => state.advanceRampMigration)
  const beginRampTransition = useLabStore((state) => state.beginRampTransition)
  const effectPreset = useLabStore((state) => state.effectPreset)
  const effectRun = useLabStore((state) => state.effectRun)
  const phase = useLabStore((state) => state.experiencePhase)
  const focused = useLabStore((state) => state.workstationFocused)
  const migrationStep = useLabStore((state) => state.rampMigrationStep)
  const rampPromptVisible = useLabStore((state) => state.rampPromptVisible)
  const setFocused = useLabStore((state) => state.setWorkstationFocused)
  const gameActive = window.location.pathname === '/game'

  return (
    <Html
      center={focused}
      scale={focused ? 1 : 0.0208}
      style={{ height: 650, pointerEvents: 'auto', width: 1040 }}
      transform={!focused}
      zIndexRange={[30, 0]}
    >
      {gameActive ? <GameWorkstation /> : (
        <WorkstationOS
          effect={effectPreset}
          effectRun={effectRun}
          focused={focused}
          migrationStep={migrationStep}
          onAdvanceMigration={advanceRampMigration}
          onExit={() => setFocused(false)}
          onFocus={() => setFocused(true)}
          onTryRamp={beginRampTransition}
          phase={phase}
          rampPromptVisible={rampPromptVisible}
        />
      )}
    </Html>
  )
}

const DESK_HOTSPOT_POSITIONS = Object.fromEntries(
  DESK_ASSET_PLACEMENTS
    .filter((placement) => placement.position)
    .map((placement) => [placement.id, placement.position]),
) as Record<string, [number, number, number]>

function DeskGameHotspot({ id, label, onActivate, tone = 'neutral' }: {
  id: string
  label: string
  onActivate: () => void
  tone?: 'approve' | 'danger' | 'neutral' | 'warn'
}) {
  const position = DESK_HOTSPOT_POSITIONS[id]
  if (!position) return null
  return (
    <Html center position={[position[0], position[1] + (id === 'desk-computer' ? 0.48 : 0.2), position[2]]} zIndexRange={[24, 1]}>
      <button className={`game-world-hotspot is-${tone}`} onClick={(event) => { event.stopPropagation(); onActivate() }} type="button">{label}</button>
    </Html>
  )
}

function DeskGameControls() {
  const activeActions = useGameStore((state) => state.activeActions)
  const calculatorComplete = useGameStore((state) => state.calculatorComplete)
  const caseIndex = useGameStore((state) => state.caseIndex)
  const completeCalculator = useGameStore((state) => state.completeCalculator)
  const feedback = useGameStore((state) => state.feedback)
  const paused = useGameStore((state) => state.paused)
  const performAction = useGameStore((state) => state.performAction)
  const phase = useGameStore((state) => state.phase)
  const submitDecision = useGameStore((state) => state.submitDecision)
  const focused = useLabStore((state) => state.workstationFocused)
  const setFocused = useLabStore((state) => state.setWorkstationFocused)
  const triggerEffect = useLabStore((state) => state.triggerEffect)
  const gameActive = window.location.pathname === '/game'
  const currentCase = GAME_CASES[Math.min(caseIndex, GAME_CASES.length - 1)]
  const requiredActions = currentCase.truth.requiredActions ?? []
  const active = gameActive && !focused && !paused && !feedback && ['manual', 'ramp'].includes(phase)

  if (!active) return null

  const decide = (decision: GameDecision) => {
    requestGameAudioCue('stamp-pickup', 0.46)
    submitDecision(decision)
    triggerEffect(decision === 'approve' ? 'approve' : decision === 'reject' ? 'reject' : 'fraud')
  }

  const useCalculator = () => {
    completeCalculator()
    requestGameAudioCue('calculator-key', 0.42)
    requestGameAudioCue('calculator-print', 0.52)
    triggerEffect('paper-drop')
  }

  const freezeCard = () => {
    performAction('freeze-card')
    requestGameAudioCue('freeze-cover', 0.5)
    requestGameAudioCue('freeze-button', 0.64)
    triggerEffect('fraud')
  }

  return (
    <>
      <DeskGameHotspot id="desk-computer" label="OPEN EXPENSE OS" onActivate={() => setFocused(true)} />
      {currentCase.workflow.requiredDeskTool === 'calculator' && !calculatorComplete && (
        <DeskGameHotspot id="desk-calculator" label="CALCULATE TIP %" onActivate={useCalculator} tone="warn" />
      )}
      {requiredActions.includes('freeze-card') && !activeActions.includes('freeze-card') && (
        <DeskGameHotspot id="freeze-card-button" label="FREEZE CARD" onActivate={freezeCard} tone="danger" />
      )}
      <DeskGameHotspot id="approval-stamp" label="APPROVE" onActivate={() => decide('approve')} tone="approve" />
      <DeskGameHotspot id="reject-stamp" label="REJECT" onActivate={() => decide('reject')} tone="danger" />
      <DeskGameHotspot id="fraud-stamp" label="INVESTIGATE" onActivate={() => decide('investigate')} tone="warn" />
    </>
  )
}

function AnimationFloor() {
  const compositionId = useLabStore((state) => state.compositionId)
  const assetId = useLabStore((state) => state.assetId)
  const effectPreset = useLabStore((state) => state.effectPreset)
  const effectRun = useLabStore((state) => state.effectRun)

  if (compositionId.startsWith('solo:')) {
    const definition = getAssetDefinition(assetId)
    return (
      <group>
        <RegisteredAsset id={definition.id} position={[0, 0.02, 0]} scale={definition.scale} />
        <mesh position={[0, -0.11, 0]} receiveShadow>
          <cylinderGeometry args={[1.28, 1.36, 0.18, 64]} />
          <meshStandardMaterial color="#303a35" metalness={0.22} roughness={0.72} />
        </mesh>
      </group>
    )
  }

  if (compositionId === 'receipt-routing') {
    return (
      <group scale={2.35}>
        <RegisteredAsset id="receipt-printer" position={[-0.22, 0.015, -0.05]} />
        <RegisteredAsset id="receipt-tray-set" position={[0.28, 0.015, 0.04]} />
        <ReceiptPaper position={[0.02, 0.012, 0.25]} rotation={[0, -0.08, 0]} />
      </group>
    )
  }

  if (compositionId === 'decision-console') {
    return (
      <group scale={2.4}>
        <RegisteredAsset id="desk-calculator" position={[-0.23, 0.012, -0.04]} rotation={[0, 0.1, 0]} />
        <RegisteredAsset id="approval-stamp" position={[0.12, 0.012, 0.02]} rotation={[0, -0.08, 0]} />
        <RegisteredAsset id="reject-stamp" position={[0.27, 0.012, 0.02]} rotation={[0, -0.12, 0]} />
        <RegisteredAsset id="fraud-stamp" position={[0.49, 0.012, -0.01]} rotation={[0, -0.16, 0]} />
        <ReceiptPaper position={[0.08, 0.01, 0.18]} rotation={[0, -0.08, 0]} />
      </group>
    )
  }

  if (compositionId === 'fraud-response') {
    return (
      <group scale={2.15}>
        <RegisteredAsset id="desk-computer" position={[-0.17, 0.012, -0.12]} scale={0.72} />
        <RegisteredAsset id="freeze-card-button" position={[0.28, 0.012, 0.08]} rotation={[0, -0.18, 0]} />
        <RegisteredAsset id="desk-calculator" position={[-0.22, 0.012, 0.18]} rotation={[0, 0.08, 0]} />
      </group>
    )
  }

  if (compositionId === 'giraffe-window') {
    const fullRevealActive = effectPreset === 'migration' && effectRun > 0
    return (
      <group scale={0.65} position={[0, 0.01, 0.85]}>
        <RegisteredAsset id="office-service-window" />
        <RegisteredAsset id="giraffe-reveal" position={[0.76, 0, -2.22]} visible={fullRevealActive} />
      </group>
    )
  }

  return (
    <group scale={3.15}>
      <ReceiptPaper position={[0, 0.008, 0.025]} rotation={[0, -0.04, 0]} />
      <RegisteredAsset id="approval-stamp" position={[0.015, 0.012, 0.01]} rotation={[0, -0.08, 0]} />
    </group>
  )
}

function DeskEnvironment() {
  const giraffeFocused = useLabStore((state) => state.giraffeFocused)
  const focused = useLabStore((state) => state.workstationFocused)
  const phase = useGameStore((state) => state.phase)
  const submitDecision = useGameStore((state) => state.submitDecision)
  const completeCalculator = useGameStore((state) => state.completeCalculator)
  const performAction = useGameStore((state) => state.performAction)
  const setFocused = useLabStore((state) => state.setWorkstationFocused)
  const triggerEffect = useLabStore((state) => state.triggerEffect)
  const gameActive = window.location.pathname === '/game'

  const activateAsset = (id: string) => {
    if (!gameActive || focused || !['manual', 'ramp'].includes(phase)) return
    if (id === 'desk-computer') {
      setFocused(true)
      return
    }
    if (id === 'desk-calculator') {
      completeCalculator()
      requestGameAudioCue('calculator-print', 0.52)
      triggerEffect('paper-drop')
      return
    }
    if (id === 'freeze-card-button') {
      performAction('freeze-card')
      requestGameAudioCue('freeze-button', 0.64)
      triggerEffect('fraud')
      return
    }
    const decisions: Partial<Record<string, GameDecision>> = {
      'approval-stamp': 'approve',
      'fraud-stamp': 'investigate',
      'reject-stamp': 'reject',
    }
    const decision = decisions[id]
    if (!decision) return
    submitDecision(decision)
    triggerEffect(decision === 'approve' ? 'approve' : decision === 'reject' ? 'reject' : 'fraud')
  }

  const handleModelGameAction = (action: 'calculator-complete' | 'freeze-card') => {
    if (!gameActive || focused || !['manual', 'ramp'].includes(phase)) return
    if (action === 'calculator-complete') {
      completeCalculator()
      requestGameAudioCue('calculator-print', 0.52)
      return
    }
    performAction('freeze-card')
    requestGameAudioCue('freeze-button', 0.64)
    triggerEffect('fraud')
  }

  return (
    <group>
      <ReceiptPaper position={SCENE_LAYOUT_MANIFEST.desk.receiptPosition} rotation={[0, -0.08, 0]} />
      {DESK_ASSET_PLACEMENTS.map((placement, index) => (
        <RegisteredAsset
          key={`${placement.id}-${index}`}
          {...placement}
          onActivate={['approval-stamp', 'desk-calculator', 'desk-computer', 'fraud-stamp', 'freeze-card-button', 'reject-stamp'].includes(placement.id)
            ? () => activateAsset(placement.id)
            : undefined}
          onGameAction={['desk-calculator', 'freeze-card-button'].includes(placement.id) ? handleModelGameAction : undefined}
          visible={placement.id === 'giraffe-reveal' ? giraffeFocused : true}
        >
          {placement.id === 'desk-computer' ? <WorkstationScreen /> : null}
        </RegisteredAsset>
      ))}
      <DeskGameControls />
    </group>
  )
}

function ImpactRig({ children }: { children: React.ReactNode }) {
  const group = useRef<Group>(null)
  const effectPreset = useLabStore((state) => state.effectPreset)
  const effectRun = useLabStore((state) => state.effectRun)
  const reducedMotion = useLabStore((state) => state.reducedMotion)
  const startTime = useRef(-1)

  useEffect(() => {
    if (effectRun < 1) {
      startTime.current = -1
      group.current?.position.set(0, 0, 0)
      if (group.current) group.current.rotation.z = 0
      return
    }
    startTime.current = performance.now() / 1000
  }, [effectRun])

  useFrame(() => {
    if (!group.current || startTime.current < 0) return
    const profile = EFFECT_PROFILE[effectPreset]
    const elapsed = performance.now() / 1000 - startTime.current
    const progress = Math.min(1, Math.max(0, elapsed / profile.duration))
    const envelope = Math.pow(1 - progress, 2.4)
    const motionScale = reducedMotion ? 0.12 : 1
    const phase = elapsed * (effectPreset === 'printer-jam' ? 88 : 54)

    group.current.position.x = Math.sin(phase * 1.17) * profile.position * envelope * motionScale
    group.current.position.y = Math.sin(phase * 1.9) * profile.position * 0.7 * envelope * motionScale
    group.current.rotation.z = Math.sin(phase) * profile.rotation * envelope * motionScale
  })

  return <group ref={group}>{children}</group>
}

function SceneContactShadows() {
  const assetId = useLabStore((state) => state.assetId)
  const compositionId = useLabStore((state) => state.compositionId)
  const effectRun = useLabStore((state) => state.effectRun)
  const lightingPreset = useLabStore((state) => state.lightingPreset)
  const mode = useLabStore((state) => state.mode)
  const renderQuality = useLabStore((state) => state.renderQuality)
  const [effectFrames, setEffectFrames] = useState(1)

  useEffect(() => {
    if (effectRun < 1 || renderQuality !== 'default') return
    setEffectFrames(72)
    const timeout = window.setTimeout(() => setEffectFrames(1), 1400)
    return () => window.clearTimeout(timeout)
  }, [effectRun, renderQuality])

  const frames = renderQuality === 'capture'
    ? Infinity
    : renderQuality === 'low'
      ? 1
      : effectFrames
  const resolution = renderQuality === 'capture' ? 1024 : renderQuality === 'low' ? 256 : 512
  const refreshKey = `${mode}:${assetId}:${compositionId}:${effectRun}:${lightingPreset}:${renderQuality}`

  // The assembled office already uses the directional shadow map. Rendering
  // every scene mesh through a second contact-shadow camera can exhaust WebGL
  // contexts on constrained GPUs, so reserve that pass for capture review.
  if (mode === 'scene' && renderQuality !== 'capture') return null

  return (
    <ContactShadows
      key={refreshKey}
      blur={2.8}
      far={8}
      frames={frames}
      opacity={0.48}
      position={[0, mode === 'scene' ? 0.073 : -0.205, 0]}
      resolution={resolution}
      scale={13}
    />
  )
}

export function LabScene() {
  const effectPreset = useLabStore((state) => state.effectPreset)
  const gridVisible = useLabStore((state) => state.gridVisible)
  const lightingPreset = useLabStore((state) => state.lightingPreset)
  const mode = useLabStore((state) => state.mode)
  const performanceVisible = useLabStore((state) => state.performanceVisible)
  const renderQuality = useLabStore((state) => state.renderQuality)
  const postprocessingEnabled = renderQuality === 'capture' || (renderQuality === 'default' && mode === 'effects')

  return (
    <>
      <Lighting preset={lightingPreset} />
      <CameraRig />
      {performanceVisible && <Perf position="top-right" />}

      <ImpactRig>
        {mode === 'animation' ? <AnimationFloor /> : mode === 'scene' ? <DeskEnvironment /> : <AssetFloor />}
      </ImpactRig>

      {gridVisible && (
        <Grid
          args={[40, 40]}
          cellColor="#4f5b55"
          cellSize={0.25}
          cellThickness={0.45}
          fadeDistance={24}
          fadeStrength={1.25}
          followCamera={false}
          infiniteGrid
          position={[0, mode === 'scene' ? 0.072 : -0.21, 0]}
          sectionColor="#87958e"
          sectionSize={1}
          sectionThickness={0.8}
        />
      )}
      <SceneContactShadows />

      {postprocessingEnabled && (
        <EffectComposer multisampling={0}>
          <Bloom intensity={effectPreset === 'migration' ? 0.35 : 0.16} luminanceThreshold={1.05} mipmapBlur />
          <Noise blendFunction={BlendFunction.SOFT_LIGHT} opacity={lightingPreset === 'manual' ? 0.08 : 0.025} />
          <Vignette darkness={lightingPreset === 'manual' ? 0.55 : 0.34} eskil={false} offset={0.26} />
        </EffectComposer>
      )}
    </>
  )
}
