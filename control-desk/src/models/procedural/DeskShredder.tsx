import { Instance, Instances, RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { CanvasTexture, CatmullRomCurve3, DoubleSide, SRGBColorSpace, Vector3 } from 'three'
import type { Group, Mesh, MeshStandardMaterial } from 'three'
import { useLabStore } from '../../store/useLabStore'
import type { ProceduralAssetProps } from '../types'

type ShredderEffect = NonNullable<ProceduralAssetProps['effectPreset']>
type ManualControl = 'power' | 'feed' | 'reverse'

type ManualAction = {
  control: ManualControl
  elapsed: number
}

const CUTTER_X = [-0.105, -0.084, -0.063, -0.042, -0.021, 0, 0.021, 0.042, 0.063, 0.084, 0.105]

const GUARD_FINGER_X = [-0.105, -0.075, -0.045, -0.015, 0.015, 0.045, 0.075, 0.105]

const CONTROL_PANEL = {
  width: 0.3,
  height: 0.054,
  y: 0.4,
  z: 0.1462,
  statusX: [-0.112, -0.074, -0.036],
  controlX: [0.03, 0.079, 0.128],
} as const

const CONTROL_LABELS = ['READY', 'JAM', 'REJECT', 'POWER', 'FEED', 'REV'] as const

const FEET: [number, number, number][] = [
  [-0.135, 0.009, -0.105],
  [0.135, 0.009, -0.105],
  [-0.135, 0.009, 0.095],
  [0.135, 0.009, 0.095],
]

const VENTS: [number, number, number][] = [
  [-0.1775, 0.445, -0.058],
  [-0.1775, 0.466, -0.058],
  [-0.1775, 0.487, -0.058],
  [-0.1775, 0.508, -0.058],
  [0.1775, 0.445, -0.058],
  [0.1775, 0.466, -0.058],
  [0.1775, 0.487, -0.058],
  [0.1775, 0.508, -0.058],
]

const DOOR_FASTENERS: [number, number, number][] = [
  [-0.132, 0.075, 0.1435],
  [0.132, 0.075, 0.1435],
  [-0.132, 0.332, 0.1435],
  [0.132, 0.332, 0.1435],
]

const LOOSE_STRIPS = [
  {
    position: [-0.083, 0.166, 0.1465] as [number, number, number],
    rotation: [0, 0, -0.18] as [number, number, number],
    scale: [1, 0.84, 1] as [number, number, number],
  },
  {
    position: [-0.051, 0.148, 0.1465] as [number, number, number],
    rotation: [0, 0, 0.12] as [number, number, number],
    scale: [0.82, 1.12, 1] as [number, number, number],
  },
  {
    position: [-0.017, 0.174, 0.1465] as [number, number, number],
    rotation: [0, 0, -0.06] as [number, number, number],
    scale: [1.12, 0.72, 1] as [number, number, number],
  },
  {
    position: [0.019, 0.145, 0.1465] as [number, number, number],
    rotation: [0, 0, 0.17] as [number, number, number],
    scale: [0.9, 1.18, 1] as [number, number, number],
  },
  {
    position: [0.054, 0.171, 0.1465] as [number, number, number],
    rotation: [0, 0, -0.14] as [number, number, number],
    scale: [1.06, 0.78, 1] as [number, number, number],
  },
  {
    position: [0.084, 0.151, 0.1465] as [number, number, number],
    rotation: [0, 0, 0.08] as [number, number, number],
    scale: [0.86, 1.08, 1] as [number, number, number],
  },
]

const NEAT_STRIPS = [
  [-0.075, 0.13, 0.1465],
  [-0.045, 0.13, 0.1465],
  [-0.015, 0.13, 0.1465],
  [0.015, 0.13, 0.1465],
  [0.045, 0.13, 0.1465],
  [0.075, 0.13, 0.1465],
] as [number, number, number][]

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const smoothstep = (value: number) => {
  const clamped = clamp01(value)
  return clamped * clamped * (3 - 2 * clamped)
}
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount
const pulse = (time: number, start: number, length: number) => {
  const phase = clamp01((time - start) / length)
  return Math.sin(phase * Math.PI)
}

function makeEquipmentLabelTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 256
  const context = canvas.getContext('2d')

  if (context) {
    context.fillStyle = '#d8d1c5'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.strokeStyle = '#6f171f'
    context.lineWidth = 18
    context.strokeRect(9, 9, canvas.width - 18, canvas.height - 18)

    context.fillStyle = '#242426'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = '700 68px Arial, sans-serif'
    context.fillText('REJECTION INTAKE', 512, 78)
    context.font = '600 34px Arial, sans-serif'
    context.fillText('PAPER ONLY  •  MAX 8 SHEETS', 512, 146)
    context.font = '700 25px Arial, sans-serif'
    context.fillStyle = '#6f171f'
    context.fillText('GUARDED CROSS-CUT  /  MANUAL OVERRIDE', 512, 205)
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function makeControlPanelTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 256
  const context = canvas.getContext('2d')

  if (context) {
    context.fillStyle = '#26292b'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.strokeStyle = '#686d70'
    context.lineWidth = 9
    context.strokeRect(5, 5, canvas.width - 10, canvas.height - 10)
    context.fillStyle = '#d8d1c5'
    context.font = '700 29px Arial, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'

    const panelLeft = -CONTROL_PANEL.width / 2
    const columns = [...CONTROL_PANEL.statusX, ...CONTROL_PANEL.controlX]

    columns.forEach((position, index) => {
      const x = ((position - panelLeft) / CONTROL_PANEL.width) * canvas.width
      context.fillText(CONTROL_LABELS[index], x, 55)
      context.strokeStyle = index < 3 ? '#868b8d' : '#777d80'
      context.lineWidth = 5
      context.beginPath()
      context.arc(x, 171, index < 3 ? 25 : 35, 0, Math.PI * 2)
      context.stroke()
    })

    context.strokeStyle = '#686d70'
    context.lineWidth = 5
    const dividerX = ((-0.003 - panelLeft) / CONTROL_PANEL.width) * canvas.width
    context.beginPath()
    context.moveTo(dividerX, 20)
    context.lineTo(dividerX, 236)
    context.stroke()
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function makeReceiptTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 768
  const context = canvas.getContext('2d')

  if (context) {
    context.fillStyle = '#f1ead9'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#373638'
    context.textAlign = 'center'
    context.font = '700 44px Arial, sans-serif'
    context.fillText('EXPENSE', 256, 78)
    context.font = '600 22px Arial, sans-serif'
    context.fillText('SUPPORTING RECEIPT', 256, 112)
    context.fillStyle = '#77716a'
    for (let index = 0; index < 7; index += 1) {
      const width = index % 3 === 0 ? 330 : 386
      context.fillRect(63, 180 + index * 53, width, 9)
    }
    context.fillStyle = '#373638'
    context.fillRect(64, 592, 384, 5)
    context.font = '700 36px Arial, sans-serif'
    context.fillText('$ 980.00', 256, 654)
    context.strokeStyle = '#9c2630'
    context.lineCap = 'round'
    context.lineWidth = 18
    context.beginPath()
    context.moveTo(370, 38)
    context.lineTo(454, 122)
    context.moveTo(454, 38)
    context.lineTo(370, 122)
    context.stroke()
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/**
 * Premium credenza rejection shredder. Manufactured envelope is 0.36 m wide,
 * 0.32 m deep (0.40 m including the rear cable loop), and 0.56 m tall.
 * The origin is centered under the footprint, the base rests at y=0, and +z
 * is the player-facing interaction side.
 */
export function DeskShredder({ effectPreset, effectRun, selected = false, ...groupProps }: ProceduralAssetProps) {
  const reducedMotion = useLabStore((state) => state.reducedMotion)
  const upperHeadRef = useRef<Group>(null)
  const safetyFlapRef = useRef<Group>(null)
  const upperCutterRef = useRef<Group>(null)
  const lowerCutterRef = useRef<Group>(null)
  const mainPaperRef = useRef<Mesh>(null)
  const jamPaperARef = useRef<Mesh>(null)
  const jamPaperBRef = useRef<Mesh>(null)
  const binPanelRef = useRef<Group>(null)
  const looseStripsRef = useRef<Group>(null)
  const neatStripsRef = useRef<Group>(null)
  const greenLightRef = useRef<MeshStandardMaterial>(null)
  const amberLightRef = useRef<MeshStandardMaterial>(null)
  const redLightRef = useRef<MeshStandardMaterial>(null)
  const powerButtonRef = useRef<Group>(null)
  const feedButtonRef = useRef<Group>(null)
  const reverseButtonRef = useRef<Group>(null)
  const powerButtonMaterialRef = useRef<MeshStandardMaterial>(null)
  const feedButtonMaterialRef = useRef<MeshStandardMaterial>(null)
  const reverseButtonMaterialRef = useRef<MeshStandardMaterial>(null)
  const activeEffectRef = useRef<ShredderEffect | null>(null)
  const manualPowerRef = useRef(true)
  const effectPowerSnapshotRef = useRef(true)
  const manualActionRef = useRef<ManualAction | null>(null)
  const elapsedRef = useRef(0)

  const equipmentLabelTexture = useMemo(makeEquipmentLabelTexture, [])
  const controlPanelTexture = useMemo(makeControlPanelTexture, [])
  const receiptTexture = useMemo(makeReceiptTexture, [])
  const cableCurve = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0.112, 0.39, -0.142),
        new Vector3(0.146, 0.31, -0.196),
        new Vector3(0.152, 0.15, -0.224),
        new Vector3(0.158, 0.006, -0.228),
      ]),
    [],
  )

  useEffect(
    () => () => {
      equipmentLabelTexture.dispose()
      controlPanelTexture.dispose()
      receiptTexture.dispose()
    },
    [controlPanelTexture, equipmentLabelTexture, receiptTexture],
  )

  const applyManualPanelState = useCallback(() => {
    const powered = manualPowerRef.current

    if (greenLightRef.current) greenLightRef.current.emissiveIntensity = powered ? 0.42 : 0.02
    if (amberLightRef.current) amberLightRef.current.emissiveIntensity = powered ? 0.08 : 0.02
    if (redLightRef.current) redLightRef.current.emissiveIntensity = powered ? (selected ? 0.34 : 0.12) : selected ? 0.18 : 0.03
    if (powerButtonMaterialRef.current) powerButtonMaterialRef.current.emissiveIntensity = powered ? 0.7 : 0.03
    if (feedButtonMaterialRef.current) feedButtonMaterialRef.current.emissiveIntensity = powered ? 0.12 : 0.02
    if (reverseButtonMaterialRef.current) reverseButtonMaterialRef.current.emissiveIntensity = powered ? 0.09 : 0.02
  }, [selected])

  const restoreManualMechanism = useCallback(() => {
    if (upperHeadRef.current) {
      upperHeadRef.current.position.set(0, 0, 0)
      upperHeadRef.current.rotation.set(0, 0, 0)
    }
    if (safetyFlapRef.current) safetyFlapRef.current.rotation.set(0, 0, 0)
    if (upperCutterRef.current) upperCutterRef.current.rotation.set(0, 0, 0)
    if (lowerCutterRef.current) lowerCutterRef.current.rotation.set(0, 0, 0)
    if (binPanelRef.current) {
      binPanelRef.current.position.set(0, 0, 0)
      binPanelRef.current.rotation.set(0, 0, 0)
    }
    if (powerButtonRef.current) powerButtonRef.current.position.z = 0
    if (feedButtonRef.current) feedButtonRef.current.position.z = 0
    if (reverseButtonRef.current) reverseButtonRef.current.position.z = 0
    applyManualPanelState()
  }, [applyManualPanelState])

  const resetPose = useCallback(() => {
    const head = upperHeadRef.current
    const flap = safetyFlapRef.current
    const upperCutter = upperCutterRef.current
    const lowerCutter = lowerCutterRef.current
    const paper = mainPaperRef.current
    const jamA = jamPaperARef.current
    const jamB = jamPaperBRef.current
    const binPanel = binPanelRef.current
    const looseStrips = looseStripsRef.current
    const neatStrips = neatStripsRef.current

    manualActionRef.current = null

    if (head) {
      head.position.set(0, 0, 0)
      head.rotation.set(0, 0, 0)
    }
    if (flap) flap.rotation.set(0, 0, 0)
    if (upperCutter) upperCutter.rotation.set(0, 0, 0)
    if (lowerCutter) lowerCutter.rotation.set(0, 0, 0)
    if (paper) {
      paper.visible = false
      paper.position.set(0, 0.68, 0.163)
      paper.rotation.set(-0.08, 0, 0)
    }
    if (jamA) {
      jamA.visible = false
      jamA.position.set(-0.018, 0.7, 0.164)
      jamA.rotation.set(-0.08, 0, 0.08)
    }
    if (jamB) {
      jamB.visible = false
      jamB.position.set(0.018, 0.73, 0.165)
      jamB.rotation.set(-0.08, 0, -0.08)
    }
    if (binPanel) {
      binPanel.position.set(0, 0, 0)
      binPanel.rotation.set(0, 0, 0)
    }
    if (looseStrips) {
      looseStrips.visible = true
      looseStrips.position.set(0, 0, 0)
      looseStrips.rotation.set(0, 0, 0)
    }
    if (neatStrips) {
      neatStrips.visible = false
      neatStrips.position.set(0, 0, 0)
      neatStrips.rotation.set(0, 0, 0)
    }
    restoreManualMechanism()
  }, [restoreManualMechanism])

  const finishEffect = useCallback(() => {
    activeEffectRef.current = null
    manualPowerRef.current = effectPowerSnapshotRef.current
    restoreManualMechanism()
  }, [restoreManualMechanism])

  const triggerManualControl = useCallback(
    (control: ManualControl) => {
      if (activeEffectRef.current || manualActionRef.current) return
      if (control !== 'power' && !manualPowerRef.current) return

      if (control === 'power') manualPowerRef.current = !manualPowerRef.current
      manualActionRef.current = { control, elapsed: 0 }
      applyManualPanelState()
    },
    [applyManualPanelState],
  )

  useEffect(() => {
    effectPowerSnapshotRef.current = manualPowerRef.current
    resetPose()
    elapsedRef.current = 0
    activeEffectRef.current = effectPreset ?? null

    const paper = mainPaperRef.current
    const jamA = jamPaperARef.current
    const jamB = jamPaperBRef.current
    const looseStrips = looseStripsRef.current

    switch (effectPreset) {
      case 'paper-drop':
        if (paper) paper.visible = true
        break
      case 'approve':
        if (paper) {
          paper.visible = true
          paper.position.y = 0.615
        }
        break
      case 'reject':
      case 'fraud':
        if (paper) paper.visible = true
        break
      case 'printer-jam':
        if (paper) paper.visible = true
        if (jamA) jamA.visible = true
        if (jamB) jamB.visible = true
        break
      case 'migration':
        if (jamA) {
          jamA.visible = true
          jamA.position.set(-0.018, 0.585, 0.164)
          jamA.rotation.z = 0.19
        }
        if (jamB) {
          jamB.visible = true
          jamB.position.set(0.018, 0.605, 0.165)
          jamB.rotation.z = -0.17
        }
        if (looseStrips) {
          looseStrips.position.y = 0.018
          looseStrips.rotation.z = 0.08
        }
        if (amberLightRef.current) amberLightRef.current.emissiveIntensity = 2.8
        if (redLightRef.current) redLightRef.current.emissiveIntensity = 1.2
        break
      default:
        activeEffectRef.current = null
    }
  }, [effectPreset, effectRun, resetPose])

  useFrame((_, delta) => {
    const effect = activeEffectRef.current
    const head = upperHeadRef.current
    const flap = safetyFlapRef.current
    const upperCutter = upperCutterRef.current
    const lowerCutter = lowerCutterRef.current
    const greenLight = greenLightRef.current
    const amberLight = amberLightRef.current
    const redLight = redLightRef.current

    if (!effect) {
      const action = manualActionRef.current
      const powerButton = powerButtonRef.current
      const feedButton = feedButtonRef.current
      const reverseButton = reverseButtonRef.current

      if (!action || !head || !flap || !upperCutter || !lowerCutter || !greenLight || !amberLight || !powerButton || !feedButton || !reverseButton) {
        return
      }

      action.elapsed += Math.min(delta, 0.05)
      const manualMotion = reducedMotion ? 0.18 : 1

      switch (action.control) {
        case 'power': {
          const duration = reducedMotion ? 0.16 : 0.28
          const click = pulse(action.elapsed, 0, duration)
          powerButton.position.z = -0.006 * click
          head.position.y = -0.0015 * click * manualMotion
          if (action.elapsed >= duration) manualActionRef.current = null
          break
        }
        case 'feed': {
          const duration = reducedMotion ? 0.28 : 0.7
          const progress = smoothstep(action.elapsed / duration)
          const press = pulse(action.elapsed, 0, duration * 0.72)
          feedButton.position.z = -0.006 * press
          flap.rotation.x = -0.17 * press * manualMotion
          upperCutter.rotation.x = progress * Math.PI * 4
          lowerCutter.rotation.x = -progress * Math.PI * 4.4
          greenLight.emissiveIntensity = 0.42 + press * 2.15
          if (action.elapsed >= duration) manualActionRef.current = null
          break
        }
        case 'reverse': {
          const duration = reducedMotion ? 0.3 : 0.76
          const progress = smoothstep(action.elapsed / duration)
          const press = pulse(action.elapsed, 0, duration * 0.75)
          reverseButton.position.z = -0.006 * press
          flap.rotation.x = 0.08 * press * manualMotion
          upperCutter.rotation.x = -progress * Math.PI * 3.2
          lowerCutter.rotation.x = progress * Math.PI * 3.55
          amberLight.emissiveIntensity = 0.08 + press * 2.6
          if (action.elapsed >= duration) manualActionRef.current = null
          break
        }
      }

      if (!manualActionRef.current) restoreManualMechanism()
      return
    }

    const paper = mainPaperRef.current
    const jamA = jamPaperARef.current
    const jamB = jamPaperBRef.current
    const binPanel = binPanelRef.current
    const looseStrips = looseStripsRef.current
    const neatStrips = neatStripsRef.current

    if (
      !head ||
      !flap ||
      !upperCutter ||
      !lowerCutter ||
      !paper ||
      !jamA ||
      !jamB ||
      !binPanel ||
      !looseStrips ||
      !neatStrips ||
      !greenLight ||
      !amberLight ||
      !redLight
    ) {
      return
    }

    elapsedRef.current += Math.min(delta, 0.05)
    const time = elapsedRef.current
    const motion = reducedMotion ? 0.12 : 1

    switch (effect) {
      case 'paper-drop': {
        const arrival = smoothstep(time / 0.28)
        const feed = smoothstep((time - 0.42) / (reducedMotion ? 0.22 : 0.62))
        paper.position.y = time < 0.42 ? lerp(0.68, 0.62, arrival) : lerp(0.62, 0.505, feed)
        paper.position.z = lerp(0.163, 0.154, feed)
        paper.rotation.z = Math.sin(time * 7) * 0.012 * motion * (1 - feed)
        paper.visible = feed < 0.93
        flap.rotation.x = -0.27 * pulse(time, 0.34, reducedMotion ? 0.3 : 0.7) * motion
        upperCutter.rotation.x = feed * Math.PI * 5
        lowerCutter.rotation.x = -feed * Math.PI * 5
        greenLight.emissiveIntensity = lerp(0.42, 2.25, feed)
        if (time > (reducedMotion ? 0.78 : 1.35)) finishEffect()
        break
      }
      case 'approve': {
        const check = smoothstep(time / 0.22)
        const returnPaper = smoothstep((time - 0.25) / (reducedMotion ? 0.28 : 0.62))
        paper.position.y = lerp(0.615, 0.594, check) + returnPaper * 0.092
        paper.rotation.z = -0.015 * pulse(time, 0.22, 0.7) * motion
        paper.visible = returnPaper < 0.96
        flap.rotation.x = -0.085 * pulse(time, 0.08, 0.56) * motion
        upperCutter.rotation.x = -returnPaper * Math.PI * 0.36
        lowerCutter.rotation.x = returnPaper * Math.PI * 0.36
        greenLight.emissiveIntensity = lerp(0.42, 2.8, smoothstep(time / 0.34))
        if (time > (reducedMotion ? 0.68 : 1.2)) finishEffect()
        break
      }
      case 'reject': {
        const anticipation = pulse(time, 0, 0.34)
        const feed = smoothstep((time - 0.21) / (reducedMotion ? 0.24 : 0.56))
        paper.position.y = lerp(0.68 + anticipation * 0.014 * motion, 0.5, feed)
        paper.position.z = lerp(0.163, 0.153, feed)
        paper.visible = feed < 0.94
        flap.rotation.x = -0.34 * pulse(time, 0.17, reducedMotion ? 0.3 : 0.68) * motion
        upperCutter.rotation.x = feed * Math.PI * 7
        lowerCutter.rotation.x = -feed * Math.PI * 7.4
        binPanel.position.z = 0.004 * pulse(time, 0.53, 0.36) * motion
        redLight.emissiveIntensity = reducedMotion
          ? lerp(0.5, 2.4, feed)
          : 0.5 + pulse(time, 0.16, 0.7) * 3.1
        greenLight.emissiveIntensity = lerp(0.42, 0.08, feed)
        if (time > (reducedMotion ? 0.72 : 1.28)) {
          finishEffect()
        }
        break
      }
      case 'fraud': {
        const feed = smoothstep((time - 0.14) / (reducedMotion ? 0.3 : 1.04))
        const biteOne = pulse(time, 0.14, 0.3)
        const biteTwo = pulse(time, 0.5, 0.3)
        const biteThree = pulse(time, 0.86, 0.36)
        const bites = biteOne + biteTwo + biteThree
        paper.position.y = lerp(0.68, 0.49, feed) + Math.sin(feed * Math.PI * 5) * 0.009 * (1 - feed) * motion
        paper.position.z = lerp(0.163, 0.153, feed)
        paper.rotation.z = Math.sin(time * 24) * 0.018 * motion * (1 - feed)
        paper.visible = feed < 0.96
        flap.rotation.x = -0.38 * Math.min(1, bites) * motion
        upperCutter.rotation.x = feed * Math.PI * 12
        lowerCutter.rotation.x = -feed * Math.PI * 13
        head.position.y = bites * 0.004 * motion
        head.rotation.z = (biteOne - biteThree) * 0.008 * motion
        binPanel.position.z = bites * 0.0045 * motion
        looseStrips.position.y = bites * 0.005 * motion
        looseStrips.rotation.z = (biteOne - biteTwo + biteThree) * 0.025 * motion
        redLight.emissiveIntensity = reducedMotion
          ? lerp(0.8, 3.4, feed)
          : time < 1.3
            ? Math.sin(time * 47) > 0
              ? 4.2
              : 0.75
            : 2.2
        greenLight.emissiveIntensity = lerp(0.42, 0.03, feed)
        if (time > (reducedMotion ? 0.82 : 1.72)) {
          head.position.y = 0
          head.rotation.z = 0
          binPanel.position.z = 0
          looseStrips.position.y = 0
          looseStrips.rotation.z = 0
          finishEffect()
        }
        break
      }
      case 'printer-jam': {
        const feed = smoothstep(time / (reducedMotion ? 0.3 : 0.82))
        const chatterFade = 1 - smoothstep((time - 0.78) / 0.55)
        paper.position.y = lerp(0.68, 0.558, feed)
        jamA.position.y = lerp(0.7, 0.588, feed)
        jamB.position.y = lerp(0.73, 0.608, feed)
        paper.position.z = lerp(0.163, 0.158, feed)
        jamA.position.z = lerp(0.164, 0.1585, feed)
        jamB.position.z = lerp(0.165, 0.159, feed)
        paper.rotation.z = lerp(0, 0.055, feed)
        jamA.rotation.z = lerp(0.08, 0.19, feed)
        jamB.rotation.z = lerp(-0.08, -0.17, feed)
        flap.rotation.x = -0.045 - Math.abs(Math.sin(time * 25)) * 0.12 * chatterFade * motion
        upperCutter.rotation.x = Math.sin(time * 11) * 1.25 * motion
        lowerCutter.rotation.x = -Math.sin(time * 12.5) * 1.05 * motion
        head.position.x = Math.sin(time * 29) * 0.0022 * chatterFade * motion
        amberLight.emissiveIntensity = reducedMotion
          ? lerp(0.4, 2.8, feed)
          : time < 1.2
            ? Math.sin(time * 23) > 0
              ? 3.5
              : 0.3
            : 2.8
        greenLight.emissiveIntensity = lerp(0.42, 0.05, feed)
        if (time > (reducedMotion ? 0.68 : 1.55)) {
          head.position.x = 0
          finishEffect()
        }
        break
      }
      case 'migration': {
        const purge = smoothstep(time / (reducedMotion ? 0.3 : 0.82))
        const settle = smoothstep((time - 0.5) / (reducedMotion ? 0.24 : 0.72))
        jamA.position.x = lerp(-0.018, -0.135, purge)
        jamB.position.x = lerp(0.018, 0.135, purge)
        jamA.position.y = lerp(0.585, 0.76, purge)
        jamB.position.y = lerp(0.605, 0.735, purge)
        jamA.rotation.z = lerp(0.19, 0.36, purge) * motion
        jamB.rotation.z = lerp(-0.17, -0.32, purge) * motion
        jamA.visible = purge < 0.93
        jamB.visible = purge < 0.93
        flap.rotation.x = -0.24 * pulse(time, 0, reducedMotion ? 0.36 : 0.9) * motion
        upperCutter.rotation.x = -purge * Math.PI * 1.5
        lowerCutter.rotation.x = purge * Math.PI * 1.5
        looseStrips.position.y = lerp(0.018, 0, settle)
        looseStrips.rotation.z = lerp(0.08, 0, settle)
        looseStrips.visible = settle < 0.72
        neatStrips.visible = settle >= 0.72
        amberLight.emissiveIntensity = lerp(2.8, 0.08, purge)
        redLight.emissiveIntensity = lerp(1.2, selected ? 0.34 : 0.12, purge)
        greenLight.emissiveIntensity = lerp(0.42, 2.35, settle)
        if (time > (reducedMotion ? 0.74 : 1.62)) {
          jamA.visible = false
          jamB.visible = false
          looseStrips.visible = false
          neatStrips.visible = true
          finishEffect()
        }
        break
      }
    }
  })

  return (
    <group {...groupProps} name="desk-shredder">
      <Instances limit={FEET.length} castShadow receiveShadow>
        <cylinderGeometry args={[0.021, 0.023, 0.018, 24]} />
        <meshStandardMaterial color="#191b1d" roughness={0.78} metalness={0.02} />
        {FEET.map((position, index) => (
          <Instance key={index} position={position} />
        ))}
      </Instances>

      <RoundedBox args={[0.335, 0.35, 0.272]} position={[0, 0.195, -0.008]} radius={0.027} smoothness={6} castShadow receiveShadow>
        <meshStandardMaterial color="#cec7bc" roughness={0.58} metalness={0.04} />
      </RoundedBox>

      <RoundedBox args={[0.326, 0.038, 0.254]} position={[0, 0.366, -0.006]} radius={0.012} smoothness={5} castShadow receiveShadow>
        <meshStandardMaterial color="#25282a" roughness={0.46} metalness={0.12} />
      </RoundedBox>

      <group ref={binPanelRef} name="removable-bin-panel">
        <RoundedBox args={[0.306, 0.3, 0.01]} position={[0, 0.2, 0.129]} radius={0.019} smoothness={5} castShadow receiveShadow>
          <meshStandardMaterial color="#17191a" roughness={0.62} metalness={0.08} />
        </RoundedBox>
        <RoundedBox args={[0.292, 0.286, 0.015]} position={[0, 0.2, 0.135]} radius={0.015} smoothness={5} castShadow receiveShadow>
          <meshStandardMaterial color="#343638" roughness={0.42} metalness={0.06} />
        </RoundedBox>

        <mesh position={[-0.151, 0.132, 0.139]} castShadow>
          <cylinderGeometry args={[0.006, 0.006, 0.038, 18]} />
          <meshStandardMaterial color="#83888b" roughness={0.3} metalness={0.68} />
        </mesh>
        <mesh position={[-0.151, 0.268, 0.139]} castShadow>
          <cylinderGeometry args={[0.006, 0.006, 0.038, 18]} />
          <meshStandardMaterial color="#83888b" roughness={0.3} metalness={0.68} />
        </mesh>

        <RoundedBox args={[0.019, 0.026, 0.015]} position={[-0.045, 0.318, 0.148]} radius={0.005} smoothness={4} castShadow>
          <meshStandardMaterial color="#242628" roughness={0.55} metalness={0.2} />
        </RoundedBox>
        <RoundedBox args={[0.019, 0.026, 0.015]} position={[0.045, 0.318, 0.148]} radius={0.005} smoothness={4} castShadow>
          <meshStandardMaterial color="#242628" roughness={0.55} metalness={0.2} />
        </RoundedBox>
        <RoundedBox args={[0.112, 0.017, 0.018]} position={[0, 0.318, 0.157]} radius={0.007} smoothness={4} castShadow>
          <meshStandardMaterial color="#17191b" roughness={0.7} metalness={0.02} />
        </RoundedBox>

        <Instances limit={DOOR_FASTENERS.length} castShadow>
          <cylinderGeometry args={[0.004, 0.004, 0.003, 16]} />
          <meshStandardMaterial color="#a8adb0" roughness={0.28} metalness={0.72} />
          {DOOR_FASTENERS.map((position, index) => (
            <Instance key={index} position={position} rotation={[Math.PI / 2, 0, 0]} />
          ))}
        </Instances>

        <group ref={looseStripsRef} name="loose-paper-strips">
          <Instances limit={LOOSE_STRIPS.length} castShadow>
            <boxGeometry args={[0.018, 0.072, 0.002]} />
            <meshStandardMaterial color="#e8dfca" roughness={0.9} metalness={0} />
            {LOOSE_STRIPS.map((strip, index) => (
              <Instance key={index} position={strip.position} rotation={strip.rotation} scale={strip.scale} />
            ))}
          </Instances>
        </group>
        <group ref={neatStripsRef} name="neatly-settled-paper-strips" visible={false}>
          <Instances limit={NEAT_STRIPS.length} castShadow>
            <boxGeometry args={[0.019, 0.071, 0.002]} />
            <meshStandardMaterial color="#e8dfca" roughness={0.9} metalness={0} />
            {NEAT_STRIPS.map((position, index) => (
              <Instance key={index} position={position} />
            ))}
          </Instances>
        </group>

        <RoundedBox args={[0.236, 0.012, 0.013]} position={[0, 0.102, 0.149]} radius={0.003} smoothness={3} castShadow receiveShadow>
          <meshStandardMaterial color="#202426" roughness={0.41} metalness={0.28} />
        </RoundedBox>
        <RoundedBox args={[0.236, 0.012, 0.013]} position={[0, 0.24, 0.149]} radius={0.003} smoothness={3} castShadow receiveShadow>
          <meshStandardMaterial color="#202426" roughness={0.41} metalness={0.28} />
        </RoundedBox>
        <RoundedBox args={[0.012, 0.15, 0.013]} position={[-0.115, 0.171, 0.149]} radius={0.003} smoothness={3} castShadow receiveShadow>
          <meshStandardMaterial color="#202426" roughness={0.41} metalness={0.28} />
        </RoundedBox>
        <RoundedBox args={[0.012, 0.15, 0.013]} position={[0.115, 0.171, 0.149]} radius={0.003} smoothness={3} castShadow receiveShadow>
          <meshStandardMaterial color="#202426" roughness={0.41} metalness={0.28} />
        </RoundedBox>

        <RoundedBox args={[0.218, 0.13, 0.004]} position={[0, 0.171, 0.1505]} radius={0.009} smoothness={5} receiveShadow>
          <meshPhysicalMaterial color="#3e4849" roughness={0.2} metalness={0.08} transparent opacity={0.56} depthWrite={false} />
        </RoundedBox>
      </group>

      <group ref={upperHeadRef} name="isolated-motor-head">
        <RoundedBox args={[0.36, 0.196, 0.276]} position={[0, 0.462, 0]} radius={0.033} smoothness={7} castShadow receiveShadow>
          <meshStandardMaterial color="#3a3d3f" roughness={0.34} metalness={0.12} />
        </RoundedBox>

        <Instances limit={VENTS.length} castShadow>
          <boxGeometry args={[0.005, 0.007, 0.048]} />
          <meshStandardMaterial color="#181a1c" roughness={0.66} metalness={0.08} />
          {VENTS.map((position, index) => (
            <Instance key={index} position={position} />
          ))}
        </Instances>

        <RoundedBox args={[0.276, 0.054, 0.009]} position={[0, 0.461, 0.1415]} radius={0.003} smoothness={3} castShadow receiveShadow>
          <meshStandardMaterial color="#d8d1c5" roughness={0.69} metalness={0.04} />
        </RoundedBox>
        <mesh position={[0, 0.461, 0.1462]}>
          <planeGeometry args={[0.268, 0.046]} />
          <meshStandardMaterial map={equipmentLabelTexture} roughness={0.7} metalness={0.01} />
        </mesh>

        <RoundedBox
          args={[CONTROL_PANEL.width + 0.008, CONTROL_PANEL.height + 0.008, 0.01]}
          position={[0, CONTROL_PANEL.y, CONTROL_PANEL.z - 0.005]}
          radius={0.003}
          smoothness={4}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#26292b" roughness={0.58} metalness={0.18} />
        </RoundedBox>
        <mesh position={[0, CONTROL_PANEL.y, CONTROL_PANEL.z + 0.0002]}>
          <planeGeometry args={[CONTROL_PANEL.width, CONTROL_PANEL.height]} />
          <meshStandardMaterial map={controlPanelTexture} roughness={0.66} metalness={0.08} />
        </mesh>

        <mesh position={[CONTROL_PANEL.statusX[0], CONTROL_PANEL.y - 0.009, CONTROL_PANEL.z + 0.004]} castShadow>
          <sphereGeometry args={[0.007, 20, 12]} />
          <meshStandardMaterial ref={greenLightRef} color="#4b8a65" emissive="#63d58f" emissiveIntensity={0.42} roughness={0.3} />
        </mesh>
        <mesh position={[CONTROL_PANEL.statusX[1], CONTROL_PANEL.y - 0.009, CONTROL_PANEL.z + 0.004]} castShadow>
          <sphereGeometry args={[0.007, 20, 12]} />
          <meshStandardMaterial ref={amberLightRef} color="#926f36" emissive="#ffb443" emissiveIntensity={0.08} roughness={0.3} />
        </mesh>
        <mesh position={[CONTROL_PANEL.statusX[2], CONTROL_PANEL.y - 0.009, CONTROL_PANEL.z + 0.004]} castShadow>
          <sphereGeometry args={[0.007, 20, 12]} />
          <meshStandardMaterial ref={redLightRef} color="#8c2c33" emissive="#ff3140" emissiveIntensity={selected ? 0.34 : 0.12} roughness={0.3} />
        </mesh>

        <group
          position={[CONTROL_PANEL.controlX[0], CONTROL_PANEL.y - 0.009, CONTROL_PANEL.z + 0.007]}
          name="power-control"
          onPointerDown={(event) => {
            event.stopPropagation()
            triggerManualControl('power')
          }}
        >
          <mesh position={[0, 0, -0.0035]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.0145, 0.0145, 0.005, 28]} />
            <meshStandardMaterial color="#101214" roughness={0.48} metalness={0.38} />
          </mesh>
          <group ref={powerButtonRef}>
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.011, 0.011, 0.008, 28]} />
              <meshStandardMaterial
                ref={powerButtonMaterialRef}
                color="#49755c"
                emissive="#55c680"
                emissiveIntensity={0.7}
                roughness={0.34}
                metalness={0.18}
              />
            </mesh>
          </group>
          <mesh position={[0, 0, 0.007]}>
            <boxGeometry args={[0.039, 0.041, 0.025]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>

        <group
          position={[CONTROL_PANEL.controlX[1], CONTROL_PANEL.y - 0.009, CONTROL_PANEL.z + 0.007]}
          name="feed-control"
          onPointerDown={(event) => {
            event.stopPropagation()
            triggerManualControl('feed')
          }}
        >
          <mesh position={[0, 0, -0.0035]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.0145, 0.0145, 0.005, 28]} />
            <meshStandardMaterial color="#101214" roughness={0.48} metalness={0.38} />
          </mesh>
          <group ref={feedButtonRef}>
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.011, 0.011, 0.008, 28]} />
              <meshStandardMaterial
                ref={feedButtonMaterialRef}
                color="#b6b9b6"
                emissive="#e6eee8"
                emissiveIntensity={0.12}
                roughness={0.3}
                metalness={0.46}
              />
            </mesh>
          </group>
          <mesh position={[0, 0, 0.007]}>
            <boxGeometry args={[0.039, 0.041, 0.025]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>

        <group
          position={[CONTROL_PANEL.controlX[2], CONTROL_PANEL.y - 0.009, CONTROL_PANEL.z + 0.007]}
          name="reverse-control"
          onPointerDown={(event) => {
            event.stopPropagation()
            triggerManualControl('reverse')
          }}
        >
          <mesh position={[0, 0, -0.0035]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.0145, 0.0145, 0.005, 28]} />
            <meshStandardMaterial color="#101214" roughness={0.48} metalness={0.38} />
          </mesh>
          <group ref={reverseButtonRef}>
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.011, 0.011, 0.008, 28]} />
              <meshStandardMaterial
                ref={reverseButtonMaterialRef}
                color="#af8748"
                emissive="#e4a64f"
                emissiveIntensity={0.09}
                roughness={0.34}
                metalness={0.28}
              />
            </mesh>
          </group>
          <mesh position={[0, 0, 0.007]}>
            <boxGeometry args={[0.039, 0.041, 0.025]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>

        <RoundedBox args={[0.318, 0.06, 0.028]} position={[0, 0.527, 0.1365]} radius={0.012} smoothness={5} castShadow receiveShadow>
          <meshStandardMaterial
            color="#17191a"
            roughness={0.48}
            metalness={0.22}
          />
        </RoundedBox>

        <RoundedBox args={[0.286, 0.036, 0.009]} position={[0, 0.525, 0.144]} radius={0.007} smoothness={4} receiveShadow>
          <meshStandardMaterial color="#080a0b" roughness={0.64} metalness={0.12} />
        </RoundedBox>

        <RoundedBox args={[0.286, 0.01, 0.016]} position={[0, 0.551, 0.153]} radius={0.004} smoothness={4} castShadow receiveShadow>
          <meshStandardMaterial color="#8e2630" emissive="#4f0c14" emissiveIntensity={selected ? 0.46 : 0.1} roughness={0.31} metalness={0.18} />
        </RoundedBox>
        <RoundedBox args={[0.286, 0.01, 0.016]} position={[0, 0.501, 0.153]} radius={0.004} smoothness={4} castShadow receiveShadow>
          <meshStandardMaterial color="#8e2630" emissive="#4f0c14" emissiveIntensity={selected ? 0.46 : 0.1} roughness={0.31} metalness={0.18} />
        </RoundedBox>

        <mesh position={[0, 0.532, 0.152]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.0045, 0.0045, 0.278, 18]} />
          <meshStandardMaterial color="#777d80" roughness={0.31} metalness={0.7} />
        </mesh>
        <mesh position={[0, 0.518, 0.152]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.0045, 0.0045, 0.278, 18]} />
          <meshStandardMaterial color="#666c6f" roughness={0.34} metalness={0.66} />
        </mesh>
        <mesh position={[-0.145, 0.526, 0.151]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.018, 0.018, 0.012, 24]} />
          <meshStandardMaterial color="#64696c" roughness={0.33} metalness={0.68} />
        </mesh>
        <mesh position={[0.145, 0.526, 0.151]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.018, 0.018, 0.012, 24]} />
          <meshStandardMaterial color="#64696c" roughness={0.33} metalness={0.68} />
        </mesh>

        <group ref={upperCutterRef} position={[0, 0.532, 0.152]} name="upper-cutter-shaft">
          <Instances limit={CUTTER_X.length} castShadow>
            <cylinderGeometry args={[0.011, 0.011, 0.011, 24]} />
            <meshStandardMaterial color="#a6aaac" roughness={0.3} metalness={0.74} />
            {CUTTER_X.map((position) => (
              <Instance key={position} position={[position, 0, 0]} rotation={[0, 0, Math.PI / 2]} />
            ))}
          </Instances>
        </group>
        <group ref={lowerCutterRef} position={[0, 0.518, 0.152]} name="lower-cutter-shaft">
          <Instances limit={CUTTER_X.length} castShadow>
            <cylinderGeometry args={[0.011, 0.011, 0.011, 24]} />
            <meshStandardMaterial color="#858a8d" roughness={0.34} metalness={0.68} />
            {CUTTER_X.map((position) => (
              <Instance key={position} position={[position + 0.01, 0, 0]} rotation={[0, 0, Math.PI / 2]} />
            ))}
          </Instances>
        </group>

        <Instances limit={GUARD_FINGER_X.length} castShadow>
          <boxGeometry args={[0.007, 0.017, 0.007]} />
          <meshStandardMaterial color="#292c2e" roughness={0.44} metalness={0.2} />
          {GUARD_FINGER_X.map((position) => (
            <Instance key={position} position={[position, 0.538, 0.163]} />
          ))}
        </Instances>

        <group ref={safetyFlapRef} position={[0, 0.544, 0.1645]} name="guarded-intake-flap">
          <mesh position={[0, -0.008, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.252, 0.011, 0.004]} />
            <meshStandardMaterial color="#2a2c2e" roughness={0.54} metalness={0.18} />
          </mesh>
        </group>
      </group>

      <mesh ref={mainPaperRef} position={[0, 0.68, 0.163]} rotation={[-0.08, 0, 0]} visible={false} castShadow>
        <planeGeometry args={[0.178, 0.146, 1, 1]} />
        <meshStandardMaterial map={receiptTexture} roughness={0.9} metalness={0} side={DoubleSide} />
      </mesh>
      <mesh ref={jamPaperARef} position={[-0.018, 0.7, 0.164]} rotation={[-0.08, 0, 0.08]} visible={false} castShadow>
        <planeGeometry args={[0.178, 0.146, 1, 1]} />
        <meshStandardMaterial map={receiptTexture} roughness={0.9} metalness={0} side={DoubleSide} />
      </mesh>
      <mesh ref={jamPaperBRef} position={[0.018, 0.73, 0.165]} rotation={[-0.08, 0, -0.08]} visible={false} castShadow>
        <planeGeometry args={[0.178, 0.146, 1, 1]} />
        <meshStandardMaterial map={receiptTexture} roughness={0.9} metalness={0} side={DoubleSide} />
      </mesh>

      <mesh castShadow receiveShadow>
        <tubeGeometry args={[cableCurve, 28, 0.0045, 8, false]} />
        <meshStandardMaterial color="#202225" roughness={0.76} metalness={0.02} />
      </mesh>
      <mesh position={[0.112, 0.39, -0.145]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.009, 0.027, 20]} />
        <meshStandardMaterial color="#202225" roughness={0.72} metalness={0.02} />
      </mesh>
      <RoundedBox args={[0.032, 0.014, 0.028]} position={[0.158, 0.007, -0.218]} radius={0.004} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color="#202225" roughness={0.73} metalness={0.02} />
      </RoundedBox>
      <mesh position={[0.158, 0.008, -0.229]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.0065, 0.005, 0.006, 18]} />
        <meshStandardMaterial color="#202225" roughness={0.71} metalness={0.02} />
      </mesh>
    </group>
  )
}
