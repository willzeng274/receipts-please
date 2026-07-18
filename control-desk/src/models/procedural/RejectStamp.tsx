import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useLabStore } from '../../store/useLabStore'
import type { ProceduralAssetProps } from '../types'

type RejectStampEffect = NonNullable<ProceduralAssetProps['effectPreset']>

type MotionState = {
  active: boolean
  elapsed: number
  preset: RejectStampEffect
}

const EFFECT_DURATIONS: Record<RejectStampEffect, number> = {
  'paper-drop': 0.5,
  approve: 0.7,
  reject: 0.68,
  fraud: 0.96,
  'printer-jam': 0.88,
  migration: 1.18,
}

const GUIDE_X = [-0.031, 0.031] as const
const GRIP_RIBS = [-0.024, -0.012, 0, 0.012, 0.024] as const

const REJECT_GLYPHS = [
  ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
] as const

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const smoothstep = (value: number) => {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

const easeInCubic = (value: number) => {
  const t = clamp01(value)
  return t * t * t
}

const easeOutCubic = (value: number) => {
  const t = 1 - clamp01(value)
  return 1 - t * t * t
}

const easeOutBack = (value: number) => {
  const t = clamp01(value) - 1
  const overshoot = 1.18
  return 1 + (overshoot + 1) * t * t * t + overshoot * t * t
}

function resolveEffect(
  preset: ProceduralAssetProps['effectPreset'],
): RejectStampEffect {
  switch (preset) {
    case 'paper-drop':
    case 'approve':
    case 'reject':
    case 'fraud':
    case 'printer-jam':
    case 'migration':
      return preset
    default:
      return 'reject'
  }
}

/**
 * Premium rail-guided self-inking reject press.
 *
 * Real dimensions: approximately 0.118 m wide, 0.057 m deep, and 0.16 m high.
 * The base rests at y=0; +y is up and the labelled working face points toward +z.
 */
export function RejectStamp({
  effectPreset,
  effectRun = 0,
  selected = false,
  ...groupProps
}: ProceduralAssetProps) {
  const actionRef = useRef<THREE.Group>(null)
  const pressRef = useRef<THREE.Group>(null)
  const cartridgeRef = useRef<THREE.Group>(null)
  const platenRef = useRef<THREE.Group>(null)
  const springRef = useRef<THREE.Group>(null)
  const identityMaterialRef = useRef<THREE.MeshPhysicalMaterial>(null)
  const indicatorMaterialRef = useRef<THREE.MeshPhysicalMaterial>(null)
  const platenMaterialRef = useRef<THREE.MeshStandardMaterial>(null)
  const motionRef = useRef<MotionState>({
    active: false,
    elapsed: 0,
    preset: resolveEffect(effectPreset),
  })
  const reducedMotion = useLabStore((state) => state.reducedMotion)

  const frameShape = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-0.051, 0.034)
    shape.lineTo(-0.034, 0.034)
    shape.lineTo(-0.017, 0.094)
    shape.quadraticCurveTo(-0.012, 0.112, 0.004, 0.119)
    shape.lineTo(0.026, 0.128)
    shape.lineTo(0.034, 0.115)
    shape.lineTo(0.013, 0.103)
    shape.quadraticCurveTo(0.006, 0.099, 0.003, 0.087)
    shape.lineTo(-0.009, 0.038)
    shape.lineTo(-0.047, 0.038)
    shape.closePath()
    return shape
  }, [])

  const gripShape = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-0.039, 0.133)
    shape.lineTo(-0.028, 0.126)
    shape.lineTo(0.029, 0.129)
    shape.lineTo(0.041, 0.14)
    shape.lineTo(0.031, 0.154)
    shape.lineTo(0.019, 0.158)
    shape.lineTo(-0.028, 0.155)
    shape.lineTo(-0.042, 0.146)
    shape.closePath()
    return shape
  }, [])

  const frameExtrusion = useMemo<THREE.ExtrudeGeometryOptions>(
    () => ({
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: 0.0014,
      bevelThickness: 0.0012,
      curveSegments: 10,
      depth: 0.02,
      steps: 1,
    }),
    [],
  )

  const gripExtrusion = useMemo<THREE.ExtrudeGeometryOptions>(
    () => ({
      bevelEnabled: true,
      bevelSegments: 5,
      bevelSize: 0.0018,
      bevelThickness: 0.0015,
      curveSegments: 12,
      depth: 0.036,
      steps: 1,
    }),
    [],
  )

  const labelShapes = useMemo(() => {
    const pixel = 0.00175
    const glyphColumns = 5
    const glyphGap = 1
    const glyphRows = 7
    const width =
      (REJECT_GLYPHS.length * glyphColumns +
        (REJECT_GLYPHS.length - 1) * glyphGap) *
      pixel
    const height = glyphRows * pixel
    const shapes: THREE.Shape[] = []

    REJECT_GLYPHS.forEach((glyph, glyphIndex) => {
      glyph.forEach((row, rowIndex) => {
        Array.from(row).forEach((cell, columnIndex) => {
          if (cell !== '1') {
            return
          }

          const wordColumn =
            glyphIndex * (glyphColumns + glyphGap) + columnIndex
          const x = wordColumn * pixel - width / 2
          const y = height / 2 - (rowIndex + 1) * pixel
          const cellShape = new THREE.Shape()
          cellShape.moveTo(x, y)
          cellShape.lineTo(x + pixel * 0.78, y)
          cellShape.lineTo(x + pixel * 0.78, y + pixel * 0.8)
          cellShape.lineTo(x, y + pixel * 0.8)
          cellShape.closePath()
          shapes.push(cellShape)
        })
      })
    })

    return shapes
  }, [])

  const labelExtrusion = useMemo<THREE.ExtrudeGeometryOptions>(
    () => ({
      bevelEnabled: false,
      curveSegments: 1,
      depth: 0.00045,
      steps: 1,
    }),
    [],
  )

  const springGeometry = useMemo(() => {
    const points: THREE.Vector3[] = []
    const segments = 96
    const turns = 8.5

    for (let index = 0; index <= segments; index += 1) {
      const t = index / segments
      const angle = t * Math.PI * 2 * turns
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * 0.0048,
          0.004 + t * 0.049,
          Math.sin(angle) * 0.0048,
        ),
      )
    }

    const curve = new THREE.CatmullRomCurve3(points)
    return new THREE.TubeGeometry(curve, segments, 0.00062, 8, false)
  }, [])

  const colors = useMemo(
    () => ({
      baseIdentity: new THREE.Color('#b62c32'),
      baseIdentityEmissive: new THREE.Color('#3c090c'),
      baseIndicator: new THREE.Color('#70171c'),
      baseRubber: new THREE.Color('#46171a'),
      effects: {
        'paper-drop': new THREE.Color('#c8ae70'),
        approve: new THREE.Color('#4f9a72'),
        reject: new THREE.Color('#ef3f45'),
        fraud: new THREE.Color('#f36b2b'),
        'printer-jam': new THREE.Color('#d49737'),
        migration: new THREE.Color('#61b5a4'),
      } satisfies Record<RejectStampEffect, THREE.Color>,
    }),
    [],
  )

  const resetPose = useCallback(() => {
    const action = actionRef.current
    const press = pressRef.current
    const cartridge = cartridgeRef.current
    const platen = platenRef.current
    const spring = springRef.current
    const identityMaterial = identityMaterialRef.current
    const indicatorMaterial = indicatorMaterialRef.current
    const platenMaterial = platenMaterialRef.current

    if (action) {
      action.position.set(0, 0, 0)
      action.rotation.set(0, 0, 0)
    }
    if (press) {
      press.position.set(0, 0, 0)
      press.rotation.set(0, 0, 0)
    }
    if (cartridge) {
      cartridge.position.set(0, 0, 0)
      cartridge.rotation.set(0, 0, 0)
    }
    if (platen) {
      platen.position.set(0, 0.003, 0)
      platen.scale.set(1, 1, 1)
    }
    if (spring) {
      spring.scale.set(1, 1, 1)
    }
    if (identityMaterial) {
      identityMaterial.color.copy(colors.baseIdentity)
      identityMaterial.emissive.copy(colors.baseIdentityEmissive)
      identityMaterial.emissiveIntensity = 0.08
    }
    if (indicatorMaterial) {
      indicatorMaterial.color.copy(colors.baseIndicator)
      indicatorMaterial.emissive.copy(colors.baseIdentityEmissive)
      indicatorMaterial.emissiveIntensity = 0.16
    }
    if (platenMaterial) {
      platenMaterial.color.copy(colors.baseRubber)
    }
  }, [colors])

  useLayoutEffect(() => {
    resetPose()
    motionRef.current.active = effectRun > 0
    motionRef.current.elapsed = 0
    motionRef.current.preset = resolveEffect(effectPreset)
  }, [effectPreset, effectRun, resetPose])

  useFrame((_, delta) => {
    const action = actionRef.current
    const press = pressRef.current
    const cartridge = cartridgeRef.current
    const platen = platenRef.current
    const spring = springRef.current
    const identityMaterial = identityMaterialRef.current
    const indicatorMaterial = indicatorMaterialRef.current
    const platenMaterial = platenMaterialRef.current
    const motion = motionRef.current

    if (
      !action ||
      !press ||
      !cartridge ||
      !platen ||
      !spring ||
      !identityMaterial ||
      !indicatorMaterial ||
      !platenMaterial
    ) {
      return
    }

    if (!motion.active) {
      identityMaterial.emissiveIntensity = selected ? 0.36 : 0.08
      indicatorMaterial.emissiveIntensity = selected ? 0.82 : 0.16
      return
    }

    motion.elapsed += Math.min(delta, 0.05)
    const duration = EFFECT_DURATIONS[motion.preset]
    if (motion.elapsed >= duration) {
      resetPose()
      motion.active = false
      return
    }

    const translationScale = reducedMotion ? 0.32 : 1
    const rotationScale = reducedMotion ? 0.18 : 1
    const mechanicalScale = reducedMotion ? 0.72 : 1
    const elapsed = motion.elapsed

    let lift = 0
    let lateral = 0
    let foreAft = 0
    let pitch = 0
    let yaw = 0
    let roll = 0
    let pressX = 0
    let pressY = 0
    let pressPitch = 0
    let pressRoll = 0
    let cartridgeX = 0
    let cartridgeY = 0
    let cartridgeZ = 0
    let cartridgeRoll = 0
    let platenDrop = 0
    let platenCompression = 1
    let springCompression = 1
    let signalPulse = 0

    switch (motion.preset) {
      case 'paper-drop': {
        if (elapsed < 0.08) {
          const t = smoothstep(elapsed / 0.08)
          lift = 0.0012 * translationScale * t
          foreAft = -0.0036 * translationScale * t
          pitch = -0.034 * rotationScale * t
          cartridgeZ = -0.0009 * mechanicalScale * t
          signalPulse = 0.12 * t
        } else if (elapsed < 0.17) {
          const t = smoothstep((elapsed - 0.08) / 0.09)
          lift = 0.0012 * translationScale * (1 - t)
          foreAft = -0.0036 * translationScale * (1 - t)
          pitch = -0.034 * rotationScale * (1 - t)
          cartridgeZ = -0.0009 * mechanicalScale * (1 - t)
          platenCompression = 1 - 0.07 * Math.sin(t * Math.PI)
          signalPulse = 0.12 + 0.16 * Math.sin(t * Math.PI)
        } else {
          const t = (elapsed - 0.17) / 0.33
          const decay = Math.exp(-6.5 * t)
          lift =
            0.0013 *
            translationScale *
            decay *
            Math.abs(Math.sin(t * Math.PI * 2.6))
          foreAft =
            -0.0012 *
            translationScale *
            decay *
            Math.sin(t * Math.PI * 5.2)
          pitch =
            0.012 *
            rotationScale *
            decay *
            Math.sin(t * Math.PI * 5.2 + 0.4)
          cartridgeX =
            0.00055 *
            mechanicalScale *
            decay *
            Math.sin(t * Math.PI * 7)
          signalPulse = 0.24 * decay
        }
        break
      }

      case 'approve': {
        if (elapsed < 0.16) {
          const t = easeOutBack(elapsed / 0.16)
          lift = 0.012 * translationScale * t
          lateral = -0.0025 * translationScale * t
          pitch = 0.048 * rotationScale * t
          pressY = 0.0045 * mechanicalScale * t
          springCompression = 1 + 0.07 * mechanicalScale * t
          signalPulse = 0.6 * t
        } else if (elapsed < 0.34) {
          const t = smoothstep((elapsed - 0.16) / 0.18)
          lift = 0.012 * translationScale * (1 - t)
          lateral = -0.0025 * translationScale * (1 - t)
          pitch = 0.048 * rotationScale * (1 - t)
          pressY = 0.0045 * mechanicalScale
          springCompression = 1 + 0.07 * mechanicalScale
          signalPulse = 0.6 - 0.16 * t
        } else if (elapsed < 0.5) {
          const t = smoothstep((elapsed - 0.34) / 0.16)
          pressY = 0.0045 * mechanicalScale * (1 - t)
          springCompression =
            1 + 0.07 * mechanicalScale * (1 - t) - 0.08 * Math.sin(t * Math.PI)
          pressPitch = 0.018 * rotationScale * Math.sin(t * Math.PI)
          signalPulse = 0.44 + 0.32 * Math.sin(t * Math.PI)
        } else {
          const t = (elapsed - 0.5) / 0.2
          const decay = Math.exp(-7.5 * t)
          lift =
            0.0025 *
            translationScale *
            decay *
            Math.abs(Math.sin(t * Math.PI * 2.2))
          pitch =
            -0.009 *
            rotationScale *
            decay *
            Math.sin(t * Math.PI * 4.4)
          pressY =
            -0.0012 *
            mechanicalScale *
            decay *
            Math.sin(t * Math.PI * 4.4)
          signalPulse = 0.34 * decay
        }
        break
      }

      case 'reject': {
        const liftHeight = 0.052 * translationScale
        if (elapsed < 0.1) {
          const t = easeOutBack(elapsed / 0.1)
          lift = liftHeight * t
          lateral = -0.018 * translationScale * t
          foreAft = 0.003 * translationScale * t
          yaw = -0.12 * rotationScale * t
          roll = 0.105 * rotationScale * t
          pressY = 0.0025 * mechanicalScale * t
          signalPulse = 0.16 * t
        } else if (elapsed < 0.145) {
          const t = (elapsed - 0.1) / 0.045
          lift = liftHeight +
            (reducedMotion ? 0.0002 : 0.0008) * Math.sin(t * Math.PI)
          lateral = -0.018 * translationScale
          foreAft = 0.003 * translationScale
          yaw = -0.12 * rotationScale
          roll = 0.105 * rotationScale
          pressY = 0.0025 * mechanicalScale
          signalPulse = 0.16 + 0.08 * t
        } else if (elapsed < 0.235) {
          const rawT = (elapsed - 0.145) / 0.09
          const down = easeInCubic(rawT)
          const slice = easeOutCubic(rawT)
          lift = liftHeight * (1 - down)
          lateral = (-0.018 + 0.03 * slice) * translationScale
          foreAft = 0.003 * translationScale * (1 - down)
          yaw = (-0.12 * (1 - down) + 0.055 * down) * rotationScale
          roll = (0.105 * (1 - down) - 0.04 * down) * rotationScale
          pressY = 0.0025 * mechanicalScale * (1 - down)
          signalPulse = 0.24 + 0.28 * down
        } else if (elapsed < 0.305) {
          const t = (elapsed - 0.235) / 0.07
          const contact = 1 - smoothstep(t)
          lift =
            0.016 *
            translationScale *
            Math.sin(Math.PI * easeOutCubic(t))
          lateral = 0.012 * translationScale * contact
          foreAft = -0.0015 * translationScale * Math.sin(t * Math.PI)
          yaw = 0.055 * rotationScale * contact
          roll = -0.04 * rotationScale * contact
          pressY = -0.007 * mechanicalScale * contact
          pressRoll = -0.032 * rotationScale * Math.sin(t * Math.PI)
          platenDrop = -0.00075 * mechanicalScale * contact
          platenCompression = 1 - 0.32 * mechanicalScale * contact
          springCompression = 1 - 0.38 * mechanicalScale * contact
          signalPulse = 0.7 + 0.82 * Math.exp(-3.2 * t)
        } else {
          const t = (elapsed - 0.305) / 0.375
          const decay = Math.exp(-7.2 * t)
          lift =
            0.005 *
            translationScale *
            decay *
            Math.abs(Math.sin(t * Math.PI * 2.7))
          lateral =
            0.0035 *
            translationScale *
            decay *
            Math.sin(t * Math.PI * 5.4)
          yaw =
            0.018 *
            rotationScale *
            decay *
            Math.sin(t * Math.PI * 5.4 + 0.5)
          roll =
            -0.026 *
            rotationScale *
            decay *
            Math.sin(t * Math.PI * 5.4)
          pressY =
            -0.0015 *
            mechanicalScale *
            decay *
            Math.sin(t * Math.PI * 5.4)
          cartridgeX =
            0.0008 *
            mechanicalScale *
            decay *
            Math.sin(t * Math.PI * 7.2)
          springCompression =
            1 -
            0.08 *
              mechanicalScale *
              decay *
              Math.abs(Math.sin(t * Math.PI * 2.7))
          signalPulse = 0.78 * decay
        }
        break
      }

      case 'fraud': {
        if (elapsed < 0.14) {
          const t = easeOutBack(elapsed / 0.14)
          lift = 0.023 * translationScale * t
          foreAft = -0.004 * translationScale * t
          roll = 0.058 * rotationScale * t
          pressY = 0.002 * mechanicalScale * t
          signalPulse = 0.55 * t
        } else if (elapsed < 0.27) {
          const t = smoothstep((elapsed - 0.14) / 0.13)
          lift = 0.023 * translationScale * (1 - t)
          foreAft = -0.004 * translationScale * (1 - t)
          roll = 0.058 * rotationScale * (1 - t)
          pressY = (0.002 * (1 - t) - 0.0055 * Math.sin(t * Math.PI)) * mechanicalScale
          springCompression = 1 - 0.31 * mechanicalScale * Math.sin(t * Math.PI)
          cartridgeX = 0.001 * mechanicalScale * Math.sin(t * Math.PI)
          signalPulse = 0.55 + 0.8 * Math.sin(t * Math.PI)
        } else if (elapsed < 0.46) {
          const t = (elapsed - 0.27) / 0.19
          lift =
            0.009 *
            translationScale *
            Math.sin(Math.PI * easeOutCubic(t))
          lateral = -0.003 * translationScale * Math.sin(t * Math.PI)
          pitch = 0.026 * rotationScale * Math.sin(t * Math.PI)
          pressY = -0.004 * mechanicalScale * Math.sin(t * Math.PI)
          springCompression = 1 - 0.24 * mechanicalScale * Math.sin(t * Math.PI)
          platenCompression = 1 - 0.14 * mechanicalScale * Math.sin(t * Math.PI)
          signalPulse = 0.72 + 0.72 * Math.sin(t * Math.PI)
        } else {
          const t = (elapsed - 0.46) / 0.5
          const decay = Math.exp(-5.8 * t)
          lift =
            0.0045 *
            translationScale *
            decay *
            Math.abs(Math.sin(t * Math.PI * 3.2))
          lateral =
            0.0017 *
            translationScale *
            decay *
            Math.sin(t * Math.PI * 8.4)
          foreAft =
            0.0012 *
            translationScale *
            decay *
            Math.sin(t * Math.PI * 10.2 + 0.4)
          roll =
            0.019 *
            rotationScale *
            decay *
            Math.sin(t * Math.PI * 8.4)
          pressY =
            -0.002 *
            mechanicalScale *
            decay *
            Math.sin(t * Math.PI * 10.2)
          cartridgeRoll =
            0.012 *
            rotationScale *
            decay *
            Math.sin(t * Math.PI * 11)
          signalPulse = 0.95 * decay * (0.7 + 0.3 * Math.abs(Math.cos(t * Math.PI * 5)))
        }
        break
      }

      case 'printer-jam': {
        if (elapsed < 0.12) {
          const t = easeOutBack(elapsed / 0.12)
          lift = 0.011 * translationScale * t
          pitch = -0.025 * rotationScale * t
          pressY = 0.002 * mechanicalScale * t
          signalPulse = 0.22 * t
        } else if (elapsed < 0.65) {
          const t = (elapsed - 0.12) / 0.53
          lift =
            0.011 * translationScale +
            0.0012 * translationScale * Math.sin(t * Math.PI * 15)
          lateral = 0.0022 * translationScale * Math.sin(t * Math.PI * 12)
          foreAft =
            0.0014 * translationScale * Math.sin(t * Math.PI * 17 + 0.3)
          pitch =
            -0.025 * rotationScale +
            0.009 * rotationScale * Math.sin(t * Math.PI * 13)
          yaw = 0.018 * rotationScale * Math.sin(t * Math.PI * 9)
          pressY =
            (0.002 + 0.0016 * Math.sin(t * Math.PI * 19)) * mechanicalScale
          pressRoll = 0.035 * rotationScale * Math.sin(t * Math.PI * 16)
          cartridgeX = 0.0015 * mechanicalScale * Math.sin(t * Math.PI * 18)
          cartridgeY = 0.0008 * mechanicalScale * Math.sin(t * Math.PI * 22 + 0.4)
          cartridgeZ = 0.0009 * mechanicalScale * Math.sin(t * Math.PI * 15)
          springCompression =
            0.94 - 0.08 * mechanicalScale * Math.sin(t * Math.PI * 18)
          signalPulse = 0.34 + 0.28 * Math.abs(Math.sin(t * Math.PI * 7.5))
        } else {
          const t = (elapsed - 0.65) / 0.23
          const decay = Math.exp(-7 * t)
          lift =
            0.006 *
            translationScale *
            decay *
            Math.abs(Math.sin(t * Math.PI * 2.8))
          lateral =
            0.0018 *
            translationScale *
            decay *
            Math.sin(t * Math.PI * 6.4)
          pitch =
            0.018 *
            rotationScale *
            decay *
            Math.sin(t * Math.PI * 6.4)
          pressRoll =
            0.028 *
            rotationScale *
            decay *
            Math.sin(t * Math.PI * 8.2)
          cartridgeX =
            0.0011 *
            mechanicalScale *
            decay *
            Math.sin(t * Math.PI * 9)
          springCompression =
            1 - 0.12 * mechanicalScale * decay * Math.abs(Math.sin(t * Math.PI * 3))
          signalPulse = 0.62 * decay
        }
        break
      }

      case 'migration': {
        if (elapsed < 0.28) {
          const t = smoothstep(elapsed / 0.28)
          lift = 0.022 * translationScale * t
          lateral = -0.006 * translationScale * t
          yaw = -0.16 * rotationScale * t
          pressY = 0.006 * mechanicalScale * t
          springCompression = 1 + 0.1 * mechanicalScale * t
          signalPulse = 0.32 * t
        } else if (elapsed < 0.62) {
          const t = smoothstep((elapsed - 0.28) / 0.34)
          lift = 0.022 * translationScale
          lateral = (-0.006 + 0.014 * t) * translationScale
          foreAft = -0.002 * translationScale * Math.sin(t * Math.PI)
          yaw = (-0.16 + 0.28 * t) * rotationScale
          pressY = 0.006 * mechanicalScale
          pressPitch = -0.025 * rotationScale * Math.sin(t * Math.PI)
          cartridgeY = 0.0018 * mechanicalScale * Math.sin(t * Math.PI)
          springCompression = 1 + 0.1 * mechanicalScale
          signalPulse = 0.32 + 0.38 * Math.sin(t * Math.PI)
        } else if (elapsed < 0.95) {
          const t = smoothstep((elapsed - 0.62) / 0.33)
          lift = 0.022 * translationScale * (1 - t)
          lateral = 0.008 * translationScale * (1 - t)
          yaw = 0.12 * rotationScale * (1 - t)
          pressY = 0.006 * mechanicalScale * (1 - t)
          springCompression = 1 + 0.1 * mechanicalScale * (1 - t)
          signalPulse = 0.38 + 0.16 * t
        } else if (elapsed < 1.05) {
          const t = (elapsed - 0.95) / 0.1
          pressY = -0.0035 * mechanicalScale * Math.sin(t * Math.PI)
          pressX = 0.0008 * mechanicalScale * Math.sin(t * Math.PI)
          springCompression = 1 - 0.22 * mechanicalScale * Math.sin(t * Math.PI)
          platenCompression = 1 - 0.1 * mechanicalScale * Math.sin(t * Math.PI)
          signalPulse = 0.54 + 0.48 * Math.sin(t * Math.PI)
        } else {
          const t = (elapsed - 1.05) / 0.13
          const decay = Math.exp(-7 * t)
          lift =
            0.0025 *
            translationScale *
            decay *
            Math.abs(Math.sin(t * Math.PI * 1.8))
          pressY =
            -0.0012 *
            mechanicalScale *
            decay *
            Math.sin(t * Math.PI * 3.6)
          springCompression =
            1 - 0.08 * mechanicalScale * decay * Math.abs(Math.sin(t * Math.PI * 1.8))
          signalPulse = 0.62 * decay
        }
        break
      }
    }

    action.position.set(lateral, lift, foreAft)
    action.rotation.set(pitch, yaw, roll)
    press.position.set(pressX, pressY, 0)
    press.rotation.set(pressPitch, 0, pressRoll)
    cartridge.position.set(cartridgeX, cartridgeY, cartridgeZ)
    cartridge.rotation.set(0, 0, cartridgeRoll)
    platen.position.y = 0.003 + platenDrop
    platen.scale.y = platenCompression
    spring.scale.y = springCompression

    const signalColor = colors.effects[motion.preset]
    const identityBlend = clamp01(signalPulse * 0.18)
    identityMaterial.color
      .copy(colors.baseIdentity)
      .lerp(signalColor, identityBlend)
    identityMaterial.emissive
      .copy(colors.baseIdentityEmissive)
      .lerp(signalColor, clamp01(signalPulse * 0.9))
    identityMaterial.emissiveIntensity =
      (selected ? 0.36 : 0.08) + signalPulse * 0.72

    indicatorMaterial.color
      .copy(colors.baseIndicator)
      .lerp(signalColor, clamp01(signalPulse * 0.7))
    indicatorMaterial.emissive.copy(signalColor)
    indicatorMaterial.emissiveIntensity =
      (selected ? 0.82 : 0.16) + signalPulse * 1.15

    platenMaterial.color
      .copy(colors.baseRubber)
      .lerp(signalColor, clamp01(signalPulse * 0.065))
  })

  return (
    <group {...groupProps}>
      <group ref={actionRef}>
        <group ref={platenRef} position={[0, 0.003, 0]}>
          <RoundedBox
            args={[0.094, 0.006, 0.036]}
            radius={0.0025}
            smoothness={5}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              ref={platenMaterialRef}
              color="#46171a"
              roughness={0.92}
              metalness={0.01}
            />
          </RoundedBox>
          <RoundedBox
            args={[0.075, 0.0012, 0.024]}
            position={[0, -0.0024, 0]}
            radius={0.0012}
            smoothness={4}
            castShadow
          >
            <meshStandardMaterial
              color="#712127"
              roughness={0.97}
              metalness={0}
            />
          </RoundedBox>
        </group>

        <RoundedBox
          args={[0.118, 0.014, 0.054]}
          position={[0, 0.013, 0]}
          radius={0.0045}
          smoothness={6}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial
            color="#353a3d"
            roughness={0.29}
            metalness={0.82}
            clearcoat={0.34}
            clearcoatRoughness={0.25}
          />
        </RoundedBox>

        <group ref={cartridgeRef}>
          <RoundedBox
            args={[0.104, 0.025, 0.046]}
            position={[0, 0.0285, 0]}
            radius={0.005}
            smoothness={6}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial
              color="#1f2427"
              roughness={0.42}
              metalness={0.26}
              clearcoat={0.36}
              clearcoatRoughness={0.36}
            />
          </RoundedBox>

          <RoundedBox
            args={[0.084, 0.017, 0.0018]}
            position={[0, 0.029, 0.0237]}
            radius={0.0028}
            smoothness={5}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial
              color="#111518"
              roughness={0.48}
              metalness={0.35}
              clearcoat={0.24}
              clearcoatRoughness={0.4}
            />
          </RoundedBox>

          <mesh position={[0, 0.029, 0.02465]} castShadow>
            <extrudeGeometry args={[labelShapes, labelExtrusion]} />
            <meshPhysicalMaterial
              ref={identityMaterialRef}
              color="#b62c32"
              emissive="#3c090c"
              emissiveIntensity={selected ? 0.36 : 0.08}
              roughness={0.28}
              metalness={0.22}
              clearcoat={0.62}
              clearcoatRoughness={0.2}
            />
          </mesh>

          {GUIDE_X.map((x) => (
            <RoundedBox
              key={`release-${x}`}
              args={[0.009, 0.012, 0.006]}
              position={[x < 0 ? -0.0535 : 0.0535, 0.03, 0]}
              radius={0.002}
              smoothness={4}
              castShadow
              receiveShadow
            >
              <meshPhysicalMaterial
                color="#8f252b"
                roughness={0.35}
                metalness={0.38}
                clearcoat={0.5}
                clearcoatRoughness={0.25}
              />
            </RoundedBox>
          ))}
        </group>

        <mesh position={[0, 0, -0.01]} castShadow receiveShadow>
          <extrudeGeometry args={[frameShape, frameExtrusion]} />
          <meshPhysicalMaterial
            color="#4f5558"
            roughness={0.25}
            metalness={0.88}
            clearcoat={0.3}
            clearcoatRoughness={0.18}
          />
        </mesh>

        {GUIDE_X.map((x) => (
          <group key={`guide-${x}`} position={[x, 0, 0.004]}>
            <mesh position={[0, 0.073, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.0032, 0.0032, 0.069, 32]} />
              <meshPhysicalMaterial
                color="#b8bec1"
                roughness={0.16}
                metalness={0.96}
                clearcoat={0.48}
                clearcoatRoughness={0.12}
              />
            </mesh>
            <mesh position={[0, 0.043, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.0054, 0.0054, 0.007, 32]} />
              <meshStandardMaterial
                color="#242a2d"
                roughness={0.38}
                metalness={0.66}
              />
            </mesh>
          </group>
        ))}

        <group ref={springRef} position={[0, 0.041, 0.004]}>
          {GUIDE_X.map((x) => (
            <mesh
              key={`spring-${x}`}
              geometry={springGeometry}
              position={[x, 0, 0]}
              castShadow
            >
              <meshStandardMaterial
                color="#8d9396"
                roughness={0.26}
                metalness={0.9}
              />
            </mesh>
          ))}
        </group>

        <group ref={pressRef}>
          <RoundedBox
            args={[0.082, 0.017, 0.029]}
            position={[0, 0.111, 0.002]}
            radius={0.004}
            smoothness={5}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial
              color="#2c3235"
              roughness={0.31}
              metalness={0.8}
              clearcoat={0.32}
              clearcoatRoughness={0.23}
            />
          </RoundedBox>

          {GUIDE_X.map((x) => (
            <mesh key={`collar-${x}`} position={[x, 0.104, 0.004]} castShadow>
              <cylinderGeometry args={[0.0062, 0.0062, 0.012, 36]} />
              <meshPhysicalMaterial
                color="#9d252c"
                roughness={0.3}
                metalness={0.52}
                clearcoat={0.5}
                clearcoatRoughness={0.22}
              />
            </mesh>
          ))}

          <mesh position={[0, 0, -0.018]} castShadow receiveShadow>
            <extrudeGeometry args={[gripShape, gripExtrusion]} />
            <meshPhysicalMaterial
              color="#771f25"
              roughness={0.3}
              metalness={0.38}
              clearcoat={0.62}
              clearcoatRoughness={0.2}
            />
          </mesh>

          <RoundedBox
            args={[0.069, 0.017, 0.0022]}
            position={[0, 0.142, 0.0192]}
            rotation={[0, 0, -0.015]}
            radius={0.0025}
            smoothness={5}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial
              color="#24292c"
              roughness={0.62}
              metalness={0.05}
              clearcoat={0.18}
              clearcoatRoughness={0.5}
            />
          </RoundedBox>

          {GRIP_RIBS.map((x) => (
            <RoundedBox
              key={`grip-rib-${x}`}
              args={[0.0022, 0.012, 0.0012]}
              position={[x, 0.142, 0.0206]}
              rotation={[0, 0, -0.08]}
              radius={0.0007}
              smoothness={3}
              castShadow
            >
              <meshStandardMaterial
                color="#0f1315"
                roughness={0.82}
                metalness={0.02}
              />
            </RoundedBox>
          ))}

          <RoundedBox
            args={[0.022, 0.006, 0.003]}
            position={[0.024, 0.131, 0.0195]}
            radius={0.0022}
            smoothness={4}
            castShadow
          >
            <meshPhysicalMaterial
              ref={indicatorMaterialRef}
              color="#70171c"
              emissive="#3c090c"
              emissiveIntensity={selected ? 0.82 : 0.16}
              roughness={0.22}
              metalness={0.12}
              clearcoat={0.78}
              clearcoatRoughness={0.14}
            />
          </RoundedBox>

          <mesh
            position={[-0.024, 0.117, 0.0168]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.0042, 0.0042, 0.0022, 32]} />
            <meshStandardMaterial
              color="#aeb3b4"
              roughness={0.24}
              metalness={0.94}
            />
          </mesh>
        </group>
      </group>
    </group>
  )
}

export default RejectStamp
