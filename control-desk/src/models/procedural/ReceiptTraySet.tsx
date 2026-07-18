import { RoundedBox, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { useLabStore, type EffectPreset } from '../../store/useLabStore'
import type { ProceduralAssetProps } from '../types'

const TRAY_WIDTH = 0.145
const TRAY_DEPTH = 0.245
const TRAY_X = [-0.17, 0, 0.17] as const
const TRAY_FRONT_FACE_Z = TRAY_DEPTH / 2 + 0.001

const LABEL_CASSETTE_WIDTH = 0.133
const LABEL_CASSETTE_HEIGHT = 0.038
const LABEL_CASSETTE_DEPTH = 0.0075
const LABEL_CASSETTE_Y = 0.041
const LABEL_CASSETTE_Z = TRAY_FRONT_FACE_Z + LABEL_CASSETTE_DEPTH / 2
const LABEL_INSERT_WIDTH = 0.119
const LABEL_INSERT_HEIGHT = 0.024
const LABEL_INSERT_DEPTH = 0.0016
const LABEL_INSERT_Z = LABEL_CASSETTE_Z + LABEL_CASSETTE_DEPTH / 2 + LABEL_INSERT_DEPTH / 2
const LABEL_TEXT_Z = LABEL_INSERT_Z + LABEL_INSERT_DEPTH / 2 + 0.00014

const TRAYS = [
  { label: 'APPROVE', accent: '#4c8b6d', paperAngle: -0.025, labelSize: 0.0122 },
  { label: 'REJECT', accent: '#a14f4b', paperAngle: 0.018, labelSize: 0.0122 },
  { label: 'INVESTIGATE', accent: '#b57f38', paperAngle: -0.014, labelSize: 0.0105 },
] as const

const POWDER_COAT = '#606a70'
const POWDER_COAT_DARK = '#465057'
const FOLDED_EDGE = '#788187'
const RUBBER = '#202629'
const PAPER = '#e9e3d5'
const PAPER_SHADOW = '#c9c1b1'
const INK = '#404a4f'

type AnimationState = {
  active: boolean
  startTime: number
  preset: EffectPreset
  target: number
  strength: number
}

const RECEIPT_SETTLED_Y = 0.0269

const EFFECT_DURATIONS: Record<EffectPreset, number> = {
  'paper-drop': 0.94,
  approve: 0.9,
  reject: 0.82,
  fraud: 1.08,
  'printer-jam': 1.2,
  migration: 0.92,
}

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3)
}

function resetTrayRoot(tray: THREE.Group, index: number) {
  tray.position.set(TRAY_X[index], 0, 0)
  tray.rotation.set(0, 0, 0)
  tray.scale.set(1, 1, 1)
}

function resetReceipt(receipt: THREE.Group) {
  receipt.visible = false
  receipt.position.set(0, 0, 0)
  receipt.rotation.set(0, 0, 0)
  receipt.scale.set(1, 1, 1)
}

function getReceiptStartPosition(
  preset: EffectPreset,
  target: number,
  reducedMotion: boolean,
): readonly [number, number, number] {
  const targetX = TRAY_X[target]

  if (reducedMotion) {
    switch (preset) {
      case 'approve':
        return [targetX + 0.006, 0.074, 0.075]
      case 'reject':
        return [targetX + 0.028, 0.078, 0.075]
      case 'fraud':
        return [targetX - 0.012, 0.084, 0.085]
      case 'printer-jam':
        return [targetX + 0.02, 0.082, -0.075]
      case 'migration':
        return [TRAY_X[1], RECEIPT_SETTLED_Y, 0.018]
      default:
        return [targetX, 0.071, 0.067]
    }
  }

  switch (preset) {
    case 'approve':
      return [targetX + 0.02, 0.16, 0.26]
    case 'reject':
      return [targetX + 0.105, 0.155, 0.25]
    case 'fraud':
      return [targetX - 0.035, 0.21, 0.29]
    case 'printer-jam':
      return [targetX + 0.075, 0.19, -0.29]
    case 'migration':
      return [TRAY_X[1], RECEIPT_SETTLED_Y, 0.018]
    default:
      return [targetX, 0.155, 0.285]
  }
}

