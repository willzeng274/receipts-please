import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { useLabStore } from '../../store/useLabStore'
import type { ProceduralAssetProps } from '../types'

type WindowEffect = NonNullable<ProceduralAssetProps['effectPreset']>

type MotionState = {
  active: boolean
  duration: number
  elapsed: number
  preset?: WindowEffect
}

type WindowGeometry = {
  accent: THREE.BufferGeometry
  backdropHardware: THREE.BufferGeometry
  cityFar: THREE.BufferGeometry
  cityNear: THREE.BufferGeometry
  cityWindows: THREE.BufferGeometry
  corridorDetails: THREE.BufferGeometry
  corridorFloor: THREE.BufferGeometry
  documentFlap: THREE.BufferGeometry
  elevatorLabelFace: THREE.BufferGeometry
  exteriorGlass: THREE.BufferGeometry
  exteriorTrim: THREE.BufferGeometry
  fasteners: THREE.BufferGeometry
  fixtureHousings: THREE.BufferGeometry
  fluorescentLeft: THREE.BufferGeometry
  fluorescentRight: THREE.BufferGeometry
  frontGlass: THREE.BufferGeometry
  frontGlassFilm: THREE.BufferGeometry
  frontLabelFace: THREE.BufferGeometry
  frontTrim: THREE.BufferGeometry
  gasket: THREE.BufferGeometry
  reflection: THREE.BufferGeometry
  rearLabelFace: THREE.BufferGeometry
  shutterHandle: THREE.BufferGeometry
  shutterPanel: THREE.BufferGeometry
  signPlaques: THREE.BufferGeometry
  sill: THREE.BufferGeometry
  sillHardware: THREE.BufferGeometry
  sky: THREE.BufferGeometry
  statusLabelFace: THREE.BufferGeometry
  wall: THREE.BufferGeometry
  warningWash: THREE.BufferGeometry
}

type WindowMaterials = {
  accent: THREE.MeshStandardMaterial
  approve: THREE.MeshStandardMaterial
  cityFar: THREE.MeshStandardMaterial
  cityNear: THREE.MeshStandardMaterial
  cityWindows: THREE.MeshStandardMaterial
  corridor: THREE.MeshPhysicalMaterial
  exteriorGlass: THREE.MeshPhysicalMaterial
  fastener: THREE.MeshStandardMaterial
  film: THREE.MeshBasicMaterial
  fluorescentLeft: THREE.MeshStandardMaterial
  fluorescentRight: THREE.MeshStandardMaterial
  fraudLeft: THREE.MeshStandardMaterial
  fraudRight: THREE.MeshStandardMaterial
  frontGlass: THREE.MeshPhysicalMaterial
  gasket: THREE.MeshStandardMaterial
  reflection: THREE.MeshBasicMaterial
  reject: THREE.MeshStandardMaterial
  shutter: THREE.MeshPhysicalMaterial
  sill: THREE.MeshPhysicalMaterial
  sillHardware: THREE.MeshStandardMaterial
  sky: THREE.MeshBasicMaterial
  trim: THREE.MeshPhysicalMaterial
  wall: THREE.MeshPhysicalMaterial
  warningWash: THREE.MeshBasicMaterial
}

type WindowLabelMaterials = {
  elevator: THREE.MeshStandardMaterial
  front: THREE.MeshStandardMaterial
  rear: THREE.MeshStandardMaterial
  status: THREE.MeshStandardMaterial
}

/**
 * Architectural placement contract, in meters.
 *
 * The operator is on +Z looking through the service glass toward -Z. The root
 * origin is the floor datum directly below the center of the service opening.
 * Scene authors can place employees in the reveal volume and later place the
 * giraffe at `giraffeRiseAnchor` without intersecting any opaque foreground
 * construction. Glass and the corridor floor intentionally cross that volume.
 */
const OFFICE_SERVICE_WINDOW_CONTRACT = Object.freeze({
  axes: Object.freeze({ forward: '-Z', operator: '+Z', up: '+Y' }),
  dimensions: Object.freeze([5.8, 3.2, 2.65] as const),
  exteriorWindowClearBounds: Object.freeze({
    max: Object.freeze([2.5, 2.85, -2.03] as const),
    min: Object.freeze([-0.35, 0.58, -2.08] as const),
  }),
  frontWallPlaneZ: 0,
  giraffeRiseAnchor: Object.freeze([0.76, 0, -2.22] as const),
  giraffeRiseColumn: Object.freeze({
    max: Object.freeze([1.38, 2.85, -2.12] as const),
    min: Object.freeze([0.2, 0, -2.32] as const),
  }),
  serviceOpeningClearBounds: Object.freeze({
    max: Object.freeze([1.64, 2.66, 0.14] as const),
    min: Object.freeze([-1.64, 1.08, -0.2] as const),
  }),
  serviceRevealBounds: Object.freeze({
    max: Object.freeze([1.22, 2.55, -0.1] as const),
    min: Object.freeze([-1.22, 1.1, -2.25] as const),
  }),
  sillTopAnchor: Object.freeze([0, 1.04, 0.18] as const),
})

const EFFECT_DURATIONS: Readonly<Record<WindowEffect, number>> = {
  'paper-drop': 0.62,
  approve: 0.98,
  reject: 0.92,
  fraud: 1.12,
  'printer-jam': 1.2,
  migration: 1.55,
}

const SHUTTER_REST_X = 2.04
const SHUTTER_REST_Y = 1.96
const SHUTTER_REST_Z = 0.085
const DOCUMENT_FLAP_REST_Y = 1.057
const DOCUMENT_FLAP_REST_Z = 0.065

