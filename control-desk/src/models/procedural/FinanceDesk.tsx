import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Shape,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Group } from 'three'
import { useLabStore } from '../../store/useLabStore'
import type { ProceduralAssetProps } from '../types'

type RoundedPart = {
  size: readonly [number, number, number]
  position: readonly [number, number, number]
  rotation?: readonly [number, number, number]
  radius: number
}

type CylinderPart = {
  radius: number
  height: number
  position: readonly [number, number, number]
  rotation?: readonly [number, number, number]
  segments?: number
}

type DeskProfile = {
  halfWidth: number
  rearZ: number
  sideZ: number
  wingX: number
  wingZ: number
  recessShoulderX: number
  recessShoulderZ: number
  recessCenterZ: number
}

type DeskEffect = NonNullable<ProceduralAssetProps['effectPreset']>

type MotionState = {
  active: boolean
  duration: number
  elapsed: number
  preset?: DeskEffect
}

/**
 * Integration datums for the executive finance console. Coordinates are local
 * to the FinanceDesk root, in meters. The seated operator approaches from +z.
 */
// oxlint-disable-next-line react/only-export-components -- scene integration reads this co-located asset contract.
export const FINANCE_DESK_CONTRACT = Object.freeze({
  dimensions: Object.freeze([2.84, 0.794, 1.52] as const),
  overallBounds: Object.freeze({
    x: Object.freeze([-1.42, 1.42] as const),
    y: Object.freeze([0, 0.794] as const),
    z: Object.freeze([-0.68, 0.84] as const),
  }),
  surfaceY: 0.78,
  grommets: Object.freeze({
    center: Object.freeze([0, 0.782, -0.515] as const),
    left: Object.freeze([-0.88, 0.782, -0.445] as const),
    right: Object.freeze([0.88, 0.782, -0.445] as const),
  }),
  operatorRecess: Object.freeze({
    openingWidth: 1.4,
    shoulderX: 0.7,
    shoulderZ: 0.7,
    centerZ: 0.26,
    depth: 0.58,
  }),
  // Kept for existing scene consumers while exposing the more explicit recess contract above.
  operatorEdge: Object.freeze({
    centerZ: 0.26,
    cutoutDepth: 0.58,
    shoulderX: 0.7,
    wingPeakX: 0.9,
    wingPeakZ: 0.84,
  }),
  kneeClearance: Object.freeze({
    x: Object.freeze([-0.84, 0.84] as const),
    y: Object.freeze([0.065, 0.69] as const),
    z: Object.freeze([-0.34, 0.34] as const),
  }),
  usableBounds: Object.freeze({
    x: Object.freeze([-1.34, 1.34] as const),
    z: Object.freeze([-0.56, 0.73] as const),
  }),
  zones: Object.freeze({
    manual: Object.freeze({
      x: Object.freeze([-1.32, -0.62] as const),
      z: Object.freeze([-0.36, 0.7] as const),
    }),
    input: Object.freeze({
      x: Object.freeze([-0.6, 0.6] as const),
      z: Object.freeze([-0.34, 0.21] as const),
    }),
    decision: Object.freeze({
      x: Object.freeze([0.62, 1.32] as const),
      z: Object.freeze([-0.36, 0.7] as const),
    }),
    rearService: Object.freeze({
      x: Object.freeze([-1.24, 1.24] as const),
      z: Object.freeze([-0.57, -0.39] as const),
    }),
  }),
  wingPlacementArc: Object.freeze([
    Object.freeze({ absX: 0.62, maxZ: 0.31 }),
    Object.freeze({ absX: 0.74, maxZ: 0.45 }),
    Object.freeze({ absX: 0.86, maxZ: 0.6 }),
    Object.freeze({ absX: 0.98, maxZ: 0.71 }),
    Object.freeze({ absX: 1.1, maxZ: 0.67 }),
    Object.freeze({ absX: 1.22, maxZ: 0.55 }),
    Object.freeze({ absX: 1.32, maxZ: 0.37 }),
  ] as const),
})

const TOP_PIVOT_Y = 0.738
const TOP_PIVOT_Z = -0.02
const TROUGH_PIVOT_Y = 0.65
const TROUGH_PIVOT_Z = -0.47
const MODESTY_PIVOT_Y = 0.43
const MODESTY_PIVOT_Z = -0.42

const EFFECT_DURATIONS: Readonly<Record<DeskEffect, number>> = {
  'paper-drop': 0.34,
  approve: 0.48,
  reject: 0.5,
  fraud: 0.76,
  'printer-jam': 0.88,
  migration: 0.82,
}

const EDGE_PROFILE: Readonly<DeskProfile> = Object.freeze({
  halfWidth: 1.42,
  rearZ: -0.68,
  sideZ: 0.06,
  wingX: 0.9,
  wingZ: 0.84,
  recessShoulderX: 0.7,
  recessShoulderZ: 0.7,
  recessCenterZ: 0.26,
})

