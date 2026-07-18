import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { useLabStore } from '../../store/useLabStore'
import type { ProceduralAssetProps } from '../types'

type RoomEffect = NonNullable<ProceduralAssetProps['effectPreset']>

type MotionState = {
  active: boolean
  duration: number
  elapsed: number
  preset?: RoomEffect
}

type RoomGeometry = {
  accentCove: THREE.BufferGeometry
  alarmLens: THREE.BufferGeometry
  baseboards: THREE.BufferGeometry
  ceilingGrid: THREE.BufferGeometry
  ceilingStructure: THREE.BufferGeometry
  ceilingTiles: THREE.BufferGeometry
  clockFace: THREE.BufferGeometry
  clockHands: THREE.BufferGeometry
  decorFrames: THREE.BufferGeometry
  decorGrounds: THREE.BufferGeometry
  decorGraphics: THREE.BufferGeometry
  doorHardware: THREE.BufferGeometry
  doorLeaf: THREE.BufferGeometry
  doorPanelInlays: THREE.BufferGeometry
  extinguisher: THREE.BufferGeometry
  extinguisherHardware: THREE.BufferGeometry
  fasteners: THREE.BufferGeometry
  floor: THREE.BufferGeometry
  floorInlays: THREE.BufferGeometry
  frontFixtureDiffuser: THREE.BufferGeometry
  frontFixtureHousing: THREE.BufferGeometry
  gasket: THREE.BufferGeometry
  looseTile: THREE.BufferGeometry
  serviceSweep: THREE.BufferGeometry
  staticDiffusers: THREE.BufferGeometry
  staticLightHousings: THREE.BufferGeometry
  storageBodies: THREE.BufferGeometry
  storageFaces: THREE.BufferGeometry
  trim: THREE.BufferGeometry
  walls: THREE.BufferGeometry
}

type RoomMaterials = {
  accent: THREE.MeshStandardMaterial
  alarm: THREE.MeshStandardMaterial
  ceilingGrid: THREE.MeshStandardMaterial
  ceilingTile: THREE.MeshStandardMaterial
  clockFace: THREE.MeshPhysicalMaterial
  decorInk: THREE.MeshStandardMaterial
  diffuser: THREE.MeshStandardMaterial
  door: THREE.MeshPhysicalMaterial
  extinguisher: THREE.MeshPhysicalMaterial
  floor: THREE.MeshPhysicalMaterial
  floorInlay: THREE.MeshStandardMaterial
  gasket: THREE.MeshStandardMaterial
  hardware: THREE.MeshStandardMaterial
  housing: THREE.MeshStandardMaterial
  poster: THREE.MeshPhysicalMaterial
  storage: THREE.MeshPhysicalMaterial
  sweep: THREE.MeshBasicMaterial
  trim: THREE.MeshPhysicalMaterial
  wall: THREE.MeshPhysicalMaterial
}

/**
 * Room-scale placement contract in meters.
 *
 * The operator occupies the open +Z edge and looks toward -Z. The floor datum
 * starts at y=0 and its finished surface is y=.07, matching the corridor floor
 * in OfficeServiceWindow when that asset is rooted at `serviceWindowRoot`.
 * The service module owns all central rear glazing, corridor/elevator scenery,
 * exterior sky, and the protected giraffe rise column; this shell only frames
 * its 5.8 m-wide interface with non-overlapping side-wing returns.
 */
// oxlint-disable-next-line react/only-export-components -- scene integration reads this co-located asset contract.
export const OFFICE_ROOM_SHELL_CONTRACT = Object.freeze({
  anchors: Object.freeze({
    cabinets: Object.freeze({
      left: Object.freeze([-3.55, 0.07, -1.45] as const),
      right: Object.freeze([3.55, 0.07, -0.7] as const),
    }),
    decor: Object.freeze({
      clock: Object.freeze([3.55, 2.28, -4.57] as const),
      extinguisher: Object.freeze([3.7, 0.3, -4.54] as const),
      leftPosterRail: Object.freeze([-4.055, 1.62, -0.72] as const),
      rightPosterRail: Object.freeze([4.055, 1.62, 0.44] as const),
    }),
    desk: Object.freeze([0, 0.07, 0.12] as const),
    door: Object.freeze({
      center: Object.freeze([4.14, 1.2, -2.85] as const),
      clearBounds: Object.freeze({
        max: Object.freeze([4.24, 2.32, -2.2] as const),
        min: Object.freeze([4.04, 0.07, -3.5] as const),
      }),
      exitDirection: '+X',
    }),
    giraffeReveal: Object.freeze({
      anchor: Object.freeze([0.76, 0, -6.88] as const),
      ownedBy: 'OfficeServiceWindow',
      protectedColumn: Object.freeze({
        max: Object.freeze([1.38, 2.85, -6.78] as const),
        min: Object.freeze([0.2, 0, -6.98] as const),
      }),
    }),
    plants: Object.freeze({
      left: Object.freeze([-3.48, 0.07, -3.55] as const),
      right: Object.freeze([3.45, 0.07, 0.72] as const),
    }),
    serviceOpening: Object.freeze({
      clearBounds: Object.freeze({
        max: Object.freeze([1.64, 2.66, -4.52] as const),
        min: Object.freeze([-1.64, 1.08, -4.86] as const),
      }),
      root: Object.freeze([0, 0, -4.66] as const),
    }),
    serviceWindowRoot: Object.freeze([0, 0, -4.66] as const),
  }),
  axes: Object.freeze({ forward: '-Z', operator: '+Z', up: '+Y' }),
  dimensions: Object.freeze([8.4, 3.24, 7.2] as const),
  envelope: Object.freeze({
    max: Object.freeze([4.2, 3.24, 2.4] as const),
    min: Object.freeze([-4.2, 0, -4.8] as const),
  }),
  finishedFloorY: 0.07,
  openCameraZone: Object.freeze({
    max: Object.freeze([3.85, 2.86, 2.4] as const),
    min: Object.freeze([-3.85, 0.07, 0.95] as const),
  }),
  serviceModuleInterface: Object.freeze({
    clearBounds: Object.freeze({
      max: Object.freeze([2.94, 3.2, -4.5] as const),
      min: Object.freeze([-2.94, 0, -4.82] as const),
    }),
    requiredAsset: 'OfficeServiceWindow',
  }),
})

const EFFECT_DURATIONS: Readonly<Record<RoomEffect, number>> = {
  'paper-drop': 0.58,
  approve: 0.92,
  reject: 1.05,
  fraud: 1.16,
  'printer-jam': 1.28,
  migration: 1.62,
}