const SERVICE_GLASS_COLOR = new THREE.Color('#91aaa8')
const CLEAN_GLASS_COLOR = new THREE.Color('#c3dcda')
const EXTERIOR_GLASS_COLOR = new THREE.Color('#7d9fa6')
const ACCENT_IDLE = new THREE.Color('#172e31')
const ACCENT_SELECTED = new THREE.Color('#41d9b3')
const APPROVE_GREEN = new THREE.Color('#58d68f')
const REJECT_RED = new THREE.Color('#ff4f4a')
const FRAUD_RED = new THREE.Color('#ff2f37')
const FRAUD_AMBER = new THREE.Color('#ff9747')
const FLUORESCENT_WARM = new THREE.Color('#e8d8a6')
const FLUORESCENT_CLEAN = new THREE.Color('#d7f5ee')
const FLUORESCENT_WARNING = new THREE.Color('#ffc36e')
const FLUORESCENT_BASE_COLOR = new THREE.Color('#d5cfb2')
const FLUORESCENT_CLEAN_COLOR = new THREE.Color('#e5fff7')
const CITY_IDLE = new THREE.Color('#ffd38a')
const CITY_CLEAN = new THREE.Color('#d7f8ee')

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const smoothstep = (value: number) => {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

const pulse = (time: number, start: number, peak: number, end: number) =>
  smoothstep((time - start) / Math.max(0.0001, peak - start)) *
  (1 - smoothstep((time - peak) / Math.max(0.0001, end - peak)))

const dampedOscillation = (time: number, start: number, cycles: number, damping: number) => {
  if (time <= start) return 0
  const localTime = (time - start) / Math.max(0.0001, 1 - start)
  return Math.sin(localTime * Math.PI * 2 * cycles) * Math.exp(-localTime * damping)
}

const steppedBallastFlicker = (time: number) =>
  time < 0.12
    ? 1
    : time < 0.19
      ? 0.08
      : time < 0.27
        ? 1.3
        : time < 0.35
          ? 0.16
          : time < 0.47
            ? 0.92
            : time < 0.54
              ? 0.04
              : time < 0.66
                ? 1.45
                : time < 0.75
                  ? 0.22
                  : 0.78

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

function labelFace(
  size: readonly [number, number],
  position: readonly [number, number, number],
  rotationY = 0,
) {
  const geometry = new THREE.PlaneGeometry(size[0], size[1])
  geometry.rotateY(rotationY)
  geometry.translate(position[0], position[1], position[2])
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function createLabelMaterial(text: string, background: string, ink: string, border: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 160
  const context = canvas.getContext('2d')

  if (!context) throw new Error(`Unable to paint OfficeServiceWindow label: ${text}`)

  context.fillStyle = background
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = border
  context.lineWidth = 9
  context.strokeRect(5, 5, canvas.width - 10, canvas.height - 10)
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = ink

  let fontSize = 86
  do {
    context.font = `700 ${fontSize}px Inter, Arial, sans-serif`
    fontSize -= 2
  } while (context.measureText(text).width > canvas.width - 92 && fontSize > 36)

  context.fillText(text, canvas.width / 2, canvas.height / 2 + 3)

  const texture = new THREE.CanvasTexture(canvas)
  texture.anisotropy = 4
  texture.colorSpace = THREE.SRGBColorSpace
  texture.name = `OfficeServiceWindow ${text}`

  return new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#16272a',
    emissiveIntensity: 0.08,
    map: texture,
    metalness: 0.08,
    roughness: 0.42,
  })
}

function mergeParts(parts: THREE.BufferGeometry[], label: string) {
  const compatibleParts = parts.map((part) => (part.index ? part.toNonIndexed() : part))
  const merged = mergeGeometries(compatibleParts, false)

  parts.forEach((part) => part.dispose())
  compatibleParts.forEach((part, index) => {
    if (part !== parts[index]) part.dispose()
  })

  if (!merged) throw new Error(`Unable to assemble OfficeServiceWindow ${label} geometry`)
  merged.computeBoundingBox()
  merged.computeBoundingSphere()
  return merged
}

function createWallGeometry() {
  return mergeParts(
    [
      // Front shell, with a real opening rather than a painted dark rectangle.
      roundedPart([1.26, 3.2, 0.26], [-2.27, 1.6, 0], 0.025, [0, 0, 0], 3),
      roundedPart([1.26, 3.2, 0.26], [2.27, 1.6, 0], 0.025, [0, 0, 0], 3),
      roundedPart([3.28, 1, 0.26], [0, 0.5, 0], 0.018, [0, 0, 0], 3),
      roundedPart([3.28, 0.46, 0.26], [0, 2.97, 0], 0.018, [0, 0, 0], 3),
      // Corridor sidewalls make the section credible from profile and rear views.
      roundedPart([0.14, 3.18, 2.18], [-2.83, 1.59, -1.14], 0.025, [0, 0, 0], 3),
      roundedPart([0.14, 3.18, 2.18], [2.83, 1.59, -1.14], 0.025, [0, 0, 0], 3),
      // Back wall wraps a large exterior window from x -0.35 to 2.50.
      roundedPart([2.42, 3.16, 0.16], [-1.56, 1.58, -2.12], 0.02, [0, 0, 0], 3),
      roundedPart([0.33, 3.16, 0.16], [2.665, 1.58, -2.12], 0.018, [0, 0, 0], 3),
      roundedPart([2.85, 0.52, 0.16], [1.075, 0.26, -2.12], 0.016, [0, 0, 0], 3),
      roundedPart([2.85, 0.31, 0.16], [1.075, 3.045, -2.12], 0.016, [0, 0, 0], 3),
    ],
    'wall shell',
  )
}

function createFrontTrimGeometry() {
  return mergeParts(
    [
      // A single broad pane keeps the reveal readable from the authored camera.
      // Front and rear frame skins are tied by deep jamb returns.
      roundedPart([0.135, 1.7, 0.19], [-1.705, 1.85, 0.075], 0.022, [0, 0, 0], 4),
      roundedPart([0.135, 1.7, 0.19], [1.705, 1.85, 0.075], 0.022, [0, 0, 0], 4),
      roundedPart([3.545, 0.15, 0.19], [0, 2.71, 0.075], 0.026, [0, 0, 0], 4),
      roundedPart([0.105, 1.64, 0.12], [-1.705, 1.85, -0.17], 0.018, [0, 0, 0], 3),
      roundedPart([0.105, 1.64, 0.12], [1.705, 1.85, -0.17], 0.018, [0, 0, 0], 3),
      roundedPart([3.505, 0.115, 0.12], [0, 2.71, -0.17], 0.02, [0, 0, 0], 3),
      // Pocket and horizontal guide for the reject shutter.
      roundedPart([0.18, 1.62, 0.24], [1.81, 1.93, 0.02], 0.025, [0, 0, 0], 4),
      roundedPart([1.55, 0.09, 0.16], [1.24, 2.675, 0.05], 0.02, [0, 0, 0], 3),
      roundedPart([1.55, 0.026, 0.032], [1.24, 2.625, 0.17], 0.008, [0, 0, 0], 3),
      // A shallow header valance gives the status lamps a manufactured home.
      roundedPart([1.15, 0.19, 0.24], [0, 2.83, 0.02], 0.035, [0, 0, 0], 4),
    ],
    'front frame and shutter pocket',
  )
}

function createGasketGeometry() {
  return mergeParts(
    [
      roundedPart([0.026, 1.3, 0.025], [-1.62, 1.98, 0.146], 0.008),
      roundedPart([0.026, 1.3, 0.025], [1.62, 1.98, 0.146], 0.008),
      roundedPart([3.24, 0.026, 0.025], [0, 1.335, 0.146], 0.008),
      roundedPart([3.24, 0.026, 0.025], [0, 2.625, 0.146], 0.008),
      // Matching rear compression beads remain visible in rear inspection.
      roundedPart([0.022, 1.3, 0.022], [-1.62, 1.98, -0.075], 0.007),
      roundedPart([0.022, 1.3, 0.022], [1.62, 1.98, -0.075], 0.007),
      roundedPart([3.24, 0.022, 0.022], [0, 1.335, -0.075], 0.007),
      roundedPart([3.24, 0.022, 0.022], [0, 2.625, -0.075], 0.007),
    ],
    'glass gaskets',
  )
}

function createFrontGlassGeometry(depth = 0.026) {
  return mergeParts(
    [roundedPart([3.24, 1.26, depth], [0, 1.98, 0.125], 0.012, [0, 0, 0], 4)],
    'laminated service glass',
  )
}