const TOP_PROFILE: Readonly<DeskProfile> = Object.freeze({
  halfWidth: 1.392,
  rearZ: -0.652,
  sideZ: 0.06,
  wingX: 0.895,
  wingZ: 0.81,
  recessShoulderX: 0.69,
  recessShoulderZ: 0.676,
  recessCenterZ: 0.278,
})

const APRON_PROFILE: Readonly<DeskProfile> = Object.freeze({
  halfWidth: 1.355,
  rearZ: -0.615,
  sideZ: 0.055,
  wingX: 0.89,
  wingZ: 0.765,
  recessShoulderX: 0.675,
  recessShoulderZ: 0.638,
  recessCenterZ: 0.298,
})

const MAT_PARTS: readonly RoundedPart[] = [
  {
    size: [1.12, 0.0045, 0.36],
    position: [0, 0.783, 0.035],
    radius: 0.032,
  },
]

const MAT_BORDER_PARTS: readonly RoundedPart[] = [
  { size: [1.145, 0.0025, 0.009], position: [0, 0.7828, -0.15], radius: 0.002 },
  { size: [1.145, 0.0025, 0.009], position: [0, 0.7828, 0.22], radius: 0.002 },
  {
    size: [0.009, 0.0025, 0.36],
    position: [-0.572, 0.7828, 0.035],
    radius: 0.002,
  },
  {
    size: [0.009, 0.0025, 0.36],
    position: [0.572, 0.7828, 0.035],
    radius: 0.002,
  },
]

// Brushed-brass reach marks echo the recess sweep without turning the desk
// into a rectangular control panel.
const WORKFLOW_CUE_PARTS: readonly RoundedPart[] = [
  {
    size: [0.2, 0.0035, 0.011],
    position: [-0.69, 0.783, 0.345],
    rotation: [0, 0.9, 0],
    radius: 0.002,
  },
  {
    size: [0.22, 0.0035, 0.011],
    position: [-0.82, 0.783, 0.505],
    rotation: [0, 0.66, 0],
    radius: 0.002,
  },
  {
    size: [0.24, 0.0035, 0.011],
    position: [-1, 0.783, 0.63],
    rotation: [0, 0.28, 0],
    radius: 0.002,
  },
  {
    size: [0.2, 0.0035, 0.011],
    position: [0.69, 0.783, 0.345],
    rotation: [0, -0.9, 0],
    radius: 0.002,
  },
  {
    size: [0.22, 0.0035, 0.011],
    position: [0.82, 0.783, 0.505],
    rotation: [0, -0.66, 0],
    radius: 0.002,
  },
  {
    size: [0.24, 0.0035, 0.011],
    position: [1, 0.783, 0.63],
    rotation: [0, -0.28, 0],
    radius: 0.002,
  },
  { size: [1.92, 0.0035, 0.01], position: [0, 0.783, -0.365], radius: 0.002 },
]

const CABLE_TROUGH_PARTS: readonly RoundedPart[] = [
  { size: [2.12, 0.018, 0.16], position: [0, 0.62, -0.49], radius: 0.007 },
  { size: [2.12, 0.064, 0.016], position: [0, 0.65, -0.41], radius: 0.004 },
  { size: [2.12, 0.064, 0.016], position: [0, 0.65, -0.57], radius: 0.004 },
  {
    size: [0.016, 0.064, 0.16],
    position: [-1.052, 0.65, -0.49],
    radius: 0.004,
  },
  { size: [0.016, 0.064, 0.16], position: [1.052, 0.65, -0.49], radius: 0.004 },
]

const POWER_BLOCK_PARTS: readonly RoundedPart[] = [
  {
    size: [0.34, 0.046, 0.075],
    position: [-0.52, 0.65, -0.445],
    radius: 0.009,
  },
  { size: [0.34, 0.046, 0.075], position: [0.52, 0.65, -0.445], radius: 0.009 },
]

const POWER_DATA_PARTS: readonly RoundedPart[] = [
  {
    size: [0.04, 0.023, 0.006],
    position: [-0.41, 0.65, -0.404],
    radius: 0.003,
  },
  { size: [0.04, 0.023, 0.006], position: [0.41, 0.65, -0.404], radius: 0.003 },
]

