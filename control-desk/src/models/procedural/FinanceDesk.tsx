import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
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
  sideFrontStartZ: number
  wingPeakX: number
  wingPeakZ: number
  cutoutShoulderX: number
  cutoutFrontZ: number
}

type DeskEffect = NonNullable<ProceduralAssetProps['effectPreset']>

type MotionState = {
  active: boolean
  duration: number
  elapsed: number
  preset?: DeskEffect
}

/**
 * Integration datums for props that must contact the authored desk rather than
 * merely sit near it. Values are local to the FinanceDesk root, in meters.
 */
// oxlint-disable-next-line react/only-export-components -- scene integration reads this co-located asset contract.
export const FINANCE_DESK_CONTRACT = Object.freeze({
  dimensions: Object.freeze([2.5, 0.78, 1.18] as const),
  overallBounds: Object.freeze({
    x: Object.freeze([-1.25, 1.25] as const),
    y: Object.freeze([0, 0.794] as const),
    z: Object.freeze([-0.48, 0.7] as const),
  }),
  grommets: Object.freeze({
    center: Object.freeze([0, 0.782, -0.395] as const),
    left: Object.freeze([-0.78, 0.782, -0.395] as const),
    right: Object.freeze([0.78, 0.782, -0.395] as const),
  }),
  surfaceY: 0.78,
  operatorEdge: Object.freeze({
    centerZ: 0.35,
    cutoutDepth: 0.35,
    shoulderX: 0.6,
    wingPeakX: 0.92,
    wingPeakZ: 0.7,
  }),
  kneeClearance: Object.freeze({
    x: Object.freeze([-0.86, 0.86] as const),
    y: Object.freeze([0.062, 0.696] as const),
    z: Object.freeze([-0.28, 0.28] as const),
  }),
  usableBounds: Object.freeze({
    x: Object.freeze([-1.2, 1.2] as const),
    z: Object.freeze([-0.45, 0.65] as const),
  }),
  zones: Object.freeze({
    manual: Object.freeze({
      x: Object.freeze([-1.2, -0.6] as const),
      z: Object.freeze([-0.24, 0.62] as const),
    }),
    input: Object.freeze({
      x: Object.freeze([-0.58, 0.58] as const),
      z: Object.freeze([-0.24, 0.32] as const),
    }),
    decision: Object.freeze({
      x: Object.freeze([0.6, 1.2] as const),
      z: Object.freeze([-0.24, 0.62] as const),
    }),
    rearService: Object.freeze({
      x: Object.freeze([-1.2, 1.2] as const),
      z: Object.freeze([-0.45, -0.255] as const),
    }),
  }),
  wingPlacementArc: Object.freeze([
    Object.freeze({ absX: 0.6, maxZ: 0.34 }),
    Object.freeze({ absX: 0.72, maxZ: 0.43 }),
    Object.freeze({ absX: 0.82, maxZ: 0.54 }),
    Object.freeze({ absX: 0.94, maxZ: 0.63 }),
    Object.freeze({ absX: 1.08, maxZ: 0.55 }),
    Object.freeze({ absX: 1.16, maxZ: 0.4 }),
  ] as const),
})

const TOP_PIVOT_Y = 0.748
const TOP_PIVOT_Z = -0.03
const TROUGH_PIVOT_Y = 0.655
const TROUGH_PIVOT_Z = -0.395
const MODESTY_PIVOT_Y = 0.45
const MODESTY_PIVOT_Z = -0.405

const EFFECT_DURATIONS: Readonly<Record<DeskEffect, number>> = {
  'paper-drop': 0.34,
  approve: 0.48,
  reject: 0.5,
  fraud: 0.76,
  'printer-jam': 0.88,
  migration: 0.82,
}

const EDGE_PROFILE: Readonly<DeskProfile> = Object.freeze({
  halfWidth: 1.244,
  rearZ: -0.474,
  sideFrontStartZ: 0.19,
  wingPeakX: 0.92,
  wingPeakZ: 0.694,
  cutoutShoulderX: 0.6,
  cutoutFrontZ: 0.344,
})

const TOP_PROFILE: Readonly<DeskProfile> = Object.freeze({
  halfWidth: 1.218,
  rearZ: -0.448,
  sideFrontStartZ: 0.184,
  wingPeakX: 0.908,
  wingPeakZ: 0.668,
  cutoutShoulderX: 0.585,
  cutoutFrontZ: 0.334,
})