function createFrontGlassFilmGeometry() {
  return mergeParts(
    [
      roundedPart([0.72, 0.012, 0.004], [-1.16, 2.38, 0.143], 0.004, [0, 0, -0.012]),
      roundedPart([0.58, 0.012, 0.004], [1.22, 2.5, 0.143], 0.004, [0, 0, 0.009]),
    ],
    'restrained manual-mode glass film',
  )
}

function createSillGeometry() {
  return mergeParts(
    [
      roundedPart([3.7, 0.11, 0.48], [0, 0.985, 0.04], 0.034, [0, 0, 0], 5),
      roundedPart([3.74, 0.048, 0.07], [0, 1.016, 0.27], 0.022, [0, 0, 0], 5),
      roundedPart([3.56, 0.022, 0.34], [0, 0.923, 0.01], 0.009, [0, 0, 0], 3),
    ],
    'transaction sill',
  )
}

function createSillHardwareGeometry() {
  return mergeParts(
    [
      roundedPart([3.68, 0.018, 0.038], [0, 1.041, 0.255], 0.008, [0, 0, 0], 3),
      roundedPart([0.09, 0.34, 0.23], [-1.38, 0.79, -0.02], 0.018, [0, 0, -0.12], 3),
      roundedPart([0.09, 0.34, 0.23], [1.38, 0.79, -0.02], 0.018, [0, 0, 0.12], 3),
      roundedPart([0.28, 0.065, 0.25], [-1.38, 0.67, -0.02], 0.016, [0, 0, 0], 3),
      roundedPart([0.28, 0.065, 0.25], [1.38, 0.67, -0.02], 0.016, [0, 0, 0], 3),
      // Restrained edge-rub marks sit on the stainless cap rather than floating above it.
      roundedPart([0.28, 0.002, 0.006], [-0.78, 1.052, 0.274], 0.001, [0, -0.03, 0]),
      roundedPart([0.12, 0.002, 0.006], [0.47, 1.052, 0.274], 0.001, [0, 0.045, 0]),
      // A continuous rear hinge grounds the moving document flap in the sill cap.
      cylinderPart(
        0.014,
        0.76,
        [0, DOCUMENT_FLAP_REST_Y, DOCUMENT_FLAP_REST_Z],
        [0, 0, Math.PI / 2],
        24,
      ),
    ],
    'sill cap, brackets, and wear',
  )
}

function createDocumentFlapGeometry() {
  return mergeParts(
    [
      roundedPart([0.86, 0.022, 0.18], [0, 0, 0.09], 0.012, [0, 0, 0], 4),
      roundedPart([0.58, 0.006, 0.035], [0, 0.014, 0.125], 0.006, [0, 0, 0], 3),
    ],
    'hinged document transfer flap',
  )
}

function createFastenerGeometry() {
  const parts: THREE.BufferGeometry[] = []

  ;[-1.705, 1.705].forEach((x) => {
    ;[1.18, 1.72, 2.26, 2.58].forEach((y) => {
      parts.push(cylinderPart(0.014, 0.012, [x, y, 0.181], [Math.PI / 2, 0, 0], 24))
      parts.push(cylinderPart(0.011, 0.009, [x, y, -0.235], [Math.PI / 2, 0, 0], 20))
    })
  })
  ;[-1.42, -0.72, 0, 0.72, 1.42].forEach((x) => {
    parts.push(cylinderPart(0.013, 0.011, [x, 2.71, 0.181], [Math.PI / 2, 0, 0], 22))
  })
  ;[-1.38, 1.38].forEach((x) => {
    ;[0.67, 0.88].forEach((y) => {
      parts.push(cylinderPart(0.012, 0.01, [x, y, 0.112], [Math.PI / 2, 0, 0], 20))
    })
  })

  return mergeParts(parts, 'countersunk fasteners')
}

function createCorridorFloorGeometry() {
  return mergeParts(
    [
      roundedPart([5.48, 0.07, 2.16], [0, 0.035, -1.13], 0.02, [0, 0, 0], 3),
      roundedPart([5.42, 0.012, 0.025], [0, 0.077, -0.45], 0.005),
      roundedPart([5.42, 0.012, 0.025], [0, 0.077, -1.06], 0.005),
      roundedPart([5.42, 0.012, 0.025], [0, 0.077, -1.67], 0.005),
    ],
    'corridor floor and terrazzo bands',
  )
}

function createCorridorDetailsGeometry() {
  return mergeParts(
    [
      // Elevator portal and split doors occupy the left backdrop only.
      roundedPart([1.28, 0.11, 0.13], [-1.72, 2.56, -2.002], 0.02, [0, 0, 0], 3),
      roundedPart([0.11, 2.25, 0.13], [-2.305, 1.43, -2.002], 0.02, [0, 0, 0], 3),
      roundedPart([0.11, 2.25, 0.13], [-1.135, 1.43, -2.002], 0.02, [0, 0, 0], 3),
      roundedPart([0.545, 2.12, 0.055], [-2.01, 1.42, -1.986], 0.012, [0, 0, 0], 3),
      roundedPart([0.545, 2.12, 0.055], [-1.43, 1.42, -1.986], 0.012, [0, 0, 0], 3),
      roundedPart([0.016, 2.04, 0.018], [-1.72, 1.42, -1.948], 0.006),
      // A compact waiting bench stays fully left of the protected reveal column.
      roundedPart([0.94, 0.13, 0.37], [-1.76, 0.48, -1.34], 0.045, [0, 0, 0], 4),
      roundedPart([0.09, 0.48, 0.09], [-2.1, 0.24, -1.34], 0.022, [0, 0, 0], 3),
      roundedPart([0.09, 0.48, 0.09], [-1.42, 0.24, -1.34], 0.022, [0, 0, 0], 3),
      roundedPart([0.94, 0.34, 0.12], [-1.76, 0.77, -1.49], 0.04, [-0.14, 0, 0], 4),
      // Planter at far right establishes parallax without crowding the rise column.
      roundedPart([0.46, 0.47, 0.46], [2.22, 0.235, -1.43], 0.055, [0, 0, 0], 4),
      roundedPart([0.38, 0.06, 0.38], [2.22, 0.49, -1.43], 0.028, [0, 0, 0], 3),
      // Ceiling baffles communicate corridor depth in side inspection.
      ...[-2.36, -1.57, -0.78, 0, 0.78, 1.57, 2.36].map((x) =>
        roundedPart([0.36, 0.08, 2.02], [x, 3.115, -1.12], 0.018, [0, 0, 0], 3),
      ),
    ],
    'corridor fixtures',
  )
}