const FRAME_PARTS: readonly RoundedPart[] = [
  // Twin cantilever C-legs leave the operator bay open while carrying the wide wings.
  { size: [0.14, 0.055, 1.02], position: [-1.04, 0.037, 0.015], radius: 0.018 },
  { size: [0.14, 0.055, 1.02], position: [1.04, 0.037, 0.015], radius: 0.018 },
  {
    size: [0.115, 0.61, 0.115],
    position: [-1.04, 0.366, -0.34],
    radius: 0.025,
  },
  { size: [0.115, 0.61, 0.115], position: [1.04, 0.366, -0.34], radius: 0.025 },
  {
    size: [0.145, 0.058, 1.01],
    position: [-1.04, 0.687, 0.005],
    radius: 0.018,
  },
  { size: [0.145, 0.058, 1.01], position: [1.04, 0.687, 0.005], radius: 0.018 },
  { size: [2.08, 0.075, 0.095], position: [0, 0.676, -0.39], radius: 0.017 },
  {
    size: [0.07, 0.25, 0.07],
    position: [-1.04, 0.58, -0.265],
    rotation: [0.61, 0, 0],
    radius: 0.015,
  },
  {
    size: [0.07, 0.25, 0.07],
    position: [1.04, 0.58, -0.265],
    rotation: [0.61, 0, 0],
    radius: 0.015,
  },
  ...[-0.88, -0.3, 0.3, 0.88].map((x) => ({
    size: [0.044, 0.09, 0.064] as const,
    position: [x, 0.672, -0.49] as const,
    radius: 0.009,
  })),
  { size: [0.052, 0.55, 0.046], position: [-0.96, 0.36, -0.49], radius: 0.012 },
]

const FLOOR_PAD_PARTS: readonly RoundedPart[] = [
  { size: [0.14, 0.012, 0.14], position: [-1.04, 0.006, -0.43], radius: 0.006 },
  { size: [0.14, 0.012, 0.14], position: [-1.04, 0.006, 0.46], radius: 0.006 },
  { size: [0.14, 0.012, 0.14], position: [1.04, 0.006, -0.43], radius: 0.006 },
  { size: [0.14, 0.012, 0.14], position: [1.04, 0.006, 0.46], radius: 0.006 },
]

const MODESTY_MOUNT_PARTS: readonly RoundedPart[] = [
  { size: [0.06, 0.12, 0.055], position: [-0.9, 0.61, -0.28], radius: 0.009 },
  { size: [0.06, 0.12, 0.055], position: [-0.32, 0.61, -0.49], radius: 0.009 },
  { size: [0.06, 0.12, 0.055], position: [0.32, 0.61, -0.49], radius: 0.009 },
  { size: [0.06, 0.12, 0.055], position: [0.9, 0.61, -0.28], radius: 0.009 },
]

const GROMMET_OUTER_PARTS: readonly CylinderPart[] = [
  {
    radius: 0.046,
    height: 0.008,
    position: FINANCE_DESK_CONTRACT.grommets.left,
    segments: 32,
  },
  {
    radius: 0.046,
    height: 0.008,
    position: FINANCE_DESK_CONTRACT.grommets.center,
    segments: 32,
  },
  {
    radius: 0.046,
    height: 0.008,
    position: FINANCE_DESK_CONTRACT.grommets.right,
    segments: 32,
  },
]

const GROMMET_INNER_PARTS: readonly CylinderPart[] = [
  {
    radius: 0.031,
    height: 0.008,
    position: [-0.88, 0.787, -0.445],
    segments: 28,
  },
  { radius: 0.031, height: 0.008, position: [0, 0.787, -0.515], segments: 28 },
  {
    radius: 0.031,
    height: 0.008,
    position: [0.88, 0.787, -0.445],
    segments: 28,
  },
  {
    radius: 0.034,
    height: 0.065,
    position: [-0.88, 0.692, -0.445],
    segments: 20,
  },
  { radius: 0.034, height: 0.065, position: [0, 0.692, -0.515], segments: 20 },
  {
    radius: 0.034,
    height: 0.065,
    position: [0.88, 0.692, -0.445],
    segments: 20,
  },
]

const POWER_SOCKET_PARTS: readonly CylinderPart[] = [
  {
    radius: 0.013,
    height: 0.006,
    position: [-0.62, 0.65, -0.404],
    rotation: [Math.PI / 2, 0, 0],
    segments: 20,
  },
  {
    radius: 0.013,
    height: 0.006,
    position: [-0.52, 0.65, -0.404],
    rotation: [Math.PI / 2, 0, 0],
    segments: 20,
  },
  {
    radius: 0.013,
    height: 0.006,
    position: [0.52, 0.65, -0.404],
    rotation: [Math.PI / 2, 0, 0],
    segments: 20,
  },
  {
    radius: 0.013,
    height: 0.006,
    position: [0.62, 0.65, -0.404],
    rotation: [Math.PI / 2, 0, 0],
    segments: 20,
  },
]

const POWER_INDICATOR_PARTS: readonly CylinderPart[] = [
  {
    radius: 0.006,
    height: 0.006,
    position: [-0.72, 0.65, -0.404],
    rotation: [Math.PI / 2, 0, 0],
    segments: 16,
  },
  {
    radius: 0.006,
    height: 0.006,
    position: [0.72, 0.65, -0.404],
    rotation: [Math.PI / 2, 0, 0],
    segments: 16,
  },
]