const DOOR_REST_ROTATION = -0.31
const FRONT_FIXTURE_REST_Y = 3.005
const LOOSE_TILE_REST_Y = 3.035

const MANUAL_DIFFUSER_COLOR = new THREE.Color('#d4c99f')
const CLEAN_DIFFUSER_COLOR = new THREE.Color('#e9fff8')
const MANUAL_LIGHT = new THREE.Color('#eadcaa')
const CLEAN_LIGHT = new THREE.Color('#d9fff4')
const ACCENT_IDLE = new THREE.Color('#183133')
const ACCENT_SELECTED = new THREE.Color('#48dcb7')
const APPROVE_GREEN = new THREE.Color('#5ce09e')
const REJECT_RED = new THREE.Color('#ff4b48')
const FRAUD_RED = new THREE.Color('#ff313b')
const FRAUD_AMBER = new THREE.Color('#ff9b45')
const TILE_MANUAL = new THREE.Color('#c9c5b7')
const TILE_JAM = new THREE.Color('#bdb7a5')
const TILE_CLEAN = new THREE.Color('#d8d7cc')

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const smoothstep = (value: number) => {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

const pulse = (time: number, start: number, peak: number, end: number) =>
  smoothstep((time - start) / Math.max(0.0001, peak - start)) *
  (1 - smoothstep((time - peak) / Math.max(0.0001, end - peak)))

const dampedOscillation = (
  time: number,
  start: number,
  cycles: number,
  damping: number,
) => {
  if (time <= start) return 0
  const localTime = (time - start) / Math.max(0.0001, 1 - start)
  return Math.sin(localTime * Math.PI * 2 * cycles) * Math.exp(-localTime * damping)
}

function roundedPart(
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  radius: number,
  rotation: readonly [number, number, number] = [0, 0, 0],
  segments = 2,
) {
  const geometry = new RoundedBoxGeometry(size[0], size[1], size[2], segments, radius)
  geometry.rotateX(rotation[0]).rotateY(rotation[1]).rotateZ(rotation[2])
  geometry.translate(position[0], position[1], position[2])
  return geometry
}

function cylinderPart(
  radius: number,
  height: number,
  position: readonly [number, number, number],
  rotation: readonly [number, number, number] = [0, 0, 0],
  segments = 20,
) {
  const geometry = new THREE.CylinderGeometry(radius, radius, height, segments)
  geometry.rotateX(rotation[0]).rotateY(rotation[1]).rotateZ(rotation[2])
  geometry.translate(position[0], position[1], position[2])
  return geometry
}

function mergeParts(parts: THREE.BufferGeometry[], label: string) {
  const compatibleParts = parts.map((part) => (part.index ? part.toNonIndexed() : part))
  const merged = mergeGeometries(compatibleParts, false)

  parts.forEach((part) => part.dispose())
  compatibleParts.forEach((part, index) => {
    if (part !== parts[index]) part.dispose()
  })

  if (!merged) throw new Error(`Unable to assemble OfficeRoomShell ${label} geometry`)
  merged.computeBoundingBox()
  merged.computeBoundingSphere()
  return merged
}

function createFloorGeometry() {
  return mergeParts(
    [
      roundedPart([8.4, 0.07, 7.2], [0, 0.035, -1.2], 0.025, [0, 0, 0], 3),
      // The inset threshold bridges cleanly to OfficeServiceWindow's corridor floor.
      roundedPart([5.82, 0.012, 0.24], [0, 0.064, -4.69], 0.008, [0, 0, 0], 2),
    ],
    'finished floor slab',
  )
}

function createFloorInlayGeometry() {
  const parts: THREE.BufferGeometry[] = []

  ;[-3.6, -2.4, -1.2, 0, 1.2, 2.4, 3.6].forEach((x) => {
    parts.push(roundedPart([0.012, 0.002, 6.92], [x, 0.071, -1.12], 0.003))
  })
  ;[-4.2, -3, -1.8, -0.6, 0.6, 1.8].forEach((z) => {
    parts.push(roundedPart([8.12, 0.002, 0.012], [0, 0.071, z], 0.003))
  })
  parts.push(roundedPart([5.84, 0.006, 0.03], [0, 0.077, -4.55], 0.006))
  return mergeParts(parts, 'floor seams and service threshold')
}

function createWallGeometry() {
  return mergeParts(
    [
      // Full left wall and right wall segments around the usable side door.
      roundedPart([0.12, 3.1, 7.2], [-4.14, 1.55, -1.2], 0.025, [0, 0, 0], 3),
      roundedPart([0.12, 3.1, 1.3], [4.14, 1.55, -4.15], 0.024, [0, 0, 0], 3),
      roundedPart([0.12, 3.1, 4.6], [4.14, 1.55, 0.1], 0.025, [0, 0, 0], 3),
      roundedPart([0.12, 0.78, 1.3], [4.14, 2.71, -2.85], 0.022, [0, 0, 0], 3),
      // Rear side wings deliberately stop outside the 5.8 m service module.
      roundedPart([1.2, 3.2, 0.12], [-3.6, 1.6, -4.66], 0.024, [0, 0, 0], 3),
      roundedPart([1.2, 3.2, 0.12], [3.6, 1.6, -4.66], 0.024, [0, 0, 0], 3),
      // Shallow pilasters make the service-module joint intentional in profile.
      roundedPart([0.16, 3.18, 0.26], [-3.02, 1.59, -4.62], 0.026, [0, 0, 0], 4),
      roundedPart([0.16, 3.18, 0.26], [3.02, 1.59, -4.62], 0.026, [0, 0, 0], 4),
      // Open-front wall returns preserve wall thickness in orbit views.
      roundedPart([0.22, 3.1, 0.18], [-4.08, 1.55, 2.31], 0.03, [0, 0, 0], 4),
      roundedPart([0.22, 3.1, 0.18], [4.08, 1.55, 2.31], 0.03, [0, 0, 0], 4),
    ],
    'wall shell and service side wings',
  )
}

function createBaseboardGeometry() {
  return mergeParts(
    [
      roundedPart([0.035, 0.1, 7.02], [-4.065, 0.12, -1.2], 0.012, [0, 0, 0], 3),
      roundedPart([0.035, 0.1, 1.15], [4.065, 0.12, -4.2], 0.012, [0, 0, 0], 3),
      roundedPart([0.035, 0.1, 4.45], [4.065, 0.12, 0.1], 0.012, [0, 0, 0], 3),
      roundedPart([1.08, 0.1, 0.035], [-3.6, 0.12, -4.585], 0.012, [0, 0, 0], 3),
      roundedPart([1.08, 0.1, 0.035], [3.6, 0.12, -4.585], 0.012, [0, 0, 0], 3),
      roundedPart([0.035, 0.026, 6.95], [-4.043, 0.183, -1.2], 0.006),
      roundedPart([0.035, 0.026, 4.42], [4.043, 0.183, 0.1], 0.006),
    ],
    'baseboards and shadow lines',
  )
}

function createTrimGeometry() {
  return mergeParts(
    [
      // Service-module compression jambs and ceiling-level head shadow gap.
      roundedPart([0.09, 3.08, 0.18], [-2.935, 1.58, -4.535], 0.02, [0, 0, 0], 3),
      roundedPart([0.09, 3.08, 0.18], [2.935, 1.58, -4.535], 0.02, [0, 0, 0], 3),
      // Side-door pressed-metal frame and floor threshold.
      roundedPart([0.24, 2.38, 0.11], [4.075, 1.24, -3.52], 0.022, [0, 0, 0], 3),
      roundedPart([0.24, 2.38, 0.11], [4.075, 1.24, -2.18], 0.022, [0, 0, 0], 3),
      roundedPart([0.24, 0.14, 1.45], [4.075, 2.39, -2.85], 0.025, [0, 0, 0], 3),
      roundedPart([0.18, 0.035, 1.32], [4.02, 0.088, -2.85], 0.01, [0, 0, 0], 3),
      // Wall-panel control joints and corner guards.
      roundedPart([0.018, 2.82, 0.028], [-4.068, 1.62, -3.28], 0.006),
      roundedPart([0.018, 2.82, 0.028], [-4.068, 1.62, 0.88], 0.006),
      roundedPart([0.018, 2.82, 0.028], [4.068, 1.62, 1.34], 0.006),
      roundedPart([0.13, 1.08, 0.13], [-4.06, 0.61, 2.25], 0.024, [0, 0, 0], 3),
      roundedPart([0.13, 1.08, 0.13], [4.06, 0.61, 2.25], 0.024, [0, 0, 0], 3),
    ],
    'frames, control joints, and corner guards',
  )
}

function createGasketGeometry() {
  return mergeParts(
    [
      roundedPart([0.022, 2.94, 0.024], [-2.88, 1.59, -4.43], 0.006),
      roundedPart([0.022, 2.94, 0.024], [2.88, 1.59, -4.43], 0.006),
      roundedPart([0.02, 2.2, 0.035], [4.0, 1.2, -3.43], 0.006),
      roundedPart([0.02, 2.2, 0.035], [4.0, 1.2, -2.27], 0.006),
    ],
    'service and door compression gaskets',
  )
}

function createCeilingTileGeometry() {
  const parts: THREE.BufferGeometry[] = []
  const xPositions = [-3.6, -3, -2.4, -1.8, -1.2, -0.6, 0, 0.6, 1.2, 1.8, 2.4, 3, 3.6]
  const zPositions = [-4.2, -3.6, -3, -2.4, -1.8, -1.2, -0.6, 0, 0.6, 1.2, 1.8]
  const fixtureKeys = new Set([
    '-2.4:-3.6',
    '0:-3.6',
    '2.4:-3.6',
    '-1.2:-2.4',
    '1.2:-2.4',
    '-2.4:-1.2',
    '0:-1.2',
    '2.4:-1.2',
    '-1.2:0',
    '1.2:0',
    '0:0.6',
  ])

  xPositions.forEach((x) => {
    zPositions.forEach((z) => {
      const key = `${x}:${z}`
      if (fixtureKeys.has(key) || key === '3:-0.6') return
      parts.push(roundedPart([0.558, 0.035, 0.558], [x, 3.035, z], 0.012, [0, 0, 0], 1))
    })
  })
  return mergeParts(parts, 'acoustic ceiling tile field')
}

function createCeilingGridGeometry() {
  const parts: THREE.BufferGeometry[] = []
  for (let x = -3.9; x <= 3.901; x += 0.6) {
    parts.push(roundedPart([0.022, 0.05, 6.65], [x, 3.012, -1.2], 0.006))
  }
  for (let z = -4.5; z <= 2.101; z += 0.6) {
    parts.push(roundedPart([7.82, 0.05, 0.022], [0, 3.012, z], 0.006))
  }
  return mergeParts(parts, 'suspended ceiling T-grid')
}

function createCeilingStructureGeometry() {
  return mergeParts(
    [
      // Perimeter plenum fascia and open-front upper soffit.
      roundedPart([0.22, 0.24, 7.16], [-4.04, 3.12, -1.2], 0.025, [0, 0, 0], 3),
      roundedPart([0.22, 0.24, 7.16], [4.04, 3.12, -1.2], 0.025, [0, 0, 0], 3),
      roundedPart([8.06, 0.24, 0.2], [0, 3.12, 2.3], 0.025, [0, 0, 0], 3),
      roundedPart([1.08, 0.24, 0.2], [-3.52, 3.12, -4.58], 0.022, [0, 0, 0], 3),
      roundedPart([1.08, 0.24, 0.2], [3.52, 3.12, -4.58], 0.022, [0, 0, 0], 3),
      // Two service access carriers read as real ceiling depth in low views.
      roundedPart([2.18, 0.12, 0.11], [-2.52, 3.18, -1.2], 0.018, [0, 0, 0], 3),
      roundedPart([2.18, 0.12, 0.11], [2.52, 3.18, -1.2], 0.018, [0, 0, 0], 3),
      roundedPart([0.11, 0.12, 2.34], [-2.52, 3.18, -1.2], 0.018, [0, 0, 0], 3),
      roundedPart([0.11, 0.12, 2.34], [2.52, 3.18, -1.2], 0.018, [0, 0, 0], 3),
    ],
    'ceiling plenum returns and carriers',
  )
}

const STATIC_FIXTURES: readonly (readonly [number, number])[] = [
  [-2.4, -3.6],
  [0, -3.6],
  [2.4, -3.6],
  [-1.2, -2.4],
  [1.2, -2.4],
  [-2.4, -1.2],
  [0, -1.2],
  [2.4, -1.2],
  [-1.2, 0],
  [1.2, 0],
]

function createStaticLightHousingGeometry() {
  return mergeParts(
    STATIC_FIXTURES.map(([x, z]) =>
      roundedPart([0.56, 0.11, 0.56], [x, 3.045, z], 0.026, [0, 0, 0], 3),
    ),
    'recessed light housings',
  )
}

function createStaticDiffuserGeometry() {
  return mergeParts(
    STATIC_FIXTURES.map(([x, z]) =>
      roundedPart([0.492, 0.025, 0.492], [x, 2.982, z], 0.035, [0, 0, 0], 4),
    ),
    'recessed light diffusers',
  )
}

function createFrontFixtureHousingGeometry() {
  return mergeParts(
    [roundedPart([0.56, 0.11, 0.56], [0, 0, 0], 0.026, [0, 0, 0], 3)],
    'near-camera fixture housing',
  )
}

function createFrontFixtureDiffuserGeometry() {
  return mergeParts(
    [roundedPart([0.492, 0.025, 0.492], [0, -0.063, 0], 0.035, [0, 0, 0], 4)],
    'near-camera fixture diffuser',
  )
}

function createLooseTileGeometry() {
  return mergeParts(
    [
      roundedPart([0.558, 0.035, 0.558], [0, 0, 0], 0.012, [0, 0, 0], 1),
      roundedPart([0.46, 0.012, 0.018], [0, -0.022, 0.225], 0.005),
    ],
    'service access ceiling tile',
  )
}

function createAccentCoveGeometry() {
  return mergeParts(
    [
      roundedPart([0.04, 0.035, 6.7], [-3.91, 2.94, -1.2], 0.009),
      roundedPart([0.04, 0.035, 4.38], [3.91, 2.94, 0.08], 0.009),
      roundedPart([5.76, 0.035, 0.04], [0, 2.94, -4.41], 0.009),
      roundedPart([1.02, 0.035, 0.04], [-3.52, 2.94, -4.51], 0.009),
      roundedPart([1.02, 0.035, 0.04], [3.52, 2.94, -4.51], 0.009),
    ],
    'perimeter cove accent',
  )
}

function createServiceSweepGeometry() {
  return mergeParts(
    [roundedPart([0.68, 0.018, 0.045], [0, 0, 0], 0.009, [0, 0, 0], 3)],
    'service interface confirmation sweep',
  )
}

function createDoorLeafGeometry() {
  return mergeParts(
    [
      roundedPart([0.055, 2.18, 1.16], [0, 1.09, 0.58], 0.034, [0, 0, 0], 4),
      roundedPart([0.062, 0.16, 1.02], [-0.008, 0.13, 0.58], 0.018, [0, 0, 0], 3),
      roundedPart([0.062, 0.12, 1.02], [-0.008, 2.04, 0.58], 0.018, [0, 0, 0], 3),
    ],
    'side door leaf',
  )
}

function createDoorPanelInlayGeometry() {
  return mergeParts(
    [
      roundedPart([0.018, 0.67, 0.86], [-0.039, 1.58, 0.58], 0.045, [0, 0, 0], 4),
      roundedPart([0.018, 0.54, 0.86], [-0.039, 0.76, 0.58], 0.045, [0, 0, 0], 4),
      roundedPart([0.012, 0.31, 0.5], [-0.051, 1.58, 0.58], 0.025, [0, 0, 0], 3),
    ],
    'door inset panels',
  )
}

function createDoorHardwareGeometry() {
  return mergeParts(
    [
      roundedPart([0.035, 0.2, 0.1], [-0.06, 1.18, 1.02], 0.025, [0, 0, 0], 4),
      cylinderPart(0.035, 0.12, [-0.09, 1.18, 1.02], [0, 0, Math.PI / 2], 28),
      cylinderPart(0.019, 0.19, [-0.15, 1.18, 0.94], [0, 0, Math.PI / 2], 24),
      roundedPart([0.018, 0.08, 0.22], [-0.064, 2.2, 0.16], 0.016, [0, 0, 0], 3),
      roundedPart([0.018, 0.08, 0.22], [-0.064, 0.2, 0.16], 0.016, [0, 0, 0], 3),
    ],
    'door lever, hinges, and closer plate',
  )
}

function createDecorFrameGeometry() {
  return mergeParts(
    [
      // Left wall poster rail and three restrained frames.
      roundedPart([0.04, 0.055, 2.42], [-4.058, 2.46, -0.72], 0.012, [0, 0, 0], 3),
      roundedPart([0.055, 0.96, 0.7], [-4.045, 1.76, -1.48], 0.035, [0, 0, 0], 4),
      roundedPart([0.055, 0.96, 0.7], [-4.045, 1.76, -0.72], 0.035, [0, 0, 0], 4),
      roundedPart([0.055, 0.96, 0.7], [-4.045, 1.76, 0.04], 0.035, [0, 0, 0], 4),
      // Right wall safety/process poster pair, clear of the side door.
      roundedPart([0.055, 1.02, 0.78], [4.045, 1.72, 0.42], 0.04, [0, 0, 0], 4),
      roundedPart([0.055, 1.02, 0.78], [4.045, 1.72, 1.28], 0.04, [0, 0, 0], 4),
      // Rear-wing noticeboard anchors storage and decor as one wall system.
      roundedPart([0.94, 0.72, 0.05], [-3.58, 2.15, -4.57], 0.035, [0, 0, 0], 4),
    ],
    'poster rails and wall frames',
  )
}

function createDecorGroundGeometry() {
  return mergeParts(
    [
      roundedPart([0.008, 0.76, 0.5], [-4.012, 1.76, -1.48], 0.022),
      roundedPart([0.008, 0.76, 0.5], [-4.012, 1.76, -0.72], 0.022),
      roundedPart([0.008, 0.76, 0.5], [-4.012, 1.76, 0.04], 0.022),
      roundedPart([0.008, 0.82, 0.58], [4.012, 1.72, 0.42], 0.025),
      roundedPart([0.008, 0.82, 0.58], [4.012, 1.72, 1.28], 0.025),
    ],
    'poster grounds',
  )
}

function createDecorGraphicsGeometry() {
  return mergeParts(
    [
      // Abstract print blocks avoid baked text while keeping authored hierarchy.
      roundedPart([0.006, 0.11, 0.34], [-4.005, 2.04, -1.48], 0.012),
      roundedPart([0.006, 0.06, 0.29], [-4.004, 1.85, -1.48], 0.009),
      roundedPart([0.006, 0.2, 0.2], [-4.004, 1.5, -0.72], 0.03),
      roundedPart([0.006, 0.09, 0.4], [4.004, 2.02, 0.42], 0.012),
      roundedPart([0.006, 0.18, 0.44], [4.004, 1.57, 1.28], 0.025),
    ],
    'poster graphic blocks',
  )
}

function createStorageBodyGeometry() {
  return mergeParts(
    [
      // High wall storage leaves floor anchors free for standalone cabinets.
      roundedPart([0.42, 0.68, 1.84], [-3.91, 2.4, -3.18], 0.045, [0, 0, 0], 4),
      roundedPart([0.42, 0.68, 1.2], [-3.91, 2.4, 1.28], 0.045, [0, 0, 0], 4),
      roundedPart([0.44, 0.09, 1.96], [-3.9, 2.03, -3.18], 0.022, [0, 0, 0], 3),
      roundedPart([0.44, 0.09, 1.32], [-3.9, 2.03, 1.28], 0.022, [0, 0, 0], 3),
    ],
    'wall storage carcasses',
  )
}

function createStorageFaceGeometry() {
  return mergeParts(
    [
      roundedPart([0.035, 0.56, 0.84], [-3.67, 2.4, -3.64], 0.028, [0, 0, 0], 3),
      roundedPart([0.035, 0.56, 0.84], [-3.67, 2.4, -2.72], 0.028, [0, 0, 0], 3),
      roundedPart([0.035, 0.56, 0.54], [-3.67, 2.4, 0.98], 0.028, [0, 0, 0], 3),
      roundedPart([0.035, 0.56, 0.54], [-3.67, 2.4, 1.58], 0.028, [0, 0, 0], 3),
      roundedPart([0.024, 0.16, 0.025], [-3.642, 2.4, -3.23], 0.008),
      roundedPart([0.024, 0.16, 0.025], [-3.642, 2.4, -3.13], 0.008),
      roundedPart([0.024, 0.16, 0.025], [-3.642, 2.4, 1.25], 0.008),
      roundedPart([0.024, 0.16, 0.025], [-3.642, 2.4, 1.31], 0.008),
    ],
    'storage doors and pulls',
  )
}

function createClockFaceGeometry() {
  return mergeParts(
    [
      cylinderPart(0.31, 0.055, [3.55, 2.28, -4.565], [Math.PI / 2, 0, 0], 48),
      cylinderPart(0.255, 0.016, [3.55, 2.28, -4.525], [Math.PI / 2, 0, 0], 48),
    ],
    'rear-wing wall clock face',
  )
}

function createClockHandGeometry() {
  const parts: THREE.BufferGeometry[] = [
    roundedPart([0.025, 0.18, 0.014], [3.55, 2.35, -4.505], 0.007, [0, 0, -0.42]),
    roundedPart([0.02, 0.13, 0.014], [3.59, 2.25, -4.504], 0.006, [0, 0, 0.96]),
    cylinderPart(0.035, 0.018, [3.55, 2.28, -4.5], [Math.PI / 2, 0, 0], 28),
  ]

  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2
    parts.push(
      roundedPart(
        [0.018, 0.045, 0.012],
        [3.55 + Math.sin(angle) * 0.215, 2.28 + Math.cos(angle) * 0.215, -4.501],
        0.005,
        [0, 0, -angle],
      ),
    )
  }
  return mergeParts(parts, 'clock hands and hour markers')
}

