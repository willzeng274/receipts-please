import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import { useLabStore } from '../../store/useLabStore'
import type { ProceduralAssetProps } from '../types'

const PAPER_REST_SCALE = 0.28
const PAPER_WIDTH = 0.142
const PAPER_SEGMENTS = 20
const SLOT_Y = 0.109
const SLOT_Z = 0.1
const CUTTER_Y = 0.102
const CUTTER_Z = 0.103
const CUTTER_TRAVEL = 0.0075
const LID_HINGE_Y = 0.107
const LID_HINGE_Z = -0.094
const CONTROL_PANEL_TILT = -0.135
const BUTTON_Y = 0.0518
const BUTTON_Z = 0.1074

const READY_LED_COLOR = new THREE.Color('#8bd59d')
const READY_LED_EMISSIVE = new THREE.Color('#48d56a')
const ALERT_LED_COLOR = new THREE.Color('#d8a554')
const ALERT_LED_EMISSIVE = new THREE.Color('#d37a23')
const FRAUD_LED_COLOR = new THREE.Color('#e0644b')
const FRAUD_LED_EMISSIVE = new THREE.Color('#f13d25')

const smoothStep = (value: number) => {
  const clamped = THREE.MathUtils.clamp(value, 0, 1)
  return clamped * clamped * (3 - 2 * clamped)
}

const pulseWindow = (time: number, start: number, peak: number, end: number) =>
  smoothStep((time - start) / (peak - start)) * (1 - smoothStep((time - peak) / (end - peak)))

const effectDuration = (preset: ProceduralAssetProps['effectPreset']) => {
  switch (preset) {
    case 'paper-drop':
      return 1.12
    case 'approve':
      return 1.05
    case 'reject':
      return 1.18
    case 'fraud':
      return 1.34
    case 'printer-jam':
      return 1.62
    case 'migration':
      return 1.36
    default:
      return 0
  }
}

const paperPath = (progress: number) => {
  const forward = 0.152 * progress + 0.018 * progress * progress
  const trayDescent = -0.06 * smoothStep(progress / 0.42)
  const lipLift = 0.0095 * Math.exp(-(((progress - 0.53) / 0.13) ** 2))
  const overhang = -0.043 * smoothStep((progress - 0.54) / 0.46)
  return { y: trayDescent + lipLift + overhang, z: forward }
}