function createBackdropHardwareGeometry() {
  return mergeParts(
    [
      // Elevator call plate, floor indicator, and planter rim use a brighter alloy.
      roundedPart([0.09, 0.2, 0.025], [-1.02, 1.35, -1.9], 0.015, [0, 0, 0], 3),
      roundedPart([0.24, 0.08, 0.025], [-1.72, 2.49, -1.9], 0.014, [0, 0, 0], 3),
      cylinderPart(0.025, 0.02, [-1.02, 1.39, -1.88], [Math.PI / 2, 0, 0], 24),
      roundedPart([0.43, 0.025, 0.43], [2.22, 0.515, -1.43], 0.01, [0, 0, 0], 3),
      // Bench feet have actual floor contact and remain readable from the rear.
      cylinderPart(0.032, 0.05, [-2.1, 0.025, -1.34], [0, 0, 0], 24),
      cylinderPart(0.032, 0.05, [-1.42, 0.025, -1.34], [0, 0, 0], 24),
    ],
    'backdrop hardware',
  )
}

function createFluorescentGeometry(side: 'left' | 'right') {
  const x = side === 'left' ? -1.76 : 1.86
  return mergeParts(
    [
      roundedPart([1.15, 0.055, 0.28], [x, 3.045, -0.9], 0.025, [0, 0, 0], 4),
      roundedPart([1.15, 0.055, 0.28], [x, 3.045, -1.65], 0.025, [0, 0, 0], 4),
    ],
    `${side} fluorescent lenses`,
  )
}

function createFixtureHousingGeometry() {
  const parts: THREE.BufferGeometry[] = []

  ;[-1.76, 1.86].forEach((x) => {
    ;[-0.9, -1.65].forEach((z) => {
      // A four-sided housing leaves the luminous diffuser exposed from below.
      parts.push(roundedPart([1.24, 0.07, 0.045], [x, 3.05, z - 0.165], 0.014))
      parts.push(roundedPart([1.24, 0.07, 0.045], [x, 3.05, z + 0.165], 0.014))
      parts.push(roundedPart([0.045, 0.07, 0.285], [x - 0.598, 3.05, z], 0.014))
      parts.push(roundedPart([0.045, 0.07, 0.285], [x + 0.598, 3.05, z], 0.014))
      parts.push(roundedPart([0.08, 0.1, 0.08], [x - 0.48, 3.125, z], 0.014))
      parts.push(roundedPart([0.08, 0.1, 0.08], [x + 0.48, 3.125, z], 0.014))
    })
  })

  return mergeParts(parts, 'fluorescent housings and ceiling clips')
}

function createSignPlaqueGeometry() {
  return mergeParts(
    [
      roundedPart([1.82, 0.2, 0.04], [0, 3.055, 0.151], 0.025, [0, 0, 0], 4),
      roundedPart([1.82, 0.2, 0.04], [0, 3.055, -0.151], 0.025, [0, 0, 0], 4),
    ],
    'front and employee-side sign plaques',
  )
}

function createExteriorTrimGeometry() {
  return mergeParts(
    [
      roundedPart([0.11, 2.32, 0.14], [-0.405, 1.715, -2.035], 0.02, [0, 0, 0], 4),
      roundedPart([0.11, 2.32, 0.14], [2.555, 1.715, -2.035], 0.02, [0, 0, 0], 4),
      roundedPart([3.07, 0.11, 0.14], [1.075, 0.525, -2.035], 0.02, [0, 0, 0], 4),
      roundedPart([3.07, 0.11, 0.14], [1.075, 2.905, -2.035], 0.02, [0, 0, 0], 4),
      // Exterior gasket shadow lines sell glazing depth without another glass plane.
      roundedPart([0.025, 2.23, 0.025], [-0.337, 1.715, -1.95], 0.007),
      roundedPart([0.025, 2.23, 0.025], [2.487, 1.715, -1.95], 0.007),
      roundedPart([2.82, 0.025, 0.025], [1.075, 0.595, -1.95], 0.007),
      roundedPart([2.82, 0.025, 0.025], [1.075, 2.835, -1.95], 0.007),
    ],
    'exterior window frame',
  )
}

function createExteriorGlassGeometry() {
  return mergeParts(
    [roundedPart([2.81, 2.21, 0.035], [1.075, 1.715, -2.085], 0.018, [0, 0, 0], 5)],
    'exterior glazing',
  )
}

function createSkyGeometry() {
  const geometry = new THREE.PlaneGeometry(3.35, 2.62, 28, 14)
  const position = geometry.attributes.position
  const colors = new Float32Array(position.count * 3)
  const bottom = new THREE.Color('#d7aa82')
  const middle = new THREE.Color('#829ab1')
  const top = new THREE.Color('#334b69')
  const color = new THREE.Color()

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index)
    const y = position.getY(index)
    const vertical = clamp01(y / 2.62 + 0.5)
    const horizonMix = smoothstep(vertical / 0.46)
    const upperMix = smoothstep((vertical - 0.38) / 0.62)
    color.lerpColors(bottom, middle, horizonMix).lerp(top, upperMix * 0.72)
    position.setZ(index, -0.035 - 0.085 * (x / 1.675) ** 2 - 0.018 * Math.cos(x * 2.4))
    colors[index * 3] = color.r
    colors[index * 3 + 1] = color.g
    colors[index * 3 + 2] = color.b
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.translate(1.075, 1.72, -2.31)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function createCityGeometry(layer: 'far' | 'near') {
  const parts: THREE.BufferGeometry[] = []
  // The far layer sits behind the protected giraffe z-column; its low center
  // buildings can provide skyline context without occupying the reveal volume.
  const z = layer === 'far' ? -2.35 : -2.22
  const depth = layer === 'far' ? 0.035 : 0.055
  const buildings =
    layer === 'far'
      ? [
          [-0.18, 0.48, 0.3],
          [0.06, 0.65, 0.2],
          [0.29, 0.35, 0.22],
          [0.58, 0.28, 0.3],
          [0.91, 0.33, 0.27],
          [1.22, 0.24, 0.29],
          [1.55, 0.53, 0.28],
          [1.86, 0.86, 0.27],
          [2.17, 0.68, 0.31],
          [2.4, 0.45, 0.18],
        ]
      : [
          [-0.11, 0.72, 0.28],
          [1.68, 0.71, 0.26],
          [2.02, 1.06, 0.34],
          [2.37, 0.82, 0.27],
        ]

  buildings.forEach(([x, height, width]) => {
    parts.push(roundedPart([width, height, depth], [x, 0.6 + height / 2, z], 0.018, [0, 0, 0], 2))
  })

  return mergeParts(parts, `${layer} city layer`)
}

function createCityWindowGeometry() {
  const parts: THREE.BufferGeometry[] = []
  const windows: readonly (readonly [number, number])[] = [
    [-0.17, 0.88],
    [-0.1, 1.08],
    [1.63, 0.92],
    [1.73, 1.14],
    [1.96, 0.88],
    [1.96, 1.12],
    [2.07, 1.36],
    [2.07, 1.62],
    [2.29, 0.91],
    [2.39, 1.17],
  ]

  windows.forEach(([x, y]) => {
    parts.push(roundedPart([0.038, 0.065, 0.008], [x, y, -2.185], 0.005, [0, 0, 0], 2))
  })

  return mergeParts(parts, 'city window lights')
}