function settleReceipt(receipt: THREE.Group, preset: EffectPreset, target: number) {
  const targetX = TRAY_X[target]

  receipt.visible = true
  receipt.scale.set(1, 1, 1)

  switch (preset) {
    case 'approve':
      receipt.position.set(targetX, RECEIPT_SETTLED_Y, -0.004)
      receipt.rotation.set(0, 0.006, -0.006)
      break
    case 'reject':
      receipt.position.set(targetX, RECEIPT_SETTLED_Y, -0.008)
      receipt.rotation.set(0, -0.008, 0.012)
      break
    case 'fraud':
      receipt.position.set(targetX, RECEIPT_SETTLED_Y, -0.006)
      receipt.rotation.set(0, 0.012, -0.012)
      break
    case 'printer-jam':
      receipt.position.set(targetX, RECEIPT_SETTLED_Y + 0.0001, -0.011)
      receipt.rotation.set(0, 0.16, 0.018)
      break
    case 'migration':
      receipt.position.set(targetX, RECEIPT_SETTLED_Y, -0.006)
      receipt.rotation.set(0, 0, 0)
      break
    default:
      receipt.position.set(targetX, RECEIPT_SETTLED_Y, -0.005)
      receipt.rotation.set(0, 0.003, -0.009)
  }
}

function setReceiptStart(
  receipt: THREE.Group,
  preset: EffectPreset,
  target: number,
  reducedMotion: boolean,
) {
  const motionScale = reducedMotion ? 0.28 : 1
  const [startX, startY, startZ] = getReceiptStartPosition(preset, target, reducedMotion)

  receipt.visible = true
  receipt.position.set(startX, startY, startZ)
  receipt.scale.set(1, 1, 1)

  switch (preset) {
    case 'approve':
      receipt.rotation.set(-0.08, 0, -0.035 * motionScale)
      break
    case 'reject':
      receipt.rotation.set(-0.045, -0.025 * motionScale, 0.12 * motionScale)
      break
    case 'fraud':
      receipt.rotation.set(-0.11, 0.035 * motionScale, -0.07 * motionScale)
      break
    case 'printer-jam':
      receipt.rotation.set(0.055, 0.52 * motionScale, 0.22 * motionScale)
      break
    case 'migration':
      receipt.rotation.set(0, 0.08 * motionScale, 0.055 * motionScale)
      break
    default:
      receipt.rotation.set(-0.06, 0, target === 1 ? -0.018 : 0.018)
  }
}

function reactTray(tray: THREE.Group, response: number, strength: number) {
  tray.rotation.y = strength * 0.55 * response
  tray.scale.y = 1 - strength * 0.72 * Math.abs(response)
}

function PaperSheet({
  y,
  rotation,
  offsetZ,
  top = false,
}: {
  y: number
  rotation: number
  offsetZ: number
  top?: boolean
}) {
  return (
    <group position={[0, y, offsetZ]} rotation={[0, rotation, 0]}>
      <RoundedBox
        args={[0.076, 0.0013, 0.133]}
        radius={0.0018}
        smoothness={2}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={top ? PAPER : PAPER_SHADOW} roughness={0.88} />
      </RoundedBox>
      {top && (
        <group position={[0, 0.00072, 0]}>
          <RoundedBox args={[0.044, 0.00035, 0.006]} radius={0.0007} smoothness={2}>
            <meshStandardMaterial color={INK} roughness={0.78} />
          </RoundedBox>
          {[-0.019, -0.032, -0.045].map((z, index) => (
            <RoundedBox
              key={z}
              args={[index === 1 ? 0.052 : 0.057, 0.0003, 0.0023]}
              position={[index === 1 ? -0.004 : 0, 0, z]}
              radius={0.00045}
              smoothness={2}
            >
              <meshStandardMaterial color={INK} roughness={0.78} />
            </RoundedBox>
          ))}
          <RoundedBox
            args={[0.032, 0.0003, 0.003]}
            position={[0.012, 0, 0.048]}
            radius={0.0005}
            smoothness={2}
          >
            <meshStandardMaterial color={INK} roughness={0.78} />
          </RoundedBox>
        </group>
      )}
    </group>
  )
}