const APRON_PROFILE: Readonly<DeskProfile> = Object.freeze({
  halfWidth: 1.184,
  rearZ: -0.418,
  sideFrontStartZ: 0.174,
  wingPeakX: 0.892,
  wingPeakZ: 0.628,
  cutoutShoulderX: 0.56,
  cutoutFrontZ: 0.295,
})

const EDGE_WEAR_PARTS: readonly RoundedPart[] = [
  {
    size: [0.19, 0.008, 0.004],
    position: [-0.92, 0.744, 0.697],
    radius: 0.0015,
  },
  {
    size: [0.14, 0.007, 0.004],
    position: [0.91, 0.743, 0.697],
    radius: 0.0015,
  },
  {
    size: [0.25, 0.006, 0.004],
    position: [0.08, 0.741, 0.348],
    radius: 0.0015,
  },
]

const MAT_PARTS: readonly RoundedPart[] = [
  {
    size: [1.06, 0.0045, 0.34],
    position: [0, 0.783, 0.145],
    radius: 0.026,
  },
]

const MAT_BORDER_PARTS: readonly RoundedPart[] = [
  {
    size: [1.088, 0.003, 0.009],
    position: [0, 0.7827, -0.029],
    radius: 0.002,
  },
  {
    size: [1.088, 0.003, 0.009],
    position: [0, 0.7827, 0.319],
    radius: 0.002,
  },
  {
    size: [0.009, 0.003, 0.34],
    position: [-0.544, 0.7827, 0.145],
    radius: 0.002,
  },
  {
    size: [0.009, 0.003, 0.34],
    position: [0.544, 0.7827, 0.145],
    radius: 0.002,
  },
]

const WORKFLOW_CUE_PARTS: readonly RoundedPart[] = [
  // The center bay remains rectangular and deliberately stops behind the
  // operator cutout. Side cues then follow the horseshoe reach arc.
  {
    size: [0.012, 0.004, 0.56],
    position: [-0.585, 0.783, 0.04],
    radius: 0.0015,
  },
  {
    size: [0.58, 0.004, 0.012],
    position: [-0.89, 0.783, -0.234],
    radius: 0.0015,
  },
  {
    size: [0.205, 0.004, 0.012],
    position: [-0.7, 0.783, 0.44],
    rotation: [0, 0.78, 0],
    radius: 0.0015,
  },
  {
    size: [0.19, 0.004, 0.012],
    position: [-0.85, 0.783, 0.575],
    rotation: [0, 0.62, 0],
    radius: 0.0015,
  },
  {
    size: [0.2, 0.004, 0.012],
    position: [-1, 0.783, 0.585],
    rotation: [0, -0.5, 0],
    radius: 0.0015,
  },
  {
    size: [0.012, 0.004, 0.56],
    position: [0.585, 0.783, 0.04],
    radius: 0.0015,
  },
  {
    size: [0.58, 0.004, 0.012],
    position: [0.89, 0.783, -0.234],
    radius: 0.0015,
  },
  {
    size: [0.205, 0.004, 0.012],
    position: [0.7, 0.783, 0.44],
    rotation: [0, -0.78, 0],
    radius: 0.0015,
  },
  {
    size: [0.19, 0.004, 0.012],
    position: [0.85, 0.783, 0.575],
    rotation: [0, -0.62, 0],
    radius: 0.0015,
  },
  {
    size: [0.2, 0.004, 0.012],
    position: [1, 0.783, 0.585],
    rotation: [0, 0.5, 0],
    radius: 0.0015,
  },
  // Rear datum keeps monitor feet and the printer out of the document field.
  {
    size: [2.28, 0.004, 0.012],
    position: [0, 0.783, -0.255],
    radius: 0.0015,
  },
  // A centered input outline preserves a keyboard and mouse landing zone.
  {
    size: [1.14, 0.004, 0.01],
    position: [0, 0.783, -0.238],
    radius: 0.0015,
  },
  {
    size: [1.14, 0.004, 0.01],
    position: [0, 0.783, -0.048],
    radius: 0.0015,
  },
  {
    size: [0.01, 0.004, 0.18],
    position: [-0.565, 0.783, -0.143],
    radius: 0.0015,
  },
  {
    size: [0.01, 0.004, 0.18],
    position: [0.565, 0.783, -0.143],
    radius: 0.0015,
  },
]