function makeDeskProfileShape(profile: Readonly<DeskProfile>) {
  const shape = new Shape()

  // The path starts on the left recess shoulder, sweeps around the inset bay,
  // then follows one uninterrupted executive-oval perimeter back to the start.
  shape.moveTo(-profile.recessShoulderX, profile.recessShoulderZ)
  shape.bezierCurveTo(
    -profile.recessShoulderX * 0.72,
    profile.recessShoulderZ,
    -profile.recessShoulderX * 0.58,
    profile.recessCenterZ,
    0,
    profile.recessCenterZ,
  )
  shape.bezierCurveTo(
    profile.recessShoulderX * 0.58,
    profile.recessCenterZ,
    profile.recessShoulderX * 0.72,
    profile.recessShoulderZ,
    profile.recessShoulderX,
    profile.recessShoulderZ,
  )
  shape.bezierCurveTo(
    profile.recessShoulderX + 0.09,
    profile.recessShoulderZ + 0.08,
    profile.wingX - 0.08,
    profile.wingZ,
    profile.wingX,
    profile.wingZ,
  )
  shape.bezierCurveTo(
    profile.halfWidth - 0.16,
    profile.wingZ - 0.015,
    profile.halfWidth,
    profile.sideZ + 0.27,
    profile.halfWidth,
    profile.sideZ,
  )
  shape.bezierCurveTo(
    profile.halfWidth,
    profile.rearZ + 0.2,
    0.62,
    profile.rearZ,
    0,
    profile.rearZ,
  )
  shape.bezierCurveTo(
    -0.62,
    profile.rearZ,
    -profile.halfWidth,
    profile.rearZ + 0.2,
    -profile.halfWidth,
    profile.sideZ,
  )
  shape.bezierCurveTo(
    -profile.halfWidth,
    profile.sideZ + 0.27,
    -profile.halfWidth + 0.16,
    profile.wingZ - 0.015,
    -profile.wingX,
    profile.wingZ,
  )
  shape.bezierCurveTo(
    -profile.wingX + 0.08,
    profile.wingZ,
    -profile.recessShoulderX - 0.09,
    profile.recessShoulderZ + 0.08,
    -profile.recessShoulderX,
    profile.recessShoulderZ,
  )
  shape.closePath()

  return shape
}

function extrudeDeskProfile(
  profile: Readonly<DeskProfile>,
  totalThickness: number,
  topY: number,
  bevelSize: number,
) {
  const geometry = new ExtrudeGeometry(makeDeskProfileShape(profile), {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments: 20,
    depth: totalThickness - bevelSize * 2,
    steps: 1,
  })

  geometry.rotateX(Math.PI / 2)
  geometry.translate(0, topY - bevelSize, 0)
  geometry.computeVertexNormals()
  return geometry
}

