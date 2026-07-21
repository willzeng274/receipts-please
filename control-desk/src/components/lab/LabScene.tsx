import { ContactShadows, Grid, Html, OrbitControls } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AmbientLight, DirectionalLight, Group, PerspectiveCamera, PointLight, SpotLight } from 'three'
import { Color, Shape, ShapeGeometry, Vector3 } from 'three'
import {
  BlendFunction,
  BloomEffect,
  EffectComposer as PostprocessingComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  VignetteEffect,
} from 'postprocessing'
import { SCENE_LAYOUT_MANIFEST, type SceneAssetPlacement } from '../../config/sceneManifest'
import { isGamePath } from '../../config/labRoutes'
import { ASSET_DEFINITIONS, findAssetDefinition, getAssetDefinition } from '../../models/registry'
import { DESK_COMPUTER_SCREEN } from '../../models/procedural/DeskComputer'
import { useLabStore, type EffectPreset, type LabMode, type LightingPreset } from '../../store/useLabStore'
import { WorkstationOS } from '../workstation/WorkstationOS'
import { type GameDecision } from '../../game/gameData'
import { requestGameAudioCue } from '../../game/gameAudio'
import { GameWorkstation } from '../../game/GameWorkstation'
import { useGameStore } from '../../game/useGameStore'
import type { WorkstationFinalDecision, WorkstationSceneEventId } from '../workstation/types'
import { useWorkstationStore } from '../workstation/useWorkstationStore'

const DESK_COMPUTER_POSITION = SCENE_LAYOUT_MANIFEST.desk.computerPosition
const WORKSTATION_SCREEN_WORLD = [
  DESK_COMPUTER_POSITION[0] + DESK_COMPUTER_SCREEN.position[0],
  DESK_COMPUTER_POSITION[1] + DESK_COMPUTER_SCREEN.position[1],
  DESK_COMPUTER_POSITION[2] + DESK_COMPUTER_SCREEN.position[2],
] as const

const WORKSTATION_SURFACE_WIDTH = 1040
const WORKSTATION_SURFACE_HEIGHT = 585
const HOMOGRAPHY_EPSILON = 1e-7
const FOCUS_CAMERA_DURATION_SECONDS = 0.62

const WORKSTATION_EFFECTS: Record<WorkstationSceneEventId, EffectPreset> = {
  'card.freeze': 'fraud',
  'decision.approve': 'approve',
  'decision.fraud': 'fraud',
  'decision.reject': 'reject',
  'receipt.submitted': 'paper-drop',
}