function createShutterPanelGeometry() {
  const parts: THREE.BufferGeometry[] = []
  for (let index = 0; index < 16; index += 1) {
    parts.push(
      roundedPart([0.68, 0.082, 0.055], [0, -0.615 + index * 0.082, 0], 0.015, [0, 0, 0], 3),
    )
  }
  parts.push(roundedPart([0.72, 0.08, 0.075], [0, -0.695, 0], 0.022, [0, 0, 0], 4))
  parts.push(roundedPart([0.06, 1.39, 0.07], [-0.34, -0.04, 0], 0.018, [0, 0, 0], 3))
  return mergeParts(parts, 'service shutter')
}

function createShutterHandleGeometry() {
  return mergeParts(
    [
      roundedPart([0.055, 0.32, 0.07], [-0.37, -0.05, 0.055], 0.018, [0, 0, 0], 4),
      cylinderPart(0.027, 0.07, [-0.37, -0.05, 0.11], [Math.PI / 2, 0, 0], 24),
    ],
    'shutter strike edge and pull',
  )
}

function createReflectionGeometry() {
  return mergeParts(
    [
      roundedPart([0.14, 1.18, 0.005], [-0.12, 0, 0], 0.02, [0, 0, -0.14], 4),
      roundedPart([0.035, 1.05, 0.005], [0.1, 0.02, 0], 0.012, [0, 0, -0.14], 3),
      roundedPart([0.018, 0.82, 0.005], [0.18, -0.08, 0], 0.008, [0, 0, -0.14], 3),
    ],
    'moving glass reflection',
  )
}

function createWarningWashGeometry() {
  return mergeParts(
    [
      roundedPart([0.26, 1.18, 0.005], [-0.94, 0, 0], 0.035, [0, 0, -0.1], 4),
      roundedPart([0.26, 1.18, 0.005], [0.78, 0, 0], 0.035, [0, 0, 0.1], 4),
    ],
    'warning reflections',
  )
}

function createAccentGeometry() {
  return mergeParts(
    [
      roundedPart([0.34, 0.025, 0.025], [0, 2.865, 0.155], 0.008, [0, 0, 0], 3),
      roundedPart([0.62, 0.012, 0.02], [0, 1.058, 0.284], 0.005, [0, 0, 0], 3),
    ],
    'architectural accent inlays',
  )
}

function createStatusLensGeometry(x: number) {
  return mergeParts(
    [
      cylinderPart(0.035, 0.028, [x, 2.82, 0.155], [Math.PI / 2, 0, 0], 32),
      roundedPart([0.082, 0.082, 0.018], [x, 2.82, 0.135], 0.022, [0, 0, 0], 4),
    ],
    `status lens ${x}`,
  )
}

function createWindowGeometry(): WindowGeometry {
  return {
    accent: createAccentGeometry(),
    backdropHardware: createBackdropHardwareGeometry(),
    cityFar: createCityGeometry('far'),
    cityNear: createCityGeometry('near'),
    cityWindows: createCityWindowGeometry(),
    corridorDetails: createCorridorDetailsGeometry(),
    corridorFloor: createCorridorFloorGeometry(),
    documentFlap: createDocumentFlapGeometry(),
    elevatorLabelFace: labelFace([0.86, 0.062], [-1.72, 2.56, -1.934]),
    exteriorGlass: createExteriorGlassGeometry(),
    exteriorTrim: createExteriorTrimGeometry(),
    fasteners: createFastenerGeometry(),
    fixtureHousings: createFixtureHousingGeometry(),
    fluorescentLeft: createFluorescentGeometry('left'),
    fluorescentRight: createFluorescentGeometry('right'),
    frontGlass: createFrontGlassGeometry(),
    frontGlassFilm: createFrontGlassFilmGeometry(),
    frontLabelFace: labelFace([1.62, 0.12], [0, 3.055, 0.173]),
    frontTrim: createFrontTrimGeometry(),
    gasket: createGasketGeometry(),
    reflection: createReflectionGeometry(),
    rearLabelFace: labelFace([1.62, 0.12], [0, 3.055, -0.173], Math.PI),
    shutterHandle: createShutterHandleGeometry(),
    shutterPanel: createShutterPanelGeometry(),
    signPlaques: createSignPlaqueGeometry(),
    sill: createSillGeometry(),
    sillHardware: createSillHardwareGeometry(),
    sky: createSkyGeometry(),
    statusLabelFace: labelFace([0.5, 0.042], [0, 2.895, 0.142]),
    wall: createWallGeometry(),
    warningWash: createWarningWashGeometry(),
  }
}

function createWindowMaterials(): WindowMaterials {
  return {
    accent: new THREE.MeshStandardMaterial({
      color: '#20383a',
      emissive: ACCENT_IDLE,
      emissiveIntensity: 0.08,
      metalness: 0.35,
      roughness: 0.36,
    }),
    approve: new THREE.MeshStandardMaterial({
      color: '#244c39',
      emissive: APPROVE_GREEN,
      emissiveIntensity: 0.05,
      metalness: 0.08,
      roughness: 0.22,
    }),
    cityFar: new THREE.MeshStandardMaterial({
      color: '#45566a',
      metalness: 0.08,
      roughness: 0.92,
    }),
    cityNear: new THREE.MeshStandardMaterial({
      color: '#253647',
      metalness: 0.14,
      roughness: 0.8,
    }),
    cityWindows: new THREE.MeshStandardMaterial({
      color: '#d9a45f',
      emissive: CITY_IDLE,
      emissiveIntensity: 0.72,
      roughness: 0.22,
      toneMapped: false,
    }),
    corridor: new THREE.MeshPhysicalMaterial({
      clearcoat: 0.2,
      clearcoatRoughness: 0.5,
      color: '#77756e',
      metalness: 0.08,
      roughness: 0.62,
    }),
    exteriorGlass: new THREE.MeshPhysicalMaterial({
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      color: EXTERIOR_GLASS_COLOR,
      depthWrite: false,
      ior: 1.46,
      metalness: 0.02,
      opacity: 0.18,
      roughness: 0.16,
      side: THREE.DoubleSide,
      thickness: 0.035,
      transmission: 0.42,
      transparent: true,
    }),
    fastener: new THREE.MeshStandardMaterial({
      color: '#a9afb0',
      metalness: 0.88,
      roughness: 0.26,
    }),
    film: new THREE.MeshBasicMaterial({
      color: '#d1ddd2',
      depthWrite: false,
      opacity: 0.1,
      side: THREE.DoubleSide,
      transparent: true,
    }),
    fluorescentLeft: new THREE.MeshStandardMaterial({
      color: '#d5cfb2',
      emissive: FLUORESCENT_WARM,
      emissiveIntensity: 0.85,
      roughness: 0.32,
      toneMapped: false,
    }),
    fluorescentRight: new THREE.MeshStandardMaterial({
      color: '#d5cfb2',
      emissive: FLUORESCENT_WARM,
      emissiveIntensity: 0.85,
      roughness: 0.32,
      toneMapped: false,
    }),
    fraudLeft: new THREE.MeshStandardMaterial({
      color: '#532327',
      emissive: FRAUD_RED,
      emissiveIntensity: 0.04,
      roughness: 0.24,
      toneMapped: false,
    }),
    fraudRight: new THREE.MeshStandardMaterial({
      color: '#5d3424',
      emissive: FRAUD_AMBER,
      emissiveIntensity: 0.04,
      roughness: 0.24,
      toneMapped: false,
    }),
    frontGlass: new THREE.MeshPhysicalMaterial({
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      color: SERVICE_GLASS_COLOR,
      depthWrite: false,
      emissive: '#102c2b',
      emissiveIntensity: 0.02,
      ior: 1.47,
      metalness: 0.01,
      opacity: 0.2,
      roughness: 0.2,
      side: THREE.DoubleSide,
      thickness: 0.026,
      transmission: 0.52,
      transparent: true,
    }),
    gasket: new THREE.MeshStandardMaterial({
      color: '#171c1c',
      metalness: 0.03,
      roughness: 0.78,
    }),
    reflection: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: '#d9fff8',
      depthWrite: false,
      opacity: 0,
      side: THREE.DoubleSide,
      transparent: true,
    }),
    reject: new THREE.MeshStandardMaterial({
      color: '#5b2428',
      emissive: REJECT_RED,
      emissiveIntensity: 0.04,
      roughness: 0.24,
      toneMapped: false,
    }),
    shutter: new THREE.MeshPhysicalMaterial({
      clearcoat: 0.48,
      clearcoatRoughness: 0.3,
      color: '#374244',
      metalness: 0.76,
      roughness: 0.34,
    }),
    sill: new THREE.MeshPhysicalMaterial({
      clearcoat: 0.55,
      clearcoatRoughness: 0.28,
      color: '#69655d',
      metalness: 0.05,
      roughness: 0.42,
    }),
    sillHardware: new THREE.MeshStandardMaterial({
      color: '#8f9999',
      metalness: 0.84,
      roughness: 0.3,
    }),
    sky: new THREE.MeshBasicMaterial({
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      vertexColors: true,
    }),
    trim: new THREE.MeshPhysicalMaterial({
      clearcoat: 0.42,
      clearcoatRoughness: 0.34,
      color: '#303b3c',
      metalness: 0.72,
      roughness: 0.36,
    }),
    wall: new THREE.MeshPhysicalMaterial({
      clearcoat: 0.08,
      clearcoatRoughness: 0.72,
      color: '#a9a59b',
      metalness: 0.02,
      roughness: 0.76,
    }),
    warningWash: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: '#ff343b',
      depthWrite: false,
      opacity: 0,
      side: THREE.DoubleSide,
      transparent: true,
    }),
  }
}