function createExtinguisherGeometry() {
  return mergeParts(
    [
      cylinderPart(0.105, 0.48, [0, 0.31, 0], [0, 0, 0], 32),
      cylinderPart(0.085, 0.08, [0, 0.585, 0], [0, 0, 0], 28),
      roundedPart([0.19, 0.055, 0.08], [0, 0.66, 0], 0.02, [0, 0, -0.14], 4),
      roundedPart([0.06, 0.18, 0.055], [0.075, 0.6, 0], 0.018, [0, 0, -0.28], 3),
      cylinderPart(0.026, 0.26, [-0.11, 0.5, 0], [0, 0, 0.48], 20),
    ],
    'wall fire extinguisher',
  )
}

function createExtinguisherHardwareGeometry() {
  return mergeParts(
    [
      roundedPart([0.34, 0.62, 0.055], [0, 0.34, -0.055], 0.045, [0, 0, 0], 4),
      roundedPart([0.28, 0.055, 0.2], [0, 0.11, 0], 0.02, [0, 0, 0], 3),
      roundedPart([0.24, 0.035, 0.035], [0, 0.42, 0.1], 0.009),
      cylinderPart(0.045, 0.03, [0.095, 0.62, 0.04], [Math.PI / 2, 0, 0], 28),
    ],
    'extinguisher bracket, strap, and gauge',
  )
}