const REAR_SERVICE_PARTS: readonly RoundedPart[] = [
  {
    size: [2.28, 0.006, 0.16],
    position: [0, 0.7825, -0.39],
    radius: 0.018,
  },
  {
    size: [2.28, 0.016, 0.02],
    position: [0, 0.786, -0.465],
    radius: 0.009,
  },
]

const CABLE_TROUGH_PARTS: readonly RoundedPart[] = [
  {
    size: [1.94, 0.018, 0.15],
    position: [0, 0.625, -0.395],
    radius: 0.006,
  },
  {
    size: [1.94, 0.06, 0.016],
    position: [0, 0.655, -0.32],
    radius: 0.004,
  },
  {
    size: [1.94, 0.06, 0.016],
    position: [0, 0.655, -0.47],
    radius: 0.004,
  },
  {
    size: [0.016, 0.06, 0.15],
    position: [-0.962, 0.655, -0.395],
    radius: 0.004,
  },
  {
    size: [0.016, 0.06, 0.15],
    position: [0.962, 0.655, -0.395],
    radius: 0.004,
  },
]

const POWER_BLOCK_PARTS: readonly RoundedPart[] = [
  {
    size: [0.32, 0.046, 0.075],
    position: [-0.48, 0.655, -0.35],
    radius: 0.009,
  },
  {
    size: [0.32, 0.046, 0.075],
    position: [0.48, 0.655, -0.35],
    radius: 0.009,
  },
]

const POWER_DATA_PARTS: readonly RoundedPart[] = [
  {
    size: [0.038, 0.023, 0.006],
    position: [-0.38, 0.655, -0.309],
    radius: 0.003,
  },
  {
    size: [0.038, 0.023, 0.006],
    position: [0.38, 0.655, -0.309],
    radius: 0.003,
  },
]

const FRAME_PARTS: readonly RoundedPart[] = [
  // Full-depth floor skids carry the long wraparound wings without placing
  // structure inside the operator's knee bay.
  {
    size: [0.115, 0.05, 1],
    position: [-1.03, 0.037, 0.02],
    radius: 0.015,
  },
  {
    size: [0.115, 0.05, 1],
    position: [1.03, 0.037, 0.02],
    radius: 0.015,
  },
  {
    size: [0.085, 0.62, 0.085],
    position: [-1.03, 0.37, -0.31],
    radius: 0.018,
  },
  {
    size: [0.085, 0.62, 0.085],
    position: [1.03, 0.37, -0.31],
    radius: 0.018,
  },
  {
    size: [0.11, 0.055, 0.98],
    position: [-1.03, 0.6885, 0.015],
    radius: 0.014,
  },
  {
    size: [0.11, 0.055, 0.98],
    position: [1.03, 0.6885, 0.015],
    radius: 0.014,
  },
  // Rear beam supports the modesty panel and the managed cable channel.
  {
    size: [2.14, 0.07, 0.08],
    position: [0, 0.681, -0.36],
    radius: 0.014,
  },
  // Gussets make the cantilever construction legible from profile views.
  {
    size: [0.065, 0.22, 0.065],
    position: [-1.03, 0.59, -0.245],
    rotation: [0.6, 0, 0],
    radius: 0.014,
  },
  {
    size: [0.065, 0.22, 0.065],
    position: [1.03, 0.59, -0.245],
    rotation: [0.6, 0, 0],
    radius: 0.014,
  },
  // Four hangers touch the desktop underside and the trough base.
  ...[-0.82, -0.28, 0.28, 0.82].map((x) => ({
    size: [0.042, 0.084, 0.06] as const,
    position: [x, 0.674, -0.395] as const,
    radius: 0.009,
  })),
  // Closed raceway overlaps the trough and the left floor skid.
  {
    size: [0.052, 0.56, 0.045],
    position: [-0.96, 0.365, -0.395],
    radius: 0.011,
  },
  {
    size: [0.08, 0.08, 0.08],
    position: [-0.96, 0.09, -0.395],
    radius: 0.012,
  },
]