function TrayBay({
  index,
  motionRef,
}: {
  index: number
  motionRef: (node: THREE.Group | null) => void
}) {
  const tray = TRAYS[index]

  return (
    <group ref={motionRef} position={[TRAY_X[index], 0, 0]}>
      {/* Folded floor pan: the shallow double layer gives the shell a credible stamped profile. */}
      <RoundedBox
        args={[TRAY_WIDTH, 0.009, TRAY_DEPTH]}
        position={[0, 0.015, 0]}
        radius={0.004}
        smoothness={4}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={POWDER_COAT} metalness={0.34} roughness={0.47} />
      </RoundedBox>
      <RoundedBox
        args={[TRAY_WIDTH - 0.014, 0.003, TRAY_DEPTH - 0.017]}
        position={[0, 0.021, -0.002]}
        radius={0.003}
        smoothness={3}
        receiveShadow
      >
        <meshStandardMaterial color={POWDER_COAT_DARK} metalness={0.26} roughness={0.62} />
      </RoundedBox>

      {/* Paired loading guides rise directly from the pan and keep loose receipts off the folds. */}
      {[-0.052, 0.052].map((x) => (
        <RoundedBox
          key={x}
          args={[0.015, 0.015, 0.04]}
          position={[x, 0.03, 0.084]}
          radius={0.0028}
          smoothness={3}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={FOLDED_EDGE} metalness={0.42} roughness={0.43} />
        </RoundedBox>
      ))}

      {/* Splayed side folds and unequal front/back walls keep the capacity readable from +z. */}
      {[-1, 1].map((side) => (
        <group
          key={side}
          position={[side * (TRAY_WIDTH / 2 - 0.0035), 0.051, -0.002]}
          rotation={[0, 0, side * -0.035]}
        >
          <RoundedBox
            args={[0.007, 0.066, TRAY_DEPTH - 0.006]}
            radius={0.0032}
            smoothness={4}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color={POWDER_COAT} metalness={0.36} roughness={0.46} />
          </RoundedBox>
          <mesh position={[-side * 0.0004, -0.025, 0]} receiveShadow>
            <boxGeometry args={[0.0014, 0.004, TRAY_DEPTH - 0.026]} />
            <meshStandardMaterial color={POWDER_COAT_DARK} metalness={0.22} roughness={0.64} />
          </mesh>
          <mesh position={[side * 0.0008, 0.033, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.0038, 0.0038, TRAY_DEPTH - 0.004, 12]} />
            <meshStandardMaterial color={FOLDED_EDGE} metalness={0.48} roughness={0.4} />
          </mesh>
        </group>
      ))}

      <RoundedBox
        args={[TRAY_WIDTH - 0.006, 0.039, 0.008]}
        position={[0, 0.038, TRAY_DEPTH / 2 - 0.003]}
        radius={0.003}
        smoothness={4}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={POWDER_COAT} metalness={0.35} roughness={0.47} />
      </RoundedBox>
      <mesh
        position={[0, 0.058, TRAY_DEPTH / 2 + 0.0005]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.0036, 0.0036, TRAY_WIDTH - 0.005, 12]} />
        <meshStandardMaterial color={FOLDED_EDGE} metalness={0.48} roughness={0.4} />
      </mesh>

      <RoundedBox
        args={[TRAY_WIDTH - 0.006, 0.078, 0.009]}
        position={[0, 0.057, -TRAY_DEPTH / 2 + 0.003]}
        radius={0.0035}
        smoothness={4}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={POWDER_COAT} metalness={0.36} roughness={0.46} />
      </RoundedBox>
      <mesh
        position={[0, 0.097, -TRAY_DEPTH / 2 - 0.001]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.0038, 0.0038, TRAY_WIDTH - 0.005, 12]} />
        <meshStandardMaterial color={FOLDED_EDGE} metalness={0.48} roughness={0.4} />
      </mesh>

      {/* The cassette backs directly onto the front fold; its inset and rails share one datum. */}
      <RoundedBox
        args={[LABEL_CASSETTE_WIDTH, LABEL_CASSETTE_HEIGHT, LABEL_CASSETTE_DEPTH]}
        position={[0, LABEL_CASSETTE_Y, LABEL_CASSETTE_Z]}
        radius={0.0032}
        smoothness={4}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={POWDER_COAT_DARK} metalness={0.42} roughness={0.42} />
      </RoundedBox>
      <RoundedBox
        args={[LABEL_INSERT_WIDTH, LABEL_INSERT_HEIGHT, LABEL_INSERT_DEPTH]}
        position={[0, LABEL_CASSETTE_Y, LABEL_INSERT_Z]}
        radius={0.0015}
        smoothness={3}
        castShadow
      >
        <meshPhysicalMaterial
          color={tray.accent}
          roughness={0.35}
          metalness={0.12}
          clearcoat={0.22}
          clearcoatRoughness={0.4}
        />
      </RoundedBox>
      {[-1, 1].map((edge) => (
        <RoundedBox
          key={edge}
          args={[LABEL_INSERT_WIDTH + 0.006, 0.0032, 0.0015]}
          position={[
            0,
            LABEL_CASSETTE_Y + edge * (LABEL_INSERT_HEIGHT / 2 + 0.0016),
            LABEL_CASSETTE_Z + LABEL_CASSETTE_DEPTH / 2 + 0.00075,
          ]}
          radius={0.0008}
          smoothness={2}
          castShadow
        >
          <meshStandardMaterial color={FOLDED_EDGE} metalness={0.5} roughness={0.37} />
        </RoundedBox>
      ))}
      <Text
        position={[0, LABEL_CASSETTE_Y, LABEL_TEXT_Z]}
        fontSize={tray.labelSize}
        letterSpacing={0.045}
        maxWidth={LABEL_INSERT_WIDTH - 0.01}
        color="#f6f1e6"
        outlineColor="#293237"
        outlineWidth={0.00016}
        anchorX="center"
        anchorY="middle"
        renderOrder={2}
      >
        {tray.label}
      </Text>
      {[-0.063, 0.063].map((x) => (
        <mesh
          key={x}
          position={[x, LABEL_CASSETTE_Y, LABEL_CASSETTE_Z + LABEL_CASSETTE_DEPTH / 2 + 0.0011]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.0022, 0.0022, 0.0016, 14]} />
          <meshStandardMaterial color="#aab0b2" metalness={0.72} roughness={0.3} />
        </mesh>
      ))}

      {/* Rubber feet and folded stack pads create a visible grounding shadow. */}
      {[-0.052, 0.052].flatMap((x) =>
        [-0.088, 0.088].map((z) => (
          <group key={`${x}-${z}`} position={[x, 0, z]}>
            <RoundedBox args={[0.026, 0.008, 0.027]} position={[0, 0.008, 0]} radius={0.003} smoothness={3}>
              <meshStandardMaterial color={POWDER_COAT_DARK} metalness={0.32} roughness={0.55} />
            </RoundedBox>
            <RoundedBox
              args={[0.019, 0.0045, 0.02]}
              position={[0, 0.00225, 0]}
              radius={0.0025}
              smoothness={3}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color={RUBBER} metalness={0.02} roughness={0.82} />
            </RoundedBox>
          </group>
        )),
      )}

      {/* Capacity papers stay below the rolled sides and never intersect the shell. */}
      <PaperSheet y={0.0235} rotation={tray.paperAngle - 0.027} offsetZ={-0.014} />
      <PaperSheet y={0.0252} rotation={tray.paperAngle} offsetZ={-0.006} top />

      {/* Localized abrasion belongs at the loading edge, not uniformly across the finish. */}
      <mesh position={[-0.026, 0.023, 0.079]} rotation={[0, -0.1, 0]}>
        <boxGeometry args={[0.032, 0.00045, 0.0011]} />
        <meshStandardMaterial color="#343d42" metalness={0.28} roughness={0.67} />
      </mesh>
      <mesh position={[0.037, 0.023, 0.09]} rotation={[0, 0.16, 0]}>
        <boxGeometry args={[0.019, 0.00045, 0.0008]} />
        <meshStandardMaterial color="#899095" metalness={0.5} roughness={0.45} />
      </mesh>
    </group>
  )
}