function createAlarmLensGeometry() {
  return mergeParts(
    [
      cylinderPart(0.065, 0.045, [0, 0, 0], [Math.PI / 2, 0, 0], 32),
      roundedPart([0.19, 0.07, 0.055], [0, -0.082, -0.01], 0.016, [0, 0, 0], 3),
    ],
    'fire alarm lens',
  )
}

function createFastenerGeometry() {
  const parts: THREE.BufferGeometry[] = []

  ;[-3.02, 3.02].forEach((x) => {
    ;[0.28, 0.88, 1.48, 2.08, 2.68].forEach((y) => {
      parts.push(cylinderPart(0.014, 0.012, [x, y, -4.385], [Math.PI / 2, 0, 0], 20))
    })
  })
  ;[-3.84, -3.38, 3.38, 3.84].forEach((x) => {
    ;[0.32, 1.56, 2.84].forEach((y) => {
      parts.push(cylinderPart(0.013, 0.01, [x, y, -4.585], [Math.PI / 2, 0, 0], 20))
    })
  })
  ;[-3.52, -2.18].forEach((z) => {
    ;[0.32, 1.12, 2.08].forEach((y) => {
      parts.push(cylinderPart(0.013, 0.012, [3.93, y, z], [0, 0, Math.PI / 2], 20))
    })
  })
  return mergeParts(parts, 'architectural fasteners')
}