const FLOOR_PAD_PARTS: readonly RoundedPart[] = [
  {
    size: [0.11, 0.012, 0.11],
    position: [-1.03, 0.006, -0.405],
    radius: 0.005,
  },
  {
    size: [0.11, 0.012, 0.11],
    position: [-1.03, 0.006, 0.445],
    radius: 0.005,
  },
  {
    size: [0.11, 0.012, 0.11],
    position: [1.03, 0.006, -0.405],
    radius: 0.005,
  },
  {
    size: [0.11, 0.012, 0.11],
    position: [1.03, 0.006, 0.445],
    radius: 0.005,
  },
]

const MODESTY_SHELL_PARTS: readonly RoundedPart[] = [
  {
    size: [1.92, 0.33, 0.024],
    position: [0, 0, 0],
    radius: 0.022,
  },
]

const MODESTY_INSERT_PARTS: readonly RoundedPart[] = [
  {
    size: [0.42, 0.265, 0.009],
    position: [-0.72, 0, 0.0165],
    radius: 0.012,
  },
  {
    size: [0.42, 0.265, 0.009],
    position: [-0.24, 0, 0.0165],
    radius: 0.012,
  },
  {
    size: [0.42, 0.265, 0.009],
    position: [0.24, 0, 0.0165],
    radius: 0.012,
  },
  {
    size: [0.42, 0.265, 0.009],
    position: [0.72, 0, 0.0165],
    radius: 0.012,
  },
]

const MODESTY_MOUNT_PARTS: readonly RoundedPart[] = [
  {
    size: [0.055, 0.11, 0.05],
    position: [-0.82, 0.22, 0.01],
    radius: 0.008,
  },
  {
    size: [0.055, 0.11, 0.05],
    position: [-0.3, 0.22, 0.01],
    radius: 0.008,
  },
  {
    size: [0.055, 0.11, 0.05],
    position: [0.3, 0.22, 0.01],
    radius: 0.008,
  },
  {
    size: [0.055, 0.11, 0.05],
    position: [0.82, 0.22, 0.01],
    radius: 0.008,
  },
]

const GROMMET_OUTER_PARTS: readonly CylinderPart[] = [
  { radius: 0.043, height: 0.008, position: FINANCE_DESK_CONTRACT.grommets.left, segments: 28 },
  { radius: 0.043, height: 0.008, position: FINANCE_DESK_CONTRACT.grommets.center, segments: 28 },
  { radius: 0.043, height: 0.008, position: FINANCE_DESK_CONTRACT.grommets.right, segments: 28 },
]

const GROMMET_INNER_PARTS: readonly CylinderPart[] = [
  { radius: 0.029, height: 0.008, position: [-0.78, 0.787, -0.395], segments: 28 },
  { radius: 0.029, height: 0.008, position: [0, 0.787, -0.395], segments: 28 },
  { radius: 0.029, height: 0.008, position: [0.78, 0.787, -0.395], segments: 28 },
  { radius: 0.032, height: 0.064, position: [-0.78, 0.694, -0.395], segments: 20 },
  { radius: 0.032, height: 0.064, position: [0, 0.694, -0.395], segments: 20 },
  { radius: 0.032, height: 0.064, position: [0.78, 0.694, -0.395], segments: 20 },
]

const POWER_SOCKET_PARTS: readonly CylinderPart[] = [
  { radius: 0.013, height: 0.006, position: [-0.57, 0.655, -0.309], rotation: [Math.PI / 2, 0, 0], segments: 20 },
  { radius: 0.013, height: 0.006, position: [-0.48, 0.655, -0.309], rotation: [Math.PI / 2, 0, 0], segments: 20 },
  { radius: 0.013, height: 0.006, position: [0.48, 0.655, -0.309], rotation: [Math.PI / 2, 0, 0], segments: 20 },
  { radius: 0.013, height: 0.006, position: [0.57, 0.655, -0.309], rotation: [Math.PI / 2, 0, 0], segments: 20 },
]

const POWER_INDICATOR_PARTS: readonly CylinderPart[] = [
  { radius: 0.006, height: 0.006, position: [-0.67, 0.655, -0.309], rotation: [Math.PI / 2, 0, 0], segments: 16 },
  { radius: 0.006, height: 0.006, position: [0.67, 0.655, -0.309], rotation: [Math.PI / 2, 0, 0], segments: 16 },
]

