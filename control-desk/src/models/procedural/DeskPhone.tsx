import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

import { useLabStore } from '../../store/useLabStore'
import type { ProceduralAssetProps } from '../types'

const HALF_PI = Math.PI / 2
const PHONE_WIDTH = 0.224
const PANEL_Y = 0.065
const PANEL_Z = 0.03
const PANEL_TILT = 0.19
const DISPLAY_TEXT_Y = -0.0045
const DISPLAY_TEXT_Z = 0.014

type PhoneKeyDescriptor = {
  id: string
  label: string
  display: string
  feedbackColor: string
  mesh: 'number' | 'function' | 'line-one' | 'other-line'
  instanceIndex: number
  position: readonly [number, number, number]
  labelY: number
  labelSize: readonly [number, number]
}

const NUMBER_KEYS = [
  { id: 'digit-1', label: '1', display: 'DIAL 1', feedbackColor: '#79d99c', position: [-0.035, 0.0065, -0.004] },
  { id: 'digit-2', label: '2', display: 'DIAL 2', feedbackColor: '#75d8a5', position: [0, 0.0065, -0.004] },
  { id: 'digit-3', label: '3', display: 'DIAL 3', feedbackColor: '#70d5ae', position: [0.035, 0.0065, -0.004] },
  { id: 'digit-4', label: '4', display: 'DIAL 4', feedbackColor: '#7dd5a2', position: [-0.035, 0.0065, 0.021] },
  { id: 'digit-5', label: '5', display: 'DIAL 5', feedbackColor: '#78d3ab', position: [0, 0.0065, 0.021] },
  { id: 'digit-6', label: '6', display: 'DIAL 6', feedbackColor: '#72d0b4', position: [0.035, 0.0065, 0.021] },
  { id: 'digit-7', label: '7', display: 'DIAL 7', feedbackColor: '#83d0a6', position: [-0.035, 0.0065, 0.046] },
  { id: 'digit-8', label: '8', display: 'DIAL 8', feedbackColor: '#7dceb0', position: [0, 0.0065, 0.046] },
  { id: 'digit-9', label: '9', display: 'DIAL 9', feedbackColor: '#77cbb9', position: [0.035, 0.0065, 0.046] },
  { id: 'digit-star', label: '*', display: 'SERVICE MENU', feedbackColor: '#8bcbaa', position: [-0.035, 0.0065, 0.071] },
  { id: 'digit-0', label: '0', display: 'DIAL 0', feedbackColor: '#85c8b4', position: [0, 0.0065, 0.071] },
  { id: 'digit-hash', label: '#', display: 'EXTENSION MODE', feedbackColor: '#7fc5bd', position: [0.035, 0.0065, 0.071] },
] as const

const FUNCTION_KEYS = [
  { id: 'hold', label: 'HOLD', display: 'CALL ON HOLD', feedbackColor: '#efba64', position: [-0.078, 0.006, 0.061] },
  { id: 'mute', label: 'MUTE', display: 'MIC MUTED', feedbackColor: '#ef776d', position: [-0.078, 0.006, 0.032] },
  { id: 'transfer', label: 'XFER', display: 'TRANSFER READY', feedbackColor: '#75bce8', position: [-0.078, 0.006, 0.003] },
] as const

const LINE_KEYS = [
  { id: 'line-1', label: 'L1', display: 'LINE 1 ACTIVE', feedbackColor: '#70d995', position: [0.078, 0.006, 0.061] },
  { id: 'line-2', label: 'L2', display: 'LINE 2 ACTIVE', feedbackColor: '#66cfe0', position: [0.078, 0.006, 0.032] },
  { id: 'line-3', label: 'L3', display: 'LINE 3 ACTIVE', feedbackColor: '#9aa8ee', position: [0.078, 0.006, 0.003] },
] as const

const KEY_DESCRIPTORS: readonly PhoneKeyDescriptor[] = [
  ...NUMBER_KEYS.map((key, instanceIndex) => ({
    ...key,
    mesh: 'number' as const,
    instanceIndex,
    labelY: 0.012,
    labelSize: [0.0115, 0.0115] as const,
  })),
  ...FUNCTION_KEYS.map((key, instanceIndex) => ({
    ...key,
    mesh: 'function' as const,
    instanceIndex,
    labelY: 0.0109,
    labelSize: [0.022, 0.0068] as const,
  })),
  ...LINE_KEYS.map((key, instanceIndex) => ({
    ...key,
    mesh: instanceIndex === 0 ? ('line-one' as const) : ('other-line' as const),
    instanceIndex: Math.max(0, instanceIndex - 1),
    labelY: 0.0109,
    labelSize: [0.0125, 0.0068] as const,
  })),
]

const KEY_BY_ID = new Map(KEY_DESCRIPTORS.map((key) => [key.id, key]))
const KEY_INDEX_BY_ID = new Map(KEY_DESCRIPTORS.map((key, index) => [key.id, index]))

const NUMBER_KEY_POSITIONS = NUMBER_KEYS.map((key) => key.position)
const FUNCTION_KEY_POSITIONS = FUNCTION_KEYS.map((key) => key.position)
const OTHER_LINE_KEY_POSITIONS = LINE_KEYS.slice(1).map((key) => key.position)

const OTHER_LINE_LED_POSITIONS = [
  [0.091, 0.012, 0.032],
  [0.091, 0.012, 0.003],
] as const

const CRADLE_POSITIONS = [
  [-0.092, 0.098, -0.079],
  [0.092, 0.098, -0.079],
] as const

const CRADLE_PAD_POSITIONS = [
  [-0.092, 0.109, -0.076],
  [0.092, 0.109, -0.076],
] as const

const CRADLE_GUARD_POSITIONS = [
  [-0.119, 0.107, -0.079],
  [0.119, 0.107, -0.079],
] as const

const HANDSET_NECKS = [
  { position: [-0.063, 0.133, -0.078] as const, rotation: [0, 0, 0.11] as const },
  { position: [0.063, 0.133, -0.078] as const, rotation: [0, 0, -0.11] as const },
] as const

const HANDSET_EARS = [
  { position: [-0.092, 0.133, -0.078] as const, rotation: [0, 0, 0.075] as const },
  { position: [0.092, 0.133, -0.078] as const, rotation: [0, 0, -0.075] as const },
] as const

const RECEIVER_CAPS = [
  { position: [-0.092, 0.1095, -0.078] as const, rotation: [0, 0, 0.075] as const },
  { position: [0.092, 0.1095, -0.078] as const, rotation: [0, 0, -0.075] as const },
] as const

const RECEIVER_GRILLES = Array.from({ length: 10 }, (_, index) => {
  const side = index < 5 ? -1 : 1
  const hole = index % 5
  const angle = (hole / 5) * Math.PI * 2
  const capRotation = side < 0 ? 0.075 : -0.075
  const localX = Math.cos(angle) * 0.009
  const localY = -0.0026
  return {
    position: [
      side * 0.092 + Math.cos(capRotation) * localX - Math.sin(capRotation) * localY,
      0.1095 + Math.sin(capRotation) * localX + Math.cos(capRotation) * localY,
      -0.078 + Math.sin(angle) * 0.008,
    ] as const,
    rotation: [0, 0, capRotation] as const,
  }
})

const FEET = [
  [-0.087, 0.003, -0.077],
  [0.087, 0.003, -0.077],
  [-0.087, 0.003, 0.077],
  [0.087, 0.003, 0.077],
] as const