function PostprocessingStack({ effectPreset, lightingPreset }: { effectPreset: EffectPreset; lightingPreset: LightingPreset }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const composerRef = useRef<PostprocessingComposer | null>(null)
  const [contextGeneration, setContextGeneration] = useState(0)

  useEffect(() => {
    const canvas = gl.domElement
    const onContextLost = (event: Event) => {
      event.preventDefault()
      composerRef.current = null
    }
    const onContextRestored = () => {
      setContextGeneration((generation) => generation + 1)
    }
    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)
    return () => {
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
    }
  }, [gl])

  useEffect(() => {
    if (gl.getContext().getContextAttributes() === null) return

    let composer: PostprocessingComposer | null = null
    try {
      composer = new PostprocessingComposer(gl, { multisampling: 0 })
      const bloom = new BloomEffect({
        intensity: effectPreset === 'migration' ? 0.35 : 0.16,
        luminanceThreshold: 1.05,
        mipmapBlur: true,
      })
      const noise = new NoiseEffect({ blendFunction: BlendFunction.SOFT_LIGHT })
      noise.blendMode.opacity.value = lightingPreset === 'manual' ? 0.08 : 0.025
      const vignette = new VignetteEffect({
        darkness: lightingPreset === 'manual' ? 0.55 : 0.34,
        eskil: false,
        offset: 0.26,
      })
      composer.addPass(new RenderPass(scene, camera))
      composer.addPass(new EffectPass(camera, bloom))
      composer.addPass(new EffectPass(camera, noise, vignette))
      composer.setSize(size.width, size.height)
      composerRef.current = composer
    } catch (error) {
      composer?.dispose()
      composerRef.current = null
      console.warn('Postprocessing skipped because the WebGL context is unavailable.', error)
    }

    return () => {
      if (composerRef.current === composer) composerRef.current = null
      composer?.dispose()
    }
  }, [camera, contextGeneration, effectPreset, gl, lightingPreset, scene, size.height, size.width])

  useFrame((_, delta) => {
    const composer = composerRef.current
    if (gl.getContext().getContextAttributes() === null) return
    if (!composer) {
      gl.render(scene, camera)
      return
    }
    try {
      composer.render(delta)
    } catch (error) {
      composerRef.current = null
      console.warn('Postprocessing render stopped after WebGL context loss.', error)
      if (gl.getContext().getContextAttributes() !== null) gl.render(scene, camera)
    }
  }, 1)

  return null
}

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
          target: [
            WORKSTATION_SCREEN_WORLD[0] + SCENE_LAYOUT_MANIFEST.camera.workstation.targetOffset[0],
            WORKSTATION_SCREEN_WORLD[1] + SCENE_LAYOUT_MANIFEST.camera.workstation.targetOffset[1],
            WORKSTATION_SCREEN_WORLD[2] + SCENE_LAYOUT_MANIFEST.camera.workstation.targetOffset[2],
          ] as [number, number, number],
        }
      : focusMode === 'giraffe'
        ? SCENE_LAYOUT_MANIFEST.camera.giraffe
        : restoredView.current
    if (!destination) return

    gsap.killTweensOf(camera.position)
    gsap.killTweensOf(activeTarget)
    gsap.killTweensOf(perspectiveCamera)
    const startPosition = camera.position.clone()
    const startTarget = activeTarget.clone()
    const startFov = perspectiveCamera.fov
    const destinationPosition = new Vector3(...destination.position)
    const destinationTarget = new Vector3(...destination.target)
    const tweenState = { progress: 0 }
    const updateFocusCamera = () => {
      const progress = tweenState.progress
      camera.position.lerpVectors(startPosition, destinationPosition, progress)
      activeTarget.lerpVectors(startTarget, destinationTarget, progress)
      perspectiveCamera.fov = startFov + (destination.fov - startFov) * progress
      perspectiveCamera.updateProjectionMatrix()
      if (orbit) orbit.update()
      else camera.lookAt(activeTarget)
    }
    const focusTween = gsap.to(tweenState, {
      duration: FOCUS_CAMERA_DURATION_SECONDS,
      ease: 'power3.inOut',
      overwrite: true,
      progress: 1,
      onUpdate: updateFocusCamera,
      onComplete: updateFocusCamera,
    })

    if (!focusMode) restoredView.current = null
    return () => {
      focusTween.kill()
    }
  }, [camera, cameraPreset, focusMode])

  useEffect(() => {
    if (!firstPersonActive) return

    const canvas = gl.domElement
    let draggingPointer: number | null = null
    const look = playerLookRef.current

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

const DESK_STAMP_DECISIONS = {
  'approval-stamp': 'approve',
  'fraud-stamp': 'investigate',
  'reject-stamp': 'reject',
} as const satisfies Partial<Record<string, WorkstationFinalDecision>>

const DESK_STAMP_HIT_AREAS = {
  'approval-stamp': { position: [0, 0.1, 0] as const, size: [0.17, 0.21, 0.17] as const },
  'fraud-stamp': { position: [0, 0.11, 0] as const, size: [0.24, 0.23, 0.2] as const },
  'reject-stamp': { position: [0, 0.1, 0] as const, size: [0.17, 0.21, 0.16] as const },
} as const

function DeskDecisionStamp({ placement }: { placement: SceneAssetPlacement & { id: keyof typeof DESK_STAMP_HIT_AREAS } }) {
  const phase = useLabStore((state) => state.experiencePhase)
  const rampPromptVisible = useLabStore((state) => state.rampPromptVisible)
  const workstationFocused = useLabStore((state) => state.workstationFocused)
  const requestStampedDecision = useWorkstationStore((state) => state.requestStampedDecision)
  const enabled = workstationFocused && phase !== 'migrating' && !rampPromptVisible
  const hitArea = DESK_STAMP_HIT_AREAS[placement.id]

  useEffect(() => () => {
    document.body.style.cursor = ''
  }, [])

  const stopPointer = (event: ThreeEvent<PointerEvent>) => {
    if (enabled) event.stopPropagation()
  }

  return (
    <group
      onClick={(event) => {
        if (!enabled) return
        event.stopPropagation()
        requestStampedDecision(DESK_STAMP_DECISIONS[placement.id])
      }}
      onPointerDown={stopPointer}
      onPointerOut={() => { document.body.style.cursor = '' }}
      onPointerOver={(event) => {
        if (!enabled) return
        event.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      position={placement.position}
      rotation={placement.rotation}
      scale={placement.scale}
      userData={{ decision: DESK_STAMP_DECISIONS[placement.id], role: 'expense-decision-stamp' }}
    >
      <RegisteredAsset id={placement.id} />
      <mesh position={hitArea.position}>
        <boxGeometry args={hitArea.size} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} opacity={0} transparent />
      </mesh>
    </group>
  )
}

function GameStampHighlight({ size }: { size: readonly [number, number, number] }) {
  const brackets = useRef<Group>(null)
  const bracketGeometry = useMemo(() => {
    const x = size[0] * 0.57
    const z = size[2] * 0.57
    const long = Math.min(size[0], size[2]) * 0.26
    const short = Math.max(0.005, Math.min(size[0], size[2]) * 0.03)
    const segments = [
      { position: [-x + long / 2, 0, -z] as const, size: [long, 0.0025, short] as const },
      { position: [-x, 0, -z + long / 2] as const, size: [short, 0.0025, long] as const },
      { position: [x - long / 2, 0, -z] as const, size: [long, 0.0025, short] as const },
      { position: [x, 0, -z + long / 2] as const, size: [short, 0.0025, long] as const },
      { position: [-x + long / 2, 0, z] as const, size: [long, 0.0025, short] as const },
      { position: [-x, 0, z - long / 2] as const, size: [short, 0.0025, long] as const },
      { position: [x - long / 2, 0, z] as const, size: [long, 0.0025, short] as const },
      { position: [x, 0, z - long / 2] as const, size: [short, 0.0025, long] as const },
    ]
    const shapes = segments.map((segment) => {
      const [segmentX, , segmentZ] = segment.position
      const [segmentWidth, , segmentDepth] = segment.size
      const shape = new Shape()
      shape.moveTo(segmentX - segmentWidth / 2, segmentZ - segmentDepth / 2)
      shape.lineTo(segmentX + segmentWidth / 2, segmentZ - segmentDepth / 2)
      shape.lineTo(segmentX + segmentWidth / 2, segmentZ + segmentDepth / 2)
      shape.lineTo(segmentX - segmentWidth / 2, segmentZ + segmentDepth / 2)
      shape.closePath()
      return shape
    })
    return new ShapeGeometry(shapes)
  }, [size])

  useEffect(() => () => bracketGeometry.dispose(), [bracketGeometry])

  useFrame(({ clock }) => {
    if (!brackets.current) return
    const pulse = (Math.sin(clock.elapsedTime * 3.1) + 1) * 0.5
    brackets.current.scale.setScalar(1 + pulse * 0.025)
  })

  return (
    <group ref={brackets} position={[0, 0.012, 0]}>
      <mesh geometry={bracketGeometry} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color="#efbd4d" depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

function ReceiptPaper({ onActivate, position = [0, 0.005, 0], rotation = [0, 0, 0] }: Omit<RegisteredAssetProps, 'id' | 'scale'>) {
  return (
    <group
      onClick={onActivate ? (event) => {
        event.stopPropagation()
        document.body.style.cursor = ''
        onActivate()
      } : undefined}
      onPointerOut={onActivate ? () => { document.body.style.cursor = '' } : undefined}
      onPointerOver={onActivate ? (event) => {
        event.stopPropagation()
        document.body.style.cursor = 'pointer'
      } : undefined}
      position={position}
      rotation={rotation}
      userData={{ role: onActivate ? 'game-receipt-pickup' : 'receipt-paper' }}
    >
      {onActivate && (
        <mesh position={[0, -0.0008, 0]}>
          <boxGeometry args={[0.247, 0.002, 0.162]} />
          <meshBasicMaterial color="#efbd4d" transparent opacity={0.72} />
        </mesh>
      )}
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
  const completeRampTransition = useLabStore((state) => state.completeRampTransition)
  const effectPreset = useLabStore((state) => state.effectPreset)
  const effectRun = useLabStore((state) => state.effectRun)
  const phase = useLabStore((state) => state.experiencePhase)
  const focused = useLabStore((state) => state.workstationFocused)
  const migrationLocked = useLabStore((state) => state.rampMigrationLocked)
  const migrationStep = useLabStore((state) => state.rampMigrationStep)
  const queueRampIntroduction = useLabStore((state) => state.queueRampIntroduction)
  const rampPromptVisible = useLabStore((state) => state.rampPromptVisible)
  const resetExpenseExperience = useLabStore((state) => state.resetExpenseExperience)
  const runGiraffeReveal = useLabStore((state) => state.runGiraffeReveal)
  const setFocused = useLabStore((state) => state.setWorkstationFocused)
  const gameActive = isGamePath(window.location.pathname)
  const completeGameManualQueue = useGameStore((state) => state.completeManualQueue)
  const gamePhase = useGameStore((state) => state.phase)
  const triggerEffect = useLabStore((state) => state.triggerEffect)
  const sceneEvent = useWorkstationStore((state) => state.sceneEvent)
  const markRampUnlocked = useWorkstationStore((state) => state.markRampUnlocked)
  const rampUnlocked = useWorkstationStore((state) => state.rampUnlocked)
  const handledSceneEventRun = useRef(sceneEvent?.run ?? 0)
  const screenAnchor = useRef<Group>(null)
  const focusSurface = useRef<HTMLDivElement>(null)
  const localScreenCorners = useMemo(() => [
    new Vector3(-DESK_COMPUTER_SCREEN.glassWidth / 2, DESK_COMPUTER_SCREEN.glassHeight / 2, 0),
    new Vector3(DESK_COMPUTER_SCREEN.glassWidth / 2, DESK_COMPUTER_SCREEN.glassHeight / 2, 0),
    new Vector3(DESK_COMPUTER_SCREEN.glassWidth / 2, -DESK_COMPUTER_SCREEN.glassHeight / 2, 0),
    new Vector3(-DESK_COMPUTER_SCREEN.glassWidth / 2, -DESK_COMPUTER_SCREEN.glassHeight / 2, 0),
  ], [])
  const projectedScreenCorners = useMemo(() => localScreenCorners.map(() => new Vector3()), [localScreenCorners])
  const projectedScreenOrigin = useMemo(() => new Vector3(), [])

  useFrame(({ camera, size }) => {
    if (!screenAnchor.current || !focusSurface.current) return
    screenAnchor.current.updateWorldMatrix(true, false)
    projectedScreenCorners.forEach((corner, index) => {
      corner.copy(localScreenCorners[index])
      screenAnchor.current!.localToWorld(corner)
      corner.project(camera)
    })
    projectedScreenOrigin.set(0, 0, 0)
    screenAnchor.current.localToWorld(projectedScreenOrigin)
    projectedScreenOrigin.project(camera)

    const surface = focusSurface.current
    if (projectedScreenCorners.some((corner) => !Number.isFinite(corner.x)
      || !Number.isFinite(corner.y)
      || !Number.isFinite(corner.z)
      || corner.z < -1
      || corner.z > 1)) {
      surface.style.opacity = '0'
      surface.style.pointerEvents = 'none'
      return
    }

    const [topLeft, topRight, bottomRight, bottomLeft] = projectedScreenCorners
    // Drei centers a fullscreen Html child on its own projected 3D anchor. The
    // homography is therefore authored in that inner wrapper's local pixels,
    // not viewport pixels. Removing the wrapper origin prevents the camera
    // transform from being applied twice when the monitor is viewed obliquely.
    const wrapperLeft = projectedScreenOrigin.x * size.width * 0.5
    const wrapperTop = -projectedScreenOrigin.y * size.height * 0.5
    const x0 = (topLeft.x * 0.5 + 0.5) * size.width - wrapperLeft
    const y0 = (-topLeft.y * 0.5 + 0.5) * size.height - wrapperTop
    const x1 = (topRight.x * 0.5 + 0.5) * size.width - wrapperLeft
    const y1 = (-topRight.y * 0.5 + 0.5) * size.height - wrapperTop
    const x2 = (bottomRight.x * 0.5 + 0.5) * size.width - wrapperLeft
    const y2 = (-bottomRight.y * 0.5 + 0.5) * size.height - wrapperTop
    const x3 = (bottomLeft.x * 0.5 + 0.5) * size.width - wrapperLeft
    const y3 = (-bottomLeft.y * 0.5 + 0.5) * size.height - wrapperTop
    const dx1 = x1 - x2
    const dx2 = x3 - x2
    const dx3 = x0 - x1 + x2 - x3
    const dy1 = y1 - y2
    const dy2 = y3 - y2
    const dy3 = y0 - y1 + y2 - y3
    const denominator = dx1 * dy2 - dx2 * dy1

    let perspectiveX = 0
    let perspectiveY = 0
    if (Math.abs(dx3) > HOMOGRAPHY_EPSILON || Math.abs(dy3) > HOMOGRAPHY_EPSILON) {
      if (Math.abs(denominator) <= HOMOGRAPHY_EPSILON) {
        surface.style.opacity = '0'
        surface.style.pointerEvents = 'none'
        return
      }
      perspectiveX = (dx3 * dy2 - dx2 * dy3) / denominator
      perspectiveY = (dx1 * dy3 - dx3 * dy1) / denominator
    }

    const scaleX = x1 - x0 + perspectiveX * x1
    const skewX = x3 - x0 + perspectiveY * x3
    const scaleY = y1 - y0 + perspectiveX * y1
    const skewY = y3 - y0 + perspectiveY * y3
    const matrixValues = [
      scaleX / WORKSTATION_SURFACE_WIDTH,
      scaleY / WORKSTATION_SURFACE_WIDTH,
      0,
      perspectiveX / WORKSTATION_SURFACE_WIDTH,
      skewX / WORKSTATION_SURFACE_HEIGHT,
      skewY / WORKSTATION_SURFACE_HEIGHT,
      0,
      perspectiveY / WORKSTATION_SURFACE_HEIGHT,
      0,
      0,
      1,
      0,
      x0,
      y0,
      0,
      1,
    ]

    surface.style.opacity = '1'
    surface.style.pointerEvents = 'auto'
    surface.style.transform = `matrix3d(${matrixValues.join(',')})`
  })

  useEffect(() => {
    if (gameActive && gamePhase === 'briefing' && focused) setFocused(false)
  }, [focused, gameActive, gamePhase, setFocused])

  useEffect(() => {
    if (!sceneEvent || sceneEvent.run <= handledSceneEventRun.current) return
    handledSceneEventRun.current = sceneEvent.run
    triggerEffect(WORKSTATION_EFFECTS[sceneEvent.id])
  }, [sceneEvent, triggerEffect])

  useEffect(() => {
    if (gameActive) return
    if (phase === 'ramp' && !rampUnlocked) {
      markRampUnlocked()
      return
    }
    if (phase === 'manual' && rampUnlocked && !rampPromptVisible) completeRampTransition()
  }, [completeRampTransition, gameActive, markRampUnlocked, phase, rampPromptVisible, rampUnlocked])

  const screen = gameActive ? <GameWorkstation /> : (
    <WorkstationOS
      effect={effectPreset}
      effectRun={effectRun}
      focused={focused}
      migrationLocked={migrationLocked}
      migrationStep={migrationStep}
      onAdvanceMigration={advanceRampMigration}
      onExit={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onGameComplete={gameActive ? undefined : runGiraffeReveal}
      onManualQueueComplete={gameActive ? completeGameManualQueue : queueRampIntroduction}
      onRestart={resetExpenseExperience}
      onTryRamp={beginRampTransition}
      phase={gameActive
        ? gamePhase === 'migrating' ? 'migrating' : gamePhase === 'ramp' ? 'ramp' : 'manual'
        : phase}
      rampPromptVisible={gameActive ? false : rampPromptVisible}
      readOnly={false}
    />
  )

  return (
    <group ref={screenAnchor}>
      <Html fullscreen pointerEvents="none" wrapperClass="workstation-focus-layer" zIndexRange={[40, 40]}>
        <div className="workstation-focus-surface" ref={focusSurface}>{screen}</div>
      </Html>
    </group>
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

  if (compositionId === 'freeze-card-control') {
    return (
      <group scale={3.05}>
        <RegisteredAsset id="freeze-card-button" position={[0.12, 0.012, 0.02]} rotation={[0, -0.18, 0]} />
        <ReceiptPaper position={[-0.12, 0.008, 0.1]} rotation={[0, 0.08, 0]} />
      </group>
    )
  }

  if (compositionId === 'travel-review') {
    return (
      <group scale={2.45}>
        <RegisteredAsset id="desk-computer" position={[-0.22, 0.012, -0.12]} scale={0.68} />
        <RegisteredAsset id="receipt-printer" position={[0.26, 0.012, 0.04]} rotation={[0, -0.18, 0]} />
        <ReceiptPaper position={[0.02, 0.008, 0.23]} rotation={[0, -0.06, 0]} />
      </group>
    )
  }

  if (compositionId === 'phone-dial') {
    return (
      <group scale={3.25}>
        <RegisteredAsset id="desk-phone" position={[0.02, 0.012, -0.01]} rotation={[0, -0.12, 0]} />
        <ReceiptPaper position={[-0.06, 0.008, 0.2]} rotation={[0, 0.05, 0]} />
      </group>
    )
  }

  if (compositionId === 'giraffe-window') {
    const fullRevealActive = effectPreset === 'migration' && effectRun > 0
    return (
      <group scale={0.65} position={[0, 0.01, 0.85]}>
        <RegisteredAsset id="office-service-window" />
        {fullRevealActive ? <RegisteredAsset id="giraffe-reveal" position={[0.76, 0, -2.22]} /> : null}
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
  const automationActive = useGameStore((state) => state.automationActive)
  const feedback = useGameStore((state) => state.feedback)
  const giraffeFocused = useLabStore((state) => state.giraffeFocused)
  const focused = useLabStore((state) => state.workstationFocused)
  const paused = useGameStore((state) => state.paused)
  const phase = useGameStore((state) => state.phase)
  const startGame = useGameStore((state) => state.startGame)
  const submitDecision = useGameStore((state) => state.submitDecision)
  const setRenderQuality = useLabStore((state) => state.setRenderQuality)
  const setFocused = useLabStore((state) => state.setWorkstationFocused)
  const triggerEffect = useLabStore((state) => state.triggerEffect)
  const gameActive = isGamePath(window.location.pathname)
  const decisionAvailable = gameActive && phase === 'manual' && !automationActive && !focused && !paused && !feedback

  const pickUpReceipt = () => {
    if (!gameActive || phase !== 'briefing') return
    setRenderQuality('default')
    startGame()
    setFocused(false)
    triggerEffect('paper-drop')
    requestGameAudioCue('paper-pickup', 0.52)
  }

  const activateAsset = (id: string) => {
    if (!gameActive || automationActive || focused || paused || feedback || phase !== 'manual') return
    if (id === 'desk-computer') {
      setFocused(true)
      requestGameAudioCue('paper-slide', 0.32)
      return
    }
    if (id === 'desk-phone') {
      triggerEffect('approve')
      requestGameAudioCue('phone-ring', 0.5)
      return
    }
    if (id === 'receipt-printer') {
      triggerEffect('printer-jam')
      requestGameAudioCue('printer-jam', 0.58)
      return
    }
    const decisions: Partial<Record<string, GameDecision>> = {
      'approval-stamp': 'approve',
      'fraud-stamp': 'fire',
      'reject-stamp': 'reject',
    }
    const decision = decisions[id]
    if (!decision) return
    requestGameAudioCue('stamp-pickup', 0.46)
    submitDecision(decision)
    triggerEffect(decision === 'approve' ? 'approve' : decision === 'fire' ? 'fraud' : 'reject')
  }
  return (
    <group>
      <ReceiptPaper
        onActivate={gameActive && phase === 'briefing' ? pickUpReceipt : undefined}
        position={SCENE_LAYOUT_MANIFEST.desk.receiptPosition}
        rotation={[0, -0.08, 0]}
      />
      {gameActive && phase === 'briefing' && (
        <Html
          center
          position={[
            SCENE_LAYOUT_MANIFEST.desk.receiptPosition[0],
            SCENE_LAYOUT_MANIFEST.desk.receiptPosition[1] + 0.075,
            SCENE_LAYOUT_MANIFEST.desk.receiptPosition[2],
          ]}
          zIndexRange={[32, 1]}
        >
          <button
            aria-label="Pick up receipt and begin the shift"
            className="game-receipt-pickup-hotspot"
            onClick={(event) => {
              event.stopPropagation()
              pickUpReceipt()
            }}
            type="button"
          >
            <span>Finance Ops · 11:54</span>
            <strong>Pick up receipt</strong>
          </button>
        </Html>
      )}
      {DESK_ASSET_PLACEMENTS.map((placement, index) => {
        const key = `${placement.id}-${index}`
        if (placement.id === 'giraffe-reveal' && !giraffeFocused) return null
        if (!gameActive && placement.id in DESK_STAMP_DECISIONS) {
          return <DeskDecisionStamp key={key} placement={placement as SceneAssetPlacement & { id: keyof typeof DESK_STAMP_HIT_AREAS }} />
        }
        if (gameActive && placement.id in DESK_STAMP_DECISIONS) {
          const stampId = placement.id as keyof typeof DESK_STAMP_HIT_AREAS
          return (
            <group key={key} position={placement.position} rotation={placement.rotation} scale={placement.scale}>
              {decisionAvailable && <GameStampHighlight size={DESK_STAMP_HIT_AREAS[stampId].size} />}
              <RegisteredAsset id={stampId} onActivate={() => activateAsset(stampId)} />
            </group>
          )
        }
        return (
          <RegisteredAsset
            key={key}
            {...placement}
            onActivate={gameActive && ['approval-stamp', 'desk-computer', 'desk-phone', 'fraud-stamp', 'receipt-printer', 'reject-stamp'].includes(placement.id)
              ? () => activateAsset(placement.id)
              : !gameActive && placement.id === 'desk-phone'
                ? () => triggerEffect('approve')
                : !gameActive && placement.id === 'receipt-printer'
                  ? () => triggerEffect('printer-jam')
              : undefined}
            visible={placement.id !== 'freeze-card-button' || !gameActive || automationActive}
          >
            {placement.id === 'desk-computer' ? <WorkstationScreen /> : null}
          </RegisteredAsset>
        )
      })}
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

function LightweightPerf() {
  const gl = useThree((state) => state.gl)
  const panelRef = useRef<HTMLDivElement>(null)
  const sampleRef = useRef({ elapsed: 0, frames: 0, frameTotal: 0 })

  useFrame((_, delta) => {
    const sample = sampleRef.current
    sample.elapsed += delta
    sample.frames += 1
    sample.frameTotal += delta
    if (sample.elapsed < 0.5 || !panelRef.current) return

    const averageFrameMs = (sample.frameTotal / sample.frames) * 1000
    const fps = sample.frames / sample.elapsed
    const render = gl.info.render
    const memory = gl.info.memory
    panelRef.current.textContent = [
      `${fps.toFixed(0)} fps  ${averageFrameMs.toFixed(1)} ms`,
      `${render.calls} calls  ${render.triangles.toLocaleString()} tris`,
      `${memory.geometries} geo  ${memory.textures} tex`,
    ].join('\n')
    sample.elapsed = 0
    sample.frames = 0
    sample.frameTotal = 0
  })

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }} zIndexRange={[100, 100]}>
      <div
        ref={panelRef}
        style={{
          background: 'rgba(11, 19, 17, .88)',
          border: '1px solid rgba(118, 224, 169, .32)',
          color: '#bce8cf',
          font: '500 10px/1.55 "IBM Plex Mono", monospace',
          padding: '8px 10px',
          position: 'absolute',
          right: 10,
          top: 10,
          whiteSpace: 'pre',
        }}
      >
        Sampling renderer…
      </div>
    </Html>
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
      {performanceVisible && <LightweightPerf />}

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
        <PostprocessingStack effectPreset={effectPreset} lightingPreset={lightingPreset} />
      )}
    </>
  )
}