function createWindowLabelMaterials(): WindowLabelMaterials {
  return {
    elevator: createLabelMaterial('ELEVATOR  •  03', '#273437', '#e7eee9', '#708183'),
    front: createLabelMaterial('FINANCE SERVICE', '#26383a', '#f1f5ef', '#71918c'),
    rear: createLabelMaterial('EMPLOYEE SIDE', '#39413f', '#eef1e9', '#828c87'),
    status: createLabelMaterial('READY   HOLD   ALERT', '#1d292b', '#cbe0d8', '#536d69'),
  }
}

export function OfficeServiceWindow({
  effectPreset,
  effectRun = 0,
  selected = false,
  ...groupProps
}: ProceduralAssetProps) {
  const documentFlapRef = useRef<THREE.Group>(null)
  const shutterRef = useRef<THREE.Group>(null)
  const reflectionRef = useRef<THREE.Group>(null)
  const previousRunRef = useRef(effectRun)
  const selectedRef = useRef(selected)
  const motionRef = useRef<MotionState>({
    active: false,
    duration: 0,
    elapsed: 0,
  })
  const reducedMotion = useLabStore((state) => state.reducedMotion)

  const geometry = useMemo(() => createWindowGeometry(), [])
  const materials = useMemo(() => createWindowMaterials(), [])
  const labelMaterials = useMemo(() => createWindowLabelMaterials(), [])
  const statusGeometry = useMemo(
    () => ({
      approve: createStatusLensGeometry(-0.22),
      fraudLeft: createStatusLensGeometry(0.08),
      fraudRight: createStatusLensGeometry(0.24),
      reject: createStatusLensGeometry(-0.07),
    }),
    [],
  )

  useEffect(
    () => () => {
      Object.values(geometry).forEach((item) => item.dispose())
      Object.values(statusGeometry).forEach((item) => item.dispose())
      Object.values(materials).forEach((material) => material.dispose())
      Object.values(labelMaterials).forEach((material) => {
        material.map?.dispose()
        material.dispose()
      })
    },
    [geometry, labelMaterials, materials, statusGeometry],
  )

  const resetPose = useCallback(() => {
    const documentFlap = documentFlapRef.current
    const shutter = shutterRef.current
    const reflection = reflectionRef.current

    if (documentFlap) {
      documentFlap.position.set(0, DOCUMENT_FLAP_REST_Y, DOCUMENT_FLAP_REST_Z)
      documentFlap.rotation.set(0, 0, 0)
    }
    if (shutter) {
      shutter.position.set(SHUTTER_REST_X, SHUTTER_REST_Y, SHUTTER_REST_Z)
      shutter.rotation.set(0, 0, 0)
    }
    if (reflection) {
      reflection.position.set(-1.5, 1.98, 0.155)
      reflection.rotation.set(0, 0, 0)
      reflection.scale.set(1, 1, 1)
    }

    materials.accent.emissive.copy(selectedRef.current ? ACCENT_SELECTED : ACCENT_IDLE)
    materials.accent.emissiveIntensity = selectedRef.current ? 0.42 : 0.08
    materials.approve.emissive.copy(APPROVE_GREEN)
    materials.approve.emissiveIntensity = 0.05
    materials.reject.emissive.copy(REJECT_RED)
    materials.reject.emissiveIntensity = 0.04
    materials.fraudLeft.emissive.copy(FRAUD_RED)
    materials.fraudLeft.emissiveIntensity = 0.04
    materials.fraudRight.emissive.copy(FRAUD_AMBER)
    materials.fraudRight.emissiveIntensity = 0.04
    materials.fluorescentLeft.color.copy(FLUORESCENT_BASE_COLOR)
    materials.fluorescentLeft.emissive.copy(FLUORESCENT_WARM)
    materials.fluorescentLeft.emissiveIntensity = 0.85
    materials.fluorescentRight.color.copy(FLUORESCENT_BASE_COLOR)
    materials.fluorescentRight.emissive.copy(FLUORESCENT_WARM)
    materials.fluorescentRight.emissiveIntensity = 0.85
    materials.frontGlass.color.copy(SERVICE_GLASS_COLOR)
    materials.frontGlass.emissive.set('#102c2b')
    materials.frontGlass.emissiveIntensity = 0.02
    materials.frontGlass.opacity = 0.2
    materials.frontGlass.roughness = 0.2
    materials.frontGlass.transmission = 0.52
    materials.exteriorGlass.color.copy(EXTERIOR_GLASS_COLOR)
    materials.exteriorGlass.opacity = 0.18
    materials.exteriorGlass.roughness = 0.16
    materials.film.opacity = 0.1
    materials.reflection.opacity = 0
    materials.warningWash.opacity = 0
    materials.cityWindows.emissive.copy(CITY_IDLE)
    materials.cityWindows.emissiveIntensity = 0.72
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
    const documentFlap = documentFlapRef.current
    const shutter = shutterRef.current
    const reflection = reflectionRef.current
    if (!motion.active || !motion.preset || !documentFlap || !shutter || !reflection) return

    motion.elapsed += Math.min(delta, 0.05)
    const time = Math.min(1, motion.elapsed / motion.duration)
    const transformScale = reducedMotion ? 0.2 : 1
    resetPose()

    switch (motion.preset) {
      case 'paper-drop': {
        // The transfer flap takes the paper's weight as a cool reflection crosses the panes.
        const sweep = smoothstep(time / 0.72)
        const appear = pulse(time, 0.03, 0.16, 0.88)
        const flapLoad = pulse(time, 0.02, 0.18, 0.46)
        const flapSettle = dampedOscillation(time, 0.22, 2.4, 5.2)
        documentFlap.position.y = DOCUMENT_FLAP_REST_Y - transformScale * 0.004 * flapLoad
        documentFlap.rotation.x = transformScale * (0.075 * flapLoad + 0.018 * flapSettle)
        reflection.position.x = -1.5 + transformScale * 3.05 * sweep
        reflection.position.y = 1.98 + transformScale * 0.025 * flapSettle
        reflection.rotation.z = transformScale * 0.015 * flapSettle
        materials.reflection.opacity = 0.52 * appear
        materials.frontGlass.emissiveIntensity = 0.02 + 0.08 * appear
        break
      }

      case 'approve': {
        // The green header indicator rises cleanly, breathes once, and settles.
        const on = smoothstep(time / 0.18)
        const off = smoothstep((time - 0.7) / 0.24)
        const envelope = on * (1 - off)
        const breathe = reducedMotion ? 0.2 : Math.sin(time * Math.PI * 3.2) ** 2
        const settle = dampedOscillation(time, 0.36, 1.55, 5.8)
        materials.approve.emissiveIntensity = 0.05 + envelope * (2.45 + 0.48 * breathe)
        materials.accent.emissive.copy(APPROVE_GREEN)
        materials.accent.emissiveIntensity =
          (selectedRef.current ? 0.42 : 0.08) + envelope * 0.52 + settle * 0.08
        materials.frontGlass.emissive.copy(APPROVE_GREEN)
        materials.frontGlass.emissiveIntensity = 0.02 + envelope * 0.055
        break
      }

      case 'reject': {
        // The pocketed security shutter anticipates right, snaps left, rings, then reopens.
        const anticipate = pulse(time, 0.01, 0.09, 0.16)
        const close = smoothstep((time - 0.11) / 0.16)
        const reopen = smoothstep((time - 0.6) / 0.25)
        const ring = dampedOscillation(time, 0.26, 3.1, 4.6)
        const travel = transformScale * 1.13 * close * (1 - reopen)
        shutter.position.x =
          SHUTTER_REST_X +
          transformScale * 0.045 * anticipate -
          travel +
          transformScale * 0.024 * ring
        shutter.rotation.z = transformScale * 0.008 * ring
        const redPulse = pulse(time, 0.13, 0.29, 0.82)
        materials.reject.emissiveIntensity = 0.04 + redPulse * 3.2
        materials.warningWash.opacity = redPulse * 0.18
        break
      }

      case 'fraud': {
        // Twin fixed warning beacons alternate, with their light captured as two glass streaks.
        const attack = smoothstep(time / 0.1)
        const release = 1 - smoothstep((time - 0.84) / 0.13)
        const envelope = attack * release
        const leftFlash = reducedMotion
          ? 0.72
          : Math.max(0, Math.sin(time * Math.PI * 10 + 0.55)) ** 3
        const rightFlash = reducedMotion
          ? 0.72
          : Math.max(0, Math.sin(time * Math.PI * 10 + Math.PI + 0.55)) ** 3
        materials.fraudLeft.emissiveIntensity = 0.04 + envelope * (0.55 + 4 * leftFlash)
        materials.fraudRight.emissiveIntensity = 0.04 + envelope * (0.55 + 3.6 * rightFlash)
        materials.warningWash.opacity = envelope * (0.12 + 0.2 * Math.max(leftFlash, rightFlash))
        materials.frontGlass.emissive.copy(FRAUD_RED)
        materials.frontGlass.emissiveIntensity = 0.02 + envelope * 0.075
        break
      }

      case 'printer-jam': {
        // A deterministic ballast fault travels left-to-right; reduced motion holds a steady cue.
        const leftEnvelope = smoothstep(time / 0.09) * (1 - smoothstep((time - 0.82) / 0.14))
        const rightEnvelope =
          smoothstep((time - 0.11) / 0.09) * (1 - smoothstep((time - 0.88) / 0.1))
        const leftStep = reducedMotion ? 0.46 : steppedBallastFlicker(time)
        const rightStep = reducedMotion ? 0.34 : steppedBallastFlicker(Math.max(0, time - 0.11))
        const ballastBuzz = reducedMotion ? 0 : Math.sin(time * Math.PI * 38)
        materials.fluorescentLeft.emissiveIntensity = Math.max(
          0.08,
          0.85 + leftEnvelope * (leftStep - 0.85 + 0.08 * ballastBuzz),
        )
        materials.fluorescentRight.emissiveIntensity = Math.max(
          0.08,
          0.85 + rightEnvelope * (rightStep - 0.85 - 0.07 * ballastBuzz),
        )
        materials.fluorescentLeft.emissive.lerpColors(
          FLUORESCENT_WARM,
          reducedMotion || (leftEnvelope > 0.2 && leftStep < 0.2)
            ? FLUORESCENT_WARNING
            : FLUORESCENT_WARM,
          leftEnvelope,
        )
        materials.fluorescentRight.emissive.lerpColors(
          FLUORESCENT_WARM,
          reducedMotion || (rightEnvelope > 0.2 && rightStep < 0.2)
            ? FLUORESCENT_WARNING
            : FLUORESCENT_WARM,
          rightEnvelope,
        )
        const glassCue = Math.max(leftEnvelope * leftStep, rightEnvelope * rightStep)
        materials.frontGlass.emissiveIntensity = 0.02 + 0.045 * glassCue
        materials.reflection.opacity = 0.09 * glassCue
        reflection.position.x = -0.5 + transformScale * 0.02 * ballastBuzz
        reflection.scale.x = 2.2
        break
      }

      case 'migration': {
        // The room blacks out, relights neutral, and the laminated glass visibly clears.
        const blackout = pulse(time, 0, 0.12, 0.29)
        const cleanLeft = smoothstep((time - 0.23) / 0.42)
        const cleanRight = smoothstep((time - 0.34) / 0.42)
        const clean = (cleanLeft + cleanRight) / 2
        const completion = pulse(time, 0.69, 0.83, 0.98)
        const glassSettle = dampedOscillation(time, 0.49, 1.7, 5.4)
        materials.fluorescentLeft.color.lerpColors(
          FLUORESCENT_BASE_COLOR,
          FLUORESCENT_CLEAN_COLOR,
          cleanLeft,
        )
        materials.fluorescentRight.color.lerpColors(
          FLUORESCENT_BASE_COLOR,
          FLUORESCENT_CLEAN_COLOR,
          cleanRight,
        )
        materials.fluorescentLeft.emissive.lerpColors(
          FLUORESCENT_WARM,
          FLUORESCENT_CLEAN,
          cleanLeft,
        )
        materials.fluorescentRight.emissive.lerpColors(
          FLUORESCENT_WARM,
          FLUORESCENT_CLEAN,
          cleanRight,
        )
        materials.fluorescentLeft.emissiveIntensity =
          0.85 * (1 - blackout) + cleanLeft * 0.75 + completion * 1.2
        materials.fluorescentRight.emissiveIntensity =
          0.85 * (1 - blackout) + cleanRight * 0.75 + completion * 1.2
        materials.frontGlass.color.lerpColors(SERVICE_GLASS_COLOR, CLEAN_GLASS_COLOR, clean)
        materials.frontGlass.roughness = 0.2 - clean * 0.14
        materials.frontGlass.opacity = 0.2 - clean * 0.075
        materials.frontGlass.transmission = 0.52 + clean * 0.2
        materials.frontGlass.emissive.copy(FLUORESCENT_CLEAN)
        materials.frontGlass.emissiveIntensity = 0.02 + completion * 0.06
        materials.exteriorGlass.color.lerpColors(EXTERIOR_GLASS_COLOR, CLEAN_GLASS_COLOR, clean)
        materials.exteriorGlass.roughness = 0.16 - clean * 0.07
        materials.exteriorGlass.opacity = 0.18 - clean * 0.045
        materials.film.opacity = 0.1 * (1 - clean)
        materials.cityWindows.emissive.lerpColors(CITY_IDLE, CITY_CLEAN, clean)
        materials.cityWindows.emissiveIntensity = 0.72 + clean * 0.8 + completion * 0.65
        materials.accent.emissive.copy(FLUORESCENT_CLEAN)
        materials.accent.emissiveIntensity = (selectedRef.current ? 0.42 : 0.08) + completion * 1.75
        reflection.position.x = -1.25 + transformScale * 2.5 * clean
        reflection.rotation.z = transformScale * 0.012 * glassSettle
        materials.reflection.opacity = 0.24 * completion
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
      userData={{
        ...groupProps.userData,
        assetContract: OFFICE_SERVICE_WINDOW_CONTRACT,
      }}
    >
      <mesh geometry={geometry.wall} material={materials.wall} castShadow receiveShadow />
      <mesh geometry={geometry.frontTrim} material={materials.trim} castShadow receiveShadow />
      <mesh geometry={geometry.signPlaques} material={materials.trim} castShadow receiveShadow />
      <mesh geometry={geometry.frontLabelFace} material={labelMaterials.front} />
      <mesh geometry={geometry.rearLabelFace} material={labelMaterials.rear} />
      <mesh geometry={geometry.statusLabelFace} material={labelMaterials.status} />
      <mesh geometry={geometry.gasket} material={materials.gasket} castShadow receiveShadow />
      <mesh
        geometry={geometry.frontGlass}
        material={materials.frontGlass}
        receiveShadow
        renderOrder={3}
      />
      <mesh geometry={geometry.frontGlassFilm} material={materials.film} renderOrder={4} />
      <mesh geometry={geometry.sill} material={materials.sill} castShadow receiveShadow />
      <group ref={documentFlapRef} position={[0, DOCUMENT_FLAP_REST_Y, DOCUMENT_FLAP_REST_Z]}>
        <mesh
          geometry={geometry.documentFlap}
          material={materials.sillHardware}
          castShadow
          receiveShadow
        />
      </group>
      <mesh
        geometry={geometry.sillHardware}
        material={materials.sillHardware}
        castShadow
        receiveShadow
      />
      <mesh geometry={geometry.fasteners} material={materials.fastener} castShadow receiveShadow />
      <mesh geometry={geometry.accent} material={materials.accent} castShadow />

      <mesh geometry={statusGeometry.approve} material={materials.approve} castShadow />
      <mesh geometry={statusGeometry.reject} material={materials.reject} castShadow />
      <mesh geometry={statusGeometry.fraudLeft} material={materials.fraudLeft} castShadow />
      <mesh geometry={statusGeometry.fraudRight} material={materials.fraudRight} castShadow />

      <group ref={shutterRef} position={[SHUTTER_REST_X, SHUTTER_REST_Y, SHUTTER_REST_Z]}>
        <mesh
          geometry={geometry.shutterPanel}
          material={materials.shutter}
          castShadow
          receiveShadow
        />
        <mesh
          geometry={geometry.shutterHandle}
          material={materials.sillHardware}
          castShadow
          receiveShadow
        />
      </group>

      <group ref={reflectionRef} position={[-1.5, 1.98, 0.155]}>
        <mesh geometry={geometry.reflection} material={materials.reflection} renderOrder={5} />
      </group>
      <mesh
        geometry={geometry.warningWash}
        material={materials.warningWash}
        position={[0, 1.98, 0.155]}
        renderOrder={5}
      />

      <mesh
        geometry={geometry.corridorFloor}
        material={materials.corridor}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={geometry.corridorDetails}
        material={materials.corridor}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={geometry.backdropHardware}
        material={materials.sillHardware}
        castShadow
        receiveShadow
      />
      <mesh geometry={geometry.elevatorLabelFace} material={labelMaterials.elevator} />
      <mesh
        geometry={geometry.fixtureHousings}
        material={materials.trim}
        castShadow
        receiveShadow
      />
      <mesh geometry={geometry.fluorescentLeft} material={materials.fluorescentLeft} />
      <mesh geometry={geometry.fluorescentRight} material={materials.fluorescentRight} />

      <mesh geometry={geometry.sky} material={materials.sky} renderOrder={-2} />
      <mesh geometry={geometry.cityFar} material={materials.cityFar} receiveShadow />
      <mesh geometry={geometry.cityNear} material={materials.cityNear} receiveShadow />
      <mesh geometry={geometry.cityWindows} material={materials.cityWindows} />
      <mesh
        geometry={geometry.exteriorGlass}
        material={materials.exteriorGlass}
        receiveShadow
        renderOrder={1}
      />
      <mesh geometry={geometry.exteriorTrim} material={materials.trim} castShadow receiveShadow />

      {/*
        World anchors: wall z=0; sill top (0, 1.04, 0.18); service opening
        x[-1.64, 1.64], y[1.08, 2.66]; protected giraffe rise anchor
        (0.76, 0, -2.22). Overall envelope 5.80 W × 3.20 H × 2.65 D.
        Full placement metadata is retained in OFFICE_SERVICE_WINDOW_CONTRACT.
      */}
    </group>
  )
}