const REAR_VENTS = Array.from({ length: 8 }, (_, index) => [
  -0.061 + index * 0.0175,
  0.056,
  -0.1145,
] as const)

const FASTENERS = [
  [-0.096, 0.036, -0.114],
  [0.096, 0.036, -0.114],
  [-0.108, 0.036, 0.064],
  [0.108, 0.036, 0.064],
] as const

const PLUG_CONTACTS = Array.from({ length: 4 }, (_, index) => [
  -0.006 + index * 0.004,
  0.0144,
  -0.252,
] as const)

const READY_COLOR = new THREE.Color('#83d8a1')
const READY_EMISSIVE = new THREE.Color('#36c873')
const ALERT_COLOR = new THREE.Color('#9a3028')
const ALERT_EMISSIVE = new THREE.Color('#f04435')
const LCD_COLOR = new THREE.Color('#365449')
const LCD_EMISSIVE = new THREE.Color('#75d69b')
const LCD_DARK = new THREE.Color('#21352f')
const LABEL_ATLAS_SIZE = 1024

type BitmapGlyph = readonly string[]

const BITMAP_GLYPHS: Readonly<Record<string, BitmapGlyph>> = {
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '#': ['01010', '11111', '01010', '01010', '11111', '01010', '00000'],
  '*': ['00000', '10101', '01110', '11111', '01110', '10101', '00000'],
  '•': ['00000', '00000', '00100', '01110', '01110', '00100', '00000'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
}

const UNKNOWN_GLYPH: BitmapGlyph = ['11111', '10001', '00110', '00100', '00000', '00100', '00100']

type LabelSpec = {
  id: string
  text: string
  color: string
  width: number
  height: number
}

type AtlasEntry = {
  offset: readonly [number, number]
  scale: readonly [number, number]
}

type LabelResources = {
  texture: THREE.CanvasTexture
  material: THREE.MeshBasicMaterial
  keyPlane: THREE.PlaneGeometry
  manualDisplay: THREE.PlaneGeometry
  unifiedDisplay: THREE.PlaneGeometry
  interactionDisplay: THREE.PlaneGeometry
  interactionEntries: ReadonlyMap<string, AtlasEntry>
  statusLabels: THREE.PlaneGeometry
  contactLabel: THREE.PlaneGeometry
}

const KEY_LABEL_SPECS: readonly LabelSpec[] = KEY_DESCRIPTORS.map((key) => ({
  id: `key:${key.id}`,
  text: key.label,
  color: key.mesh === 'number' ? '#292d2b' : '#e2dfcf',
  width: key.mesh === 'number' ? 64 : key.mesh === 'function' ? 128 : 80,
  height: 64,
}))

const DISPLAY_LABEL_SPECS: readonly LabelSpec[] = [
  { id: 'display:manual', text: 'FINANCE OPS\nLINE 1 READY', color: '#b8f1c9', width: 384, height: 112 },
  { id: 'display:unified', text: 'UNIFIED READY', color: '#c5f8d4', width: 320, height: 72 },
  ...KEY_DESCRIPTORS.map((key) => ({
    id: `display:${key.id}`,
    text: key.display,
    color: '#d2f7dd',
    width: 320,
    height: 72,
  })),
  { id: 'status', text: 'KEY               MSG', color: '#d5d1bf', width: 384, height: 56 },
  { id: 'contact', text: 'ACCT • 3 LINE', color: '#d2cfbd', width: 320, height: 64 },
]

function drawBitmapText(context: CanvasRenderingContext2D, spec: LabelSpec, x: number, y: number) {
  const lines = spec.text.split('\n')
  const longestLine = Math.max(...lines.map((line) => line.length))
  const contentUnitsWide = Math.max(1, longestLine * 6 - 1)
  const contentUnitsHigh = Math.max(1, lines.length * 8 - 1)
  const pixelSize = Math.max(
    1,
    Math.floor(Math.min((spec.width - 16) / contentUnitsWide, (spec.height - 16) / contentUnitsHigh)),
  )
  const contentWidth = contentUnitsWide * pixelSize
  const contentHeight = contentUnitsHigh * pixelSize
  const startX = x + Math.floor((spec.width - contentWidth) / 2)
  const startY = y + Math.floor((spec.height - contentHeight) / 2)

  context.fillStyle = spec.color
  lines.forEach((line, lineIndex) => {
    const lineWidth = Math.max(1, line.length * 6 - 1) * pixelSize
    const lineX = startX + Math.floor((contentWidth - lineWidth) / 2)
    const lineY = startY + lineIndex * 8 * pixelSize

    Array.from(line).forEach((character, characterIndex) => {
      const glyph = BITMAP_GLYPHS[character] ?? UNKNOWN_GLYPH
      glyph.forEach((row, rowIndex) => {
        Array.from(row).forEach((pixel, columnIndex) => {
          if (pixel === '1') {
            context.fillRect(
              lineX + (characterIndex * 6 + columnIndex) * pixelSize,
              lineY + rowIndex * pixelSize,
              pixelSize,
              pixelSize,
            )
          }
        })
      })
    })
  })
}

function remapPlaneUvs(geometry: THREE.PlaneGeometry, entry: AtlasEntry) {
  const uv = geometry.getAttribute('uv')
  const baseUv =
    (geometry.userData.baseUv as Float32Array | undefined) ?? new Float32Array(uv.array as ArrayLike<number>)
  geometry.userData.baseUv = baseUv
  for (let index = 0; index < uv.count; index += 1) {
    uv.setXY(
      index,
      entry.offset[0] + baseUv[index * 2] * entry.scale[0],
      entry.offset[1] + baseUv[index * 2 + 1] * entry.scale[1],
    )
  }
  uv.needsUpdate = true
}

function createLabelResources(): LabelResources {
  const canvas = document.createElement('canvas')
  canvas.width = LABEL_ATLAS_SIZE
  canvas.height = LABEL_ATLAS_SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('DeskPhone label atlas requires a 2D canvas context')

  const entries = new Map<string, AtlasEntry>()
  const specs = [...KEY_LABEL_SPECS, ...DISPLAY_LABEL_SPECS]
  let cursorX = 2
  let cursorY = 2
  let rowHeight = 0

  specs.forEach((spec) => {
    if (cursorX + spec.width + 2 > LABEL_ATLAS_SIZE) {
      cursorX = 2
      cursorY += rowHeight + 2
      rowHeight = 0
    }
    if (cursorY + spec.height + 2 > LABEL_ATLAS_SIZE) {
      throw new Error('DeskPhone label atlas overflow')
    }

    drawBitmapText(context, spec, cursorX, cursorY)
    entries.set(spec.id, {
      offset: [cursorX / LABEL_ATLAS_SIZE, 1 - (cursorY + spec.height) / LABEL_ATLAS_SIZE],
      scale: [spec.width / LABEL_ATLAS_SIZE, spec.height / LABEL_ATLAS_SIZE],
    })
    cursorX += spec.width + 2
    rowHeight = Math.max(rowHeight, spec.height)
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.name = 'desk-phone-label-atlas'

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.08,
    depthWrite: false,
    toneMapped: false,
  })
  material.name = 'desk-phone-atlas-labels'
  material.polygonOffset = true
  material.polygonOffsetFactor = -1
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
#ifdef USE_INSTANCING
attribute vec4 atlasUv;
#endif`,
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
#if defined( USE_INSTANCING ) && defined( USE_MAP )
vMapUv = atlasUv.xy + uv * atlasUv.zw;
#endif`,
      )
  }
  material.customProgramCacheKey = () => 'desk-phone-instanced-atlas-v1'

  const requireEntry = (id: string) => {
    const entry = entries.get(id)
    if (!entry) throw new Error(`Missing DeskPhone label atlas entry: ${id}`)
    return entry
  }

  const keyPlane = new THREE.PlaneGeometry(1, 1)
  const keyUv = new Float32Array(KEY_DESCRIPTORS.length * 4)
  KEY_DESCRIPTORS.forEach((key, index) => {
    const entry = requireEntry(`key:${key.id}`)
    keyUv.set([...entry.offset, ...entry.scale], index * 4)
  })
  keyPlane.setAttribute('atlasUv', new THREE.InstancedBufferAttribute(keyUv, 4))

  const makePlane = (id: string, width: number, height: number) => {
    const geometry = new THREE.PlaneGeometry(width, height)
    remapPlaneUvs(geometry, requireEntry(id))
    return geometry
  }

  return {
    texture,
    material,
    keyPlane,
    manualDisplay: makePlane('display:manual', 0.106, 0.018),
    unifiedDisplay: makePlane('display:unified', 0.106, 0.01),
    interactionDisplay: makePlane('display:digit-1', 0.108, 0.01),
    interactionEntries: new Map(
      KEY_DESCRIPTORS.map((key) => [key.display, requireEntry(`display:${key.id}`)]),
    ),
    statusLabels: makePlane('status', 0.108, 0.006),
    contactLabel: makePlane('contact', 0.084, 0.0072),
  }
}