function createRoomGeometry(): RoomGeometry {
  return {
    accentCove: createAccentCoveGeometry(),
    alarmLens: createAlarmLensGeometry(),
    baseboards: createBaseboardGeometry(),
    ceilingGrid: createCeilingGridGeometry(),
    ceilingStructure: createCeilingStructureGeometry(),
    ceilingTiles: createCeilingTileGeometry(),
    clockFace: createClockFaceGeometry(),
    clockHands: createClockHandGeometry(),
    decorFrames: createDecorFrameGeometry(),
    decorGrounds: createDecorGroundGeometry(),
    decorGraphics: createDecorGraphicsGeometry(),
    doorHardware: createDoorHardwareGeometry(),
    doorLeaf: createDoorLeafGeometry(),
    doorPanelInlays: createDoorPanelInlayGeometry(),
    extinguisher: createExtinguisherGeometry(),
    extinguisherHardware: createExtinguisherHardwareGeometry(),
    fasteners: createFastenerGeometry(),
    floor: createFloorGeometry(),
    floorInlays: createFloorInlayGeometry(),
    frontFixtureDiffuser: createFrontFixtureDiffuserGeometry(),
    frontFixtureHousing: createFrontFixtureHousingGeometry(),
    gasket: createGasketGeometry(),
    looseTile: createLooseTileGeometry(),
    serviceSweep: createServiceSweepGeometry(),
    staticDiffusers: createStaticDiffuserGeometry(),
    staticLightHousings: createStaticLightHousingGeometry(),
    storageBodies: createStorageBodyGeometry(),
    storageFaces: createStorageFaceGeometry(),
    trim: createTrimGeometry(),
    walls: createWallGeometry(),
  }
}