const MODESTY_FASTENER_PARTS: readonly CylinderPart[] = [
  {
    radius: 0.011,
    height: 0.007,
    position: [-0.86, -0.13, 0.021],
    rotation: [Math.PI / 2, 0, 0],
    segments: 16,
  },
  {
    radius: 0.011,
    height: 0.007,
    position: [-0.29, -0.13, 0.021],
    rotation: [Math.PI / 2, 0, 0],
    segments: 16,
  },
  {
    radius: 0.011,
    height: 0.007,
    position: [0.29, -0.13, 0.021],
    rotation: [Math.PI / 2, 0, 0],
    segments: 16,
  },
  {
    radius: 0.011,
    height: 0.007,
    position: [0.86, -0.13, 0.021],
    rotation: [Math.PI / 2, 0, 0],
    segments: 16,
  },
  {
    radius: 0.011,
    height: 0.007,
    position: [-0.86, 0.13, 0.021],
    rotation: [Math.PI / 2, 0, 0],
    segments: 16,
  },
  {
    radius: 0.011,
    height: 0.007,
    position: [-0.29, 0.13, 0.021],
    rotation: [Math.PI / 2, 0, 0],
    segments: 16,
  },
  {
    radius: 0.011,
    height: 0.007,
    position: [0.29, 0.13, 0.021],
    rotation: [Math.PI / 2, 0, 0],
    segments: 16,
  },
  {
    radius: 0.011,
    height: 0.007,
    position: [0.86, 0.13, 0.021],
    rotation: [Math.PI / 2, 0, 0],
    segments: 16,
  },
]