function makeCurvedModestyGeometry() {
  const geometry = new BufferGeometry()
  const positions: number[] = []
  const indices: number[] = []
  const segments = 28
  const start = -1.16
  const end = 1.16
  const outerX = 1.18
  const outerZ = 0.59
  const innerX = 1.145
  const innerZ = 0.555
  const centerZ = 0.035
  const bottomY = 0.245
  const topY = 0.585

  for (let index = 0; index <= segments; index += 1) {
    const angle = start + ((end - start) * index) / segments
    const sin = Math.sin(angle)
    const cos = Math.cos(angle)
    positions.push(
      outerX * sin,
      bottomY,
      centerZ - outerZ * cos,
      outerX * sin,
      topY,
      centerZ - outerZ * cos,
      innerX * sin,
      bottomY,
      centerZ - innerZ * cos,
      innerX * sin,
      topY,
      centerZ - innerZ * cos,
    )
  }

  for (let index = 0; index < segments; index += 1) {
    const current = index * 4
    const next = (index + 1) * 4
    indices.push(
      current,
      next,
      current + 1,
      next,
      next + 1,
      current + 1,
      current + 2,
      current + 3,
      next + 2,
      next + 2,
      current + 3,
      next + 3,
      current + 1,
      next + 1,
      current + 3,
      next + 1,
      next + 3,
      current + 3,
      current + 2,
      next + 2,
      current,
      next + 2,
      next,
      current,
    )
  }

  const final = segments * 4
  indices.push(
    0,
    1,
    2,
    1,
    3,
    2,
    final,
    final + 2,
    final + 1,
    final + 1,
    final + 2,
    final + 3,
  )
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function makeModestyFasteners() {
  const parts: CylinderPart[] = []
  const angles = [-0.9, -0.45, 0, 0.45, 0.9]

  for (const angle of angles) {
    for (const y of [0.29, 0.54]) {
      parts.push({
        radius: 0.009,
        height: 0.006,
        position: [
          1.145 * Math.sin(angle),
          y,
          0.035 - 0.555 * Math.cos(angle) + 0.006,
        ],
        rotation: [Math.PI / 2, angle, 0],
        segments: 16,
      })
    }
  }

  return parts
}

function mergeRoundedParts(parts: readonly RoundedPart[]) {
  const source = parts.map((part) => {
    const geometry = new RoundedBoxGeometry(
      part.size[0],
      part.size[1],
      part.size[2],
      4,
      part.radius,
    )

    if (part.rotation) {
      geometry.rotateX(part.rotation[0])
      geometry.rotateY(part.rotation[1])
      geometry.rotateZ(part.rotation[2])
    }

    geometry.translate(part.position[0], part.position[1], part.position[2])
    return geometry
  })
  const merged = mergeGeometries(source, false)
  source.forEach((geometry) => geometry.dispose())

  if (!merged) {
    throw new Error('Unable to assemble FinanceDesk rounded geometry')
  }

  return merged
}

function mergeCylinderParts(parts: readonly CylinderPart[]) {
  const source = parts.map((part) => {
    const geometry = new CylinderGeometry(
      part.radius,
      part.radius,
      part.height,
      part.segments ?? 16,
    )

    if (part.rotation) {
      geometry.rotateX(part.rotation[0])
      geometry.rotateY(part.rotation[1])
      geometry.rotateZ(part.rotation[2])
    }

    geometry.translate(part.position[0], part.position[1], part.position[2])
    return geometry
  })
  const merged = mergeGeometries(source, false)
  source.forEach((geometry) => geometry.dispose())

  if (!merged) {
    throw new Error('Unable to assemble FinanceDesk cylindrical geometry')
  }

  return merged
}

function smoothstep(value: number) {
  const clamped = Math.max(0, Math.min(1, value))
  return clamped * clamped * (3 - 2 * clamped)
}

function pulse(value: number, start: number, peak: number, end: number) {
  if (value <= start || value >= end) {
    return 0
  }
  if (value < peak) {
    return smoothstep((value - start) / (peak - start))
  }
  return 1 - smoothstep((value - peak) / (end - peak))
}

function dampedOscillation(
  value: number,
  start: number,
  cycles: number,
  decayPower: number,
  phase = 0,
) {
  if (value <= start) {
    return 0
  }
  const progress = Math.min(1, (value - start) / (1 - start))
  const decay = Math.pow(1 - progress, decayPower)
  return Math.sin(progress * Math.PI * 2 * cycles + phase) * decay
}

function setShadowFlags(geometry: BufferGeometry) {
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/**
 * Premium oval finance console, modeled at real-world meter scale.
 * The continuous top is 2.84 m wide by 1.52 m deep, with a 580 mm rounded
 * operator recess that wraps the manual and decision wings toward seated reach.
 */
export function FinanceDesk({
  effectPreset,
  effectRun,
  selected = false,
  ...groupProps
}: ProceduralAssetProps) {
  const reducedMotion = useLabStore((state) => state.reducedMotion)
  const topMotionRef = useRef<Group>(null)
  const matMotionRef = useRef<Group>(null)
  const troughMotionRef = useRef<Group>(null)
  const modestyMotionRef = useRef<Group>(null)
  const previousRunRef = useRef(effectRun)
  const cueBaseIntensityRef = useRef(selected ? 0.2 : 0)
  const motionRef = useRef<MotionState>({
    active: false,
    duration: 0,
    elapsed: 0,
  })

  const geometry = useMemo(
    () => ({
      apron: setShadowFlags(
        extrudeDeskProfile(APRON_PROFILE, 0.05, 0.724, 0.005),
      ),
      cableTrough: setShadowFlags(mergeRoundedParts(CABLE_TROUGH_PARTS)),
      cues: setShadowFlags(mergeRoundedParts(WORKFLOW_CUE_PARTS)),
      edge: setShadowFlags(
        extrudeDeskProfile(EDGE_PROFILE, 0.07, 0.775, 0.007),
      ),
      floorPads: setShadowFlags(mergeRoundedParts(FLOOR_PAD_PARTS)),
      frame: setShadowFlags(mergeRoundedParts(FRAME_PARTS)),
      grommetInner: setShadowFlags(mergeCylinderParts(GROMMET_INNER_PARTS)),
      grommetOuter: setShadowFlags(mergeCylinderParts(GROMMET_OUTER_PARTS)),
      mat: setShadowFlags(mergeRoundedParts(MAT_PARTS)),
      matBorder: setShadowFlags(mergeRoundedParts(MAT_BORDER_PARTS)),
      modesty: setShadowFlags(makeCurvedModestyGeometry()),
      modestyFasteners: setShadowFlags(
        mergeCylinderParts(makeModestyFasteners()),
      ),
      modestyMounts: setShadowFlags(mergeRoundedParts(MODESTY_MOUNT_PARTS)),
      powerBlocks: setShadowFlags(mergeRoundedParts(POWER_BLOCK_PARTS)),
      powerData: setShadowFlags(mergeRoundedParts(POWER_DATA_PARTS)),
      powerIndicators: setShadowFlags(
        mergeCylinderParts(POWER_INDICATOR_PARTS),
      ),
      powerSockets: setShadowFlags(mergeCylinderParts(POWER_SOCKET_PARTS)),
      top: setShadowFlags(extrudeDeskProfile(TOP_PROFILE, 0.042, 0.78, 0.006)),
    }),
    [],
  )

  const material = useMemo(() => {
    const cue = new MeshStandardMaterial({
      color: '#a88d59',
      emissive: '#7b5b29',
      emissiveIntensity: 0,
      metalness: 0.72,
      roughness: 0.28,
    })
    const power = new MeshStandardMaterial({
      color: '#657666',
      emissive: '#3dca72',
      emissiveIntensity: 0.1,
      metalness: 0.2,
      roughness: 0.38,
    })

    return {
      cue,
      edge: new MeshPhysicalMaterial({
        clearcoat: 0.22,
        clearcoatRoughness: 0.58,
        color: '#3e3029',
        metalness: 0.01,
        roughness: 0.39,
      }),
      fastener: new MeshStandardMaterial({
        color: '#a6a39a',
        metalness: 0.82,
        roughness: 0.25,
      }),
      frame: new MeshStandardMaterial({
        color: '#1e2524',
        metalness: 0.66,
        roughness: 0.29,
      }),
      mat: new MeshStandardMaterial({
        color: '#263331',
        metalness: 0.01,
        roughness: 0.82,
      }),
      modesty: new MeshPhysicalMaterial({
        clearcoat: 0.08,
        clearcoatRoughness: 0.72,
        color: '#303836',
        metalness: 0.3,
        roughness: 0.5,
      }),
      power,
      rubber: new MeshStandardMaterial({
        color: '#151918',
        metalness: 0,
        roughness: 0.86,
      }),
      top: new MeshPhysicalMaterial({
        clearcoat: 0.24,
        clearcoatRoughness: 0.55,
        color: '#725d4c',
        metalness: 0.01,
        roughness: 0.4,
      }),
    }
  }, [])

  const resetPose = useCallback(() => {
    const top = topMotionRef.current
    const mat = matMotionRef.current
    const trough = troughMotionRef.current
    const modesty = modestyMotionRef.current

    if (top) {
      top.position.set(0, TOP_PIVOT_Y, TOP_PIVOT_Z)
      top.rotation.set(0, 0, 0)
    }
    if (mat) {
      mat.position.set(0, 0, 0)
      mat.rotation.set(0, 0, 0)
      mat.scale.set(1, 1, 1)
    }
    if (trough) {
      trough.position.set(0, TROUGH_PIVOT_Y, TROUGH_PIVOT_Z)
      trough.rotation.set(0, 0, 0)
    }
    if (modesty) {
      modesty.position.set(0, MODESTY_PIVOT_Y, MODESTY_PIVOT_Z)
      modesty.rotation.set(0, 0, 0)
    }
    material.cue.emissiveIntensity = cueBaseIntensityRef.current
    material.power.emissiveIntensity = 0.1
  }, [material.cue, material.power])

  useEffect(() => {
    cueBaseIntensityRef.current = selected ? 0.2 : 0
    if (!motionRef.current.active) {
      material.cue.emissiveIntensity = cueBaseIntensityRef.current
    }
  }, [material.cue, selected])

  useEffect(() => {
    if (effectRun === undefined || effectRun === previousRunRef.current) {
      return
    }
    previousRunRef.current = effectRun
    resetPose()
    const motion = motionRef.current
    motion.elapsed = 0
    motion.preset = effectPreset
    if (!effectPreset) {
      motion.active = false
      return
    }
    motion.active = true
    motion.duration = EFFECT_DURATIONS[effectPreset]
  }, [effectPreset, effectRun, resetPose])

  useFrame((_, delta) => {
    const motion = motionRef.current
    const top = topMotionRef.current
    const mat = matMotionRef.current
    const trough = troughMotionRef.current
    const modesty = modestyMotionRef.current

    if (
      !motion.active ||
      !motion.preset ||
      !top ||
      !mat ||
      !trough ||
      !modesty
    ) {
      return
    }

    motion.elapsed += Math.min(delta, 0.05)
    const normalized = Math.min(1, motion.elapsed / motion.duration)
    const translationScale = reducedMotion ? 0.3 : 1
    const rotationScale = reducedMotion ? 0.16 : 1
    const surfaceScale = reducedMotion ? 0.55 : 1

    switch (motion.preset) {
      case 'paper-drop': {
        const contact = pulse(normalized, 0.02, 0.14, 0.3)
        const settle = Math.abs(dampedOscillation(normalized, 0.12, 1.5, 2.8))
        mat.position.y = -surfaceScale * (0.00042 * contact + 0.00011 * settle)
        material.cue.emissiveIntensity =
          cueBaseIntensityRef.current + 0.06 * contact
        break
      }
      case 'approve': {
        const cueLead = pulse(normalized, 0, 0.12, 0.25)
        const contact = pulse(normalized, 0.18, 0.27, 0.41)
        const settle = dampedOscillation(normalized, 0.26, 1.4, 2.6)
        top.position.y =
          TOP_PIVOT_Y +
          translationScale * (-0.00115 * contact + 0.00025 * settle)
        top.rotation.z = rotationScale * (-0.00068 * contact + 0.00024 * settle)
        modesty.position.z =
          MODESTY_PIVOT_Z + translationScale * 0.00072 * settle
        modesty.rotation.x = rotationScale * 0.00105 * settle
        material.cue.emissiveIntensity =
          cueBaseIntensityRef.current + 0.16 * cueLead + 0.12 * contact
        break
      }
      case 'reject': {
        const cueLead = pulse(normalized, 0, 0.08, 0.2)
        const contact = pulse(normalized, 0.14, 0.21, 0.32)
        const snap = dampedOscillation(normalized, 0.2, 2.35, 2.5)
        const panelClick = pulse(normalized, 0.34, 0.4, 0.5)
        top.position.x =
          translationScale * (-0.00072 * contact + 0.00042 * snap)
        top.position.y =
          TOP_PIVOT_Y + translationScale * (-0.00092 * contact + 0.00018 * snap)
        top.rotation.y = rotationScale * (0.00078 * contact - 0.00038 * snap)
        modesty.position.z =
          MODESTY_PIVOT_Z +
          translationScale * (0.00105 * snap - 0.00048 * panelClick)
        modesty.rotation.z = rotationScale * 0.0015 * snap
        material.cue.emissiveIntensity =
          cueBaseIntensityRef.current +
          0.13 * cueLead +
          0.24 * contact +
          0.08 * panelClick
        break
      }
      case 'fraud': {
        const cueLead = pulse(normalized, 0, 0.15, 0.28)
        const contact = pulse(normalized, 0.2, 0.29, 0.44)
        const ring = dampedOscillation(normalized, 0.28, 1.8, 2.1)
        const aftershock = pulse(normalized, 0.53, 0.6, 0.72)
        top.position.y =
          TOP_PIVOT_Y +
          translationScale *
            (-0.0021 * contact + 0.00052 * ring - 0.00034 * aftershock)
        top.rotation.x = rotationScale * (0.00072 * contact - 0.0003 * ring)
        top.rotation.z = rotationScale * (-0.00155 * contact + 0.00068 * ring)
        trough.position.z =
          TROUGH_PIVOT_Z +
          translationScale * (-0.00072 * contact + 0.00048 * ring)
        modesty.position.z =
          MODESTY_PIVOT_Z +
          translationScale *
            (-0.0024 * contact + 0.0022 * ring - 0.00065 * aftershock)
        modesty.rotation.x =
          rotationScale * (0.0032 * ring + 0.0014 * aftershock)
        material.cue.emissiveIntensity =
          cueBaseIntensityRef.current +
          0.16 * cueLead +
          0.5 * contact +
          0.2 * Math.abs(ring) +
          0.12 * aftershock
        break
      }
      case 'printer-jam': {
        const spinUp = smoothstep(normalized / 0.13)
        const shutDown = 1 - smoothstep((normalized - 0.72) / 0.2)
        const envelope = spinUp * shutDown
        const rumble = Math.sin(normalized * Math.PI * 22) * envelope
        const carrier = Math.sin(normalized * Math.PI * 35 + 0.4) * envelope
        const panelRumble = Math.sin(normalized * Math.PI * 8 + 0.7) * envelope
        const stall = pulse(normalized, 0.42, 0.53, 0.69)
        top.position.y =
          TOP_PIVOT_Y + translationScale * (0.00028 * rumble - 0.001 * stall)
        top.position.z = TOP_PIVOT_Z + translationScale * 0.00024 * carrier
        top.rotation.x = rotationScale * (0.00076 * rumble - 0.00122 * stall)
        trough.position.y =
          TROUGH_PIVOT_Y +
          translationScale * (0.00018 * carrier - 0.00034 * stall)
        trough.position.z =
          TROUGH_PIVOT_Z +
          translationScale * (0.00058 * rumble - 0.0009 * stall)
        modesty.position.z =
          MODESTY_PIVOT_Z +
          translationScale * (0.00128 * panelRumble - 0.00072 * stall)
        modesty.rotation.x = rotationScale * 0.0017 * panelRumble
        material.cue.emissiveIntensity =
          cueBaseIntensityRef.current +
          0.07 * envelope * (0.35 + 0.65 * Math.abs(rumble)) +
          0.17 * stall
        material.power.emissiveIntensity =
          0.1 + 0.08 * Math.abs(carrier) + 0.16 * stall
        break
      }
      case 'migration': {
        const powerOff = pulse(normalized, 0.03, 0.1, 0.18)
        const cableDraw = pulse(normalized, 0.22, 0.38, 0.56)
        const powerOn = pulse(normalized, 0.5, 0.58, 0.7)
        const settle = dampedOscillation(normalized, 0.55, 1.25, 2.7)
        const online =
          smoothstep((normalized - 0.48) / 0.22) *
          (1 - smoothstep((normalized - 0.92) / 0.08))
        top.position.y =
          TOP_PIVOT_Y +
          translationScale *
            (-0.00042 * powerOff - 0.00034 * powerOn + 0.00018 * settle)
        top.rotation.z =
          rotationScale *
          (0.00024 * powerOff - 0.0003 * powerOn + 0.00016 * settle)
        mat.position.y =
          -surfaceScale * (0.00018 * cableDraw + 0.00008 * Math.abs(settle))
        trough.position.z =
          TROUGH_PIVOT_Z +
          translationScale * (-0.00115 * cableDraw + 0.00038 * settle)
        modesty.position.z =
          MODESTY_PIVOT_Z +
          translationScale * (-0.00062 * cableDraw + 0.0005 * settle)
        modesty.rotation.x = rotationScale * 0.0012 * settle
        material.cue.emissiveIntensity =
          cueBaseIntensityRef.current +
          0.07 * powerOff +
          0.14 * cableDraw +
          0.5 * online
        material.power.emissiveIntensity =
          0.04 + 0.5 * powerOff + 0.34 * cableDraw + 1.35 * online
        break
      }
    }

    if (normalized >= 1) {
      motion.active = false
      resetPose()
    }
  })

  return (
    <group {...groupProps}>
      <group ref={topMotionRef} position={[0, TOP_PIVOT_Y, TOP_PIVOT_Z]}>
        <group position={[0, -TOP_PIVOT_Y, -TOP_PIVOT_Z]}>
          <mesh
            castShadow
            receiveShadow
            geometry={geometry.top}
            material={material.top}
          />
          <mesh
            castShadow
            receiveShadow
            geometry={geometry.apron}
            material={material.modesty}
          />
          <mesh
            castShadow
            receiveShadow
            geometry={geometry.edge}
            material={material.edge}
          />
          <group ref={matMotionRef}>
            <mesh
              castShadow
              receiveShadow
              geometry={geometry.mat}
              material={material.mat}
            />
            <mesh
              receiveShadow
              geometry={geometry.matBorder}
              material={material.modesty}
            />
          </group>
          <mesh
            castShadow
            receiveShadow
            geometry={geometry.cues}
            material={material.cue}
          />
          <mesh
            castShadow
            receiveShadow
            geometry={geometry.grommetOuter}
            material={material.fastener}
          />
          <mesh
            castShadow
            receiveShadow
            geometry={geometry.grommetInner}
            material={material.rubber}
          />
        </group>
      </group>

      <group
        ref={troughMotionRef}
        position={[0, TROUGH_PIVOT_Y, TROUGH_PIVOT_Z]}
      >
        <group position={[0, -TROUGH_PIVOT_Y, -TROUGH_PIVOT_Z]}>
          <mesh
            castShadow
            receiveShadow
            geometry={geometry.cableTrough}
            material={material.frame}
          />
          <mesh
            castShadow
            receiveShadow
            geometry={geometry.powerBlocks}
            material={material.modesty}
          />
          <mesh
            receiveShadow
            geometry={geometry.powerData}
            material={material.fastener}
          />
          <mesh
            castShadow
            geometry={geometry.powerSockets}
            material={material.rubber}
          />
          <mesh geometry={geometry.powerIndicators} material={material.power} />
        </group>
      </group>

      <mesh
        castShadow
        receiveShadow
        geometry={geometry.frame}
        material={material.frame}
      />
      <mesh
        receiveShadow
        geometry={geometry.floorPads}
        material={material.rubber}
      />

      <group
        ref={modestyMotionRef}
        position={[0, MODESTY_PIVOT_Y, MODESTY_PIVOT_Z]}
      >
        <group position={[0, -MODESTY_PIVOT_Y, -MODESTY_PIVOT_Z]}>
          <mesh
            castShadow
            receiveShadow
            geometry={geometry.modestyMounts}
            material={material.frame}
          />
          <mesh
            castShadow
            receiveShadow
            geometry={geometry.modesty}
            material={material.modesty}
          />
          <mesh
            castShadow
            receiveShadow
            geometry={geometry.modestyFasteners}
            material={material.fastener}
          />
        </group>
      </group>
    </group>
  )
}

export default FinanceDesk