export function ReceiptTraySet({
  effectPreset = 'paper-drop',
  effectRun = 0,
  selected: _selected,
  ...groupProps
}: ProceduralAssetProps) {
  const trayRefs = useRef<Array<THREE.Group | null>>([null, null, null])
  const receiptRef = useRef<THREE.Group>(null)
  const receiptAccentRef = useRef<THREE.MeshStandardMaterial>(null)
  const animationRef = useRef<AnimationState>({
    active: false,
    startTime: -1,
    preset: 'paper-drop',
    target: 0,
    strength: 0.004,
  })
  const reducedMotion = useLabStore((state) => state.reducedMotion)

  useLayoutEffect(() => {
    let target = (Math.max(effectRun, 1) - 1) % 3
    let strength = 0.004
    const trays = [...trayRefs.current]
    const receipt = receiptRef.current
    const receiptAccent = receiptAccentRef.current
    const animation = animationRef.current

    switch (effectPreset) {
      case 'approve':
        target = 0
        strength = 0.005
        break
      case 'reject':
        target = 1
        strength = 0.0065
        break
      case 'fraud':
        target = 2
        strength = 0.009
        break
      case 'printer-jam':
        target = 1
        strength = 0.008
        break
      case 'migration':
        target = 2
        strength = 0.0035
        break
      default:
        break
    }

    for (let index = 0; index < trays.length; index += 1) {
      const tray = trays[index]
      if (tray) resetTrayRoot(tray, index)
    }

    if (receipt) {
      resetReceipt(receipt)
      if (effectRun > 0) {
        setReceiptStart(receipt, effectPreset, target, reducedMotion)
      }
    }
    receiptAccent?.color.set(TRAYS[target].accent)

    animation.active = effectRun > 0
    animation.startTime = -1
    animation.preset = effectPreset
    animation.target = target
    animation.strength = strength

    return () => {
      animation.active = false
      animation.startTime = -1

      for (let index = 0; index < trays.length; index += 1) {
        const tray = trays[index]
        if (tray) resetTrayRoot(tray, index)
      }

      if (receipt) resetReceipt(receipt)
      receiptAccent?.color.set(TRAYS[0].accent)
    }
  }, [effectPreset, effectRun, reducedMotion])

  useFrame((state) => {
    const animation = animationRef.current
    const receipt = receiptRef.current
    if (!animation.active || !receipt) return

    if (animation.startTime < 0) animation.startTime = state.clock.elapsedTime
    const elapsed = state.clock.elapsedTime - animation.startTime
    const targetX = TRAY_X[animation.target]
    const tray = trayRefs.current[animation.target]
    const motionScale = reducedMotion ? 0.28 : 1
    const mechanicalScale = reducedMotion ? 0.4 : 1

    for (let index = 0; index < trayRefs.current.length; index += 1) {
      const trayRoot = trayRefs.current[index]
      if (trayRoot) resetTrayRoot(trayRoot, index)
    }

    if (elapsed >= EFFECT_DURATIONS[animation.preset]) {
      settleReceipt(receipt, animation.preset, animation.target)
      animation.active = false
      return
    }

    switch (animation.preset) {
      case 'paper-drop': {
        const [, startY, startZ] = getReceiptStartPosition(
          animation.preset,
          animation.target,
          reducedMotion,
        )
        const liftedPitch = -0.06 - 0.025 * motionScale
        const startRoll = animation.target === 1 ? -0.018 : 0.018

        if (elapsed < 0.12) {
          const t = easeOutCubic(elapsed / 0.12)
          receipt.position.set(targetX, startY + 0.008 * motionScale * t, startZ + 0.012 * motionScale * t)
          receipt.rotation.set(-0.06 - 0.025 * motionScale * t, 0, startRoll)
        } else if (elapsed < 0.5) {
          const t = easeInOutCubic((elapsed - 0.12) / 0.38)
          const lateralArc = Math.sin(t * Math.PI) * (animation.target === 1 ? -0.004 : 0.003) * motionScale
          receipt.position.set(
            targetX + lateralArc,
            startY + 0.008 * motionScale + (0.065 - startY - 0.008 * motionScale) * t,
            startZ + 0.012 * motionScale + (0.055 - startZ - 0.012 * motionScale) * t,
          )
          receipt.rotation.set(
            liftedPitch + (0.02 - liftedPitch) * t,
            0.018 * Math.sin(t * Math.PI) * motionScale,
            startRoll + (-0.009 - startRoll) * t,
          )
        } else if (elapsed < 0.63) {
          const t = easeOutCubic((elapsed - 0.5) / 0.13)
          receipt.position.set(targetX, 0.065 - 0.034 * t, 0.055 - 0.035 * t)
          receipt.rotation.set(
            0.02 - 0.016 * t,
            0.018 * Math.sin(t * Math.PI) * motionScale,
            -0.009 + 0.012 * t,
          )
        } else {
          const t = easeOutCubic((elapsed - 0.63) / 0.31)
          receipt.position.set(
            targetX,
            0.031 + (RECEIPT_SETTLED_Y - 0.031) * t,
            0.02 + (-0.005 - 0.02) * t,
          )
          receipt.rotation.set(0.004 * (1 - t), 0.003 * t, 0.003 - 0.012 * t)
        }

        if (tray && elapsed >= 0.5) {
          const impactTime = Math.min((elapsed - 0.5) / 0.44, 1)
          const response = Math.sin(impactTime * Math.PI * 4.5) * (1 - impactTime)
          reactTray(tray, response * mechanicalScale, animation.strength)
        }
        break
      }
      case 'approve': {
        const [startX, startY, startZ] = getReceiptStartPosition(
          animation.preset,
          animation.target,
          reducedMotion,
        )

        if (elapsed < 0.1) {
          const t = easeOutCubic(elapsed / 0.1)
          receipt.position.set(startX - 0.006 * motionScale * t, startY + 0.006 * motionScale * t, startZ)
          receipt.rotation.set(-0.08, 0.01 * motionScale * t, -0.035 * motionScale * (1 - t))
        } else if (elapsed < 0.48) {
          const t = easeInOutCubic((elapsed - 0.1) / 0.38)
          receipt.position.set(
            startX - 0.006 * motionScale + (targetX - startX + 0.006 * motionScale) * t,
            startY + 0.006 * motionScale + (0.064 - startY - 0.006 * motionScale) * t,
            startZ + (0.046 - startZ) * t,
          )
          receipt.rotation.set(-0.08 + 0.098 * t, 0.01 * motionScale * (1 - t), -0.008 * t)
        } else if (elapsed < 0.64) {
          const t = easeOutCubic((elapsed - 0.48) / 0.16)
          receipt.position.set(targetX, 0.064 - 0.0345 * t, 0.046 - 0.034 * t)
          receipt.rotation.set(0.018 * (1 - t), 0.006 * t, -0.008 + 0.004 * t)
        } else {
          const t = easeOutCubic((elapsed - 0.64) / 0.26)
          const settleBounce = Math.sin(t * Math.PI * 2) * (1 - t) * 0.0013 * mechanicalScale
          receipt.position.set(
            targetX,
            0.0295 + (RECEIPT_SETTLED_Y - 0.0295) * t + settleBounce,
            0.012 + (-0.004 - 0.012) * t,
          )
          receipt.rotation.set(0, 0.006, -0.004 - 0.002 * t)
        }

        if (tray && elapsed >= 0.48) {
          const impactTime = Math.min((elapsed - 0.48) / 0.42, 1)
          const response = Math.sin(impactTime * Math.PI * 3.5) * (1 - impactTime)
          reactTray(tray, response * mechanicalScale, animation.strength)
        }
        break
      }
      case 'reject': {
        const [startX, startY, startZ] = getReceiptStartPosition(
          animation.preset,
          animation.target,
          reducedMotion,
        )

        if (elapsed < 0.08) {
          const t = easeOutCubic(elapsed / 0.08)
          receipt.position.set(startX + 0.01 * motionScale * t, startY + 0.004 * motionScale * t, startZ)
          receipt.rotation.set(-0.045, -0.025 * motionScale, 0.12 * motionScale + 0.035 * motionScale * t)
        } else if (elapsed < 0.42) {
          const t = easeInOutCubic((elapsed - 0.08) / 0.34)
          receipt.position.set(
            startX + 0.01 * motionScale + (targetX - 0.004 * motionScale - startX - 0.01 * motionScale) * t,
            startY + 0.004 * motionScale + (0.069 - startY - 0.004 * motionScale) * t,
            startZ + (0.048 - startZ) * t,
          )
          receipt.rotation.set(-0.045 + 0.07 * t, -0.025 * motionScale * (1 - t), 0.155 * motionScale * (1 - t) - 0.02 * t)
        } else if (elapsed < 0.54) {
          const t = easeOutCubic((elapsed - 0.42) / 0.12)
          receipt.position.set(targetX - 0.004 * motionScale * (1 - t), 0.069 - 0.039 * t, 0.048 - 0.043 * t)
          receipt.rotation.set(0.025 * (1 - t), -0.008 * t, -0.02 + 0.035 * t)
        } else {
          const t = easeOutCubic((elapsed - 0.54) / 0.28)
          receipt.position.set(
            targetX,
            0.03 + (RECEIPT_SETTLED_Y - 0.03) * t,
            0.005 + (-0.008 - 0.005) * t,
          )
          receipt.rotation.set(0, -0.008, 0.015 - 0.003 * t)
        }

        if (tray && elapsed >= 0.42) {
          const impactTime = Math.min((elapsed - 0.42) / 0.4, 1)
          const response = Math.sin(impactTime * Math.PI * 4) * (1 - impactTime)
          reactTray(tray, -response * mechanicalScale, animation.strength)
        }
        break
      }
      case 'fraud': {
        const [startX, startY, startZ] = getReceiptStartPosition(
          animation.preset,
          animation.target,
          reducedMotion,
        )
        const liftedPitch = -0.11 - 0.035 * motionScale
        const startRoll = -0.07 * motionScale

        if (elapsed < 0.14) {
          const t = easeOutCubic(elapsed / 0.14)
          receipt.position.set(startX, startY + 0.012 * motionScale * t, startZ + 0.008 * motionScale * t)
          receipt.rotation.set(-0.11 - 0.035 * motionScale * t, 0.035 * motionScale, startRoll)
        } else if (elapsed < 0.52) {
          const t = easeInOutCubic((elapsed - 0.14) / 0.38)
          receipt.position.set(
            startX + (targetX - startX) * t,
            startY + 0.012 * motionScale + (0.071 - startY - 0.012 * motionScale) * t,
            startZ + 0.008 * motionScale + (0.05 - startZ - 0.008 * motionScale) * t,
          )
          receipt.rotation.set(
            liftedPitch + (0.03 - liftedPitch) * t,
            0.035 * motionScale * (1 - t),
            startRoll + (-0.015 - startRoll) * t,
          )
        } else if (elapsed < 0.66) {
          const t = easeOutCubic((elapsed - 0.52) / 0.14)
          receipt.position.set(targetX, 0.071 - 0.042 * t, 0.05 - 0.038 * t)
          receipt.rotation.set(0.03 * (1 - t), 0.012 * t, -0.015 - 0.006 * t)
        } else if (elapsed < 0.79) {
          const t = easeOutCubic((elapsed - 0.66) / 0.13)
          receipt.position.set(targetX, 0.029 + 0.005 * t, 0.012 - 0.01 * t)
          receipt.rotation.set(-0.012 * t, 0.012, -0.021 + 0.006 * t)
        } else {
          const t = easeOutCubic((elapsed - 0.79) / 0.29)
          receipt.position.set(
            targetX,
            0.034 + (RECEIPT_SETTLED_Y - 0.034) * t,
            0.002 + (-0.006 - 0.002) * t,
          )
          receipt.rotation.set(-0.012 * (1 - t), 0.012, -0.015 + 0.003 * t)
        }

        if (tray && elapsed >= 0.52) {
          const impactTime = Math.min((elapsed - 0.52) / 0.56, 1)
          const response = Math.sin(impactTime * Math.PI * 5) * (1 - impactTime)
          reactTray(tray, response * mechanicalScale, animation.strength)
        }
        break
      }
      case 'printer-jam': {
        const [startX, startY, startZ] = getReceiptStartPosition(
          animation.preset,
          animation.target,
          reducedMotion,
        )

        if (elapsed < 0.34) {
          const t = easeInOutCubic(elapsed / 0.34)
          receipt.position.set(
            startX + (targetX + 0.018 * motionScale - startX) * t,
            startY + (0.107 - startY) * t,
            startZ + (-0.045 - startZ) * t,
          )
          receipt.rotation.set(
            0.055 - 0.035 * t,
            0.52 * motionScale + (0.28 - 0.52 * motionScale) * t,
            0.22 * motionScale + (0.07 - 0.22 * motionScale) * t,
          )
        } else if (elapsed < 0.54) {
          const t = (elapsed - 0.34) / 0.2
          const snag = Math.sin(t * Math.PI * 3) * (1 - t)
          receipt.position.set(
            targetX + 0.018 * motionScale * (1 - t),
            0.107 - 0.033 * t + 0.004 * snag * mechanicalScale,
            -0.045 + 0.012 * t,
          )
          receipt.rotation.set(0.02 + 0.055 * snag * mechanicalScale, 0.28 - 0.08 * t, 0.07 - 0.04 * t)
        } else if (elapsed < 0.77) {
          const t = easeOutCubic((elapsed - 0.54) / 0.23)
          receipt.position.set(targetX, 0.074 - 0.043 * t, -0.033 + 0.021 * t)
          receipt.rotation.set(0.02 * (1 - t), 0.2 - 0.04 * t, 0.03 - 0.012 * t)
        } else {
          const t = easeOutCubic((elapsed - 0.77) / 0.43)
          receipt.position.set(
            targetX,
            0.031 + (RECEIPT_SETTLED_Y + 0.0001 - 0.031) * t,
            -0.012 + 0.001 * t,
          )
          receipt.rotation.set(0, 0.16, 0.018)
        }

        for (let index = 0; index < trayRefs.current.length; index += 1) {
          const trayRoot = trayRefs.current[index]
          const localTime = (elapsed - 0.34 - index * 0.045) / 0.56
          if (!trayRoot || localTime <= 0 || localTime >= 1) continue
          const response = Math.sin(localTime * Math.PI * 5) * (1 - localTime)
          reactTray(trayRoot, response * mechanicalScale, animation.strength * (1 - index * 0.12))
        }
        break
      }
      case 'migration': {
        const startX = TRAY_X[1]
        const lift = reducedMotion ? 0.035 : 0.085

        if (elapsed < 0.18) {
          const t = easeInOutCubic(elapsed / 0.18)
          receipt.position.set(startX, RECEIPT_SETTLED_Y + lift * t, 0.018 - 0.012 * t)
          receipt.rotation.set(0, 0.08 * motionScale * (1 - t), 0.055 * motionScale * (1 - t))
        } else if (elapsed < 0.66) {
          const t = easeInOutCubic((elapsed - 0.18) / 0.48)
          receipt.position.set(
            startX + (targetX - startX) * t,
            RECEIPT_SETTLED_Y + lift + Math.sin(t * Math.PI) * 0.004 * motionScale,
            0.006 + (-0.006 - 0.006) * t,
          )
          receipt.rotation.set(0, 0.012 * Math.sin(t * Math.PI) * motionScale, 0)
        } else {
          const t = easeInOutCubic((elapsed - 0.66) / 0.26)
          receipt.position.set(targetX, RECEIPT_SETTLED_Y + lift * (1 - t), -0.006)
          receipt.rotation.set(0, 0, 0)
        }

        for (let index = 0; index < trayRefs.current.length; index += 1) {
          const trayRoot = trayRefs.current[index]
          const localTime = (elapsed - 0.08 - index * 0.065) / 0.58
          if (!trayRoot || localTime <= 0 || localTime >= 1) continue
          const response = Math.sin(localTime * Math.PI * 2) * (1 - localTime)
          reactTray(trayRoot, response * mechanicalScale, animation.strength)
        }
        break
      }
    }
  })

  return (
    <group
      {...groupProps}
      name="receipt-tray-set"
      userData={{
        assetId: 'receipt-tray-set',
        dimensionsMeters: [0.485, 0.101, 0.266],
        forwardAxis: '+z',
        upAxis: '+y',
      }}
    >
      {/* Shared rails make the three decisions read as one deliberate manufactured station. */}
      <RoundedBox
        args={[0.485, 0.018, 0.03]}
        position={[0, 0.012, -0.106]}
        radius={0.004}
        smoothness={4}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={POWDER_COAT_DARK} metalness={0.4} roughness={0.48} />
      </RoundedBox>
      <RoundedBox
        args={[0.485, 0.012, 0.026]}
        position={[0, 0.008, 0.101]}
        radius={0.0035}
        smoothness={4}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={POWDER_COAT_DARK} metalness={0.38} roughness={0.5} />
      </RoundedBox>
      {[-0.085, 0.085].map((x) => (
        <RoundedBox
          key={x}
          args={[0.013, 0.014, 0.232]}
          position={[x, 0.013, -0.002]}
          radius={0.003}
          smoothness={3}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={POWDER_COAT_DARK} metalness={0.38} roughness={0.5} />
        </RoundedBox>
      ))}

      {TRAYS.map((tray, index) => (
        <TrayBay
          key={tray.label}
          index={index}
          motionRef={(node) => {
            trayRefs.current[index] = node
          }}
        />
      ))}

      {/* One reusable local decision receipt; effectRun always resets it before replay. */}
      <group ref={receiptRef} visible={false}>
        <RoundedBox
          args={[0.076, 0.0015, 0.135]}
          radius={0.0018}
          smoothness={3}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#f2ecde" roughness={0.86} />
        </RoundedBox>
        <RoundedBox args={[0.055, 0.00035, 0.006]} position={[0, 0.00085, -0.048]} radius={0.0007} smoothness={2}>
          <meshStandardMaterial ref={receiptAccentRef} color={TRAYS[0].accent} roughness={0.45} />
        </RoundedBox>
        {[-0.028, -0.015, -0.002, 0.011].map((z, index) => (
          <RoundedBox
            key={z}
            args={[index === 2 ? 0.045 : 0.058, 0.0003, 0.0021]}
            position={[index === 2 ? -0.006 : 0, 0.00084, z]}
            radius={0.0004}
            smoothness={2}
          >
            <meshStandardMaterial color={INK} roughness={0.76} />
          </RoundedBox>
        ))}
        <RoundedBox args={[0.027, 0.0003, 0.003]} position={[0.014, 0.00084, 0.048]} radius={0.0004} smoothness={2}>
          <meshStandardMaterial color={INK} roughness={0.76} />
        </RoundedBox>
      </group>
    </group>
  )
}

export default ReceiptTraySet