const createPaperGeometry = () => {
  const positions: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const paperColor = new THREE.Color('#f5f0df')
  const inkColor = new THREE.Color('#45484a')

  for (let segment = 0; segment <= PAPER_SEGMENTS; segment += 1) {
    const progress = segment / PAPER_SEGMENTS
    const point = paperPath(progress)

    positions.push(-PAPER_WIDTH / 2, point.y, point.z)
    positions.push(PAPER_WIDTH / 2, point.y, point.z)
    uvs.push(0, progress, 1, progress)
    colors.push(paperColor.r, paperColor.g, paperColor.b, paperColor.r, paperColor.g, paperColor.b)
  }

  for (let segment = 0; segment < PAPER_SEGMENTS; segment += 1) {
    const start = segment * 2
    indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3)
  }

  const lineSpecs = [
    { progress: 0.2, width: 0.06, depth: 0.006 },
    { progress: 0.3, width: 0.098, depth: 0.003 },
    { progress: 0.37, width: 0.084, depth: 0.003 },
    { progress: 0.49, width: 0.106, depth: 0.003 },
    { progress: 0.56, width: 0.091, depth: 0.003 },
    { progress: 0.7, width: 0.046, depth: 0.006 },
  ]

  lineSpecs.forEach(({ progress, width, depth }) => {
    const before = paperPath(Math.max(0, progress - 0.01))
    const after = paperPath(Math.min(1, progress + 0.01))
    const center = paperPath(progress)
    const tangentY = after.y - before.y
    const tangentZ = after.z - before.z
    const tangentLength = Math.hypot(tangentY, tangentZ) || 1
    const halfY = (tangentY / tangentLength) * (depth / 2)
    const halfZ = (tangentZ / tangentLength) * (depth / 2)
    const normalY = tangentZ / tangentLength
    const normalZ = -tangentY / tangentLength
    const y = center.y + normalY * 0.00065
    const z = center.z + normalZ * 0.00065
    const halfWidth = width / 2
    const start = positions.length / 3

    positions.push(-halfWidth, y - halfY, z - halfZ)
    positions.push(halfWidth, y - halfY, z - halfZ)
    positions.push(-halfWidth, y + halfY, z + halfZ)
    positions.push(halfWidth, y + halfY, z + halfZ)
    uvs.push(0, 0, 1, 0, 0, 1, 1, 1)
    for (let vertex = 0; vertex < 4; vertex += 1) {
      colors.push(inkColor.r, inkColor.g, inkColor.b)
    }
    indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3)
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

const createPanelMarksGeometry = () => {
  const positions: number[] = []
  const indices: number[] = []
  const marks = [
    { y: 0.004, width: 0.027, height: 0.0022 },
    { y: -0.001, width: 0.019, height: 0.0017 },
    { y: -0.005, width: 0.009, height: 0.0015 },
  ]

  marks.forEach(({ y, width, height }) => {
    const left = -0.022
    const right = left + width
    const bottom = y - height / 2
    const top = y + height / 2
    const start = positions.length / 3

    positions.push(left, bottom, 0, right, bottom, 0, left, top, 0, right, top, 0)
    indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2)
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

const createRearPortGeometry = () => {
  const positions: number[] = []
  const indices: number[] = []
  const ports = [
    { x: -0.018, y: 0.003, width: 0.026, height: 0.012 },
    { x: 0.019, y: 0.003, width: 0.014, height: 0.014 },
    { x: 0.019, y: -0.009, width: 0.018, height: 0.002 },
  ]

  ports.forEach(({ x, y, width, height }) => {
    const start = positions.length / 3
    positions.push(
      x - width / 2,
      y - height / 2,
      0,
      x + width / 2,
      y - height / 2,
      0,
      x - width / 2,
      y + height / 2,
      0,
      x + width / 2,
      y + height / 2,
      0,
    )
    indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2)
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

const createTearEdgeShape = () => {
  const shape = new THREE.Shape()
  const width = 0.148
  const toothCount = 22
  const left = -width / 2

  shape.moveTo(left, 0.006)
  shape.lineTo(width / 2, 0.006)
  shape.lineTo(width / 2, 0)

  for (let tooth = toothCount; tooth >= 0; tooth -= 1) {
    const x = left + (width * tooth) / toothCount
    const y = tooth % 2 === 0 ? -0.0032 : 0
    shape.lineTo(x, y)
  }

  shape.closePath()
  return shape
}

type AnimationState = {
  elapsed: number
  active: boolean
  preset: ProceduralAssetProps['effectPreset']
}

export function ReceiptPrinter({
  effectPreset,
  effectRun = 0,
  selected = false,
  ...groupProps
}: ProceduralAssetProps) {
  const mechanismRef = useRef<THREE.Group>(null)
  const lidRef = useRef<THREE.Group>(null)
  const rollerRef = useRef<THREE.Group>(null)
  const cutterRef = useRef<THREE.Group>(null)
  const feedButtonRef = useRef<THREE.Group>(null)
  const mainPaperRef = useRef<THREE.Group>(null)
  const jamPaperARef = useRef<THREE.Group>(null)
  const jamPaperBRef = useRef<THREE.Group>(null)
  const thrownPaperRef = useRef<THREE.Group>(null)
  const readyLedMaterialRef = useRef<THREE.MeshStandardMaterial>(null)
  const alertLedMaterialRef = useRef<THREE.MeshStandardMaterial>(null)
  const reducedMotion = useLabStore((state) => state.reducedMotion)
  const animationRef = useRef<AnimationState>({
    elapsed: 0,
    active: false,
    preset: effectPreset,
  })

  const paperGeometry = useMemo(createPaperGeometry, [])
  const panelMarksGeometry = useMemo(createPanelMarksGeometry, [])
  const rearPortGeometry = useMemo(createRearPortGeometry, [])
  const paperMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        vertexColors: true,
        roughness: 0.91,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    [],
  )
  const tearShape = useMemo(createTearEdgeShape, [])
  const tearExtrudeSettings = useMemo(
    () => ({ depth: 0.004, bevelEnabled: false, steps: 1 }),
    [],
  )

  useEffect(
    () => () => {
      paperGeometry.dispose()
      panelMarksGeometry.dispose()
      rearPortGeometry.dispose()
      paperMaterial.dispose()
    },
    [panelMarksGeometry, paperGeometry, paperMaterial, rearPortGeometry],
  )

  const resetAssembly = useCallback(() => {
    if (mechanismRef.current) {
      mechanismRef.current.position.set(0, 0, 0)
      mechanismRef.current.rotation.set(0, 0, 0)
    }
    if (lidRef.current) lidRef.current.rotation.set(0, 0, 0)
    if (rollerRef.current) rollerRef.current.rotation.set(0, 0, 0)
    if (cutterRef.current) {
      cutterRef.current.position.set(0, CUTTER_Y, CUTTER_Z)
      cutterRef.current.rotation.set(0, 0, 0)
    }
    if (feedButtonRef.current) {
      feedButtonRef.current.position.set(0.081, BUTTON_Y, BUTTON_Z)
    }

    if (mainPaperRef.current) {
      mainPaperRef.current.position.set(0, SLOT_Y, SLOT_Z)
      mainPaperRef.current.rotation.set(0, 0, 0)
      mainPaperRef.current.scale.set(1, PAPER_REST_SCALE, PAPER_REST_SCALE)
      mainPaperRef.current.visible = true
    }

    if (jamPaperARef.current) {
      jamPaperARef.current.position.set(-0.005, SLOT_Y, SLOT_Z + 0.001)
      jamPaperARef.current.rotation.set(0, 0, 0)
      jamPaperARef.current.scale.set(1, 0.02, 0.02)
      jamPaperARef.current.visible = false
    }
    if (jamPaperBRef.current) {
      jamPaperBRef.current.position.set(0.005, SLOT_Y, SLOT_Z + 0.0015)
      jamPaperBRef.current.rotation.set(0, 0, 0)
      jamPaperBRef.current.scale.set(1, 0.02, 0.02)
      jamPaperBRef.current.visible = false
    }
    if (thrownPaperRef.current) {
      thrownPaperRef.current.position.set(0, SLOT_Y, SLOT_Z + 0.002)
      thrownPaperRef.current.rotation.set(0, 0, 0)
      thrownPaperRef.current.scale.set(1, 0.02, 0.02)
      thrownPaperRef.current.visible = false
    }

    if (readyLedMaterialRef.current) {
      readyLedMaterialRef.current.color.copy(READY_LED_COLOR)
      readyLedMaterialRef.current.emissive.copy(READY_LED_EMISSIVE)
      readyLedMaterialRef.current.emissiveIntensity = 1.35
    }
    if (alertLedMaterialRef.current) {
      alertLedMaterialRef.current.color.copy(ALERT_LED_COLOR)
      alertLedMaterialRef.current.emissive.copy(ALERT_LED_EMISSIVE)
      alertLedMaterialRef.current.emissiveIntensity = 0.28
    }
  }, [])

  useEffect(() => {
    resetAssembly()
    const state = animationRef.current
    state.elapsed = 0
    state.active = effectRun > 0 && effectPreset !== undefined
    state.preset = effectPreset
  }, [effectPreset, effectRun, resetAssembly])

  useFrame((_, delta) => {
    const mechanism = mechanismRef.current
    const lid = lidRef.current
    const roller = rollerRef.current
    const cutter = cutterRef.current
    const feedButton = feedButtonRef.current
    const mainPaper = mainPaperRef.current
    const jamPaperA = jamPaperARef.current
    const jamPaperB = jamPaperBRef.current
    const thrownPaper = thrownPaperRef.current
    const readyLedMaterial = readyLedMaterialRef.current
    const alertLedMaterial = alertLedMaterialRef.current
    const state = animationRef.current

    if (
      !mechanism ||
      !lid ||
      !roller ||
      !cutter ||
      !feedButton ||
      !mainPaper ||
      !jamPaperA ||
      !jamPaperB ||
      !thrownPaper ||
      !readyLedMaterial ||
      !alertLedMaterial
    ) return

    if (!state.active) return

    resetAssembly()
    readyLedMaterial.emissiveIntensity = selected ? 2.8 : 1.35

    const duration = effectDuration(state.preset)
    state.elapsed = Math.min(state.elapsed + Math.min(delta, 0.05), duration)
    const time = state.elapsed
    const complete = time >= duration
    const motionScale = reducedMotion ? 0.18 : 1
    const secondaryScale = reducedMotion ? 0.52 : 1

    if (state.preset === 'paper-drop') {
      const anticipation = pulseWindow(time, 0, 0.09, 0.18)
      const feed = smoothStep((time - 0.07) / 0.58)
      const motorEnvelope = smoothStep(time / 0.08) * (1 - smoothStep((time - 0.7) / 0.28))
      const settle = 1 - smoothStep((time - 0.72) / 0.34)
      const vibration = 0.00105 * motorEnvelope * motionScale
      const buttonPress = pulseWindow(time, 0.01, 0.08, 0.2)
      const cutterSnap = pulseWindow(time, 0.62, 0.68, 0.79)

      mechanism.position.z = -0.0018 * anticipation * motionScale
      mechanism.position.x = Math.sin(time * 92) * vibration
      mechanism.position.y = Math.abs(Math.sin(time * 76)) * vibration * 0.25
      mechanism.rotation.z = Math.sin(time * 68) * vibration * 2.8
      roller.rotation.x = -feed * 28
      cutter.position.y = CUTTER_Y + CUTTER_TRAVEL * cutterSnap
      feedButton.position.y = BUTTON_Y - 0.0032 * buttonPress
      feedButton.position.z = BUTTON_Z + 0.00044 * buttonPress
      mainPaper.scale.set(1, PAPER_REST_SCALE + feed * 0.52, PAPER_REST_SCALE + feed * 0.52)
      mainPaper.rotation.z = Math.sin(time * 29) * 0.012 * settle * motionScale
      readyLedMaterial.emissiveIntensity += 1.1 * motorEnvelope
      if (complete) state.active = false
      return
    }

    if (state.preset === 'approve') {
      const feed = smoothStep((time - 0.08) / 0.47)
      const motorEnvelope = smoothStep(time / 0.1) * (1 - smoothStep((time - 0.58) / 0.3))
      const confirmation = pulseWindow(time, 0.52, 0.67, 0.96)
      const cutterSnap = pulseWindow(time, 0.49, 0.56, 0.7)
      const vibration = 0.00072 * motorEnvelope * motionScale

      mechanism.position.x = Math.sin(time * 76) * vibration
      mechanism.position.y = Math.abs(Math.sin(time * 61)) * vibration * 0.2
      mechanism.rotation.x = -0.005 * confirmation * motionScale
      roller.rotation.x = -feed * 21
      cutter.position.y = CUTTER_Y + CUTTER_TRAVEL * cutterSnap
      mainPaper.scale.set(1, PAPER_REST_SCALE + feed * 0.36, PAPER_REST_SCALE + feed * 0.36)
      mainPaper.rotation.z = Math.sin(time * 22) * 0.005 * (1 - smoothStep((time - 0.7) / 0.25)) * motionScale
      readyLedMaterial.emissiveIntensity += 2.4 * confirmation
      alertLedMaterial.emissiveIntensity = 0.12
      if (complete) state.active = false
      return
    }

    if (state.preset === 'reject') {
      const firstFeed = smoothStep((time - 0.05) / 0.28)
      const reverse = smoothStep((time - 0.37) / 0.18)
      const correctionFeed = smoothStep((time - 0.61) / 0.34)
      const paperScale = PAPER_REST_SCALE + firstFeed * 0.24 - reverse * 0.1 + correctionFeed * 0.26
      const recoil = pulseWindow(time, 0.33, 0.46, 0.68)
      const settle = 1 - smoothStep((time - 0.82) / 0.28)
      const cutterSnap = pulseWindow(time, 0.94, 1, 1.12)
      const warning = pulseWindow(time, 0.16, 0.34, 0.56) + pulseWindow(time, 0.62, 0.78, 1.04)

      mechanism.position.z = -0.003 * recoil * motionScale
      mechanism.rotation.x = 0.012 * recoil * motionScale
      mechanism.rotation.z = -Math.sin(time * 37) * 0.006 * settle * motionScale
      roller.rotation.x = -firstFeed * 9 + reverse * 4 - correctionFeed * 11
      cutter.position.y = CUTTER_Y + CUTTER_TRAVEL * cutterSnap
      mainPaper.scale.set(1, paperScale, paperScale)
      mainPaper.rotation.z = -0.018 * recoil * secondaryScale
      readyLedMaterial.emissiveIntensity = 0.72
      alertLedMaterial.emissiveIntensity = 0.35 + warning * 2.5
      if (complete) state.active = false
      return
    }

    if (state.preset === 'fraud') {
      const firstBurst = smoothStep((time - 0.03) / 0.22)
      const secondBurst = smoothStep((time - 0.43) / 0.27)
      const finalBurst = smoothStep((time - 0.78) / 0.27)
      const printProgress = firstBurst * 0.31 + secondBurst * 0.31 + finalBurst * 0.38
      const motorEnvelope = Math.min(
        1,
        pulseWindow(time, 0, 0.06, 0.31) +
          pulseWindow(time, 0.4, 0.46, 0.75) +
          pulseWindow(time, 0.75, 0.82, 1.09),
      )
      const inspectionPause = pulseWindow(time, 0.27, 0.34, 0.43)
      const cutterSnap = pulseWindow(time, 1.01, 1.08, 1.21)
      const alarmPulse = 0.45 + 0.55 * Math.sin(time * 31) ** 2
      const vibration = 0.0009 * motorEnvelope * motionScale

      mechanism.position.x = Math.sin(time * 98) * vibration
      mechanism.position.z = -0.0014 * inspectionPause * motionScale
      mechanism.rotation.z = Math.sin(time * 71) * vibration * 2.2
      roller.rotation.x = -printProgress * 36
      cutter.position.y = CUTTER_Y + CUTTER_TRAVEL * cutterSnap
      mainPaper.scale.set(1, PAPER_REST_SCALE + printProgress * 0.72, PAPER_REST_SCALE + printProgress * 0.72)
      mainPaper.rotation.z = Math.sin(time * 42) * 0.009 * motorEnvelope * motionScale
      readyLedMaterial.emissiveIntensity = 0.3
      alertLedMaterial.color.copy(FRAUD_LED_COLOR)
      alertLedMaterial.emissive.copy(FRAUD_LED_EMISSIVE)
      alertLedMaterial.emissiveIntensity = time < 1.18 ? 1.4 + alarmPulse * 2.8 : 2.8
      if (complete) state.active = false
      return
    }

    if (state.preset === 'printer-jam') {
      const firstFeed = smoothStep((time - 0.05) / 0.24)
      const firstSettle = smoothStep((time - 0.34) / 0.27)
      const secondFeed = smoothStep((time - 0.37) / 0.27)
      const secondSettle = smoothStep((time - 0.68) / 0.27)
      const throwFeed = smoothStep((time - 0.72) / 0.28)
      const throwProgress = smoothStep((time - 1.08) / 0.54)
      const firstCut = pulseWindow(time, 0.27, 0.32, 0.39)
      const secondCut = pulseWindow(time, 0.61, 0.66, 0.73)
      const finalCut = pulseWindow(time, 0.97, 1.03, 1.11)
      const cutterSnap = Math.min(1, firstCut + secondCut + finalCut)
      const motorEnvelope = smoothStep(time / 0.09) * (1 - smoothStep((time - 1.12) / 0.28))
      const violentEnvelope = smoothStep((time - 0.43) / 0.2) * (1 - smoothStep((time - 1.3) / 0.28))
      const vibration = (0.0012 * motorEnvelope + 0.0034 * violentEnvelope) * motionScale
      const lidLift = smoothStep((time - 0.56) / 0.24) * (1 - smoothStep((time - 1.24) / 0.28))
      const throwArcScale = reducedMotion ? 0.35 : 1

      mechanism.position.x = Math.sin(time * 104) * vibration
      mechanism.position.y = Math.abs(Math.sin(time * 82)) * vibration * 0.42
      mechanism.rotation.z = Math.sin(time * 71 + 0.6) * vibration * 5.2
      mechanism.rotation.x = -Math.sin(time * 55) * vibration * 2.1
      lid.rotation.x = -0.044 * lidLift * secondaryScale
      roller.rotation.x = -firstFeed * 18 - secondFeed * 21 - throwFeed * 25
      cutter.position.y = CUTTER_Y + CUTTER_TRAVEL * cutterSnap
      mainPaper.visible = false
      readyLedMaterial.emissiveIntensity = 0.22
      alertLedMaterial.emissiveIntensity = 1.2 + violentEnvelope * (1.2 + Math.sin(time * 44) ** 2 * 2)

      if (time >= 0.05) {
        const feedScale = 0.02 + firstFeed * 0.6
        jamPaperA.visible = true
        jamPaperA.position.set(
          -0.037 * firstSettle,
          SLOT_Y - 0.048 * firstSettle,
          SLOT_Z + 0.004 * firstSettle,
        )
        jamPaperA.rotation.set(-0.48 * firstSettle, 0.025 * firstSettle, 0.11 * firstSettle)
        jamPaperA.scale.set(1, feedScale, feedScale)
      }

      if (time >= 0.37) {
        const feedScale = 0.02 + secondFeed * 0.58
        jamPaperB.visible = true
        jamPaperB.position.set(
          0.038 * secondSettle,
          SLOT_Y - 0.0465 * secondSettle,
          SLOT_Z + 0.007 * secondSettle,
        )
        jamPaperB.rotation.set(-0.47 * secondSettle, -0.02 * secondSettle, -0.13 * secondSettle)
        jamPaperB.scale.set(1, feedScale, feedScale)
      }

      if (time >= 0.72) {
        const feedScale = 0.02 + throwFeed * 0.7
        thrownPaper.visible = true
        thrownPaper.scale.set(1, feedScale, feedScale)

        if (time >= 1.08) {
          thrownPaper.position.set(
            0.012 * Math.sin(throwProgress * Math.PI) * throwArcScale,
            SLOT_Y + 0.085 * Math.sin(throwProgress * Math.PI) * throwArcScale - 0.055 * throwProgress,
            SLOT_Z + (0.15 + 0.07 * throwArcScale) * throwProgress,
          )
          thrownPaper.rotation.set(
            -0.48 * throwProgress * throwArcScale,
            0.14 * Math.sin(throwProgress * Math.PI) * throwArcScale,
            0.46 * Math.sin(throwProgress * Math.PI) * throwArcScale,
          )
        }
      }

      if (complete) state.active = false
      return
    }

    if (state.preset === 'migration') {
      const feed = smoothStep((time - 0.08) / 0.48)
      const cutterSnap = pulseWindow(time, 0.5, 0.57, 0.69)
      const park = smoothStep((time - 0.64) / 0.54)
      const calmPulse = pulseWindow(time, 0.7, 0.86, 1.2)
      const motorEnvelope = smoothStep(time / 0.12) * (1 - smoothStep((time - 0.58) / 0.24))
      const vibration = 0.00038 * motorEnvelope * motionScale

      mechanism.position.x = Math.sin(time * 46) * vibration
      mechanism.rotation.x = -0.004 * calmPulse * motionScale
      lid.rotation.x = -0.008 * calmPulse * secondaryScale
      roller.rotation.x = -feed * 18
      cutter.position.y = CUTTER_Y + CUTTER_TRAVEL * cutterSnap
      mainPaper.position.set(0.012 * park, SLOT_Y - 0.053 * park, SLOT_Z + 0.004 * park)
      mainPaper.rotation.set(-0.48 * park, 0.01 * park, -0.035 * park)
      mainPaper.scale.set(1, PAPER_REST_SCALE + feed * 0.42, PAPER_REST_SCALE + feed * 0.42)
      readyLedMaterial.emissiveIntensity = (selected ? 2.8 : 1.85) + 1.4 * calmPulse
      alertLedMaterial.emissiveIntensity = 0.08
      if (complete) state.active = false
    }
  })

  return (
    <group {...groupProps}>
      <group ref={mechanismRef}>
        {/* Two low rubber skids put the manufactured shell exactly on the y=0 ground plane. */}
        <RoundedBox
          args={[0.072, 0.008, 0.15]}
          position={[-0.065, 0.004, -0.002]}
          radius={0.003}
          smoothness={4}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#232526" roughness={0.94} metalness={0.02} />
        </RoundedBox>
        <RoundedBox
          args={[0.072, 0.008, 0.15]}
          position={[0.065, 0.004, -0.002]}
          radius={0.003}
          smoothness={4}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#232526" roughness={0.94} metalness={0.02} />
        </RoundedBox>

        {/* Structural chassis and clamshell lid use subtly different office plastics. */}
        <RoundedBox
          args={[0.225, 0.092, 0.176]}
          position={[0, 0.054, -0.004]}
          radius={0.015}
          smoothness={8}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial
            color="#c9c6b9"
            roughness={0.48}
            metalness={0.03}
            clearcoat={0.12}
            clearcoatRoughness={0.7}
          />
        </RoundedBox>

        {/* The complete lid assembly pivots around its physical rear hinge. */}
        <group ref={lidRef} position={[0, LID_HINGE_Y, LID_HINGE_Z]}>
          <RoundedBox
            args={[0.213, 0.073, 0.135]}
            position={[0, 0.005, 0.077]}
            rotation={[-0.135, 0, 0]}
            radius={0.016}
            smoothness={8}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial
              color="#dedbcf"
              roughness={0.39}
              metalness={0.015}
              clearcoat={0.18}
              clearcoatRoughness={0.62}
            />
          </RoundedBox>

          <RoundedBox
            args={[0.218, 0.008, 0.13]}
            position={[0, -0.013, 0.07]}
            rotation={[-0.135, 0, 0]}
            radius={0.0035}
            smoothness={5}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#5a5a55" roughness={0.72} metalness={0.04} />
          </RoundedBox>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.006, 0.006, 0.198, 24]} />
            <meshStandardMaterial color="#6b6962" roughness={0.54} metalness={0.16} />
          </mesh>

          {/* Controls follow the lid instead of hovering independently when the door kicks. */}
          <RoundedBox
            args={[0.062, 0.01, 0.043]}
            position={[0.067, 0.044, 0.1]}
            rotation={[CONTROL_PANEL_TILT, 0, 0]}
            radius={0.005}
            smoothness={6}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#575b5b" roughness={0.5} metalness={0.08} />
          </RoundedBox>
          <group ref={feedButtonRef} position={[0.081, BUTTON_Y, BUTTON_Z]}>
            <mesh rotation={[CONTROL_PANEL_TILT, 0, 0]} castShadow>
              <cylinderGeometry args={[0.008, 0.008, 0.004, 28]} />
              <meshPhysicalMaterial color="#d5d4ca" roughness={0.38} clearcoat={0.2} />
            </mesh>
          </group>
          <mesh position={[0.052, 0.05, 0.107]}>
            <sphereGeometry args={[0.0033, 16, 10]} />
            <meshStandardMaterial
              ref={readyLedMaterialRef}
              color="#8bd59d"
              emissive="#48d56a"
              emissiveIntensity={selected ? 2.8 : 1.35}
              roughness={0.28}
            />
          </mesh>
          <mesh position={[0.061, 0.051, 0.108]}>
            <sphereGeometry args={[0.0025, 14, 8]} />
            <meshStandardMaterial
              ref={alertLedMaterialRef}
              color="#d8a554"
              emissive="#d37a23"
              emissiveIntensity={0.28}
              roughness={0.32}
            />
          </mesh>

          <RoundedBox
            args={[0.011, 0.028, 0.034]}
            position={[0.111, -0.004, 0.119]}
            radius={0.004}
            smoothness={5}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#72736d" roughness={0.56} metalness={0.06} />
          </RoundedBox>
        </group>

        {/* Chassis-owned hinge blocks keep the lid pivot credible from rear and profile views. */}
        <RoundedBox
          args={[0.024, 0.022, 0.016]}
          position={[-0.095, LID_HINGE_Y, -0.092]}
          radius={0.004}
          smoothness={5}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#77756e" roughness={0.55} metalness={0.12} />
        </RoundedBox>
        <RoundedBox
          args={[0.024, 0.022, 0.016]}
          position={[0.095, LID_HINGE_Y, -0.092]}
          radius={0.004}
          smoothness={5}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#77756e" roughness={0.55} metalness={0.12} />
        </RoundedBox>

        {/* A recessed service plate gives the rear shell a manufactured power/data face. */}
        <RoundedBox
          args={[0.078, 0.034, 0.003]}
          position={[0.035, 0.054, -0.0925]}
          radius={0.004}
          smoothness={5}
          receiveShadow
        >
          <meshStandardMaterial color="#aaa79d" roughness={0.7} metalness={0.04} />
        </RoundedBox>
        <mesh geometry={rearPortGeometry} position={[0.035, 0.054, -0.0942]} rotation={[0, Math.PI, 0]}>
          <meshStandardMaterial color="#303334" roughness={0.8} metalness={0.08} />
        </mesh>

        {/* Recessed throat, upper pinch rollers, lower platen, and rising cutter. */}
        <RoundedBox
          args={[0.189, 0.058, 0.012]}
          position={[0, 0.083, 0.087]}
          radius={0.007}
          smoothness={6}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#353839" roughness={0.62} metalness={0.08} />
        </RoundedBox>
        <RoundedBox
          args={[0.164, 0.009, 0.013]}
          position={[0, 0.104, 0.097]}
          radius={0.0035}
          smoothness={6}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#121516" roughness={0.8} metalness={0.01} />
        </RoundedBox>
        <group ref={rollerRef} position={[0, 0.115, SLOT_Z]}>
          <mesh position={[-0.044, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.006, 0.006, 0.058, 20]} />
            <meshStandardMaterial color="#202425" roughness={0.9} metalness={0} />
          </mesh>
          <mesh position={[0.044, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.006, 0.006, 0.058, 20]} />
            <meshStandardMaterial color="#202425" roughness={0.9} metalness={0} />
          </mesh>
        </group>
        <group ref={cutterRef} position={[0, CUTTER_Y, CUTTER_Z]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <extrudeGeometry args={[tearShape, tearExtrudeSettings]} />
            <meshStandardMaterial color="#a9adb0" roughness={0.31} metalness={0.74} />
          </mesh>
        </group>

        {/* A recessed maker plate is embedded in the fascia rather than floating over it. */}
        <RoundedBox
          args={[0.054, 0.021, 0.003]}
          position={[-0.06, 0.065, 0.0945]}
          radius={0.003}
          smoothness={4}
        >
          <meshStandardMaterial color="#b7b4a9" roughness={0.73} metalness={0.02} />
        </RoundedBox>
        <mesh geometry={panelMarksGeometry} position={[-0.06, 0.065, 0.0964]}>
          <meshStandardMaterial color="#666963" roughness={0.76} metalness={0.02} />
        </mesh>

        {/* Projecting catch tray is thin, reinforced, and visibly connected to the fascia. */}
        <RoundedBox
          args={[0.192, 0.011, 0.112]}
          position={[0, 0.047, 0.132]}
          rotation={[0.075, 0, 0]}
          radius={0.007}
          smoothness={6}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial
            color="#bab8ad"
            roughness={0.5}
            metalness={0.03}
            clearcoat={0.1}
            clearcoatRoughness={0.72}
          />
        </RoundedBox>
        <RoundedBox
          args={[0.008, 0.018, 0.109]}
          position={[-0.096, 0.055, 0.132]}
          rotation={[0.075, 0, 0]}
          radius={0.003}
          smoothness={4}
          castShadow
        >
          <meshStandardMaterial color="#aaa89e" roughness={0.57} metalness={0.04} />
        </RoundedBox>
        <RoundedBox
          args={[0.008, 0.018, 0.109]}
          position={[0.096, 0.055, 0.132]}
          rotation={[0.075, 0, 0]}
          radius={0.003}
          smoothness={4}
          castShadow
        >
          <meshStandardMaterial color="#aaa89e" roughness={0.57} metalness={0.04} />
        </RoundedBox>
        <RoundedBox
          args={[0.184, 0.014, 0.009]}
          position={[0, 0.05, 0.187]}
          radius={0.003}
          smoothness={4}
          castShadow
        >
          <meshStandardMaterial color="#9e9c93" roughness={0.62} metalness={0.04} />
        </RoundedBox>

        {/* The main receipt carries printed marks and visibly curls down into the tray. */}
        <group ref={mainPaperRef} position={[0, SLOT_Y, SLOT_Z]} scale={[1, PAPER_REST_SCALE, PAPER_REST_SCALE]}>
          <mesh geometry={paperGeometry} material={paperMaterial} castShadow receiveShadow />
        </group>

        {/* Jam papers share the authored curl but each has its own constrained pivot. */}
        <group
          ref={jamPaperARef}
          position={[-0.005, SLOT_Y, SLOT_Z + 0.001]}
          scale={[1, 0.02, 0.02]}
          visible={false}
        >
          <mesh geometry={paperGeometry} material={paperMaterial} castShadow receiveShadow />
        </group>
        <group
          ref={jamPaperBRef}
          position={[0.005, SLOT_Y, SLOT_Z + 0.0015]}
          scale={[1, 0.02, 0.02]}
          visible={false}
        >
          <mesh geometry={paperGeometry} material={paperMaterial} castShadow receiveShadow />
        </group>
        <group
          ref={thrownPaperRef}
          position={[0, SLOT_Y, SLOT_Z + 0.002]}
          scale={[1, 0.02, 0.02]}
          visible={false}
        >
          <mesh geometry={paperGeometry} material={paperMaterial} castShadow receiveShadow />
        </group>
      </group>
    </group>
  )
}