function makeDeskProfileShape(profile: Readonly<DeskProfile>) {
  const shape = new Shape()
  const rearShoulderX = profile.halfWidth - 0.105

  shape.moveTo(-rearShoulderX, profile.rearZ)
  shape.lineTo(rearShoulderX, profile.rearZ)
  shape.bezierCurveTo(
    profile.halfWidth - 0.035,
    profile.rearZ,
    profile.halfWidth,
    profile.rearZ + 0.038,
    profile.halfWidth,
    profile.rearZ + 0.11,
  )
  shape.lineTo(profile.halfWidth, profile.sideFrontStartZ)
  shape.bezierCurveTo(
    profile.halfWidth,
    profile.sideFrontStartZ + 0.145,
    profile.halfWidth - 0.075,
    profile.wingPeakZ - 0.02,
    profile.wingPeakX,
    profile.wingPeakZ,
  )
  shape.bezierCurveTo(
    profile.wingPeakX - 0.13,
    profile.wingPeakZ,
    profile.cutoutShoulderX + 0.12,
    profile.cutoutFrontZ + 0.035,
    profile.cutoutShoulderX,
    profile.cutoutFrontZ + 0.015,
  )
  shape.bezierCurveTo(
    profile.cutoutShoulderX - 0.16,
    profile.cutoutFrontZ,
    0.16,
    profile.cutoutFrontZ,
    0,
    profile.cutoutFrontZ,
  )
  shape.bezierCurveTo(
    -0.16,
    profile.cutoutFrontZ,
    -profile.cutoutShoulderX + 0.16,
    profile.cutoutFrontZ,
    -profile.cutoutShoulderX,
    profile.cutoutFrontZ + 0.015,
  )
  shape.bezierCurveTo(
    -profile.cutoutShoulderX - 0.12,
    profile.cutoutFrontZ + 0.035,
    -profile.wingPeakX + 0.13,
    profile.wingPeakZ,
    -profile.wingPeakX,
    profile.wingPeakZ,
  )
  shape.bezierCurveTo(
    -profile.halfWidth + 0.075,
    profile.wingPeakZ - 0.02,
    -profile.halfWidth,
    profile.sideFrontStartZ + 0.145,
    -profile.halfWidth,
    profile.sideFrontStartZ,
  )
  shape.lineTo(-profile.halfWidth, profile.rearZ + 0.11)
  shape.bezierCurveTo(
    -profile.halfWidth,
    profile.rearZ + 0.038,
    -profile.halfWidth + 0.035,
    profile.rearZ,
    -rearShoulderX,
    profile.rearZ,
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
  const bevelThickness = bevelSize
  const geometry = new ExtrudeGeometry(makeDeskProfileShape(profile), {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize,
    bevelThickness,
    curveSegments: 18,
    depth: totalThickness - bevelThickness * 2,
    steps: 1,
  })

  // ExtrudeGeometry builds in XY and extrudes along +Z. This turns its shape-Y
  // into desk depth and sends the extrusion downward from the authored top Y.
  geometry.rotateX(Math.PI / 2)
  geometry.translate(0, topY - bevelThickness, 0)
  geometry.computeVertexNormals()

  return geometry
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
 * Premium finance-operations workstation, modeled in meters.
 * Overall worktop: 2.50 W x 1.18 D with its finished surface at y=0.78.
 * Base is y=0 and the seated operator approaches from +z. The rear service
 * strip and the left/manual, center/inspection, and right/decision zones are
 * built in.
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
  const cueBaseIntensityRef = useRef(selected ? 0.2 : 0.08)
  const motionRef = useRef<MotionState>({
    active: false,
    duration: 0,
    elapsed: 0,
  })

  const geometry = useMemo(
    () => ({
      apron: setShadowFlags(
        extrudeDeskProfile(APRON_PROFILE, 0.042, 0.74, 0.005),
      ),
      cableTrough: setShadowFlags(mergeRoundedParts(CABLE_TROUGH_PARTS)),
      cues: setShadowFlags(mergeRoundedParts(WORKFLOW_CUE_PARTS)),
      edge: setShadowFlags(
        extrudeDeskProfile(EDGE_PROFILE, 0.054, 0.772, 0.006),
      ),
      edgeWear: setShadowFlags(mergeRoundedParts(EDGE_WEAR_PARTS)),
      floorPads: setShadowFlags(mergeRoundedParts(FLOOR_PAD_PARTS)),
      frame: setShadowFlags(mergeRoundedParts(FRAME_PARTS)),
      grommetInner: setShadowFlags(mergeCylinderParts(GROMMET_INNER_PARTS)),
      grommetOuter: setShadowFlags(mergeCylinderParts(GROMMET_OUTER_PARTS)),
      mat: setShadowFlags(mergeRoundedParts(MAT_PARTS)),
      matBorder: setShadowFlags(mergeRoundedParts(MAT_BORDER_PARTS)),
      modestyFasteners: setShadowFlags(mergeCylinderParts(MODESTY_FASTENER_PARTS)),
      modestyInserts: setShadowFlags(mergeRoundedParts(MODESTY_INSERT_PARTS)),
      modestyMounts: setShadowFlags(mergeRoundedParts(MODESTY_MOUNT_PARTS)),
      modestyShell: setShadowFlags(mergeRoundedParts(MODESTY_SHELL_PARTS)),
      powerBlocks: setShadowFlags(mergeRoundedParts(POWER_BLOCK_PARTS)),
      powerData: setShadowFlags(mergeRoundedParts(POWER_DATA_PARTS)),
      powerIndicators: setShadowFlags(mergeCylinderParts(POWER_INDICATOR_PARTS)),
      powerSockets: setShadowFlags(mergeCylinderParts(POWER_SOCKET_PARTS)),
      rearService: setShadowFlags(mergeRoundedParts(REAR_SERVICE_PARTS)),
      top: setShadowFlags(
        extrudeDeskProfile(TOP_PROFILE, 0.036, 0.78, 0.006),
      ),
    }),
    [],
  )

  const material = useMemo(() => {
    const cue = new MeshStandardMaterial({
      color: '#9a8257',
      emissive: '#5e4825',
      emissiveIntensity: 0.08,
      metalness: 0.48,
      roughness: 0.36,
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
        clearcoat: 0.12,
        clearcoatRoughness: 0.7,
        color: '#54483e',
        metalness: 0.02,
        roughness: 0.45,
      }),
      edgeWear: new MeshStandardMaterial({
        color: '#716256',
        metalness: 0.01,
        roughness: 0.58,
      }),
      fabric: new MeshStandardMaterial({
        color: '#35413e',
        metalness: 0,
        roughness: 0.9,
      }),
      fastener: new MeshStandardMaterial({
        color: '#8c8d87',
        metalness: 0.78,
        roughness: 0.3,
      }),
      frame: new MeshStandardMaterial({
        color: '#202625',
        metalness: 0.62,
        roughness: 0.32,
      }),
      mat: new MeshStandardMaterial({
        color: '#243130',
        metalness: 0.02,
        roughness: 0.76,
      }),
      modesty: new MeshStandardMaterial({
        color: '#2a302f',
        metalness: 0.28,
        roughness: 0.52,
      }),
      power,
      rubber: new MeshStandardMaterial({
        color: '#171a19',
        metalness: 0,
        roughness: 0.82,
      }),
      top: new MeshPhysicalMaterial({
        clearcoat: 0.16,
        clearcoatRoughness: 0.62,
        color: '#695b4f',
        metalness: 0.015,
        roughness: 0.47,
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
    cueBaseIntensityRef.current = selected ? 0.2 : 0.08
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

    if (!motion.active || !motion.preset || !top || !mat || !trough || !modesty) {
      return
    }

    motion.elapsed += Math.min(delta, 0.05)
    const normalized = Math.min(1, motion.elapsed / motion.duration)
    const translationScale = reducedMotion ? 0.3 : 1
    const rotationScale = reducedMotion ? 0.16 : 1
    const surfaceScale = reducedMotion ? 0.55 : 1

    switch (motion.preset) {
      case 'paper-drop': {
        // A sheet only compresses the leather desk mat; it cannot shake the frame.
        const contact = pulse(normalized, 0.02, 0.14, 0.3)
        const settle = Math.abs(dampedOscillation(normalized, 0.12, 1.5, 2.8))
        mat.position.y = -surfaceScale * (0.00042 * contact + 0.00011 * settle)
        material.cue.emissiveIntensity = cueBaseIntensityRef.current + 0.06 * contact
        break
      }
      case 'approve': {
        // A centered, weighty stamp load flexes the right side once, then settles cleanly.
        const cueLead = pulse(normalized, 0, 0.12, 0.25)
        const contact = pulse(normalized, 0.18, 0.27, 0.41)
        const settle = dampedOscillation(normalized, 0.26, 1.4, 2.6)
        top.position.y = TOP_PIVOT_Y + translationScale * (-0.00115 * contact + 0.00025 * settle)
        top.rotation.z = rotationScale * (-0.00068 * contact + 0.00024 * settle)
        modesty.position.z = MODESTY_PIVOT_Z + translationScale * 0.00072 * settle
        modesty.rotation.x = rotationScale * 0.00105 * settle
        material.cue.emissiveIntensity = cueBaseIntensityRef.current + 0.16 * cueLead + 0.12 * contact
        break
      }
      case 'reject': {
        // The sharper reject stroke shears across the worktop and clicks the rear panel.
        const cueLead = pulse(normalized, 0, 0.08, 0.2)
        const contact = pulse(normalized, 0.14, 0.21, 0.32)
        const snap = dampedOscillation(normalized, 0.2, 2.35, 2.5)
        const panelClick = pulse(normalized, 0.34, 0.4, 0.5)
        top.position.x = translationScale * (-0.00072 * contact + 0.00042 * snap)
        top.position.y = TOP_PIVOT_Y + translationScale * (-0.00092 * contact + 0.00018 * snap)
        top.rotation.y = rotationScale * (0.00078 * contact - 0.00038 * snap)
        modesty.position.z = MODESTY_PIVOT_Z + translationScale * (0.00105 * snap - 0.00048 * panelClick)
        modesty.rotation.z = rotationScale * 0.0015 * snap
        material.cue.emissiveIntensity = cueBaseIntensityRef.current + 0.13 * cueLead + 0.24 * contact + 0.08 * panelClick
        break
      }
      case 'fraud': {
        // The heaviest stamp twists the right rail and excites the modesty panel at low frequency.
        const cueLead = pulse(normalized, 0, 0.15, 0.28)
        const contact = pulse(normalized, 0.2, 0.29, 0.44)
        const ring = dampedOscillation(normalized, 0.28, 1.8, 2.1)
        const aftershock = pulse(normalized, 0.53, 0.6, 0.72)
        top.position.y = TOP_PIVOT_Y + translationScale * (-0.0021 * contact + 0.00052 * ring - 0.00034 * aftershock)
        top.rotation.x = rotationScale * (0.00072 * contact - 0.0003 * ring)
        top.rotation.z = rotationScale * (-0.00155 * contact + 0.00068 * ring)
        trough.position.z = TROUGH_PIVOT_Z + translationScale * (-0.00072 * contact + 0.00048 * ring)
        modesty.position.z = MODESTY_PIVOT_Z + translationScale * (-0.0024 * contact + 0.0022 * ring - 0.00065 * aftershock)
        modesty.rotation.x = rotationScale * (0.0032 * ring + 0.0014 * aftershock)
        material.cue.emissiveIntensity = cueBaseIntensityRef.current + 0.16 * cueLead + 0.5 * contact + 0.2 * Math.abs(ring) + 0.12 * aftershock
        break
      }
      case 'printer-jam': {
        // Rear-mounted printer torque reaches the service rail first, with a hard stall near mid-cycle.
        const spinUp = smoothstep(normalized / 0.13)
        const shutDown = 1 - smoothstep((normalized - 0.72) / 0.2)
        const envelope = spinUp * shutDown
        const rumble = Math.sin(normalized * Math.PI * 22) * envelope
        const carrier = Math.sin(normalized * Math.PI * 35 + 0.4) * envelope
        const panelRumble = Math.sin(normalized * Math.PI * 8 + 0.7) * envelope
        const stall = pulse(normalized, 0.42, 0.53, 0.69)
        top.position.y = TOP_PIVOT_Y + translationScale * (0.00028 * rumble - 0.001 * stall)
        top.position.z = TOP_PIVOT_Z + translationScale * 0.00024 * carrier
        top.rotation.x = rotationScale * (0.00076 * rumble - 0.00122 * stall)
        trough.position.y = TROUGH_PIVOT_Y + translationScale * (0.00018 * carrier - 0.00034 * stall)
        trough.position.z = TROUGH_PIVOT_Z + translationScale * (0.00058 * rumble - 0.0009 * stall)
        modesty.position.z = MODESTY_PIVOT_Z + translationScale * (0.00128 * panelRumble - 0.00072 * stall)
        modesty.rotation.x = rotationScale * 0.0017 * panelRumble
        material.cue.emissiveIntensity = cueBaseIntensityRef.current + 0.07 * envelope * (0.35 + 0.65 * Math.abs(rumble)) + 0.17 * stall
        material.power.emissiveIntensity = 0.1 + 0.08 * Math.abs(carrier) + 0.16 * stall
        break
      }
      case 'migration': {
        // Two power-relay impulses tug the managed cable path before the surface settles into calm.
        const powerOff = pulse(normalized, 0.03, 0.1, 0.18)
        const cableDraw = pulse(normalized, 0.22, 0.38, 0.56)
        const powerOn = pulse(normalized, 0.5, 0.58, 0.7)
        const settle = dampedOscillation(normalized, 0.55, 1.25, 2.7)
        const online = smoothstep((normalized - 0.48) / 0.22) * (1 - smoothstep((normalized - 0.92) / 0.08))
        top.position.y = TOP_PIVOT_Y + translationScale * (-0.00042 * powerOff - 0.00034 * powerOn + 0.00018 * settle)
        top.rotation.z = rotationScale * (0.00024 * powerOff - 0.0003 * powerOn + 0.00016 * settle)
        mat.position.y = -surfaceScale * (0.00018 * cableDraw + 0.00008 * Math.abs(settle))
        trough.position.z = TROUGH_PIVOT_Z + translationScale * (-0.00115 * cableDraw + 0.00038 * settle)
        modesty.position.z = MODESTY_PIVOT_Z + translationScale * (-0.00062 * cableDraw + 0.0005 * settle)
        modesty.rotation.x = rotationScale * 0.0012 * settle
        material.cue.emissiveIntensity = cueBaseIntensityRef.current + 0.07 * powerOff + 0.14 * cableDraw + 0.5 * online
        material.power.emissiveIntensity = 0.04 + 0.5 * powerOff + 0.34 * cableDraw + 1.35 * online
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
          <mesh
            castShadow
            receiveShadow
            geometry={geometry.edgeWear}
            material={material.edgeWear}
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
            geometry={geometry.rearService}
            material={material.modesty}
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

      <group ref={troughMotionRef} position={[0, TROUGH_PIVOT_Y, TROUGH_PIVOT_Z]}>
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
          <mesh
            geometry={geometry.powerIndicators}
            material={material.power}
          />
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
        <mesh
          castShadow
          receiveShadow
          geometry={geometry.modestyMounts}
          material={material.frame}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={geometry.modestyShell}
          material={material.modesty}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={geometry.modestyInserts}
          material={material.fabric}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={geometry.modestyFasteners}
          material={material.fastener}
        />
      </group>
    </group>
  )
}

export default FinanceDesk