function createRoomMaterials(): RoomMaterials {
  return {
    accent: new THREE.MeshStandardMaterial({
      color: '#244446',
      emissive: ACCENT_IDLE,
      emissiveIntensity: 0.12,
      metalness: 0.42,
      roughness: 0.34,
      toneMapped: false,
    }),
    alarm: new THREE.MeshStandardMaterial({
      color: '#76262c',
      emissive: FRAUD_RED,
      emissiveIntensity: 0.08,
      roughness: 0.23,
      toneMapped: false,
    }),
    ceilingGrid: new THREE.MeshStandardMaterial({
      color: '#a4a49d',
      metalness: 0.62,
      roughness: 0.42,
    }),
    ceilingTile: new THREE.MeshStandardMaterial({
      color: '#c9c5b7',
      metalness: 0.01,
      roughness: 0.96,
    }),
    clockFace: new THREE.MeshPhysicalMaterial({
      clearcoat: 0.4,
      clearcoatRoughness: 0.32,
      color: '#d7d3c4',
      metalness: 0.05,
      roughness: 0.5,
    }),
    decorInk: new THREE.MeshStandardMaterial({
      color: '#2a4747',
      metalness: 0.08,
      roughness: 0.7,
    }),
    diffuser: new THREE.MeshStandardMaterial({
      color: MANUAL_DIFFUSER_COLOR,
      emissive: MANUAL_LIGHT,
      emissiveIntensity: 1.05,
      roughness: 0.28,
      toneMapped: false,
    }),
    door: new THREE.MeshPhysicalMaterial({
      clearcoat: 0.22,
      clearcoatRoughness: 0.48,
      color: '#64675f',
      metalness: 0.12,
      roughness: 0.54,
    }),
    extinguisher: new THREE.MeshPhysicalMaterial({
      clearcoat: 0.78,
      clearcoatRoughness: 0.2,
      color: '#b93632',
      metalness: 0.2,
      roughness: 0.3,
    }),
    floor: new THREE.MeshPhysicalMaterial({
      clearcoat: 0.18,
      clearcoatRoughness: 0.62,
      color: '#77746c',
      metalness: 0.04,
      roughness: 0.68,
    }),
    floorInlay: new THREE.MeshStandardMaterial({
      color: '#565a56',
      metalness: 0.16,
      roughness: 0.58,
    }),
    gasket: new THREE.MeshStandardMaterial({
      color: '#171b1b',
      metalness: 0.02,
      roughness: 0.84,
    }),
    hardware: new THREE.MeshStandardMaterial({
      color: '#a3aaaa',
      metalness: 0.86,
      roughness: 0.28,
    }),
    housing: new THREE.MeshStandardMaterial({
      color: '#8d918d',
      metalness: 0.66,
      roughness: 0.39,
    }),
    poster: new THREE.MeshPhysicalMaterial({
      clearcoat: 0.12,
      clearcoatRoughness: 0.7,
      color: '#bab7aa',
      metalness: 0.01,
      roughness: 0.82,
    }),
    storage: new THREE.MeshPhysicalMaterial({
      clearcoat: 0.16,
      clearcoatRoughness: 0.58,
      color: '#77796f',
      metalness: 0.16,
      roughness: 0.56,
    }),
    sweep: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: APPROVE_GREEN,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
    trim: new THREE.MeshPhysicalMaterial({
      clearcoat: 0.36,
      clearcoatRoughness: 0.33,
      color: '#384244',
      metalness: 0.72,
      roughness: 0.35,
    }),
    wall: new THREE.MeshPhysicalMaterial({
      clearcoat: 0.06,
      clearcoatRoughness: 0.78,
      color: '#aaa69b',
      metalness: 0.01,
      roughness: 0.8,
    }),
  }
}

