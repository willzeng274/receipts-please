import { RoundedBox } from '@react-three/drei'
import { useFrame, type ThreeElements } from '@react-three/fiber'
import {
  Children,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { useLabStore } from '../../store/useLabStore'
import type { ProceduralAssetProps } from '../types'

const HALF_PI = Math.PI / 2

// Root-local desk-fit contract. With the scene root at [0, .85, -.10], the
// keyboard occupies world z .045….223 and the mouse .096….235: both sit in the
// authored input outline and stop before the document mat. The stand foot stays
// inside the desk's usable rear edge at world z -.168.
const MONITOR_STAND_FOOT_Z = 0.035
const KEYBOARD_Z = 0.234
const MOUSE_X = 0.3
const MOUSE_Z = 0.27

/**
 * Stable root-local contract for the focused operating system mounted by the scene.
 * The screen and Html face +Z with +Y up. The safe area leaves a 10 mm bezel-side inset.
 */
// oxlint-disable-next-line react/only-export-components -- scene-level Html uses this exact model-space contract.
export const DESK_COMPUTER_SCREEN = {
  position: [-0.08, 0.405, 0.101] as const,
  rotation: [0, 0, 0] as const,
  normal: [0, 0, 1] as const,
  glassWidth: 0.64,
  glassHeight: 0.36,
  safeWidth: 0.62,
  safeHeight: 0.34,
} as const

const KEY_UNIT = 0.01905
const KEY_GAP = 0.003
const KEY_FACE = KEY_UNIT - KEY_GAP
const KEY_ROW_STEP = 0.0205
const KEY_BASE_Y = 0.0365
const MAIN_KEY_LEFT = -0.241
const NAV_KEY_LEFT = 0.066
const NUMPAD_KEY_LEFT = 0.145

type RowEntry = readonly [
  id: string,
  widthUnits: number,
  gapBeforeUnits?: number,
]

type KeySpec = {
  id: string
  label: string
  x: number
  y: number
  z: number
  width: number
  depth: number
  rotationX: number
}

const KEY_LABELS: Readonly<Record<string, string>> = {
  esc: 'Esc',
  grave: '`  ~',
  minus: '-  _',
  equals: '=  +',
  backspace: 'Bksp',
  tab: 'Tab',
  'bracket-left': '[  {',
  'bracket-right': ']  }',
  backslash: '\\  |',
  caps: 'Caps',
  semicolon: ';  :',
  quote: `'  "`,
  enter: 'Enter',
  'shift-left': 'Shift',
  'shift-right': 'Shift',
  comma: ',  <',
  period: '.  >',
  slash: '/  ?',
  'ctrl-left': 'Ctrl',
  'ctrl-right': 'Ctrl',
  'meta-left': 'OS',
  'alt-left': 'Alt',
  'alt-right': 'Alt',
  space: '',
  fn: 'Fn',
  menu: 'Menu',
  insert: 'Insert',
  home: 'Home',
  'page-up': 'PgUp',
  delete: 'Delete',
  end: 'End',
  'page-down': 'PgDn',
  'arrow-up': '↑',
  'arrow-left': '←',
  'arrow-down': '↓',
  'arrow-right': '→',
  'print-screen': 'Prt',
  'scroll-lock': 'Scr',
  pause: 'Pause',
  'num-lock': 'Num',
  'num-divide': '/',
  'num-multiply': '×',
  'num-minus': '−',
  'num-plus': '+',
  'num-enter': 'Enter',
  'num-period': '.',
  'num-0': '0',
  'num-1': '1',
  'num-2': '2',
  'num-3': '3',
  'num-4': '4',
  'num-5': '5',
  'num-6': '6',
  'num-7': '7',
  'num-8': '8',
  'num-9': '9',
}

function getKeyLabel(id: string) {
  if (KEY_LABELS[id]) return KEY_LABELS[id]
  if (/^f\d{1,2}$/.test(id)) return id.toUpperCase()
  if (id.length === 1) return id.toUpperCase()
  return id
}

function buildKeyboardLayout() {
  const keys: KeySpec[] = []

  const addRow = (
    entries: readonly RowEntry[],
    left: number,
    z: number,
  ) => {
    let cursor = left
    entries.forEach(([id, widthUnits, gapBeforeUnits = 0]) => {
      cursor += gapBeforeUnits * KEY_UNIT
      const pitchWidth = widthUnits * KEY_UNIT
      keys.push({
        id,
        label: getKeyLabel(id),
        x: cursor + pitchWidth / 2,
        y: KEY_BASE_Y,
        z,
        width: pitchWidth - KEY_GAP,
        depth: KEY_FACE,
        rotationX: 0,
      })
      cursor += pitchWidth
    })
  }

  addRow(
    [
      ['esc', 1],
      ['f1', 1, 0.5],
      ['f2', 1],
      ['f3', 1],
      ['f4', 1],
      ['f5', 1, 0.5],
      ['f6', 1],
      ['f7', 1],
      ['f8', 1],
      ['f9', 1, 0.5],
      ['f10', 1],
      ['f11', 1],
      ['f12', 1],
    ],
    MAIN_KEY_LEFT,
    -0.066,
  )

  addRow(
    [
      ['grave', 1],
      ['1', 1],
      ['2', 1],
      ['3', 1],
      ['4', 1],
      ['5', 1],
      ['6', 1],
      ['7', 1],
      ['8', 1],
      ['9', 1],
      ['0', 1],
      ['minus', 1],
      ['equals', 1],
      ['backspace', 2],
    ],
    MAIN_KEY_LEFT,
    -0.042,
  )

  addRow(
    [
      ['tab', 1.5],
      ['q', 1],
      ['w', 1],
      ['e', 1],
      ['r', 1],
      ['t', 1],
      ['y', 1],
      ['u', 1],
      ['i', 1],
      ['o', 1],
      ['p', 1],
      ['bracket-left', 1],
      ['bracket-right', 1],
      ['backslash', 1.5],
    ],
    MAIN_KEY_LEFT,
    -0.021,
  )

  addRow(
    [
      ['caps', 1.75],
      ['a', 1],
      ['s', 1],
      ['d', 1],
      ['f', 1],
      ['g', 1],
      ['h', 1],
      ['j', 1],
      ['k', 1],
      ['l', 1],
      ['semicolon', 1],
      ['quote', 1],
      ['enter', 2.25],
    ],
    MAIN_KEY_LEFT,
    0,
  )

  addRow(
    [
      ['shift-left', 2.25],
      ['z', 1],
      ['x', 1],
      ['c', 1],
      ['v', 1],
      ['b', 1],
      ['n', 1],
      ['m', 1],
      ['comma', 1],
      ['period', 1],
      ['slash', 1],
      ['shift-right', 2.75],
    ],
    MAIN_KEY_LEFT,
    0.021,
  )

  addRow(
    [
      ['ctrl-left', 1.25],
      ['meta-left', 1.25],
      ['alt-left', 1.25],
      ['space', 6.25],
      ['alt-right', 1.25],
      ['fn', 1.25],
      ['menu', 1.25],
      ['ctrl-right', 1.25],
    ],
    MAIN_KEY_LEFT,
    0.043,
  )

  const addGridKey = (
    id: string,
    column: number,
    row: number,
    left: number,
    top: number,
    widthUnits = 1,
    depthUnits = 1,
  ) => {
    keys.push({
      id,
      label: getKeyLabel(id),
      x: left + (column + widthUnits / 2) * KEY_UNIT,
      y: KEY_BASE_Y,
      z: top + (row + depthUnits / 2) * KEY_ROW_STEP,
      width: widthUnits * KEY_UNIT - KEY_GAP,
      depth: depthUnits * KEY_ROW_STEP - KEY_GAP,
      rotationX: 0,
    })
  }

  addGridKey('insert', 0, 0, NAV_KEY_LEFT, -0.043)
  addGridKey('home', 1, 0, NAV_KEY_LEFT, -0.043)
  addGridKey('page-up', 2, 0, NAV_KEY_LEFT, -0.043)
  addGridKey('delete', 0, 1, NAV_KEY_LEFT, -0.043)
  addGridKey('end', 1, 1, NAV_KEY_LEFT, -0.043)
  addGridKey('page-down', 2, 1, NAV_KEY_LEFT, -0.043)
  addGridKey('arrow-up', 1, 3, NAV_KEY_LEFT, -0.043)
  addGridKey('arrow-left', 0, 4, NAV_KEY_LEFT, -0.043)
  addGridKey('arrow-down', 1, 4, NAV_KEY_LEFT, -0.043)
  addGridKey('arrow-right', 2, 4, NAV_KEY_LEFT, -0.043)
  addGridKey('print-screen', 0, 0, NAV_KEY_LEFT, -0.07625)
  addGridKey('scroll-lock', 1, 0, NAV_KEY_LEFT, -0.07625)
  addGridKey('pause', 2, 0, NAV_KEY_LEFT, -0.07625)

  addGridKey('num-lock', 0, 0, NUMPAD_KEY_LEFT, -0.05225)
  addGridKey('num-divide', 1, 0, NUMPAD_KEY_LEFT, -0.05225)
  addGridKey('num-multiply', 2, 0, NUMPAD_KEY_LEFT, -0.05225)
  addGridKey('num-minus', 3, 0, NUMPAD_KEY_LEFT, -0.05225)
  addGridKey('num-7', 0, 1, NUMPAD_KEY_LEFT, -0.05225)
  addGridKey('num-8', 1, 1, NUMPAD_KEY_LEFT, -0.05225)
  addGridKey('num-9', 2, 1, NUMPAD_KEY_LEFT, -0.05225)
  addGridKey('num-plus', 3, 1, NUMPAD_KEY_LEFT, -0.05225, 1, 2)
  addGridKey('num-4', 0, 2, NUMPAD_KEY_LEFT, -0.05225)
  addGridKey('num-5', 1, 2, NUMPAD_KEY_LEFT, -0.05225)
  addGridKey('num-6', 2, 2, NUMPAD_KEY_LEFT, -0.05225)
  addGridKey('num-1', 0, 3, NUMPAD_KEY_LEFT, -0.05225)
  addGridKey('num-2', 1, 3, NUMPAD_KEY_LEFT, -0.05225)
  addGridKey('num-3', 2, 3, NUMPAD_KEY_LEFT, -0.05225)
  addGridKey('num-enter', 3, 3, NUMPAD_KEY_LEFT, -0.05225, 1, 2)
  addGridKey('num-0', 0, 4, NUMPAD_KEY_LEFT, -0.05225, 2)
  addGridKey('num-period', 2, 4, NUMPAD_KEY_LEFT, -0.05225)

  // A restrained rear-to-front rise gives each row a readable manufactured
  // step without turning the board into a tall gaming-keyboard wedge.
  keys.forEach((key) => {
    const rearBias = THREE.MathUtils.clamp((0.052 - key.z) / 0.13, 0, 1)
    key.y = KEY_BASE_Y + rearBias * 0.0038
    key.rotationX = -0.04
    // The unshifted full 104-key field spans x -0.249…0.229 and
    // z -0.074…0.059. Center that measured envelope in the 0.51 × 0.178 m
    // housing so all four deck margins are deliberate and even.
    key.x += 0.01
    key.z += 0.0075
  })

  return keys
}

const KEY_LAYOUT = buildKeyboardLayout()
const ESCAPE_KEY = KEY_LAYOUT.find((key) => key.id === 'esc') as KeySpec
const STATIC_KEYS = KEY_LAYOUT.filter((key) => key.id !== 'esc')

const MOUSE_LEFT_BUTTON_PIVOT = [-0.011, 0.0412, -0.0158] as const

const MONITOR_REAR_VENTS = Array.from({ length: 18 }, (_, index) => ({
  position: [-0.284 + index * 0.024, 0.535, -0.012] as const,
  rotation: [0, 0, 0] as const,
}))

const TOWER_SIDE_VENTS = Array.from({ length: 10 }, (_, index) => ({
  position: [0.493, 0.062 + index * 0.0135, -0.036] as const,
  rotation: [0, 0, 0] as const,
}))

const MONITOR_REAR_SCREWS = [
  [-0.31, 0.282, -0.013],
  [0.15, 0.282, -0.013],
  [-0.31, 0.528, -0.013],
  [0.15, 0.528, -0.013],
] as const

const TOWER_LED_IDLE_COLOR = new THREE.Color('#69dd92')
const TOWER_LED_IDLE_EMISSIVE = new THREE.Color('#3aff84')
const TOWER_LED_ALERT_COLOR = new THREE.Color('#ff4a3f')
const TOWER_LED_ALERT_EMISSIVE = new THREE.Color('#ff2f25')

const LABEL_ATLAS_SIZE = [512, 128] as const
const LABEL_ATLAS_REGIONS = {
  rearDisplay: { x: 0, y: 0, width: 256, height: 40 },
  towerArchive: { x: 256, y: 0, width: 160, height: 40 },
  towerRevision: { x: 0, y: 40, width: 256, height: 40 },
  escape: { x: 256, y: 40, width: 64, height: 40 },
  keyboardBadge: { x: 0, y: 80, width: 256, height: 40 },
  standBadge: { x: 256, y: 80, width: 160, height: 40 },
} as const
type LabelAtlasKey = keyof typeof LABEL_ATLAS_REGIONS

const LABEL_DEFINITIONS: ReadonlyArray<{
  key: LabelAtlasKey
  text: string
  color: string
}> = [
  { key: 'rearDisplay', text: 'EXPENSE OS / DISPLAY 29', color: '#9daaa2' },
  { key: 'towerArchive', text: 'ARCHIVE / CARD I-O', color: '#28302c' },
  { key: 'towerRevision', text: 'FINANCE DOCK / REV 04', color: '#91a89e' },
  { key: 'escape', text: 'Esc', color: '#edf4ed' },
  { key: 'keyboardBadge', text: 'EXPENSE OS / K104', color: '#303733' },
  { key: 'standBadge', text: 'EXPENSE OS', color: '#dde2d9' },
]

function makeLabelAtlas() {
  const canvas = document.createElement('canvas')
  canvas.width = LABEL_ATLAS_SIZE[0]
  canvas.height = LABEL_ATLAS_SIZE[1]
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to create workstation label atlas')

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  LABEL_DEFINITIONS.forEach(({ color, key, text }) => {
    const region = LABEL_ATLAS_REGIONS[key]
    const fontSize = Math.floor(
      Math.min((region.width - 10) / Math.max(text.length * 0.62, 1), region.height - 10),
    )
    context.fillStyle = color
    context.font = `600 ${Math.max(11, fontSize)}px "IBM Plex Mono", "SFMono-Regular", monospace`
    context.fillText(text, region.x + region.width / 2, region.y + region.height / 2)
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  return texture
}

function makeLabelGeometry(width: number, height: number, key: LabelAtlasKey) {
  const geometry = new THREE.PlaneGeometry(width, height)
  const uv = geometry.getAttribute('uv')
  const region = LABEL_ATLAS_REGIONS[key]
  const uMin = region.x / LABEL_ATLAS_SIZE[0]
  const uMax = (region.x + region.width) / LABEL_ATLAS_SIZE[0]
  const vMin = 1 - (region.y + region.height) / LABEL_ATLAS_SIZE[1]
  const vMax = 1 - region.y / LABEL_ATLAS_SIZE[1]
  for (let index = 0; index < uv.count; index += 1) {
    uv.setXY(
      index,
      THREE.MathUtils.lerp(uMin, uMax, uv.getX(index)),
      THREE.MathUtils.lerp(vMin, vMax, uv.getY(index)),
    )
  }
  uv.needsUpdate = true
  return geometry
}

function LabelPlane({
  atlasKey,
  height,
  material,
  width,
  ...meshProps
}: Omit<ThreeElements['mesh'], 'geometry' | 'material'> & {
  atlasKey: LabelAtlasKey
  height: number
  material: THREE.MeshBasicMaterial
  width: number
}) {
  const geometry = useMemo(
    () => makeLabelGeometry(width, height, atlasKey),
    [atlasKey, height, width],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} material={material} {...meshProps} />
}

type AnimationState = {
  active: boolean
  elapsed: number
  preset: ProceduralAssetProps['effectPreset']
}

function clamp01(value: number) {
  return THREE.MathUtils.clamp(value, 0, 1)
}

function smoothStep(value: number) {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

function smootherStep(value: number) {
  const t = clamp01(value)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function pulseEnvelope(
  time: number,
  attack: number,
  releaseStart: number,
  release: number,
) {
  return (
    smoothStep(time / attack) *
    (1 - smoothStep((time - releaseStart) / release))
  )
}

function makeRoundedKeyGeometry() {
  const bevelSize = 0.001
  // ExtrudeGeometry grows the outline by bevelSize on every side. Start from
  // the inset tool profile so the manufactured cap finishes at KEY_FACE.
  const halfFace = (KEY_FACE - bevelSize * 2) / 2
  const radius = 0.0024
  const shape = new THREE.Shape()

  shape.moveTo(-halfFace + radius, -halfFace)
  shape.lineTo(halfFace - radius, -halfFace)
  shape.quadraticCurveTo(halfFace, -halfFace, halfFace, -halfFace + radius)
  shape.lineTo(halfFace, halfFace - radius)
  shape.quadraticCurveTo(halfFace, halfFace, halfFace - radius, halfFace)
  shape.lineTo(-halfFace + radius, halfFace)
  shape.quadraticCurveTo(-halfFace, halfFace, -halfFace, halfFace - radius)
  shape.lineTo(-halfFace, -halfFace + radius)
  shape.quadraticCurveTo(-halfFace, -halfFace, -halfFace + radius, -halfFace)
  shape.closePath()

  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize,
    bevelThickness: 0.001,
    curveSegments: 3,
    depth: 0.008,
  })
  geometry.rotateX(-HALF_PI)
  geometry.computeVertexNormals()
  return geometry
}

function makeKeyboardLegendLayer(keys: readonly KeySpec[]) {
  const columns = 16
  const rows = Math.ceil(keys.length / columns)
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to create keyboard legend atlas')

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#f0f3ed'
  context.strokeStyle = '#303733'
  context.lineJoin = 'round'
  context.lineWidth = 1.5
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  const cellWidth = canvas.width / columns
  const cellHeight = canvas.height / rows
  const geometries = keys.map((key, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const lines = key.label.split('\n')
    const longestLine = Math.max(...lines.map((line) => line.length), 1)
    const fontSize = THREE.MathUtils.clamp(
      Math.min(cellWidth / (longestLine * 0.62), cellHeight / (lines.length * 1.18)),
      11,
      28,
    )
    const centerX = (column + 0.5) * cellWidth
    const centerY = (row + 0.5) * cellHeight
    const lineHeight = fontSize * 0.92
    context.font = `600 ${fontSize}px "IBM Plex Mono", "SFMono-Regular", monospace`
    lines.forEach((line, lineIndex) => {
      const y = centerY + (lineIndex - (lines.length - 1) / 2) * lineHeight
      context.strokeText(line, centerX, y)
      context.fillText(line, centerX, y)
    })

    const geometry = new THREE.PlaneGeometry(
      key.width * 0.82,
      Math.min(key.depth * 0.68, 0.014),
    )
    const uv = geometry.getAttribute('uv')
    const uMin = column / columns
    const uMax = (column + 1) / columns
    const vMin = 1 - (row + 1) / rows
    const vMax = 1 - row / rows
    uv.setXY(0, uMin, vMax)
    uv.setXY(1, uMax, vMax)
    uv.setXY(2, uMin, vMin)
    uv.setXY(3, uMax, vMin)
    uv.needsUpdate = true
    geometry.rotateX(-HALF_PI)
    geometry.translate(0, 0.00925, 0)
    geometry.rotateX(key.rotationX)
    geometry.translate(key.x, key.y, key.z)
    return geometry
  })

  const geometry = mergeGeometries(geometries, false)
  geometries.forEach((part) => part.dispose())
  if (!geometry) throw new Error('Unable to merge keyboard legend geometry')

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return { geometry, texture }
}

function getMouseSurfacePoint(u: number, v: number) {
  const z = THREE.MathUtils.lerp(-0.061, 0.058, v)
  const widthEnvelope = 0.78 + 0.22 * Math.pow(Math.sin(Math.PI * v), 0.7)
  const halfWidth = 0.035 * widthEnvelope
  const rise =
    v < 0.58
      ? smootherStep(v / 0.58)
      : 1 - smootherStep((v - 0.58) / 0.42)
  const centerHeight = THREE.MathUtils.lerp(0.026, 0.0545, rise)
  const archExponent = THREE.MathUtils.lerp(0.18, 0.54, smootherStep(v))
  const arch = Math.pow(
    Math.max(0, 1 - Math.pow(Math.abs(u), 2.25)),
    archExponent,
  )
  const handBias = 0.0016 * Math.sin(Math.PI * v) * (1 - Math.abs(u))
  return new THREE.Vector3(
    u * halfWidth + handBias,
    0.0045 + (centerHeight - 0.0045) * arch,
    z,
  )
}

function makeMouseButtonGeometry(side: 'left' | 'right') {
  const longitudinalSegments = 6
  const lateralSegments = 5
  const positions: number[] = []
  const indices: number[] = []
  const rowLength = lateralSegments + 1
  const pivot =
    side === 'left'
      ? new THREE.Vector3(...MOUSE_LEFT_BUTTON_PIVOT)
      : new THREE.Vector3(0.012, 0.0412, -0.0158)
  const uStart = side === 'left' ? -0.61 : 0.05
  const uEnd = side === 'left' ? -0.05 : 0.61

  for (let zIndex = 0; zIndex <= longitudinalSegments; zIndex += 1) {
    const v = THREE.MathUtils.lerp(0.045, 0.38, zIndex / longitudinalSegments)
    for (let xIndex = 0; xIndex <= lateralSegments; xIndex += 1) {
      const u = THREE.MathUtils.lerp(
        uStart,
        uEnd,
        xIndex / lateralSegments,
      )
      const point = getMouseSurfacePoint(u, v)
      point.y += 0.00035
      point.sub(pivot)
      positions.push(point.x, point.y, point.z)
    }
  }

  for (let zIndex = 0; zIndex < longitudinalSegments; zIndex += 1) {
    for (let xIndex = 0; xIndex < lateralSegments; xIndex += 1) {
      const a = zIndex * rowLength + xIndex
      const b = a + rowLength
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function makeMouseShellGeometry() {
  const longitudinalSegments = 28
  const lateralSegments = 18
  const positions: number[] = []
  const indices: number[] = []
  const rowLength = lateralSegments + 1
  const bottomY = 0.003

  for (let zIndex = 0; zIndex <= longitudinalSegments; zIndex += 1) {
    const v = zIndex / longitudinalSegments

    for (let xIndex = 0; xIndex <= lateralSegments; xIndex += 1) {
      const u = -1 + (xIndex / lateralSegments) * 2
      const point = getMouseSurfacePoint(u, v)
      positions.push(point.x, point.y, point.z)
    }
  }

  for (let zIndex = 0; zIndex < longitudinalSegments; zIndex += 1) {
    for (let xIndex = 0; xIndex < lateralSegments; xIndex += 1) {
      const a = zIndex * rowLength + xIndex
      const b = a + rowLength
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }

  // The flat underside only needs the footprint perimeter and one center
  // vertex. Keeping a second 29 x 19 grid here added 916 invisible triangles.
  // The perimeter runs clockwise from above so its fan faces down.
  const bottomPerimeter: number[] = []
  const bottomIndexByTopIndex: number[] = []
  const addBottomVertex = (topIndex: number) => {
    const vertexIndex = positions.length / 3
    positions.push(
      positions[topIndex * 3],
      bottomY,
      positions[topIndex * 3 + 2],
    )
    bottomPerimeter.push(vertexIndex)
    bottomIndexByTopIndex[topIndex] = vertexIndex
    return vertexIndex
  }

  for (let xIndex = 0; xIndex <= lateralSegments; xIndex += 1) {
    addBottomVertex(xIndex)
  }
  for (let zIndex = 1; zIndex <= longitudinalSegments; zIndex += 1) {
    addBottomVertex(zIndex * rowLength + lateralSegments)
  }
  for (let xIndex = lateralSegments - 1; xIndex >= 0; xIndex -= 1) {
    addBottomVertex(longitudinalSegments * rowLength + xIndex)
  }
  for (let zIndex = longitudinalSegments - 1; zIndex > 0; zIndex -= 1) {
    addBottomVertex(zIndex * rowLength)
  }

  const bottomCenter = positions.length / 3
  positions.push(0, bottomY, (-0.061 + 0.058) / 2)
  bottomPerimeter.forEach((vertex, index) => {
    const next = bottomPerimeter[(index + 1) % bottomPerimeter.length]
    indices.push(bottomCenter, vertex, next)
  })

  // Traverse each edge so the quad's first triangle faces away from the
  // shell. The previous top -> bottom -> top order pointed every wall inward,
  // making all four edges disappear under normal FrontSide culling.
  const connectEdge = (topA: number, topB: number) => {
    const bottomA = bottomIndexByTopIndex[topA]
    const bottomB = bottomIndexByTopIndex[topB]
    if (bottomA === undefined || bottomB === undefined) {
      throw new Error('Mouse shell perimeter is not closed')
    }
    indices.push(topA, topB, bottomA, topB, bottomB, bottomA)
  }

  for (let xIndex = 0; xIndex < lateralSegments; xIndex += 1) {
    connectEdge(xIndex, xIndex + 1)
    const rear = longitudinalSegments * rowLength + xIndex
    connectEdge(rear + 1, rear)
  }
  for (let zIndex = 0; zIndex < longitudinalSegments; zIndex += 1) {
    const left = zIndex * rowLength
    connectEdge(left + rowLength, left)
    const right = left + lateralSegments
    connectEdge(right, right + rowLength)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function makeCableGeometry(
  points: readonly (readonly [number, number, number])[],
  radius: number,
  closed = false,
) {
  const curvePoints = points.map(([x, y, z]) => new THREE.Vector3(x, y, z))
  const curve = new THREE.CatmullRomCurve3(curvePoints, closed, 'centripetal')
  return new THREE.TubeGeometry(curve, 32, radius, 8, closed)
}

function configureInstances(
  mesh: THREE.InstancedMesh | null,
  transforms: ReadonlyArray<{
    position: readonly [number, number, number]
    rotation: readonly [number, number, number]
  }>,
  helper: THREE.Object3D,
) {
  if (!mesh) return

  transforms.forEach((transform, index) => {
    helper.position.set(...transform.position)
    helper.rotation.set(...transform.rotation)
    helper.scale.set(1, 1, 1)
    helper.updateMatrix()
    mesh.setMatrixAt(index, helper.matrix)
  })
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingSphere()
}

export function DeskComputer({
  children,
  effectPreset,
  effectRun,
  selected = false,
  ...groupProps
}: ProceduralAssetProps) {
  const reducedMotion = useLabStore((state) => state.reducedMotion)
  const hasLiveScreen = Children.count(children) > 0

  const assemblyMotionRef = useRef<THREE.Group>(null)
  const mouseLeftButtonRef = useRef<THREE.Mesh>(null)
  const escapeKeyRef = useRef<THREE.Group>(null)

  const screenGlassRef = useRef<THREE.MeshPhysicalMaterial>(null)
  const powerLedRef = useRef<THREE.MeshStandardMaterial>(null)
  const towerLedRef = useRef<THREE.MeshStandardMaterial>(null)

  const keyInstancesRef = useRef<THREE.InstancedMesh>(null)
  const monitorVentsRef = useRef<THREE.InstancedMesh>(null)
  const towerVentsRef = useRef<THREE.InstancedMesh>(null)
  const screwInstancesRef = useRef<THREE.InstancedMesh>(null)

  const animationRef = useRef<AnimationState>({
    active: false,
    elapsed: 0,
    preset: effectPreset,
  })
  const hasMountedRef = useRef(false)
  const lastRunRef = useRef(effectRun)

  const keyGeometry = useMemo(makeRoundedKeyGeometry, [])
  const labelAtlasTexture = useMemo(makeLabelAtlas, [])
  const labelMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        alphaTest: 0.08,
        depthWrite: false,
        map: labelAtlasTexture,
        toneMapped: false,
        transparent: true,
      }),
    [labelAtlasTexture],
  )
  const keyboardLegendLayer = useMemo(
    () => makeKeyboardLegendLayer(STATIC_KEYS.filter((key) => key.label.length > 0)),
    [],
  )
  const mouseShellGeometry = useMemo(makeMouseShellGeometry, [])
  const mouseLeftButtonGeometry = useMemo(
    () => makeMouseButtonGeometry('left'),
    [],
  )
  const mouseRightButtonGeometry = useMemo(
    () => makeMouseButtonGeometry('right'),
    [],
  )
  const keyboardCableGeometry = useMemo(
    () =>
      makeCableGeometry(
        [
          [0.116, 0.012, 0.145],
          [0.18, 0.01, 0.12],
          [0.245, 0.012, 0.105],
          [0.31, 0.025, 0.108],
          [0.342, 0.064, 0.116],
        ],
        0.0028,
      ),
    [],
  )
  const mouseCableGeometry = useMemo(
    () =>
      makeCableGeometry(
        [
          [0.3, 0.014, 0.201],
          [0.34, 0.009, 0.192],
          [0.39, 0.012, 0.17],
          [0.43, 0.035, 0.13],
          [0.44, 0.078, 0.116],
        ],
        0.0025,
      ),
    [],
  )
  const rearCableGeometry = useMemo(
    () =>
      makeCableGeometry(
        [
          [0.08, 0.292, -0.024],
          [0.02, 0.255, -0.09],
          [0.2, 0.205, -0.185],
          [0.32, 0.17, -0.174],
          [0.382, 0.155, -0.174],
        ],
        0.0044,
      ),
    [],
  )

  const mouseShellSeamGeometry = useMemo(
    () =>
      makeCableGeometry(
        [
          [0, 0.045, -0.014],
          [0.0008, 0.053, 0.005],
          [0.0012, 0.051, 0.026],
          [0.0006, 0.041, 0.047],
        ],
        0.00052,
      ),
    [],
  )
  const mouseButtonSplitGeometry = useMemo(
    () =>
      makeCableGeometry(
        [
          [0, 0.0267, -0.055],
          [0.0002, 0.0305, -0.044],
          [0.0004, 0.0358, -0.034],
          [0.0005, 0.041, -0.025],
        ],
        0.0004,
      ),
    [],
  )

  const materials = useMemo(
    () => ({
      shell: new THREE.MeshPhysicalMaterial({
        color: '#a6a69c',
        roughness: 0.48,
        metalness: 0.018,
        clearcoat: 0.12,
        clearcoatRoughness: 0.7,
      }),
      shellLight: new THREE.MeshPhysicalMaterial({
        color: '#c0bfb2',
        roughness: 0.42,
        metalness: 0.012,
        clearcoat: 0.16,
        clearcoatRoughness: 0.66,
      }),
      shellDark: new THREE.MeshStandardMaterial({
        color: '#555b57',
        roughness: 0.68,
        metalness: 0.04,
      }),
      trim: new THREE.MeshStandardMaterial({
        color: '#202724',
        roughness: 0.58,
        metalness: 0.08,
      }),
      keycap: new THREE.MeshStandardMaterial({
        color: '#59625c',
        roughness: 0.38,
        metalness: 0.035,
      }),
      keyAccent: new THREE.MeshStandardMaterial({
        color: '#789a86',
        roughness: 0.43,
        metalness: 0.025,
      }),
      metal: new THREE.MeshStandardMaterial({
        color: '#929a94',
        roughness: 0.29,
        metalness: 0.58,
      }),
      cable: new THREE.MeshStandardMaterial({
        color: '#171c1a',
        roughness: 0.84,
        metalness: 0.012,
      }),
      rubber: new THREE.MeshStandardMaterial({
        color: '#292e2b',
        roughness: 0.94,
        metalness: 0,
      }),
      screw: new THREE.MeshStandardMaterial({
        color: '#424a46',
        roughness: 0.34,
        metalness: 0.68,
      }),
    }),
    [],
  )

  useEffect(
    () => () => {
      keyGeometry.dispose()
      labelAtlasTexture.dispose()
      labelMaterial.dispose()
      keyboardLegendLayer.geometry.dispose()
      keyboardLegendLayer.texture.dispose()
      mouseButtonSplitGeometry.dispose()
      mouseLeftButtonGeometry.dispose()
      mouseRightButtonGeometry.dispose()
      mouseShellGeometry.dispose()
      keyboardCableGeometry.dispose()
      mouseCableGeometry.dispose()
      mouseShellSeamGeometry.dispose()
      rearCableGeometry.dispose()
      Object.values(materials).forEach((material) => material.dispose())
    },
    [
      keyGeometry,
      labelAtlasTexture,
      labelMaterial,
      keyboardLegendLayer,
      keyboardCableGeometry,
      materials,
      mouseButtonSplitGeometry,
      mouseCableGeometry,
      mouseLeftButtonGeometry,
      mouseRightButtonGeometry,
      mouseShellGeometry,
      mouseShellSeamGeometry,
      rearCableGeometry,
    ],
  )

  useLayoutEffect(() => {
    const helper = new THREE.Object3D()

    if (keyInstancesRef.current) {
      STATIC_KEYS.forEach((key, index) => {
        helper.position.set(key.x, key.y, key.z)
        helper.rotation.set(key.rotationX, 0, 0)
        helper.scale.set(key.width / KEY_FACE, 1, key.depth / KEY_FACE)
        helper.updateMatrix()
        keyInstancesRef.current?.setMatrixAt(index, helper.matrix)
      })
      keyInstancesRef.current.instanceMatrix.needsUpdate = true
      keyInstancesRef.current.computeBoundingSphere()
    }

    configureInstances(monitorVentsRef.current, MONITOR_REAR_VENTS, helper)
    configureInstances(towerVentsRef.current, TOWER_SIDE_VENTS, helper)

    if (screwInstancesRef.current) {
      MONITOR_REAR_SCREWS.forEach(([x, y, z], index) => {
        helper.position.set(x, y, z)
        helper.rotation.set(HALF_PI, 0, 0)
        helper.scale.set(1, 1, 1)
        helper.updateMatrix()
        screwInstancesRef.current?.setMatrixAt(index, helper.matrix)
      })
      screwInstancesRef.current.instanceMatrix.needsUpdate = true
      screwInstancesRef.current.computeBoundingSphere()
    }
  }, [])

  const resetAssembly = useCallback(() => {
    const assembly = assemblyMotionRef.current
    const mouseButton = mouseLeftButtonRef.current
    const escapeKey = escapeKeyRef.current

    if (assembly) {
      assembly.position.set(0, 0, 0)
      assembly.rotation.set(0, 0, 0)
      assembly.scale.set(1, 1, 1)
    }
    if (mouseButton) {
      mouseButton.position.set(...MOUSE_LEFT_BUTTON_PIVOT)
      mouseButton.rotation.set(0, 0, 0)
      mouseButton.scale.set(1, 1, 1)
    }
    if (escapeKey) {
      escapeKey.position.set(ESCAPE_KEY.x, ESCAPE_KEY.y, ESCAPE_KEY.z)
      escapeKey.rotation.set(ESCAPE_KEY.rotationX, 0, 0)
      escapeKey.scale.set(1, 1, 1)
    }
    if (screenGlassRef.current) screenGlassRef.current.emissiveIntensity = 0.26
    if (powerLedRef.current) powerLedRef.current.emissiveIntensity = 1.65
    if (towerLedRef.current) {
      towerLedRef.current.color.set('#69dd92')
      towerLedRef.current.emissive.set('#3aff84')
      towerLedRef.current.emissiveIntensity = 1.4
    }
  }, [])

  const finishMigration = useCallback(() => {
    resetAssembly()
    if (screenGlassRef.current) screenGlassRef.current.emissiveIntensity = 0.46
  }, [resetAssembly])

  useEffect(() => {
    resetAssembly()
    const state = animationRef.current
    const previousRun = lastRunRef.current
    lastRunRef.current = effectRun
    state.elapsed = 0
    state.preset = effectPreset

    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      state.active = (effectRun ?? 0) > 0
      return
    }
    state.active = effectRun !== undefined && effectRun !== previousRun
  }, [effectPreset, effectRun, resetAssembly])

  useFrame((_, delta) => {
    const state = animationRef.current
    if (!state.active) return

    const assembly = assemblyMotionRef.current
    const mouseButton = mouseLeftButtonRef.current
    const escapeKey = escapeKeyRef.current
    const screenGlass = screenGlassRef.current
    const powerLed = powerLedRef.current
    const towerLed = towerLedRef.current

    if (
      !assembly ||
      !mouseButton ||
      !escapeKey ||
      !screenGlass ||
      !powerLed ||
      !towerLed
    ) {
      return
    }

    state.elapsed += Math.min(delta, 0.05)
    const time = state.elapsed
    const motionScale = reducedMotion ? 0.18 : 1
    const mechanismScale = reducedMotion ? 0.45 : 1

    resetAssembly()

    if (state.preset === 'migration') {
      const preShake = pulseEnvelope(time, 0.11, 0.31, 0.18)
      const powerOff = smoothStep((time - 0.2) / 0.2)
      const powerOn = smootherStep((time - 0.7) / 0.23)
      const ledOff = smootherStep((time - 0.27) / 0.09)
      const ledOn = smootherStep((time - 0.65) / 0.13)
      const ledLevel = 1 - ledOff * (1 - ledOn)
      const tremor = Math.sin(time * 58) * preShake * motionScale

      assembly.position.x = tremor * 0.0026
      assembly.rotation.z = tremor * 0.006
      powerLed.emissiveIntensity = 0.03 + 1.62 * ledLevel
      towerLed.emissiveIntensity = 0.02 + 1.38 * ledLevel
      screenGlass.emissiveIntensity = 0.26 * (1 - powerOff) + 0.46 * powerOn

      if (time >= 1.62) {
        finishMigration()
        state.active = false
      }
      return
    }

    const duration =
      state.preset === 'paper-drop'
        ? 0.6
        : state.preset === 'approve'
          ? 0.76
          : state.preset === 'reject'
            ? 0.82
            : state.preset === 'fraud'
              ? 1.04
              : 1.2

    const impact = pulseEnvelope(time, 0.065, duration * 0.46, duration * 0.46)
    const responseEnvelope = pulseEnvelope(
      time,
      0.055,
      duration * 0.56,
      duration * 0.34,
    )
    screenGlass.emissiveIntensity = 0.26 + 0.18 * responseEnvelope

    if (state.preset === 'paper-drop') {
      const nod = pulseEnvelope(time, 0.045, 0.19, 0.27)
      assembly.rotation.x = -0.0045 * nod * motionScale
      assembly.position.y = 0.0007 * nod * motionScale
      powerLed.emissiveIntensity = 1.65 + 1.5 * responseEnvelope
    } else if (state.preset === 'approve') {
      const click = pulseEnvelope(time, 0.035, 0.14, 0.16)
      assembly.position.y = -0.0016 * impact * motionScale
      assembly.rotation.x = 0.0025 * Math.sin(time * 34) * impact * motionScale
      mouseButton.position.y =
        MOUSE_LEFT_BUTTON_PIVOT[1] - 0.0007 * click * mechanismScale
      mouseButton.rotation.x = 0.024 * click * mechanismScale
      powerLed.emissiveIntensity = 1.65 + 2.1 * responseEnvelope
    } else if (state.preset === 'reject') {
      const keyPress = pulseEnvelope(time, 0.03, 0.14, 0.17)
      const snap = Math.sin(time * 41) * impact
      assembly.position.x = 0.0032 * snap * motionScale
      assembly.rotation.z =
        -0.007 * impact * motionScale + 0.0025 * snap * motionScale
      escapeKey.position.y = ESCAPE_KEY.y - 0.0045 * keyPress * mechanismScale
      screenGlass.emissiveIntensity = 0.26 - 0.16 * responseEnvelope
    } else if (state.preset === 'fraud') {
      const heavy = pulseEnvelope(time, 0.035, 0.5, 0.46)
      const shake = Math.sin(time * 58) * heavy
      const alarmMix =
        smootherStep((time - 0.035) / 0.12) *
        (1 - smoothStep((time - 0.78) / 0.2))
      const alarmPulse = 0.5 - 0.5 * Math.cos(time * Math.PI * 5)
      assembly.position.x = shake * 0.0055 * motionScale
      assembly.position.y =
        Math.abs(Math.sin(time * 46)) * heavy * 0.0028 * motionScale
      assembly.rotation.z = shake * 0.014 * motionScale
      towerLed.color
        .copy(TOWER_LED_IDLE_COLOR)
        .lerp(TOWER_LED_ALERT_COLOR, alarmMix)
      towerLed.emissive
        .copy(TOWER_LED_IDLE_EMISSIVE)
        .lerp(TOWER_LED_ALERT_EMISSIVE, alarmMix)
      towerLed.emissiveIntensity = 1.4 + (1.1 + 2.8 * alarmPulse) * heavy
      powerLed.emissiveIntensity = 1.65 + 3.2 * heavy
      screenGlass.emissiveIntensity = 0.26 + 0.28 * heavy
    } else if (state.preset === 'printer-jam') {
      const motor = pulseEnvelope(time, 0.075, 0.77, 0.36)
      const rattle = Math.sin(time * 64) * motor
      assembly.position.x = rattle * 0.0042 * motionScale
      assembly.position.y =
        Math.abs(Math.sin(time * 49)) * motor * 0.0017 * motionScale
      assembly.rotation.z = rattle * 0.01 * motionScale
      towerLed.color.set('#ffae3f')
      towerLed.emissive.set('#ff9b24')
      towerLed.emissiveIntensity = 1.1 + 3.2 * motor
      screenGlass.emissiveIntensity = 0.26 + 0.12 * motor
    }

    if (time >= duration) {
      resetAssembly()
      state.active = false
    }
  })

  return (
    <group {...groupProps}>
      <group ref={assemblyMotionRef}>
        {/* 29-inch 16:9 monitor: slim front frame and one continuous VESA-to-foot load path. */}
        <RoundedBox
          args={[0.32, 0.008, 0.205]}
          material={materials.rubber}
          position={[-0.08, 0.004, MONITOR_STAND_FOOT_Z]}
          radius={0.004}
          smoothness={5}
          castShadow
          receiveShadow
        />
        <RoundedBox
          args={[0.286, 0.026, 0.178]}
          material={materials.shellDark}
          position={[-0.08, 0.017, MONITOR_STAND_FOOT_Z]}
          radius={0.012}
          smoothness={7}
          castShadow
          receiveShadow
        />
        <RoundedBox
          args={[0.106, 0.034, 0.084]}
          material={materials.metal}
          position={[-0.08, 0.039, 0.016]}
          radius={0.011}
          smoothness={7}
          castShadow
          receiveShadow
        />
        <RoundedBox
          args={[0.062, 0.282, 0.047]}
          material={materials.metal}
          position={[-0.08, 0.177, 0.004]}
          radius={0.014}
          smoothness={7}
          castShadow
          receiveShadow
        />
        <RoundedBox
          args={[0.036, 0.25, 0.051]}
          material={materials.shellDark}
          position={[-0.08, 0.176, 0.006]}
          radius={0.01}
          smoothness={6}
          castShadow
        />
        <mesh
          material={materials.metal}
          position={[-0.08, 0.319, -0.01]}
          rotation={[0, 0, HALF_PI]}
          castShadow
        >
          <cylinderGeometry args={[0.022, 0.022, 0.112, 36]} />
        </mesh>
        <RoundedBox
          args={[0.104, 0.084, 0.052]}
          material={materials.metal}
          position={[-0.08, 0.354, -0.013]}
          radius={0.015}
          smoothness={7}
          castShadow
        />
        <RoundedBox
          args={[0.162, 0.142, 0.018]}
          material={materials.metal}
          position={[-0.08, 0.405, -0.017]}
          radius={0.011}
          smoothness={6}
          castShadow
        />

        <RoundedBox
          args={[0.73, 0.44, 0.052]}
          material={materials.shell}
          position={[-0.08, 0.405, 0.061]}
          radius={0.027}
          smoothness={10}
          castShadow
          receiveShadow
        />
        <RoundedBox
          args={[0.686, 0.396, 0.008]}
          material={materials.trim}
          position={[-0.08, 0.405, 0.092]}
          radius={0.018}
          smoothness={8}
          castShadow
          receiveShadow
        />
        <RoundedBox
          args={[
            DESK_COMPUTER_SCREEN.glassWidth,
            DESK_COMPUTER_SCREEN.glassHeight,
            0.004,
          ]}
          position={[
            DESK_COMPUTER_SCREEN.position[0],
            DESK_COMPUTER_SCREEN.position[1],
            DESK_COMPUTER_SCREEN.position[2] - 0.002,
          ]}
          radius={0.012}
          smoothness={8}
          castShadow
        >
          <meshPhysicalMaterial
            ref={screenGlassRef}
            color="#091716"
            emissive="#0d2c28"
            emissiveIntensity={0.26}
            roughness={0.14}
            metalness={0.05}
            clearcoat={1}
            clearcoatRoughness={0.08}
          />
        </RoundedBox>

        <RoundedBox
          args={[0.5, 0.286, 0.052]}
          material={materials.shellDark}
          position={[-0.08, 0.405, 0.015]}
          radius={0.022}
          smoothness={8}
          castShadow
        />
        <RoundedBox
          args={[0.126, 0.118, 0.026]}
          material={materials.shell}
          position={[-0.08, 0.405, -0.004]}
          radius={0.013}
          smoothness={7}
          castShadow
        />
        <RoundedBox
          args={[0.22, 0.056, 0.009]}
          material={materials.trim}
          position={[-0.08, 0.486, -0.015]}
          radius={0.009}
          smoothness={6}
          castShadow
        />
        <LabelPlane
          atlasKey="rearDisplay"
          height={0.012}
          material={labelMaterial}
          position={[-0.08, 0.486, -0.0205]}
          rotation={[0, Math.PI, 0]}
          width={0.18}
        />

        <RoundedBox
          args={[0.046, 0.026, 0.014]}
          material={materials.trim}
          position={[0.08, 0.292, -0.014]}
          radius={0.004}
          smoothness={4}
          castShadow
        />
        <RoundedBox
          args={[0.034, 0.016, 0.01]}
          material={materials.rubber}
          position={[0.08, 0.292, -0.022]}
          radius={0.004}
          smoothness={4}
          castShadow
        />
        <RoundedBox
          args={[0.048, 0.023, 0.01]}
          material={materials.trim}
          position={[-0.215, 0.292, -0.015]}
          radius={0.004}
          smoothness={4}
          castShadow
        />

        <instancedMesh
          ref={monitorVentsRef}
          args={[undefined, undefined, MONITOR_REAR_VENTS.length]}
          castShadow
        >
          <boxGeometry args={[0.015, 0.005, 0.007]} />
          <primitive object={materials.trim} attach="material" />
        </instancedMesh>
        <instancedMesh
          ref={screwInstancesRef}
          args={[undefined, undefined, MONITOR_REAR_SCREWS.length]}
          castShadow
        >
          <cylinderGeometry args={[0.004, 0.004, 0.003, 14]} />
          <primitive object={materials.screw} attach="material" />
        </instancedMesh>

        <mesh position={[0.218, 0.205, 0.096]}>
          <sphereGeometry args={[0.0045, 18, 12]} />
          <meshStandardMaterial
            ref={powerLedRef}
            color="#61df8c"
            emissive="#37ff82"
            emissiveIntensity={1.65}
            roughness={0.34}
          />
        </mesh>

        {/* Blank physical glass by default; the optional Html child is the sole screen-content owner. */}
        <group
          name="desk-computer-screen-anchor"
          position={DESK_COMPUTER_SCREEN.position}
          rotation={DESK_COMPUTER_SCREEN.rotation}
          userData={DESK_COMPUTER_SCREEN}
        >
          <mesh
            name="desk-computer-screen-hit"
            position={[0, 0, 0.018]}
            userData={{ role: 'workstation-screen-hit' }}
          >
            <planeGeometry
              args={[
                DESK_COMPUTER_SCREEN.glassWidth,
                DESK_COMPUTER_SCREEN.glassHeight,
              ]}
            />
            <meshBasicMaterial
              transparent
              opacity={0}
              depthWrite={false}
              colorWrite={false}
            />
          </mesh>

          {hasLiveScreen ? (
            <group name="desk-computer-screen-overlay-slot" position={[0, 0, 0.004]}>
              {children}
            </group>
          ) : null}
        </group>

        {/* Side dock/tower: 0.18 × 0.21 × 0.28 m with actual rear and front cable landings. */}
        <RoundedBox
          args={[0.176, 0.009, 0.276]}
          material={materials.rubber}
          position={[0.4, 0.0045, -0.03]}
          radius={0.004}
          smoothness={4}
          castShadow
          receiveShadow
        />
        <RoundedBox
          args={[0.18, 0.21, 0.28]}
          material={materials.shellDark}
          position={[0.4, 0.109, -0.03]}
          radius={0.019}
          smoothness={8}
          castShadow
          receiveShadow
        />
        <RoundedBox
          args={[0.158, 0.185, 0.022]}
          material={materials.trim}
          position={[0.4, 0.111, 0.116]}
          radius={0.012}
          smoothness={7}
          castShadow
        />
        <RoundedBox
          args={[0.126, 0.014, 0.009]}
          material={materials.metal}
          position={[0.4, 0.164, 0.13]}
          radius={0.003}
          smoothness={4}
          castShadow
        />
        <RoundedBox
          args={[0.11, 0.036, 0.009]}
          material={materials.shell}
          position={[0.389, 0.125, 0.13]}
          radius={0.006}
          smoothness={5}
          castShadow
        />
        <LabelPlane
          atlasKey="towerArchive"
          height={0.009}
          material={labelMaterial}
          position={[0.389, 0.125, 0.136]}
          width={0.09}
        />
        <RoundedBox
          args={[0.044, 0.012, 0.008]}
          material={materials.metal}
          position={[0.37, 0.082, 0.13]}
          radius={0.0025}
          smoothness={4}
        />
        <mesh position={[0.445, 0.081, 0.134]}>
          <sphereGeometry args={[0.004, 18, 12]} />
          <meshStandardMaterial
            ref={towerLedRef}
            color="#69dd92"
            emissive="#3aff84"
            emissiveIntensity={1.4}
            roughness={0.35}
          />
        </mesh>
        <LabelPlane
          atlasKey="towerRevision"
          height={0.009}
          material={labelMaterial}
          position={[0.4, 0.041, 0.133]}
          width={0.12}
        />
        <instancedMesh
          ref={towerVentsRef}
          args={[undefined, undefined, TOWER_SIDE_VENTS.length]}
          castShadow
        >
          <boxGeometry args={[0.007, 0.006, 0.06]} />
          <primitive object={materials.trim} attach="material" />
        </instancedMesh>

        {/* Full-size 104-key ANSI layout with separated system, navigation, and numpad islands. */}
        <group position={[-0.07, 0, KEYBOARD_Z]}>
          {[
            [-0.205, 0.003, -0.069],
            [0.205, 0.003, -0.069],
            [-0.205, 0.002, 0.069],
            [0.205, 0.002, 0.069],
          ].map((position, index) => (
            <RoundedBox
              // oxlint-disable-next-line react/no-array-index-key -- fixed manufactured foot set.
              key={index}
              args={[0.05, index < 2 ? 0.006 : 0.004, 0.02]}
              material={materials.rubber}
              position={position as [number, number, number]}
              radius={0.004}
              smoothness={4}
              castShadow
              receiveShadow
            />
          ))}
          <RoundedBox
            args={[0.51, 0.018, 0.178]}
            material={materials.shellDark}
            position={[0, 0.011, 0]}
            radius={0.013}
            smoothness={8}
            castShadow
            receiveShadow
          />
          <RoundedBox
            args={[0.492, 0.016, 0.162]}
            material={materials.trim}
            position={[0, 0.028, -0.003]}
            radius={0.01}
            smoothness={6}
            castShadow
          />
          <instancedMesh
            ref={keyInstancesRef}
            args={[keyGeometry, materials.keycap, STATIC_KEYS.length]}
            castShadow
            receiveShadow
          />
          <group
            ref={escapeKeyRef}
            position={[ESCAPE_KEY.x, ESCAPE_KEY.y, ESCAPE_KEY.z]}
            rotation={[ESCAPE_KEY.rotationX, 0, 0]}
          >
            <mesh
              geometry={keyGeometry}
              material={materials.keyAccent}
              castShadow
              receiveShadow
            />
            <LabelPlane
              atlasKey="escape"
              height={0.006}
              material={labelMaterial}
              position={[0, 0.0092, 0]}
              rotation={[-HALF_PI, 0, 0]}
              width={0.012}
            />
          </group>

          <mesh geometry={keyboardLegendLayer.geometry} renderOrder={2}>
            <meshBasicMaterial
              alphaTest={0.12}
              depthWrite={false}
              map={keyboardLegendLayer.texture}
              toneMapped={false}
              transparent
            />
          </mesh>

          <RoundedBox
            args={[0.088, 0.004, 0.014]}
            material={materials.shellLight}
            position={[-0.198, 0.0205, 0.08]}
            radius={0.003}
            smoothness={4}
            castShadow
          />
          <LabelPlane
            atlasKey="keyboardBadge"
            height={0.008}
            material={labelMaterial}
            position={[-0.198, 0.023, 0.08]}
            rotation={[-HALF_PI, 0, 0]}
            width={0.075}
          />
          <RoundedBox
            args={[0.052, 0.018, 0.019]}
            material={materials.rubber}
            position={[0.186, 0.017, -0.089]}
            radius={0.006}
            smoothness={5}
            castShadow
          />
        </group>

        {/* Right-handed mouse: one continuous molded shell with inset controls, grip, skids, and cable. */}
        <group position={[MOUSE_X, 0, MOUSE_Z]} rotation={[0, -0.035, 0]}>
          <mesh
            geometry={mouseShellGeometry}
            material={materials.shellDark}
            castShadow
            receiveShadow
          />
          <mesh
            geometry={mouseShellSeamGeometry}
            material={materials.trim}
          />
          <mesh
            ref={mouseLeftButtonRef}
            geometry={mouseLeftButtonGeometry}
            material={materials.shellDark}
            position={MOUSE_LEFT_BUTTON_PIVOT}
          />
          <mesh
            geometry={mouseRightButtonGeometry}
            material={materials.shellDark}
            position={[0.012, 0.0412, -0.0158]}
          />
          <mesh
            geometry={mouseButtonSplitGeometry}
            material={materials.trim}
          />
          <RoundedBox
            args={[0.012, 0.0014, 0.026]}
            material={materials.trim}
            position={[0.0005, 0.0395, -0.021]}
            rotation={[-0.33, 0, 0]}
            radius={0.004}
            smoothness={5}
          />
          <mesh
            material={materials.rubber}
            position={[0.0005, 0.0435, -0.021]}
            rotation={[0, 0, HALF_PI]}
            castShadow
          >
            <cylinderGeometry args={[0.0048, 0.0048, 0.009, 24]} />
          </mesh>
          <RoundedBox
            args={[0.0022, 0.011, 0.034]}
            material={materials.rubber}
            position={[-0.0325, 0.011, 0.012]}
            rotation={[0, 0, -0.1]}
            radius={0.001}
            smoothness={4}
          />
          <RoundedBox
            args={[0.0022, 0.011, 0.034]}
            material={materials.rubber}
            position={[0.034, 0.011, 0.012]}
            rotation={[0, 0, 0.1]}
            radius={0.001}
            smoothness={4}
          />
          <RoundedBox
            args={[0.016, 0.014, 0.022]}
            material={materials.rubber}
            position={[0, 0.011, -0.064]}
            radius={0.005}
            smoothness={5}
            castShadow
          />
          {[
            [-0.018, 0.0015, -0.027],
            [0.018, 0.0015, -0.027],
            [-0.018, 0.0015, 0.029],
            [0.018, 0.0015, 0.029],
          ].map((position, index) => (
            <RoundedBox
              // oxlint-disable-next-line react/no-array-index-key -- fixed molded foot set.
              key={index}
              args={[0.012, 0.003, 0.024]}
              material={materials.rubber}
              position={position as [number, number, number]}
              radius={0.002}
              smoothness={4}
              receiveShadow
            />
          ))}
        </group>

        {/* Every cable shares the assembly parent; endpoints overlap modeled strain reliefs. */}
        <mesh
          geometry={keyboardCableGeometry}
          material={materials.cable}
          castShadow
          receiveShadow
        />
        <mesh
          geometry={mouseCableGeometry}
          material={materials.cable}
          castShadow
          receiveShadow
        />
        <mesh
          geometry={rearCableGeometry}
          material={materials.cable}
          castShadow
        />
        <RoundedBox
          args={[0.024, 0.024, 0.024]}
          material={materials.rubber}
          position={[0.08, 0.292, -0.024]}
          radius={0.006}
          smoothness={5}
          castShadow
        />
        <RoundedBox
          args={[0.024, 0.028, 0.02]}
          material={materials.rubber}
          position={[0.382, 0.155, -0.171]}
          radius={0.006}
          smoothness={5}
          castShadow
        />

        <RoundedBox
          args={[0.092, 0.007, 0.026]}
          position={[-0.08, 0.039, 0.048]}
          radius={0.004}
          smoothness={4}
          castShadow
        >
          <meshStandardMaterial
            color={selected ? '#61a98a' : '#4b514d'}
            emissive={selected ? '#276c50' : '#000000'}
            emissiveIntensity={selected ? 0.5 : 0}
            roughness={0.7}
          />
        </RoundedBox>
        <LabelPlane
          atlasKey="standBadge"
          height={0.008}
          material={labelMaterial}
          position={[-0.08, 0.043, 0.048]}
          rotation={[-HALF_PI, 0, 0]}
          width={0.072}
        />
      </group>
    </group>
  )
}