type MotionState = {
  active: boolean
  elapsed: number
  preset: ProceduralAssetProps['effectPreset']
}

type KeyInteractionState = {
  active: boolean
  elapsed: number
  keyId: string | null
}

type InstanceTransform = {
  position: readonly [number, number, number]
  rotation?: readonly [number, number, number]
  scale?: readonly [number, number, number]
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

function pulseWindow(time: number, start: number, peak: number, end: number) {
  return smoothStep((time - start) / (peak - start)) * (1 - smoothStep((time - peak) / (end - peak)))
}

function effectDuration(preset: ProceduralAssetProps['effectPreset']) {
  switch (preset) {
    case 'paper-drop':
      return 0.68
    case 'approve':
      return 0.92
    case 'reject':
      return 1.02
    case 'fraud':
      return 1.42
    case 'printer-jam':
      return 1.34
    case 'migration':
      return 1.72
    default:
      return 0
  }
}

function makeBodyGeometry() {
  const profile = new THREE.Shape()
  profile.moveTo(-0.11, 0.025)
  profile.lineTo(-0.106, 0.044)
  profile.quadraticCurveTo(-0.101, 0.048, -0.094, 0.05)
  profile.lineTo(0.087, 0.086)
  profile.quadraticCurveTo(0.101, 0.084, 0.11, 0.064)
  profile.lineTo(0.11, 0.025)
  profile.closePath()

  const geometry = new THREE.ExtrudeGeometry(profile, {
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: 0.0045,
    bevelThickness: 0.004,
    curveSegments: 5,
    depth: PHONE_WIDTH,
    steps: 1,
  })
  geometry.rotateY(HALF_PI)
  geometry.translate(-PHONE_WIDTH / 2, 0, 0)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function makeTubeGeometry(
  points: readonly (readonly [number, number, number])[],
  radius: number,
  tubularSegments: number,
  radialSegments = 7,
) {
  const vectors = points.map(([x, y, z]) => new THREE.Vector3(x, y, z))
  const curve = new THREE.CatmullRomCurve3(vectors, false, 'centripetal')
  return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false)
}

function makeCoilGeometry() {
  const points: THREE.Vector3[] = [
    new THREE.Vector3(-0.124, 0.121, -0.076),
    new THREE.Vector3(-0.128, 0.116, -0.072),
    new THREE.Vector3(-0.129, 0.108, -0.066),
  ]
  const turns = 14
  const samples = 112

  for (let index = 0; index <= samples; index += 1) {
    const progress = index / samples
    const angle = progress * turns * Math.PI * 2
    points.push(
      new THREE.Vector3(
        -0.126 + Math.cos(angle) * 0.0056,
        0.096 - progress * 0.052,
        -0.062 + progress * 0.05 + Math.sin(angle) * 0.0056,
      ),
    )
  }

  points.push(new THREE.Vector3(-0.121, 0.042, -0.006))
  points.push(new THREE.Vector3(-0.112, 0.043, -0.004))
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal')
  return new THREE.TubeGeometry(curve, 168, 0.00165, 6, false)
}

function setInstances(mesh: THREE.InstancedMesh | null, transforms: readonly InstanceTransform[], helper: THREE.Object3D) {
  if (!mesh) return

  transforms.forEach((transform, index) => {
    helper.position.set(...transform.position)
    helper.rotation.set(...(transform.rotation ?? [0, 0, 0]))
    helper.scale.set(...(transform.scale ?? [1, 1, 1]))
    helper.updateMatrix()
    mesh.setMatrixAt(index, helper.matrix)
  })
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingSphere()
}

export function DeskPhone({
  effectPreset,
  effectRun = 0,
  selected = false,
  ...groupProps
}: ProceduralAssetProps) {
  const reducedMotion = useLabStore((state) => state.reducedMotion)
  const [interactionDisplay, setInteractionDisplay] = useState('KEY READY')

  const phoneMotionRef = useRef<THREE.Group>(null)
  const handsetMotionRef = useRef<THREE.Group>(null)
  const hookSwitchRef = useRef<THREE.Group>(null)
  const lineOneKeyRef = useRef<THREE.Group>(null)
  const lineOneDirectRef = useRef<THREE.Group>(null)
  const manualDisplayRef = useRef<THREE.Group>(null)
  const unifiedDisplayRef = useRef<THREE.Group>(null)
  const interactionDisplayRef = useRef<THREE.Group>(null)

  const readyLedRef = useRef<THREE.MeshStandardMaterial>(null)
  const alertLedRef = useRef<THREE.MeshStandardMaterial>(null)
  const keyFeedbackLedRef = useRef<THREE.MeshStandardMaterial>(null)
  const lcdMaterialRef = useRef<THREE.MeshPhysicalMaterial>(null)

  const numberKeysRef = useRef<THREE.InstancedMesh>(null)
  const functionKeysRef = useRef<THREE.InstancedMesh>(null)
  const otherLineKeysRef = useRef<THREE.InstancedMesh>(null)
  const otherLineLedsRef = useRef<THREE.InstancedMesh>(null)
  const keyHitTargetsRef = useRef<THREE.InstancedMesh>(null)
  const keyLabelsRef = useRef<THREE.InstancedMesh>(null)
  const cradleRef = useRef<THREE.InstancedMesh>(null)
  const cradleGuardsRef = useRef<THREE.InstancedMesh>(null)
  const cradlePadsRef = useRef<THREE.InstancedMesh>(null)
  const handsetNecksRef = useRef<THREE.InstancedMesh>(null)
  const handsetEarsRef = useRef<THREE.InstancedMesh>(null)
  const receiverCapsRef = useRef<THREE.InstancedMesh>(null)
  const receiverGrillesRef = useRef<THREE.InstancedMesh>(null)
  const feetRef = useRef<THREE.InstancedMesh>(null)
  const ventsRef = useRef<THREE.InstancedMesh>(null)
  const fastenersRef = useRef<THREE.InstancedMesh>(null)
  const plugContactsRef = useRef<THREE.InstancedMesh>(null)

  const motionRef = useRef<MotionState>({ active: false, elapsed: 0, preset: effectPreset })
  const keyInteractionRef = useRef<KeyInteractionState>({ active: false, elapsed: 0, keyId: null })
  const displayModeRef = useRef<'manual' | 'unified'>('manual')
  const keyMatrixHelperRef = useRef(new THREE.Object3D())

  const labelResources = useMemo(() => createLabelResources(), [])

  const geometries = useMemo(
    () => ({
      alertLens: new RoundedBoxGeometry(0.012, 0.006, 0.004, 3, 0.002),
      base: new RoundedBoxGeometry(0.232, 0.026, 0.218, 5, 0.008),
      body: makeBodyGeometry(),
      coil: makeCoilGeometry(),
      cradle: new RoundedBoxGeometry(0.05, 0.018, 0.052, 4, 0.007),
      cradleGuard: new RoundedBoxGeometry(0.012, 0.03, 0.045, 4, 0.005),
      cradlePad: new RoundedBoxGeometry(0.036, 0.005, 0.034, 3, 0.003),
      displayBezel: new RoundedBoxGeometry(0.148, 0.054, 0.016, 5, 0.007),
      displayGlass: new RoundedBoxGeometry(0.126, 0.028, 0.003, 4, 0.0035),
      displayMount: new RoundedBoxGeometry(0.018, 0.026, 0.02, 4, 0.005),
      displayRail: new RoundedBoxGeometry(0.128, 0.01, 0.002, 3, 0.002),
      displayRecess: new RoundedBoxGeometry(0.138, 0.045, 0.004, 4, 0.0045),
      fastener: new THREE.CylinderGeometry(0.0022, 0.0022, 0.0018, 12),
      foot: new RoundedBoxGeometry(0.034, 0.006, 0.025, 3, 0.004),
      functionKey: new RoundedBoxGeometry(0.028, 0.008, 0.018, 3, 0.003),
      functionWell: new RoundedBoxGeometry(0.038, 0.0016, 0.092, 3, 0.004),
      handsetEar: new RoundedBoxGeometry(0.052, 0.043, 0.047, 6, 0.013),
      handsetGrip: new RoundedBoxGeometry(0.119, 0.026, 0.029, 6, 0.011),
      handsetNeck: new RoundedBoxGeometry(0.044, 0.031, 0.033, 5, 0.009),
      handsetPort: new RoundedBoxGeometry(0.014, 0.013, 0.017, 3, 0.004),
      handsetSocket: new RoundedBoxGeometry(0.006, 0.021, 0.028, 3, 0.003),
      handsetStrainRelief: makeTubeGeometry(
        [
          [-0.118, 0.124, -0.078],
          [-0.124, 0.121, -0.076],
          [-0.128, 0.116, -0.072],
        ],
        0.0031,
        12,
        7,
      ),
      hookSwitch: new RoundedBoxGeometry(0.025, 0.008, 0.022, 3, 0.003),
      hookSwitchBay: new RoundedBoxGeometry(0.033, 0.004, 0.029, 3, 0.004),
      indicator: new RoundedBoxGeometry(0.007, 0.003, 0.006, 2, 0.0015),
      keyHitTarget: new RoundedBoxGeometry(0.034, 0.016, 0.023, 2, 0.003),
      numberKey: new RoundedBoxGeometry(0.028, 0.009, 0.019, 3, 0.003),
      numberWell: new RoundedBoxGeometry(0.108, 0.0016, 0.098, 4, 0.005),
      panel: new RoundedBoxGeometry(0.204, 0.004, 0.164, 5, 0.008),
      plugBody: new RoundedBoxGeometry(0.022, 0.012, 0.025, 3, 0.003),
      plugContact: new THREE.BoxGeometry(0.0022, 0.001, 0.009),
      plugLatch: new THREE.BoxGeometry(0.011, 0.002, 0.014),
      powerCord: makeTubeGeometry(
        [
          [0.057, 0.039, -0.107],
          [0.075, 0.026, -0.132],
          [0.092, 0.008, -0.17],
          [0.102, 0.006, -0.222],
        ],
        0.0028,
        42,
      ),
      rearLineCord: makeTubeGeometry(
        [
          [-0.052, 0.037, -0.108],
          [-0.063, 0.023, -0.141],
          [-0.045, 0.007, -0.184],
          [0, 0.008, -0.239],
        ],
        0.002,
        52,
      ),
      receiverCap: new RoundedBoxGeometry(0.038, 0.004, 0.033, 4, 0.007),
      receiverGrille: new THREE.CylinderGeometry(0.0015, 0.0015, 0.0012, 8),
      rearSocket: new RoundedBoxGeometry(0.027, 0.016, 0.005, 3, 0.002),
      seam: new RoundedBoxGeometry(0.227, 0.003, 0.212, 3, 0.002),
      socketCollar: new THREE.CylinderGeometry(0.0044, 0.0044, 0.014, 12),
      vent: new RoundedBoxGeometry(0.011, 0.0028, 0.0015, 2, 0.001),
    }),
    [],
  )

  const materials = useMemo(
    () => ({
      body: new THREE.MeshPhysicalMaterial({
        color: '#8a887d',
        roughness: 0.48,
        metalness: 0.015,
        clearcoat: 0.12,
        clearcoatRoughness: 0.76,
      }),
      bodyDark: new THREE.MeshStandardMaterial({ color: '#65665f', roughness: 0.67, metalness: 0.025 }),
      cable: new THREE.MeshStandardMaterial({ color: '#242725', roughness: 0.9, metalness: 0 }),
      contact: new THREE.MeshStandardMaterial({ color: '#b99b51', roughness: 0.28, metalness: 0.75 }),
      cradlePad: new THREE.MeshStandardMaterial({ color: '#202422', roughness: 0.96, metalness: 0 }),
      fastener: new THREE.MeshStandardMaterial({ color: '#686b68', roughness: 0.32, metalness: 0.68 }),
      handset: new THREE.MeshPhysicalMaterial({
        color: '#343a37',
        roughness: 0.45,
        metalness: 0.01,
        clearcoat: 0.18,
        clearcoatRoughness: 0.7,
      }),
      key: new THREE.MeshPhysicalMaterial({
        color: '#c4c0ad',
        roughness: 0.52,
        metalness: 0,
        clearcoat: 0.1,
        clearcoatRoughness: 0.8,
      }),
      keyDark: new THREE.MeshStandardMaterial({ color: '#4e5550', roughness: 0.48, metalness: 0.015 }),
      lensOff: new THREE.MeshStandardMaterial({
        color: '#756f52',
        emissive: '#433f25',
        emissiveIntensity: 0.18,
        roughness: 0.42,
      }),
      panel: new THREE.MeshStandardMaterial({ color: '#77776e', roughness: 0.72, metalness: 0.015 }),
      panelInset: new THREE.MeshStandardMaterial({ color: '#555a55', roughness: 0.84, metalness: 0.01 }),
      plug: new THREE.MeshPhysicalMaterial({
        color: '#6d746e',
        roughness: 0.34,
        metalness: 0.02,
        transmission: 0.18,
        transparent: true,
        opacity: 0.88,
      }),
      rubber: new THREE.MeshStandardMaterial({ color: '#252825', roughness: 0.96, metalness: 0 }),
      vent: new THREE.MeshStandardMaterial({ color: '#2c312e', roughness: 0.86, metalness: 0.02 }),
    }),
    [],
  )

  useEffect(
    () => () => {
      Object.values(geometries).forEach((geometry) => geometry.dispose())
      Object.values(materials).forEach((material) => material.dispose())
      labelResources.texture.dispose()
      labelResources.material.dispose()
      labelResources.keyPlane.dispose()
      labelResources.manualDisplay.dispose()
      labelResources.unifiedDisplay.dispose()
      labelResources.interactionDisplay.dispose()
      labelResources.statusLabels.dispose()
      labelResources.contactLabel.dispose()
    },
    [geometries, labelResources, materials],
  )

  useLayoutEffect(() => {
    const helper = new THREE.Object3D()
    setInstances(
      numberKeysRef.current,
      NUMBER_KEY_POSITIONS.map((position) => ({ position })),
      helper,
    )
    setInstances(
      functionKeysRef.current,
      FUNCTION_KEY_POSITIONS.map((position) => ({ position })),
      helper,
    )
    setInstances(
      otherLineKeysRef.current,
      OTHER_LINE_KEY_POSITIONS.map((position) => ({ position })),
      helper,
    )
    setInstances(
      otherLineLedsRef.current,
      OTHER_LINE_LED_POSITIONS.map((position) => ({ position })),
      helper,
    )
    setInstances(
      keyHitTargetsRef.current,
      KEY_DESCRIPTORS.map(({ position: [x, , z] }) => ({ position: [x, 0.017, z] as const })),
      helper,
    )
    setInstances(
      keyLabelsRef.current,
      KEY_DESCRIPTORS.map((key) => ({
        position: [key.position[0], key.labelY, key.position[2]] as const,
        rotation: [-HALF_PI, 0, 0] as const,
        scale: [key.labelSize[0], key.labelSize[1], 1] as const,
      })),
      helper,
    )
    setInstances(
      cradleRef.current,
      CRADLE_POSITIONS.map((position) => ({ position })),
      helper,
    )
    setInstances(
      cradleGuardsRef.current,
      CRADLE_GUARD_POSITIONS.map((position) => ({ position })),
      helper,
    )
    setInstances(
      cradlePadsRef.current,
      CRADLE_PAD_POSITIONS.map((position) => ({ position })),
      helper,
    )
    setInstances(handsetNecksRef.current, HANDSET_NECKS, helper)
    setInstances(handsetEarsRef.current, HANDSET_EARS, helper)
    setInstances(receiverCapsRef.current, RECEIVER_CAPS, helper)
    setInstances(receiverGrillesRef.current, RECEIVER_GRILLES, helper)
    setInstances(
      feetRef.current,
      FEET.map((position) => ({ position })),
      helper,
    )
    setInstances(
      ventsRef.current,
      REAR_VENTS.map((position) => ({ position })),
      helper,
    )
    setInstances(
      fastenersRef.current,
      FASTENERS.map((position, index) => ({
        position,
        rotation: index < 2 ? ([HALF_PI, 0, 0] as const) : ([0, 0, HALF_PI] as const),
      })),
      helper,
    )
    setInstances(
      plugContactsRef.current,
      PLUG_CONTACTS.map((position) => ({ position })),
      helper,
    )
  }, [])

  useLayoutEffect(() => {
    const entry = labelResources.interactionEntries.get(interactionDisplay)
    if (entry) remapPlaneUvs(labelResources.interactionDisplay, entry)
  }, [interactionDisplay, labelResources])

  const setKeyOffset = useCallback((key: PhoneKeyDescriptor, offsetY: number) => {
    if (key.mesh === 'line-one') {
      if (lineOneDirectRef.current) lineOneDirectRef.current.position.y = offsetY
    } else {
      const mesh =
        key.mesh === 'number'
          ? numberKeysRef.current
          : key.mesh === 'function'
            ? functionKeysRef.current
            : otherLineKeysRef.current
      if (!mesh) return

      const helper = keyMatrixHelperRef.current
      helper.position.set(key.position[0], key.position[1] + offsetY, key.position[2])
      helper.rotation.set(0, 0, 0)
      helper.scale.set(1, 1, 1)
      helper.updateMatrix()
      mesh.setMatrixAt(key.instanceIndex, helper.matrix)
      mesh.instanceMatrix.needsUpdate = true

      if (key.mesh === 'other-line' && otherLineLedsRef.current) {
        helper.position.set(0.091, 0.012 + offsetY, key.position[2])
        helper.updateMatrix()
        otherLineLedsRef.current.setMatrixAt(key.instanceIndex, helper.matrix)
        otherLineLedsRef.current.instanceMatrix.needsUpdate = true
      }
    }

    const labelIndex = KEY_INDEX_BY_ID.get(key.id)
    const labelMesh = keyLabelsRef.current
    if (labelIndex !== undefined && labelMesh) {
      const helper = keyMatrixHelperRef.current
      helper.position.set(key.position[0], key.labelY + offsetY, key.position[2])
      helper.rotation.set(-HALF_PI, 0, 0)
      helper.scale.set(key.labelSize[0], key.labelSize[1], 1)
      helper.updateMatrix()
      labelMesh.setMatrixAt(labelIndex, helper.matrix)
      labelMesh.instanceMatrix.needsUpdate = true
    }
  }, [])

  const restoreDisplayMode = useCallback(() => {
    if (manualDisplayRef.current) manualDisplayRef.current.visible = displayModeRef.current === 'manual'
    if (unifiedDisplayRef.current) unifiedDisplayRef.current.visible = displayModeRef.current === 'unified'
    if (interactionDisplayRef.current) interactionDisplayRef.current.visible = false
  }, [])

  const triggerKeyInteraction = useCallback(
    (key: PhoneKeyDescriptor) => {
      const interaction = keyInteractionRef.current
      if (interaction.keyId) {
        const previousKey = KEY_BY_ID.get(interaction.keyId)
        if (previousKey) setKeyOffset(previousKey, 0)
      }

      interaction.active = true
      interaction.elapsed = 0
      interaction.keyId = key.id
      setInteractionDisplay(key.display)
    },
    [setKeyOffset],
  )

  const resetAssembly = useCallback(() => {
    if (phoneMotionRef.current) {
      phoneMotionRef.current.position.set(0, 0, 0)
      phoneMotionRef.current.rotation.set(0, 0, 0)
    }
    if (handsetMotionRef.current) {
      handsetMotionRef.current.position.set(0, 0, 0)
      handsetMotionRef.current.rotation.set(0, 0, 0)
    }
    if (hookSwitchRef.current) {
      hookSwitchRef.current.position.set(0, 0, 0)
      hookSwitchRef.current.rotation.set(0, 0, 0)
    }
    if (lineOneKeyRef.current) {
      lineOneKeyRef.current.position.set(0, 0, 0)
      lineOneKeyRef.current.rotation.set(0, 0, 0)
    }
    displayModeRef.current = 'manual'
    if (manualDisplayRef.current) {
      manualDisplayRef.current.position.set(0, DISPLAY_TEXT_Y, DISPLAY_TEXT_Z)
      manualDisplayRef.current.scale.set(1, 1, 1)
      manualDisplayRef.current.visible = true
    }
    if (unifiedDisplayRef.current) {
      unifiedDisplayRef.current.position.set(0, DISPLAY_TEXT_Y, DISPLAY_TEXT_Z)
      unifiedDisplayRef.current.scale.set(1, 1, 1)
      unifiedDisplayRef.current.visible = false
    }
    if (interactionDisplayRef.current) interactionDisplayRef.current.visible = false

    if (readyLedRef.current) {
      readyLedRef.current.color.copy(READY_COLOR)
      readyLedRef.current.emissive.copy(READY_EMISSIVE)
      readyLedRef.current.emissiveIntensity = selected ? 2.1 : 0.9
    }
    if (alertLedRef.current) {
      alertLedRef.current.color.copy(ALERT_COLOR)
      alertLedRef.current.emissive.copy(ALERT_EMISSIVE)
      alertLedRef.current.emissiveIntensity = 0.08
    }
    if (keyFeedbackLedRef.current) {
      keyFeedbackLedRef.current.color.set('#465049')
      keyFeedbackLedRef.current.emissive.set('#26352d')
      keyFeedbackLedRef.current.emissiveIntensity = 0.08
    }
    if (lcdMaterialRef.current) {
      lcdMaterialRef.current.color.copy(LCD_COLOR)
      lcdMaterialRef.current.emissive.copy(LCD_EMISSIVE)
      lcdMaterialRef.current.emissiveIntensity = selected ? 0.36 : 0.2
      lcdMaterialRef.current.opacity = 0.92
    }
  }, [selected])

  const cancelKeyInteraction = useCallback(() => {
    const interaction = keyInteractionRef.current
    if (interaction.keyId) {
      const activeKey = KEY_BY_ID.get(interaction.keyId)
      if (activeKey) setKeyOffset(activeKey, 0)
    }
    interaction.active = false
    interaction.elapsed = 0
    interaction.keyId = null
  }, [setKeyOffset])

  const finishMigration = useCallback(() => {
    resetAssembly()
    displayModeRef.current = 'unified'
    if (manualDisplayRef.current) manualDisplayRef.current.visible = false
    if (unifiedDisplayRef.current) unifiedDisplayRef.current.visible = true
    if (readyLedRef.current) readyLedRef.current.emissiveIntensity = selected ? 2.65 : 1.55
    if (lcdMaterialRef.current) {
      lcdMaterialRef.current.color.copy(LCD_DARK)
      lcdMaterialRef.current.emissive.copy(READY_EMISSIVE)
      lcdMaterialRef.current.emissiveIntensity = 0.56
    }
  }, [resetAssembly, selected])

  useEffect(() => {
    cancelKeyInteraction()
    resetAssembly()
    const motion = motionRef.current
    motion.elapsed = 0
    motion.preset = effectPreset
    motion.active = effectRun > 0 && effectPreset !== undefined
  }, [cancelKeyInteraction, effectPreset, effectRun, resetAssembly])

  useFrame((_, delta) => {
    const motion = motionRef.current
    const phone = phoneMotionRef.current
    const handset = handsetMotionRef.current
    const hookSwitch = hookSwitchRef.current
    const lineOneKey = lineOneKeyRef.current
    const manualDisplay = manualDisplayRef.current
    const unifiedDisplay = unifiedDisplayRef.current
    const readyLed = readyLedRef.current
    const alertLed = alertLedRef.current
    const keyFeedbackLed = keyFeedbackLedRef.current
    const lcd = lcdMaterialRef.current

    if (!phone || !handset || !hookSwitch || !lineOneKey || !manualDisplay || !unifiedDisplay || !readyLed || !alertLed || !lcd) {
      return
    }

    if (motion.active) {
      resetAssembly()
      const duration = effectDuration(motion.preset)
      motion.elapsed = Math.min(motion.elapsed + Math.min(delta, 0.05), duration)
      const time = motion.elapsed
      const motionScale = reducedMotion ? 0.2 : 1
      const mechanismScale = reducedMotion ? 0.58 : 1

      if (motion.preset === 'paper-drop') {
      const acknowledgement = pulseWindow(time, 0.03, 0.12, 0.38)
      const secondGlow = pulseWindow(time, 0.25, 0.34, 0.55)
      const switchClick = pulseWindow(time, 0.02, 0.08, 0.18)

      phone.position.z = -0.0012 * acknowledgement * motionScale
      phone.rotation.x = -0.004 * acknowledgement * motionScale
      handset.position.y = 0.001 * acknowledgement * motionScale
      hookSwitch.position.y = -0.0022 * switchClick * mechanismScale
      readyLed.emissiveIntensity += acknowledgement * 1.8 + secondGlow * 0.75
      lcd.emissiveIntensity += acknowledgement * 0.28
      } else if (motion.preset === 'approve') {
      const anticipation = pulseWindow(time, 0, 0.08, 0.17)
      const press = pulseWindow(time, 0.12, 0.22, 0.38)
      const confirmation = pulseWindow(time, 0.2, 0.42, 0.78)
      const settle = 1 - smoothStep((time - 0.47) / 0.36)

      phone.position.z = -0.001 * anticipation * motionScale
      lineOneKey.position.y = -0.0032 * press * mechanismScale
      handset.rotation.z = Math.sin(time * 18) * 0.009 * confirmation * settle * motionScale
      handset.position.y = 0.0014 * confirmation * motionScale
      readyLed.emissiveIntensity += confirmation * 2.7
      lcd.emissiveIntensity += confirmation * 0.46
      alertLed.emissiveIntensity = 0.03
      } else if (motion.preset === 'reject') {
      const anticipation = pulseWindow(time, 0, 0.09, 0.19)
      const snap = pulseWindow(time, 0.13, 0.22, 0.5)
      const redCue = pulseWindow(time, 0.14, 0.28, 0.82)
      const settle = 1 - smoothStep((time - 0.38) / 0.52)

      phone.position.z = 0.0017 * anticipation * motionScale
      phone.position.x = Math.sin(time * 42) * 0.0016 * snap * motionScale
      phone.rotation.z = -0.012 * snap * motionScale
      handset.position.y = 0.007 * snap * motionScale
      handset.position.z = 0.0035 * snap * motionScale
      handset.rotation.z = (0.045 * snap + Math.sin(time * 31) * 0.012 * settle) * motionScale
      hookSwitch.position.y = 0.003 * snap * mechanismScale
      alertLed.emissiveIntensity = 0.08 + redCue * 3.9
      lcd.emissiveIntensity = 0.17 + redCue * 0.28
      readyLed.emissiveIntensity *= 1 - redCue * 0.78
      } else if (motion.preset === 'fraud') {
      const windup = pulseWindow(time, 0, 0.1, 0.2)
      const ringEnvelope = smoothStep((time - 0.12) / 0.08) * (1 - smoothStep((time - 1.06) / 0.28))
      const recoil = pulseWindow(time, 0.98, 1.08, 1.38)
      const ringWave = Math.sin(time * 70)
      const ringPulse = 0.5 + 0.5 * Math.sin(time * 26)

      phone.position.z = -0.002 * windup * motionScale
      phone.position.x = ringWave * 0.0032 * ringEnvelope * motionScale
      phone.rotation.z = ringWave * 0.017 * ringEnvelope * motionScale
      handset.position.y = Math.abs(Math.sin(time * 36)) * 0.0065 * ringEnvelope * motionScale
      handset.position.x = -ringWave * 0.0024 * ringEnvelope * motionScale
      handset.rotation.z = -ringWave * 0.025 * ringEnvelope * motionScale
      hookSwitch.position.y = Math.abs(ringWave) * 0.002 * ringEnvelope * mechanismScale
      lineOneKey.position.y = -Math.max(0, ringWave) * 0.0018 * ringEnvelope * mechanismScale
      alertLed.emissiveIntensity = 0.12 + ringPulse * ringEnvelope * 4.2 + recoil * 1.2
      lcd.emissiveIntensity = 0.13 + ringPulse * ringEnvelope * 0.52
      readyLed.emissiveIntensity *= 1 - ringEnvelope * 0.86
      } else if (motion.preset === 'printer-jam') {
      const chatterEnvelope = smoothStep(time / 0.08) * (1 - smoothStep((time - 0.98) / 0.29))
      const busyA = pulseWindow(time, 0.08, 0.15, 0.27)
      const busyB = pulseWindow(time, 0.35, 0.43, 0.56)
      const busyC = pulseWindow(time, 0.64, 0.72, 0.86)
      const errorSettle = pulseWindow(time, 0.88, 1.01, 1.28)
      const chatter = busyA + busyB + busyC

      phone.position.x = Math.sin(time * 96) * 0.00125 * chatterEnvelope * motionScale
      phone.rotation.y = Math.sin(time * 73) * 0.009 * chatterEnvelope * motionScale
      handset.position.x = Math.sin(time * 88) * 0.0018 * chatterEnvelope * motionScale
      handset.rotation.z = Math.sin(time * 82) * 0.013 * chatterEnvelope * motionScale
      lineOneKey.position.y = -0.003 * chatter * mechanismScale
      hookSwitch.position.y = -0.0016 * (busyB + busyC) * mechanismScale
      alertLed.emissiveIntensity = 0.12 + chatter * 2.8 + errorSettle * 2.2
      readyLed.emissiveIntensity = 0.18 + Math.max(0, Math.sin(time * 38)) * chatterEnvelope * 1.4
      lcd.emissiveIntensity = 0.1 + Math.max(0, Math.sin(time * 47)) * chatterEnvelope * 0.42
      } else if (motion.preset === 'migration') {
      const disconnect = pulseWindow(time, 0.02, 0.16, 0.46)
      const powerDown = smoothStep((time - 0.25) / 0.24)
      const reconnect = smootherStep((time - 0.73) / 0.42)
      const readyPulse = pulseWindow(time, 1.02, 1.22, 1.58)
      const settle = 1 - smoothStep((time - 1.14) / 0.42)

      phone.position.x = Math.sin(time * 64) * 0.0016 * disconnect * motionScale
      phone.rotation.z = Math.sin(time * 51) * 0.008 * disconnect * motionScale
      handset.position.y = 0.0026 * disconnect * motionScale
      handset.rotation.z = -0.022 * disconnect * motionScale
      handset.position.x = 0.0016 * reconnect * settle * motionScale
      lineOneKey.position.y = -0.0025 * reconnect * mechanismScale
      hookSwitch.position.y = -0.0018 * disconnect * mechanismScale

      manualDisplay.visible = time < 0.67
      unifiedDisplay.visible = time >= 0.65
      unifiedDisplay.scale.set(0.86 + reconnect * 0.14, 0.86 + reconnect * 0.14, 1)
      unifiedDisplay.position.y = DISPLAY_TEXT_Y - 0.006 * (1 - reconnect)
      lcd.opacity = 0.92 - Math.max(0, powerDown - reconnect) * 0.78
      lcd.emissiveIntensity = 0.2 * (1 - powerDown) + reconnect * 0.5 + readyPulse * 0.3
      readyLed.emissiveIntensity = 0.08 + reconnect * 1.4 + readyPulse * 2.1
      alertLed.emissiveIntensity = 0.08 + disconnect * 1.5 * (0.5 + 0.5 * Math.sin(time * 55))
      }

      if (motion.elapsed >= duration) {
        if (motion.preset === 'migration') finishMigration()
        else resetAssembly()
        motion.active = false
      }
    }

    const interaction = keyInteractionRef.current
    const activeKey = interaction.keyId ? KEY_BY_ID.get(interaction.keyId) : undefined

    if (interaction.active && activeKey) {
      interaction.elapsed = Math.min(interaction.elapsed + Math.min(delta, 0.05), 0.48)
      const press = pulseWindow(interaction.elapsed, 0, 0.055, 0.26)
      const light = pulseWindow(interaction.elapsed, 0, 0.07, 0.42)
      const depression = (reducedMotion ? -0.0015 : -0.0032) * press

      setKeyOffset(activeKey, depression)

      if (keyFeedbackLed) {
        keyFeedbackLed.color.set(activeKey.feedbackColor)
        keyFeedbackLed.emissive.set(activeKey.feedbackColor)
        keyFeedbackLed.emissiveIntensity = 0.12 + light * 3.4
      }
      if (interactionDisplayRef.current) interactionDisplayRef.current.visible = true
      manualDisplay.visible = false
      unifiedDisplay.visible = false

      if (interaction.elapsed >= 0.48) {
        setKeyOffset(activeKey, 0)
        interaction.active = false
        interaction.keyId = null
        if (keyFeedbackLed) {
          keyFeedbackLed.color.set('#465049')
          keyFeedbackLed.emissive.set('#26352d')
          keyFeedbackLed.emissiveIntensity = 0.08
        }
        restoreDisplayMode()
      }
    } else if (interaction.active) {
      interaction.active = false
      interaction.keyId = null
      restoreDisplayMode()
    }
  })

  return (
    <group {...groupProps}>
      <group ref={phoneMotionRef}>
        <mesh geometry={geometries.base} material={materials.bodyDark} position={[0, 0.019, 0]} castShadow receiveShadow />
        <mesh geometry={geometries.seam} material={materials.rubber} position={[0, 0.031, 0]} castShadow receiveShadow />
        <mesh geometry={geometries.body} material={materials.body} castShadow receiveShadow />

        <instancedMesh ref={feetRef} args={[geometries.foot, materials.rubber, FEET.length]} castShadow receiveShadow />
        <instancedMesh ref={ventsRef} args={[geometries.vent, materials.vent, REAR_VENTS.length]} castShadow />
        <instancedMesh ref={fastenersRef} args={[geometries.fastener, materials.fastener, FASTENERS.length]} castShadow />

        <group position={[0, PANEL_Y, PANEL_Z]} rotation={[PANEL_TILT, 0, 0]}>
          <mesh geometry={geometries.panel} material={materials.panel} castShadow receiveShadow />
          <mesh geometry={geometries.numberWell} material={materials.panelInset} position={[0, 0.0021, 0.0335]} receiveShadow />
          <mesh geometry={geometries.functionWell} material={materials.panelInset} position={[-0.078, 0.0021, 0.032]} receiveShadow />
          <mesh geometry={geometries.functionWell} material={materials.panelInset} position={[0.078, 0.0021, 0.032]} receiveShadow />
          <instancedMesh
            ref={numberKeysRef}
            args={[geometries.numberKey, materials.key, NUMBER_KEY_POSITIONS.length]}
            castShadow
            receiveShadow
          />
          <instancedMesh
            ref={functionKeysRef}
            args={[geometries.functionKey, materials.keyDark, FUNCTION_KEY_POSITIONS.length]}
            castShadow
            receiveShadow
          />
          <instancedMesh
            ref={otherLineKeysRef}
            args={[geometries.functionKey, materials.keyDark, OTHER_LINE_KEY_POSITIONS.length]}
            castShadow
            receiveShadow
          />
          <group ref={lineOneKeyRef}>
            <group ref={lineOneDirectRef}>
              <mesh geometry={geometries.functionKey} material={materials.keyDark} position={[0.078, 0.006, 0.061]} castShadow receiveShadow />
              <mesh geometry={geometries.indicator} position={[0.091, 0.012, 0.061]} castShadow>
                <meshStandardMaterial
                  ref={readyLedRef}
                  color="#83d8a1"
                  emissive="#36c873"
                  emissiveIntensity={0.9}
                  roughness={0.34}
                />
              </mesh>
            </group>
          </group>
          <instancedMesh
            ref={otherLineLedsRef}
            args={[geometries.indicator, materials.lensOff, OTHER_LINE_LED_POSITIONS.length]}
            castShadow
          />
          <instancedMesh
            ref={keyLabelsRef}
            args={[labelResources.keyPlane, labelResources.material, KEY_DESCRIPTORS.length]}
            frustumCulled={false}
            renderOrder={2}
          />

          <instancedMesh
            ref={keyHitTargetsRef}
            args={[geometries.keyHitTarget, undefined, KEY_DESCRIPTORS.length]}
            onPointerDown={(event) => {
              event.stopPropagation()
              if (event.instanceId === undefined) return
              const key = KEY_DESCRIPTORS[event.instanceId]
              if (key) triggerKeyInteraction(key)
            }}
            onPointerUp={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
          </instancedMesh>
        </group>

        <group position={[0, 0.095, -0.044]} rotation={[-0.18, 0, 0]}>
          <mesh geometry={geometries.displayMount} material={materials.bodyDark} position={[-0.056, -0.029, -0.006]} castShadow receiveShadow />
          <mesh geometry={geometries.displayMount} material={materials.bodyDark} position={[0.056, -0.029, -0.006]} castShadow receiveShadow />
          <mesh geometry={geometries.displayBezel} material={materials.bodyDark} castShadow receiveShadow />
          <mesh geometry={geometries.displayRecess} material={materials.rubber} position={[0, 0, 0.0088]} receiveShadow />
          <mesh geometry={geometries.displayGlass} position={[0, DISPLAY_TEXT_Y, 0.0112]} castShadow>
            <meshPhysicalMaterial
              ref={lcdMaterialRef}
              color="#365449"
              emissive="#75d69b"
              emissiveIntensity={0.2}
              roughness={0.24}
              metalness={0.02}
              clearcoat={0.32}
              clearcoatRoughness={0.34}
              transparent
              opacity={0.92}
            />
          </mesh>
          <mesh geometry={geometries.displayRail} material={materials.panelInset} position={[0, 0.018, 0.0112]} receiveShadow />
          <group ref={manualDisplayRef} position={[0, DISPLAY_TEXT_Y, DISPLAY_TEXT_Z]}>
            <mesh geometry={labelResources.manualDisplay} material={labelResources.material} renderOrder={2} />
          </group>
          <group ref={unifiedDisplayRef} position={[0, DISPLAY_TEXT_Y, DISPLAY_TEXT_Z]} visible={false}>
            <mesh geometry={labelResources.unifiedDisplay} material={labelResources.material} renderOrder={2} />
          </group>
          <group ref={interactionDisplayRef} position={[0, DISPLAY_TEXT_Y, DISPLAY_TEXT_Z + 0.0004]} visible={false}>
            <mesh
              geometry={labelResources.interactionDisplay}
              material={labelResources.material}
              renderOrder={2}
            />
          </group>
          <mesh geometry={geometries.alertLens} position={[-0.057, 0.018, 0.0132]} castShadow>
            <meshStandardMaterial
              ref={keyFeedbackLedRef}
              color="#465049"
              emissive="#26352d"
              emissiveIntensity={0.08}
              roughness={0.32}
            />
          </mesh>
          <mesh geometry={geometries.alertLens} position={[0.057, 0.018, 0.0132]} castShadow>
            <meshStandardMaterial
              ref={alertLedRef}
              color="#9a3028"
              emissive="#f04435"
              emissiveIntensity={0.08}
              roughness={0.32}
            />
          </mesh>
          <mesh
            geometry={labelResources.statusLabels}
            material={labelResources.material}
            position={[0, 0.018, 0.0154]}
            renderOrder={2}
          />
        </group>

        <instancedMesh ref={cradleRef} args={[geometries.cradle, materials.bodyDark, CRADLE_POSITIONS.length]} castShadow receiveShadow />
        <instancedMesh
          ref={cradleGuardsRef}
          args={[geometries.cradleGuard, materials.bodyDark, CRADLE_GUARD_POSITIONS.length]}
          castShadow
          receiveShadow
        />
        <instancedMesh
          ref={cradlePadsRef}
          args={[geometries.cradlePad, materials.cradlePad, CRADLE_PAD_POSITIONS.length]}
          castShadow
          receiveShadow
        />
        <mesh geometry={geometries.hookSwitchBay} material={materials.rubber} position={[-0.072, 0.105, -0.061]} receiveShadow />
        <group ref={hookSwitchRef}>
          <mesh geometry={geometries.hookSwitch} material={materials.keyDark} position={[-0.072, 0.109, -0.061]} castShadow receiveShadow />
        </group>

        <group ref={handsetMotionRef}>
          <mesh geometry={geometries.handsetGrip} material={materials.handset} position={[0, 0.134, -0.078]} castShadow receiveShadow />
          <instancedMesh
            ref={handsetNecksRef}
            args={[geometries.handsetNeck, materials.handset, HANDSET_NECKS.length]}
            castShadow
            receiveShadow
          />
          <instancedMesh
            ref={handsetEarsRef}
            args={[geometries.handsetEar, materials.handset, HANDSET_EARS.length]}
            castShadow
            receiveShadow
          />
          <instancedMesh
            ref={receiverCapsRef}
            args={[geometries.receiverCap, materials.cradlePad, RECEIVER_CAPS.length]}
            castShadow
            receiveShadow
          />
          <instancedMesh
            ref={receiverGrillesRef}
            args={[geometries.receiverGrille, materials.vent, RECEIVER_GRILLES.length]}
            castShadow
          />
          <mesh geometry={geometries.handsetPort} material={materials.rubber} position={[-0.116, 0.124, -0.078]} castShadow receiveShadow />
          <mesh geometry={geometries.handsetStrainRelief} material={materials.cable} castShadow receiveShadow />
        </group>

        <mesh geometry={geometries.coil} material={materials.cable} castShadow receiveShadow />
        <mesh geometry={geometries.handsetSocket} material={materials.rubber} position={[-0.1115, 0.043, -0.004]} castShadow receiveShadow />
        <mesh
          geometry={geometries.socketCollar}
          material={materials.cable}
          position={[-0.117, 0.043, -0.004]}
          rotation={[0, 0, HALF_PI]}
          castShadow
          receiveShadow
        />

        <mesh geometry={geometries.rearSocket} material={materials.rubber} position={[-0.052, 0.038, -0.111]} castShadow receiveShadow />
        <mesh geometry={geometries.rearSocket} material={materials.rubber} position={[0.057, 0.04, -0.111]} scale={[0.72, 0.72, 1]} castShadow receiveShadow />
        <mesh geometry={geometries.rearLineCord} material={materials.cable} castShadow receiveShadow />
        <mesh geometry={geometries.powerCord} material={materials.cable} castShadow receiveShadow />

        <group position={[0, 0, 0]}>
          <mesh geometry={geometries.plugBody} material={materials.plug} position={[0, 0.0085, -0.252]} castShadow receiveShadow />
          <mesh geometry={geometries.plugLatch} material={materials.plug} position={[0, 0.0155, -0.249]} rotation={[-0.24, 0, 0]} castShadow />
          <instancedMesh
            ref={plugContactsRef}
            args={[geometries.plugContact, materials.contact, PLUG_CONTACTS.length]}
            castShadow
          />
        </group>

        <mesh
          geometry={labelResources.contactLabel}
          material={labelResources.material}
          position={[0, 0.044, 0.1125]}
          renderOrder={2}
        />
      </group>
    </group>
  )
}