export function OfficeRoomShell({
  effectPreset,
  effectRun = 0,
  selected = false,
  ...groupProps
}: ProceduralAssetProps) {
  const doorRef = useRef<THREE.Group>(null)
  const extinguisherRef = useRef<THREE.Group>(null)
  const frontFixtureRef = useRef<THREE.Group>(null)
  const looseTileRef = useRef<THREE.Group>(null)
  const serviceSweepRef = useRef<THREE.Group>(null)
  const previousRunRef = useRef(effectRun)
  const selectedRef = useRef(selected)
  const motionRef = useRef<MotionState>({
    active: false,
    duration: 0,
    elapsed: 0,
  })
  const reducedMotion = useLabStore((state) => state.reducedMotion)
  const geometry = useMemo(() => createRoomGeometry(), [])
  const materials = useMemo(() => createRoomMaterials(), [])

  useEffect(
    () => () => {
      Object.values(geometry).forEach((item) => item.dispose())
      Object.values(materials).forEach((material) => material.dispose())
    },
    [geometry, materials],
  )

  const resetPose = useCallback(() => {
    const door = doorRef.current
    const extinguisher = extinguisherRef.current
    const frontFixture = frontFixtureRef.current
    const looseTile = looseTileRef.current
    const serviceSweep = serviceSweepRef.current

    if (door) {
      door.position.set(4.04, 0.07, -3.43)
      door.rotation.set(0, DOOR_REST_ROTATION, 0)
      door.scale.set(1, 1, 1)
    }
    if (extinguisher) {
      extinguisher.position.set(3.7, 0.22, -4.5)
      extinguisher.rotation.set(0, 0, 0)
      extinguisher.scale.set(1, 1, 1)
    }
    if (frontFixture) {
      frontFixture.position.set(0, FRONT_FIXTURE_REST_Y, 0.6)
      frontFixture.rotation.set(0, 0, 0)
      frontFixture.scale.set(1, 1, 1)
    }
    if (looseTile) {
      looseTile.position.set(3, LOOSE_TILE_REST_Y, -0.6)
      looseTile.rotation.set(0, 0, 0)
      looseTile.scale.set(1, 1, 1)
    }
    if (serviceSweep) {
      serviceSweep.position.set(-2.5, 2.965, -4.39)
      serviceSweep.rotation.set(0, 0, 0)
      serviceSweep.scale.set(1, 1, 1)
    }

    materials.accent.color.set('#244446')
    materials.accent.emissive.copy(selectedRef.current ? ACCENT_SELECTED : ACCENT_IDLE)
    materials.accent.emissiveIntensity = selectedRef.current ? 0.45 : 0.12
    materials.alarm.emissive.copy(FRAUD_RED)
    materials.alarm.emissiveIntensity = 0.08
    materials.ceilingTile.color.copy(TILE_MANUAL)
    materials.diffuser.color.copy(MANUAL_DIFFUSER_COLOR)
    materials.diffuser.emissive.copy(MANUAL_LIGHT)
    materials.diffuser.emissiveIntensity = 1.05
    materials.sweep.color.copy(APPROVE_GREEN)
    materials.sweep.opacity = 0
  }, [materials])

  useEffect(() => {
    selectedRef.current = selected
    if (!motionRef.current.active) resetPose()
  }, [resetPose, selected])

  useEffect(() => {
    if (effectRun === previousRunRef.current) return
    previousRunRef.current = effectRun
    resetPose()

    const motion = motionRef.current
    motion.elapsed = 0
    motion.preset = effectPreset
    if (!effectPreset) {
      motion.active = false
      motion.duration = 0
      return
    }

    motion.active = true
    motion.duration = EFFECT_DURATIONS[effectPreset]
  }, [effectPreset, effectRun, resetPose])

  useFrame((_, delta) => {
    const motion = motionRef.current
    const door = doorRef.current
    const extinguisher = extinguisherRef.current
    const frontFixture = frontFixtureRef.current
    const looseTile = looseTileRef.current
    const serviceSweep = serviceSweepRef.current

    if (
      !motion.active ||
      !motion.preset ||
      !door ||
      !extinguisher ||
      !frontFixture ||
      !looseTile ||
      !serviceSweep
    ) {
      return
    }

    motion.elapsed += Math.min(delta, 0.05)
    const time = Math.min(1, motion.elapsed / motion.duration)
    const transformScale = reducedMotion ? 0.15 : 1
    resetPose()

    switch (motion.preset) {
      case 'paper-drop': {
        // The nearest ceiling cassette flexes once, then its retained lens settles exactly.
        const impact = pulse(time, 0.03, 0.16, 0.58)
        const settle = dampedOscillation(time, 0.13, 2.25, 5.8)
        frontFixture.position.y =
          FRONT_FIXTURE_REST_Y - transformScale * 0.025 * impact + transformScale * 0.009 * settle
        frontFixture.rotation.x = transformScale * 0.012 * settle
        materials.diffuser.emissiveIntensity = 1.05 + 0.22 * impact
        break
      }

      case 'approve': {
        // A narrow confirmation streak runs across the room-side service interface.
        const travel = smoothstep((time - 0.04) / 0.68)
        const envelope = pulse(time, 0.02, 0.16, 0.91)
        const settle = dampedOscillation(time, 0.62, 1.35, 6.4)
        serviceSweep.position.x = -2.5 + transformScale * 5 * travel
        serviceSweep.position.y = 2.965 + transformScale * 0.008 * settle
        materials.sweep.opacity = 0.72 * envelope
        materials.accent.emissive.copy(APPROVE_GREEN)
        materials.accent.emissiveIntensity =
          (selectedRef.current ? 0.45 : 0.12) + 0.62 * envelope
        break
      }

      case 'reject': {
        // The side door anticipates open, snaps nearly shut, rings in its frame, and reopens.
        const anticipate = pulse(time, 0.02, 0.1, 0.18)
        const close = smoothstep((time - 0.12) / 0.2)
        const reopen = smoothstep((time - 0.61) / 0.28)
        const ring = dampedOscillation(time, 0.29, 2.8, 5.2)
        const closedAmount = close * (1 - reopen)
        door.rotation.y =
          DOOR_REST_ROTATION - transformScale * 0.055 * anticipate +
          transformScale * 0.292 * closedAmount + transformScale * 0.014 * ring
        materials.accent.emissive.copy(REJECT_RED)
        materials.accent.emissiveIntensity =
          (selectedRef.current ? 0.45 : 0.12) + 0.46 * pulse(time, 0.14, 0.3, 0.73)
        break
      }

      case 'fraud': {
        // The fire point behaves like a fixed building alarm, not a generic prop wobble.
        const attack = smoothstep(time / 0.08)
        const release = 1 - smoothstep((time - 0.86) / 0.12)
        const envelope = attack * release
        const redFlash = Math.max(0, Math.sin(time * Math.PI * 10 + 0.4)) ** 3
        const amberFlash = Math.max(0, Math.sin(time * Math.PI * 10 + Math.PI + 0.4)) ** 3
        const cabinetRecoil = dampedOscillation(time, 0.1, 3.1, 5.1)
        extinguisher.rotation.z = transformScale * 0.018 * cabinetRecoil
        extinguisher.position.x = 3.7 + transformScale * 0.009 * cabinetRecoil
        materials.alarm.emissive.lerpColors(FRAUD_RED, FRAUD_AMBER, amberFlash)
        materials.alarm.emissiveIntensity = 0.08 + envelope * (0.9 + 4.2 * Math.max(redFlash, amberFlash))
        materials.accent.emissive.copy(FRAUD_RED)
        materials.accent.emissiveIntensity =
          (selectedRef.current ? 0.45 : 0.12) + envelope * 0.42
        break
      }

      case 'printer-jam': {
        // A repeatable ballast-failure pattern drives one retained access tile into chatter.
        const spinUp = smoothstep(time / 0.08)
        const shutDown = 1 - smoothstep((time - 0.89) / 0.09)
        const envelope = spinUp * shutDown
        const flicker =
          time < 0.1
            ? 1
            : time < 0.18
              ? 0.06
              : time < 0.27
                ? 1.38
                : time < 0.35
                  ? 0.12
                  : time < 0.46
                    ? 0.82
                    : time < 0.55
                      ? 0.03
                      : time < 0.68
                        ? 1.5
                        : time < 0.78
                          ? 0.18
                          : 0.76
        const chatter = Math.sin(time * Math.PI * 44) * envelope
        looseTile.position.y = LOOSE_TILE_REST_Y - transformScale * 0.02 * Math.abs(chatter)
        looseTile.rotation.z = transformScale * 0.013 * chatter
        looseTile.rotation.x = transformScale * 0.009 * chatter
        frontFixture.position.y = FRONT_FIXTURE_REST_Y - transformScale * 0.007 * chatter
        materials.diffuser.emissive.copy(flicker < 0.16 ? REJECT_RED : MANUAL_LIGHT)
        materials.diffuser.emissiveIntensity = Math.max(0.015, flicker * envelope + 0.06 * chatter)
        materials.ceilingTile.color.lerpColors(TILE_MANUAL, TILE_JAM, 0.2 * Math.abs(chatter))
        break
      }

      case 'migration': {
        // Manual fluorescents black out; cove and tile order return in a back-to-front wave.
        const blackout = pulse(time, 0, 0.1, 0.27)
        const clean = smoothstep((time - 0.22) / 0.5)
        const completion = pulse(time, 0.69, 0.84, 0.99)
        const align = dampedOscillation(time, 0.38, 1.75, 5.7)
        const sweepTravel = smoothstep((time - 0.29) / 0.53)
        materials.diffuser.color.lerpColors(MANUAL_DIFFUSER_COLOR, CLEAN_DIFFUSER_COLOR, clean)
        materials.diffuser.emissive.lerpColors(MANUAL_LIGHT, CLEAN_LIGHT, clean)
        materials.diffuser.emissiveIntensity =
          1.05 * (1 - blackout) + clean * 0.7 + completion * 1.05
        materials.ceilingTile.color.lerpColors(TILE_MANUAL, TILE_CLEAN, clean)
        materials.accent.emissive.copy(CLEAN_LIGHT)
        materials.accent.emissiveIntensity =
          (selectedRef.current ? 0.45 : 0.12) + clean * 0.7 + completion * 1.35
        looseTile.position.y = LOOSE_TILE_REST_Y + transformScale * 0.014 * align
        looseTile.rotation.z = transformScale * 0.012 * align
        frontFixture.position.y = FRONT_FIXTURE_REST_Y + transformScale * 0.01 * align
        serviceSweep.position.x = -2.5 + transformScale * 5 * sweepTravel
        serviceSweep.scale.x = 0.8 + clean * 1.4
        materials.sweep.color.copy(CLEAN_LIGHT)
        materials.sweep.opacity = 0.38 * completion
        break
      }
    }

    if (time >= 1) {
      motion.active = false
      resetPose()
    }
  })

  return (
    <group
      {...groupProps}
      userData={{ ...groupProps.userData, assetContract: OFFICE_ROOM_SHELL_CONTRACT }}
    >
      <mesh geometry={geometry.floor} material={materials.floor} castShadow receiveShadow />
      <mesh geometry={geometry.floorInlays} material={materials.floorInlay} receiveShadow />
      <mesh geometry={geometry.walls} material={materials.wall} castShadow receiveShadow />
      <mesh geometry={geometry.baseboards} material={materials.trim} castShadow receiveShadow />
      <mesh geometry={geometry.trim} material={materials.trim} castShadow receiveShadow />
      <mesh geometry={geometry.gasket} material={materials.gasket} castShadow receiveShadow />
      <mesh geometry={geometry.fasteners} material={materials.hardware} castShadow />

      <mesh geometry={geometry.ceilingStructure} material={materials.trim} castShadow receiveShadow />
      <mesh geometry={geometry.ceilingTiles} material={materials.ceilingTile} receiveShadow />
      <mesh geometry={geometry.ceilingGrid} material={materials.ceilingGrid} castShadow />
      <mesh geometry={geometry.staticLightHousings} material={materials.housing} castShadow />
      <mesh geometry={geometry.staticDiffusers} material={materials.diffuser} />
      <mesh geometry={geometry.accentCove} material={materials.accent} />

      <group ref={frontFixtureRef} position={[0, FRONT_FIXTURE_REST_Y, 0.6]}>
        <mesh geometry={geometry.frontFixtureHousing} material={materials.housing} castShadow />
        <mesh geometry={geometry.frontFixtureDiffuser} material={materials.diffuser} />
      </group>
      <group ref={looseTileRef} position={[3, LOOSE_TILE_REST_Y, -0.6]}>
        <mesh geometry={geometry.looseTile} material={materials.ceilingTile} castShadow receiveShadow />
      </group>
      <group ref={serviceSweepRef} position={[-2.5, 2.965, -4.39]}>
        <mesh geometry={geometry.serviceSweep} material={materials.sweep} renderOrder={2} />
      </group>

      <group ref={doorRef} position={[4.04, 0.07, -3.43]} rotation={[0, DOOR_REST_ROTATION, 0]}>
        <mesh geometry={geometry.doorLeaf} material={materials.door} castShadow receiveShadow />
        <mesh geometry={geometry.doorPanelInlays} material={materials.poster} castShadow receiveShadow />
        <mesh geometry={geometry.doorHardware} material={materials.hardware} castShadow receiveShadow />
      </group>

      <mesh geometry={geometry.decorFrames} material={materials.trim} castShadow receiveShadow />
      <mesh geometry={geometry.decorGrounds} material={materials.poster} receiveShadow />
      <mesh geometry={geometry.decorGraphics} material={materials.decorInk} receiveShadow />
      <mesh geometry={geometry.storageBodies} material={materials.storage} castShadow receiveShadow />
      <mesh geometry={geometry.storageFaces} material={materials.trim} castShadow receiveShadow />
      <mesh geometry={geometry.clockFace} material={materials.clockFace} castShadow receiveShadow />
      <mesh geometry={geometry.clockHands} material={materials.decorInk} castShadow />

      <group ref={extinguisherRef} position={[3.7, 0.22, -4.5]}>
        <mesh geometry={geometry.extinguisherHardware} material={materials.hardware} castShadow receiveShadow />
        <mesh geometry={geometry.extinguisher} material={materials.extinguisher} castShadow receiveShadow />
        <mesh
          geometry={geometry.alarmLens}
          material={materials.alarm}
          position={[-0.02, 0.74, 0.02]}
          castShadow
        />
      </group>

      {/*
        Envelope x[-4.20,4.20], y[0,3.24], z[-4.80,2.40]. Place
        OfficeServiceWindow at [0,0,-4.66]; its central facade/corridor/giraffe
        volume is intentionally absent here. The operator/camera side at +Z is open.
      */}
    </group>
  )
}
