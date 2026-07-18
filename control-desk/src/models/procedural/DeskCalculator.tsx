import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  DynamicDrawUsage,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LinearFilter,
  MathUtils,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Object3D,
  Shape,
  SRGBColorSpace,
} from 'three'
import type { EffectPreset } from '../../store/useLabStore'
import { useLabStore } from '../../store/useLabStore'
import type { ProceduralAssetProps } from '../types'

const HALF_PI = Math.PI / 2
const DECK_ANGLE = 0.293
const KEY_BASE_Y = 0.002
// ExtrudeGeometry's bevel reaches 0.0123 m above each key group's origin.
// Keep the legends only a hair above that face so they read as pad-printed ink.
const KEY_LABEL_SURFACE_Y = 0.01248
const TAPE_BASE_Y = 0.165
const TAPE_BASE_Z = -0.097
const TEAR_BAR_BASE_Y = 0.164
const TEAR_BAR_BASE_Z = -0.104
const DISPLAY_LABEL_Z = 0.01765
const DISPLAY_EMISSIVE = 0x153b2b
const KEY_TRAVEL = 0.0034
const LABEL_ATLAS_SIZE = 1024
const INITIAL_DISPLAY_VALUE = '4,495.00 %'
const INITIAL_DISPLAY_STATUS = 'TIP ÷ SUBTOTAL'
const INITIAL_TAPE_OUTPUT = 'TIP / SUBTOTAL\n4,495.00 %\nCONCERNING.'

const EFFECT_DURATIONS: Record<EffectPreset, number> = {
  'paper-drop': 0.55,
  approve: 0.82,
  reject: 0.76,
  fraud: 1.05,
  'printer-jam': 1.18,
  migration: 1.2,
}

const KEY_COLUMNS = [-0.072, -0.024, 0.024, 0.072] as const
const KEY_ROWS = [-0.044, -0.004, 0.036, 0.076, 0.116] as const

type AtlasCell = {
  x: number
  y: number
  width: number
  height: number
}

const KEY_LABEL_CELLS = Array.from({ length: 20 }, (_, index): AtlasCell => ({
  x: (index % 4) * 96,
  y: Math.floor(index / 4) * 96,
  width: 96,
  height: 96,
}))

const LABEL_CELLS = {
  displayValue: { x: 400, y: 0, width: 600, height: 120 },
  displayStatus: { x: 400, y: 120, width: 600, height: 72 },
  displayHeader: { x: 400, y: 192, width: 600, height: 72 },
  sideBadge: { x: 400, y: 264, width: 300, height: 72 },
  tape: { x: 400, y: 352, width: 600, height: 480 },
} as const satisfies Record<string, AtlasCell>

type KeyFamily = 'number' | 'memory' | 'operation' | 'total' | 'clear'

type CalculatorKey = {
  id: string
  column: number
  row: number
  label: string
  family: KeyFamily
  fontSize: number
  labelColor: string
  display: string
  status: string
}

type ActiveKeyPress = {
  id: string
  elapsed: number
  releaseAt: number | null
}

const KEYS = [
  { id: 'memory-plus', column: 0, row: 0, label: 'M+', family: 'memory', fontSize: 0.0083, labelColor: '#f3eee0', display: 'M 4,495.00', status: 'ADDED TO MEMORY' },
  { id: 'memory-minus', column: 1, row: 0, label: 'M−', family: 'memory', fontSize: 0.0083, labelColor: '#f3eee0', display: 'M −4,495.00', status: 'SUBTRACTED FROM MEMORY' },
  { id: 'percent', column: 2, row: 0, label: '%', family: 'memory', fontSize: 0.0105, labelColor: '#f3eee0', display: '4,495.00 %', status: 'PERCENT MODE' },
  { id: 'divide', column: 3, row: 0, label: '÷', family: 'operation', fontSize: 0.012, labelColor: '#29251c', display: '4,495.00 ÷', status: 'DIVIDE' },
  { id: 'seven', column: 0, row: 1, label: '7', family: 'number', fontSize: 0.011, labelColor: '#222521', display: '7', status: 'ENTRY 7' },
  { id: 'eight', column: 1, row: 1, label: '8', family: 'number', fontSize: 0.011, labelColor: '#222521', display: '8', status: 'ENTRY 8' },
  { id: 'nine', column: 2, row: 1, label: '9', family: 'number', fontSize: 0.011, labelColor: '#222521', display: '9', status: 'ENTRY 9' },
  { id: 'multiply', column: 3, row: 1, label: '×', family: 'operation', fontSize: 0.012, labelColor: '#29251c', display: '4,495.00 ×', status: 'MULTIPLY' },
  { id: 'four', column: 0, row: 2, label: '4', family: 'number', fontSize: 0.011, labelColor: '#222521', display: '4', status: 'ENTRY 4' },
  { id: 'five', column: 1, row: 2, label: '5', family: 'number', fontSize: 0.011, labelColor: '#222521', display: '5', status: 'ENTRY 5' },
  { id: 'six', column: 2, row: 2, label: '6', family: 'number', fontSize: 0.011, labelColor: '#222521', display: '6', status: 'ENTRY 6' },
  { id: 'subtract', column: 3, row: 2, label: '−', family: 'operation', fontSize: 0.012, labelColor: '#29251c', display: '4,495.00 −', status: 'DIFFERENCE' },
  { id: 'one', column: 0, row: 3, label: '1', family: 'number', fontSize: 0.011, labelColor: '#222521', display: '1', status: 'ENTRY 1' },
  { id: 'two', column: 1, row: 3, label: '2', family: 'number', fontSize: 0.011, labelColor: '#222521', display: '2', status: 'ENTRY 2' },
  { id: 'three', column: 2, row: 3, label: '3', family: 'number', fontSize: 0.011, labelColor: '#222521', display: '3', status: 'ENTRY 3' },
  { id: 'add', column: 3, row: 3, label: '+', family: 'operation', fontSize: 0.012, labelColor: '#29251c', display: '4,495.00 +', status: 'SUM' },
  { id: 'clear', column: 0, row: 4, label: 'C', family: 'clear', fontSize: 0.0105, labelColor: '#f3eee0', display: '0.00', status: 'CLEARED' },
  { id: 'zero', column: 1, row: 4, label: '0', family: 'number', fontSize: 0.011, labelColor: '#222521', display: '0', status: 'ENTRY 0' },
  { id: 'decimal', column: 2, row: 4, label: '.', family: 'number', fontSize: 0.011, labelColor: '#222521', display: '0.', status: 'DECIMAL ENTRY' },
  { id: 'total', column: 3, row: 4, label: '=', family: 'total', fontSize: 0.012, labelColor: '#f8eee5', display: '4,495.00 %', status: 'PRINTING RESULT' },
] as const satisfies ReadonlyArray<CalculatorKey>

const KEY_MATERIALS = {
  number: { color: '#d2d0c4', roughness: 0.46, metalness: 0.04 },
  memory: { color: '#4a4f4a', roughness: 0.53, metalness: 0.08 },
  operation: { color: '#c09a46', roughness: 0.43, metalness: 0.1 },
  total: { color: '#aa4f42', roughness: 0.4, metalness: 0.08 },
  clear: { color: '#4a4f4a', roughness: 0.53, metalness: 0.08 },
} as const

const EMPTY_KEY_TRAVEL: Record<KeyFamily, number> = {
  number: 0,
  memory: 0,
  operation: 0,
  total: 0,
  clear: 0,
}

const FEET = [
  [-0.095, 0, -0.112],
  [0.095, 0, -0.112],
  [-0.095, 0, 0.112],
  [0.095, 0, 0.112],
] as const

const PANEL_SCREWS = [
  [-0.106, 0.001, -0.074],
  [0.106, 0.001, -0.074],
  [-0.106, 0.001, 0.137],
  [0.106, 0.001, 0.137],
] as const

const WEAR_MARKS = [
  [-0.078, 0.056, 0.155, -0.12],
  [-0.055, 0.052, 0.155, 0.08],
  [0.068, 0.055, 0.155, -0.05],
  [0.087, 0.051, 0.155, 0.14],
] as const

function drawAtlasLine(
  context: CanvasRenderingContext2D,
  cell: AtlasCell,
  text: string,
  color: string,
  fontSize: number,
  align: CanvasTextAlign = 'center',
  yOffset = 0,
) {
  context.save()
  context.beginPath()
  context.rect(cell.x, cell.y, cell.width, cell.height)
  context.clip()
  context.fillStyle = color
  context.font = `700 ${fontSize}px "Courier New", monospace`
  context.textAlign = align
  context.textBaseline = 'middle'

  const padding = Math.max(8, cell.width * 0.045)
  const x = align === 'right'
    ? cell.x + cell.width - padding
    : align === 'left'
      ? cell.x + padding
      : cell.x + cell.width / 2

  context.fillText(text, x, cell.y + cell.height / 2 + yOffset, cell.width - padding * 2)
  context.restore()
}

function renderLabelAtlas(
  canvas: HTMLCanvasElement,
  displayValue: string,
  displayStatus: string,
  tapeOutput: string,
) {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('DeskCalculator label atlas requires a 2D canvas context.')

  context.clearRect(0, 0, canvas.width, canvas.height)

  for (let index = 0; index < KEYS.length; index += 1) {
    const key = KEYS[index]
    drawAtlasLine(context, KEY_LABEL_CELLS[index], key.label, key.labelColor, key.fontSize >= 0.011 ? 54 : 46)
  }

  drawAtlasLine(context, LABEL_CELLS.displayValue, displayValue, '#b9e197', 62, 'right')
  drawAtlasLine(context, LABEL_CELLS.displayStatus, displayStatus, '#86a989', 30, 'left')
  drawAtlasLine(context, LABEL_CELLS.displayHeader, 'LEDGERMASTER 12 · PRINT', '#a7aa9d', 27, 'left')
  drawAtlasLine(context, LABEL_CELLS.sideBadge, 'FINANCE', '#252824', 38)

  const tapeLines = tapeOutput.split('\n')
  const tapeLineHeight = 72
  const tapeStartY = LABEL_CELLS.tape.y + LABEL_CELLS.tape.height / 2 - ((tapeLines.length - 1) * tapeLineHeight) / 2
  for (let index = 0; index < tapeLines.length; index += 1) {
    drawAtlasLine(
      context,
      LABEL_CELLS.tape,
      tapeLines[index],
      '#343631',
      46,
      'center',
      tapeStartY + index * tapeLineHeight - (LABEL_CELLS.tape.y + LABEL_CELLS.tape.height / 2),
    )
  }
}

function makeLabelAtlas() {
  const canvas = document.createElement('canvas')
  canvas.width = LABEL_ATLAS_SIZE
  canvas.height = LABEL_ATLAS_SIZE
  renderLabelAtlas(canvas, INITIAL_DISPLAY_VALUE, INITIAL_DISPLAY_STATUS, INITIAL_TAPE_OUTPUT)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.generateMipmaps = false
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.needsUpdate = true
  texture.name = 'desk-calculator-label-atlas'

  return { canvas, texture }
}

function atlasUv(cell: AtlasCell) {
  return {
    u0: cell.x / LABEL_ATLAS_SIZE,
    u1: (cell.x + cell.width) / LABEL_ATLAS_SIZE,
    v0: 1 - (cell.y + cell.height) / LABEL_ATLAS_SIZE,
    v1: 1 - cell.y / LABEL_ATLAS_SIZE,
  }
}

function makeAtlasPlaneGeometry(width: number, height: number, cell: AtlasCell) {
  const geometry = new BufferGeometry()
  const { u0, u1, v0, v1 } = atlasUv(cell)

  geometry.setAttribute('position', new Float32BufferAttribute([
    -width / 2, -height / 2, 0,
    width / 2, -height / 2, 0,
    width / 2, height / 2, 0,
    -width / 2, height / 2, 0,
  ], 3))
  geometry.setAttribute('uv', new Float32BufferAttribute([
    u0, v0,
    u1, v0,
    u1, v1,
    u0, v1,
  ], 2))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  geometry.computeBoundingSphere()
  return geometry
}

function makeKeyLabelGeometry() {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const halfWidth = 0.013
  const halfDepth = 0.009
  const y = KEY_BASE_Y + KEY_LABEL_SURFACE_Y

  for (let index = 0; index < KEYS.length; index += 1) {
    const key = KEYS[index]
    const x = KEY_COLUMNS[key.column]
    const z = KEY_ROWS[key.row]
    const { u0, u1, v0, v1 } = atlasUv(KEY_LABEL_CELLS[index])
    const vertex = index * 4

    // The label top points toward -z, matching the former Text rotation and +z player view.
    positions.push(
      x - halfWidth, y, z + halfDepth,
      x + halfWidth, y, z + halfDepth,
      x + halfWidth, y, z - halfDepth,
      x - halfWidth, y, z - halfDepth,
    )
    uvs.push(
      u0, v0,
      u1, v0,
      u1, v1,
      u0, v1,
    )
    indices.push(vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3)
  }

  const geometry = new BufferGeometry()
  const positionAttribute = new Float32BufferAttribute(positions, 3)
  positionAttribute.setUsage(DynamicDrawUsage)
  geometry.setAttribute('position', positionAttribute)
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}

function roundedRectShape(width: number, depth: number, radius: number) {
  const shape = new Shape()
  const x = width / 2
  const z = depth / 2

  shape.moveTo(-x + radius, -z)
  shape.lineTo(x - radius, -z)
  shape.quadraticCurveTo(x, -z, x, -z + radius)
  shape.lineTo(x, z - radius)
  shape.quadraticCurveTo(x, z, x - radius, z)
  shape.lineTo(-x + radius, z)
  shape.quadraticCurveTo(-x, z, -x, z - radius)
  shape.lineTo(-x, -z + radius)
  shape.quadraticCurveTo(-x, -z, -x + radius, -z)
  shape.closePath()
  return shape
}

function makeKeyGeometry() {
  const geometry = new ExtrudeGeometry(roundedRectShape(0.038, 0.031, 0.0045), {
    depth: 0.011,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.0015,
    bevelThickness: 0.0013,
    curveSegments: 4,
  })
  geometry.rotateX(-HALF_PI)
  geometry.computeVertexNormals()
  return geometry
}

function makeHousingGeometry() {
  const shape = new Shape()
  shape.moveTo(-0.154, 0.017)
  shape.lineTo(0.154, 0.017)
  shape.lineTo(0.154, 0.048)
  shape.lineTo(0.132, 0.058)
  shape.lineTo(-0.09, 0.125)
  shape.lineTo(-0.154, 0.125)
  shape.closePath()

  const geometry = new ExtrudeGeometry(shape, {
    depth: 0.246,
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: 0.004,
    bevelThickness: 0.003,
    curveSegments: 4,
  })
  geometry.rotateY(-HALF_PI)
  geometry.translate(0.123, 0, 0)
  geometry.computeVertexNormals()
  return geometry
}

function makeTapeGeometry() {
  const segments = 28
  const width = 0.088
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments
    const y = 0.126 * t - 0.014 * t * t
    const z = 0.05 * t + 0.015 * Math.sin(Math.PI * t)
    positions.push(-width / 2, y, z, width / 2, y, z)
    uvs.push(0, t, 1, t)
  }

  for (let index = 0; index < segments; index += 1) {
    const vertex = index * 2
    indices.push(vertex, vertex + 2, vertex + 1, vertex + 2, vertex + 3, vertex + 1)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function smootherStep(value: number) {
  const t = MathUtils.clamp(value, 0, 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function motionPulse(time: number, attackAt: number, attackDuration: number, releaseAt: number, releaseDuration: number) {
  return smootherStep((time - attackAt) / attackDuration) * (1 - smootherStep((time - releaseAt) / releaseDuration))
}

function setKeyTransforms(
  groups: Record<string, Group | null>,
  labelGeometry: BufferGeometry,
  familyTravel: Record<KeyFamily, number>,
  activeKeyId: string | null,
  activeTravel: number,
) {
  const labelPositions = labelGeometry.getAttribute('position')

  for (let index = 0; index < KEYS.length; index += 1) {
    const key = KEYS[index]
    const travel = familyTravel[key.family] + (key.id === activeKeyId ? activeTravel : 0)
    const group = groups[key.id]
    if (group) group.position.y = KEY_BASE_Y + travel

    const labelY = KEY_BASE_Y + KEY_LABEL_SURFACE_Y + travel
    const firstVertex = index * 4
    labelPositions.setY(firstVertex, labelY)
    labelPositions.setY(firstVertex + 1, labelY)
    labelPositions.setY(firstVertex + 2, labelY)
    labelPositions.setY(firstVertex + 3, labelY)
  }

  labelPositions.needsUpdate = true
}

export function DeskCalculator({
  effectPreset,
  effectRun,
  onGameAction,
  selected = false,
  ...groupProps
}: ProceduralAssetProps) {
  const keyGroupsRef = useRef<Record<string, Group | null>>({})
  const feetRef = useRef<InstancedMesh>(null)
  const screwsRef = useRef<InstancedMesh>(null)
  const tearTeethRef = useRef<InstancedMesh>(null)
  const wearRef = useRef<InstancedMesh>(null)

  const tapeMotionRef = useRef<Group>(null)
  const rollMotionRef = useRef<Group>(null)
  const printerMotionRef = useRef<Group>(null)
  const tearBarMotionRef = useRef<Group>(null)
  const displayMaterialRef = useRef<MeshPhysicalMaterial>(null)
  const animationTimeRef = useRef(-1)
  const activeKeyPressRef = useRef<ActiveKeyPress | null>(null)
  const tapeConfirmationTimeRef = useRef(-1)
  const selectedRef = useRef(selected)
  selectedRef.current = selected

  const [displayValue, setDisplayValue] = useState(INITIAL_DISPLAY_VALUE)
  const [displayStatus, setDisplayStatus] = useState(INITIAL_DISPLAY_STATUS)
  const [tapeOutput, setTapeOutput] = useState(INITIAL_TAPE_OUTPUT)

  const reducedMotion = useLabStore((state) => state.reducedMotion)

  const housingGeometry = useMemo(makeHousingGeometry, [])
  const keyGeometry = useMemo(makeKeyGeometry, [])
  const tapeGeometry = useMemo(makeTapeGeometry, [])
  const keyLabelGeometry = useMemo(makeKeyLabelGeometry, [])
  const labelAtlas = useMemo(makeLabelAtlas, [])
  const labelMaterial = useMemo(() => new MeshBasicMaterial({
    map: labelAtlas.texture,
    transparent: true,
    alphaTest: 0.08,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  }), [labelAtlas])
  const displayValueGeometry = useMemo(
    () => makeAtlasPlaneGeometry(0.158, 0.022, LABEL_CELLS.displayValue),
    [],
  )
  const displayStatusGeometry = useMemo(
    () => makeAtlasPlaneGeometry(0.162, 0.0082, LABEL_CELLS.displayStatus),
    [],
  )
  const displayHeaderGeometry = useMemo(
    () => makeAtlasPlaneGeometry(0.162, 0.0074, LABEL_CELLS.displayHeader),
    [],
  )
  const tapeLabelGeometry = useMemo(
    () => makeAtlasPlaneGeometry(0.078, 0.052, LABEL_CELLS.tape),
    [],
  )
  const sideBadgeGeometry = useMemo(
    () => makeAtlasPlaneGeometry(0.075, 0.015, LABEL_CELLS.sideBadge),
    [],
  )

  useLayoutEffect(() => {
    renderLabelAtlas(labelAtlas.canvas, displayValue, displayStatus, tapeOutput)
    labelAtlas.texture.needsUpdate = true
  }, [displayStatus, displayValue, labelAtlas, tapeOutput])

  useEffect(
    () => () => {
      housingGeometry.dispose()
      keyGeometry.dispose()
      tapeGeometry.dispose()
      keyLabelGeometry.dispose()
      displayValueGeometry.dispose()
      displayStatusGeometry.dispose()
      displayHeaderGeometry.dispose()
      tapeLabelGeometry.dispose()
      sideBadgeGeometry.dispose()
      labelMaterial.dispose()
      labelAtlas.texture.dispose()
    },
    [
      displayHeaderGeometry,
      displayStatusGeometry,
      displayValueGeometry,
      housingGeometry,
      keyGeometry,
      keyLabelGeometry,
      labelAtlas,
      labelMaterial,
      sideBadgeGeometry,
      tapeGeometry,
      tapeLabelGeometry,
    ],
  )

  useLayoutEffect(() => {
    const helper = new Object3D()
    setKeyTransforms(keyGroupsRef.current, keyLabelGeometry, EMPTY_KEY_TRAVEL, null, 0)

    const feet = feetRef.current
    if (feet) {
      for (let index = 0; index < FEET.length; index += 1) {
        const [x, y, z] = FEET[index]
        helper.position.set(x, y + 0.006, z)
        helper.rotation.set(0, 0, 0)
        helper.scale.set(1, 1, 1)
        helper.updateMatrix()
        feet.setMatrixAt(index, helper.matrix)
      }
      feet.instanceMatrix.needsUpdate = true
      feet.computeBoundingSphere()
    }

    const screws = screwsRef.current
    if (screws) {
      for (let index = 0; index < PANEL_SCREWS.length; index += 1) {
        const [x, y, z] = PANEL_SCREWS[index]
        helper.position.set(x, y, z)
        helper.rotation.set(0, 0, 0)
        helper.scale.set(1, 1, 1)
        helper.updateMatrix()
        screws.setMatrixAt(index, helper.matrix)
      }
      screws.instanceMatrix.needsUpdate = true
      screws.computeBoundingSphere()
    }

    const teeth = tearTeethRef.current
    if (teeth) {
      for (let index = 0; index < 13; index += 1) {
        helper.position.set(-0.045 + index * 0.0075, 0, 0)
        helper.rotation.set(HALF_PI, 0, 0)
        helper.scale.set(1, 1, 1)
        helper.updateMatrix()
        teeth.setMatrixAt(index, helper.matrix)
      }
      teeth.instanceMatrix.needsUpdate = true
      teeth.computeBoundingSphere()
    }

    const wear = wearRef.current
    if (wear) {
      for (let index = 0; index < WEAR_MARKS.length; index += 1) {
        const [x, y, z, rotation] = WEAR_MARKS[index]
        helper.position.set(x, y, z)
        helper.rotation.set(0, 0, rotation)
        helper.scale.set(index === 1 ? 0.7 : 1, 1, 1)
        helper.updateMatrix()
        wear.setMatrixAt(index, helper.matrix)
      }
      wear.instanceMatrix.needsUpdate = true
      wear.computeBoundingSphere()
    }
  }, [keyLabelGeometry])

  const setKeyGroupRef = useCallback((id: string, group: Group | null) => {
    keyGroupsRef.current[id] = group
  }, [])

  const beginKeyPress = useCallback((key: CalculatorKey, event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    activeKeyPressRef.current = { id: key.id, elapsed: 0, releaseAt: null }
    setDisplayValue(key.display)
    setDisplayStatus(key.status)

    if (key.id === 'total') {
      tapeConfirmationTimeRef.current = 0
      setTapeOutput('PRINTED RESULT\n4,495.00 %\nCONCERNING.')
      onGameAction?.('calculator-complete')
    }
  }, [onGameAction])

  const releaseKey = useCallback((id: string, event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    const press = activeKeyPressRef.current
    if (press?.id === id && press.releaseAt === null) press.releaseAt = Math.max(press.elapsed, 0.075)
  }, [])

  const stopKeyEvent = useCallback((event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
  }, [])

  const resetMotion = useCallback(() => {
    const tape = tapeMotionRef.current
    if (tape) {
      tape.position.set(0, TAPE_BASE_Y, TAPE_BASE_Z)
      tape.rotation.set(0, 0, 0)
      tape.scale.set(1, 1, 1)
    }

    const roll = rollMotionRef.current
    if (roll) roll.rotation.set(0, 0, 0)

    const printer = printerMotionRef.current
    if (printer) {
      printer.position.set(0, 0, 0)
      printer.rotation.set(0, 0, 0)
    }

    const tearBar = tearBarMotionRef.current
    if (tearBar) {
      tearBar.position.set(0, TEAR_BAR_BASE_Y, TEAR_BAR_BASE_Z)
      tearBar.rotation.set(0, 0, 0)
    }

    const displayMaterial = displayMaterialRef.current
    if (displayMaterial) {
      displayMaterial.emissive.setHex(DISPLAY_EMISSIVE)
      displayMaterial.emissiveIntensity = selectedRef.current ? 0.58 : 0.24
    }
  }, [])

  useLayoutEffect(() => {
    resetMotion()
    animationTimeRef.current = (effectRun ?? 0) > 0 ? 0 : -1
  }, [effectRun, resetMotion])

  useLayoutEffect(() => {
    if (animationTimeRef.current >= 0) return
    const displayMaterial = displayMaterialRef.current
    if (displayMaterial) displayMaterial.emissiveIntensity = selected ? 0.58 : 0.24
  }, [selected])

  useFrame((_, delta) => {
    const hadEffect = animationTimeRef.current >= 0
    const hadKeyPress = activeKeyPressRef.current !== null
    const hadTapeConfirmation = tapeConfirmationTimeRef.current >= 0
    if (!hadEffect && !hadKeyPress && !hadTapeConfirmation) return

    const tape = tapeMotionRef.current
    const roll = rollMotionRef.current
    const printer = printerMotionRef.current
    const tearBar = tearBarMotionRef.current
    const displayMaterial = displayMaterialRef.current
    if (!tape || !roll || !printer || !tearBar || !displayMaterial) return

    const preset = effectPreset ?? 'paper-drop'
    const duration = EFFECT_DURATIONS[preset]
    const motionScale = reducedMotion ? 0.32 : 1
    const mechanicalScale = reducedMotion ? 0.72 : 1
    const idleIntensity = selected ? 0.58 : 0.24
    const frameDelta = Math.min(delta, 0.05)
    const keyTravel = { ...EMPTY_KEY_TRAVEL }
    let activeKeyId: string | null = null
    let activeKeyAmount = 0
    let tapeConfirmation = 0

    const activePress = activeKeyPressRef.current
    if (activePress) {
      activePress.elapsed += frameDelta
      const attack = smootherStep(activePress.elapsed / 0.045)
      const release = activePress.releaseAt === null
        ? 0
        : smootherStep((activePress.elapsed - activePress.releaseAt) / 0.09)
      activeKeyId = activePress.id
      activeKeyAmount = attack * (1 - release)

      if (release >= 1) {
        activeKeyPressRef.current = null
        activeKeyId = null
        activeKeyAmount = 0
      }
    }

    if (tapeConfirmationTimeRef.current >= 0) {
      tapeConfirmationTimeRef.current += frameDelta
      tapeConfirmation = motionPulse(tapeConfirmationTimeRef.current, 0, 0.055, 0.17, 0.16)
      if (tapeConfirmationTimeRef.current >= 0.38) tapeConfirmationTimeRef.current = -1
    }

    if (hadEffect) animationTimeRef.current += frameDelta
    const time = animationTimeRef.current
    const effectActive = hadEffect && time < duration

    if (hadEffect && !effectActive) {
      animationTimeRef.current = -1
    }

    resetMotion()

    if (effectActive) switch (preset) {
      case 'paper-drop': {
        const response = motionPulse(time, 0.025, 0.065, 0.12, 0.38)
        const flutter = Math.sin(time * 46) * response

        tape.rotation.x = 0.035 * flutter * motionScale
        tape.rotation.z = 0.05 * Math.sin(time * 32 + 0.6) * response * motionScale
        roll.rotation.x = -0.1 * response * mechanicalScale
        tearBar.position.z = TEAR_BAR_BASE_Z + 0.0012 * response * mechanicalScale
        displayMaterial.emissiveIntensity = idleIntensity + 0.16 * response
        break
      }

      case 'approve': {
        const keyPress = motionPulse(time, 0.045, 0.07, 0.17, 0.11)
        const feed = motionPulse(time, 0.16, 0.2, 0.49, 0.28)
        const motor = Math.sin(time * 72) * feed

        keyTravel.total = -0.0031 * keyPress * mechanicalScale
        tape.scale.y = 1 + 0.1 * feed * mechanicalScale
        tape.rotation.z = 0.012 * Math.sin(time * 26) * feed * motionScale
        roll.rotation.x = -0.78 * feed * mechanicalScale
        printer.position.y = 0.00045 * motor * motionScale
        tearBar.rotation.x = -0.08 * feed * mechanicalScale
        displayMaterial.emissive.setHex(0x287243)
        displayMaterial.emissiveIntensity = idleIntensity + 0.56 * feed + 0.18 * keyPress
        break
      }

      case 'reject': {
        const clearPress = motionPulse(time, 0.04, 0.065, 0.15, 0.1)
        const retract = motionPulse(time, 0.16, 0.16, 0.42, 0.25)
        const cutterSnap = motionPulse(time, 0.29, 0.045, 0.37, 0.08)

        keyTravel.clear = -0.003 * clearPress * mechanicalScale
        tape.scale.y = 1 - 0.085 * retract * mechanicalScale
        tape.rotation.z = -0.025 * retract * motionScale
        roll.rotation.x = 0.54 * retract * mechanicalScale
        tearBar.position.y = TEAR_BAR_BASE_Y - 0.0022 * cutterSnap * mechanicalScale
        tearBar.rotation.x = 0.2 * cutterSnap * mechanicalScale
        displayMaterial.emissive.setHex(0x641c18)
        displayMaterial.emissiveIntensity = idleIntensity + 0.58 * Math.max(clearPress, cutterSnap)
        break
      }

      case 'fraud': {
        const operatorPress = Math.max(
          motionPulse(time, 0.045, 0.045, 0.12, 0.055),
          motionPulse(time, 0.2, 0.045, 0.275, 0.055),
        )
        const totalPress = motionPulse(time, 0.36, 0.055, 0.46, 0.08)
        const alarm = motionPulse(time, 0.4, 0.11, 0.69, 0.29)
        const impact = Math.sin(time * 96) * alarm

        keyTravel.operation = -0.0028 * operatorPress * mechanicalScale
        keyTravel.total = -0.0034 * totalPress * mechanicalScale
        tape.scale.y = 1 + 0.13 * alarm * mechanicalScale
        tape.rotation.z = (0.075 * alarm + 0.016 * impact) * motionScale
        roll.rotation.x = -1.15 * alarm * mechanicalScale
        printer.position.x = 0.0028 * impact * motionScale
        printer.rotation.z = 0.013 * impact * motionScale
        tearBar.rotation.x = -0.14 * alarm * mechanicalScale
        displayMaterial.emissive.setHex(0x8b1115)
        displayMaterial.emissiveIntensity = idleIntensity + 0.88 * alarm + 0.24 * Math.max(operatorPress, totalPress)
        break
      }

      case 'printer-jam': {
        const bite = smootherStep(time / 0.13)
        const release = smootherStep((time - 0.68) / 0.44)
        const seized = bite * (1 - release)
        const rattle = Math.sin(time * 91) * seized
        const chatter = Math.sin(time * 53 + 0.7) * seized

        tape.scale.y = 1 - 0.055 * seized * mechanicalScale
        tape.rotation.x = -0.1 * seized * motionScale
        tape.rotation.z = (0.12 * seized + 0.025 * chatter) * motionScale
        roll.rotation.x = (-0.32 * bite + 0.2 * Math.sin(time * 31) * seized + 0.32 * release) * mechanicalScale
        printer.position.x = 0.0035 * rattle * motionScale
        printer.position.y = 0.0015 * chatter * motionScale
        printer.rotation.z = 0.02 * rattle * motionScale
        tearBar.position.z = TEAR_BAR_BASE_Z + 0.004 * seized * mechanicalScale
        tearBar.rotation.x = (-0.18 * seized + 0.04 * chatter) * mechanicalScale
        displayMaterial.emissive.setHex(0x6f3b0d)
        displayMaterial.emissiveIntensity = idleIntensity + 0.65 * seized
        break
      }

      case 'migration': {
        const powerDown = smootherStep(time / 0.18)
        const organize = motionPulse(time, 0.2, 0.24, 0.67, 0.25)
        const restore = smootherStep((time - 0.7) / 0.2)
        const settle = smootherStep((time - 0.94) / 0.2)
        const memoryWave = motionPulse(time, 0.22, 0.06, 0.32, 0.08)
        const numberWave = motionPulse(time, 0.3, 0.06, 0.4, 0.08)
        const operationWave = motionPulse(time, 0.38, 0.06, 0.48, 0.08)
        const finalWave = motionPulse(time, 0.46, 0.06, 0.56, 0.08)

        keyTravel.memory = -0.0023 * memoryWave * mechanicalScale
        keyTravel.number = -0.0023 * numberWave * mechanicalScale
        keyTravel.operation = -0.0023 * operationWave * mechanicalScale
        keyTravel.clear = -0.0023 * finalWave * mechanicalScale
        keyTravel.total = -0.0023 * finalWave * mechanicalScale
        tape.scale.y = 1 - 0.18 * organize * mechanicalScale
        tape.rotation.z = -0.018 * organize * motionScale
        roll.rotation.x = -0.92 * organize * mechanicalScale
        tearBar.rotation.x = 0.07 * organize * mechanicalScale
        displayMaterial.emissive.setHex(restore > 0 && settle < 1 ? 0x126b58 : DISPLAY_EMISSIVE)
        displayMaterial.emissiveIntensity = Math.max(
          0.025,
          idleIntensity * (1 - powerDown) * (1 - restore) + idleIntensity * settle,
        ) + 0.82 * restore * (1 - settle)
        break
      }
    }

    if (tapeConfirmation > 0) {
      tape.scale.y *= 1 + 0.085 * tapeConfirmation * mechanicalScale
      tape.position.z += 0.0015 * tapeConfirmation * mechanicalScale
      tape.rotation.z += 0.012 * Math.sin(tapeConfirmationTimeRef.current * 42) * tapeConfirmation * motionScale
      roll.rotation.x -= 0.62 * tapeConfirmation * mechanicalScale
      printer.position.y += 0.0006 * Math.sin(tapeConfirmationTimeRef.current * 78) * tapeConfirmation * motionScale
      tearBar.rotation.x -= 0.065 * tapeConfirmation * mechanicalScale
    }

    if (activeKeyAmount > 0) {
      if (!effectActive) displayMaterial.emissive.setHex(0x287243)
      displayMaterial.emissiveIntensity += 0.24 * activeKeyAmount
    }

    setKeyTransforms(
      keyGroupsRef.current,
      keyLabelGeometry,
      keyTravel,
      activeKeyId,
      -KEY_TRAVEL * activeKeyAmount * mechanicalScale,
    )
  })

  return (
    <group {...groupProps}>
      {/* Rubber feet establish the exact y=0 ground plane. */}
      <instancedMesh ref={feetRef} args={[undefined, undefined, FEET.length]} castShadow receiveShadow>
        <boxGeometry args={[0.034, 0.012, 0.044, 2, 1, 2]} />
        <meshStandardMaterial color="#20221f" roughness={0.91} metalness={0.03} />
      </instancedMesh>

      <mesh geometry={housingGeometry} castShadow receiveShadow>
        <meshStandardMaterial color="#74766f" roughness={0.58} metalness={0.16} />
      </mesh>

      <RoundedBox args={[0.242, 0.017, 0.301]} position={[0, 0.021, 0]} radius={0.007} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color="#353934" roughness={0.7} metalness={0.23} />
      </RoundedBox>

      {/* Slightly proud brushed front rail and battered edge wear. */}
      <RoundedBox args={[0.225, 0.012, 0.013]} position={[0, 0.052, 0.148]} radius={0.004} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color="#a2a097" roughness={0.37} metalness={0.58} />
      </RoundedBox>
      <instancedMesh ref={wearRef} args={[undefined, undefined, WEAR_MARKS.length]}>
        <boxGeometry args={[0.028, 0.0012, 0.0013]} />
        <meshStandardMaterial color="#d0cdc0" roughness={0.48} metalness={0.7} />
      </instancedMesh>

      {/* Sloped control deck. */}
      <group position={[0, 0.091, 0.018]} rotation={[DECK_ANGLE, 0, 0]}>
        <RoundedBox args={[0.226, 0.006, 0.238]} position={[0, -0.002, 0.036]} radius={0.007} smoothness={4} receiveShadow>
          <meshStandardMaterial color="#5d615b" roughness={0.66} metalness={0.14} />
        </RoundedBox>

        {KEYS.map((key) => (
          <group key={key.id} position={[KEY_COLUMNS[key.column], 0, KEY_ROWS[key.row]]}>
            <mesh position={[0, KEY_BASE_Y - 0.0005, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.041, 0.006, 0.034]} />
              <meshStandardMaterial color="#242824" roughness={0.72} metalness={0.2} />
            </mesh>
            <group ref={(group) => setKeyGroupRef(key.id, group)} position={[0, KEY_BASE_Y, 0]}>
              <mesh geometry={keyGeometry} castShadow receiveShadow>
                <meshStandardMaterial {...KEY_MATERIALS[key.family]} />
              </mesh>
              <mesh
                position={[0, 0.009, 0]}
                onPointerDown={(event) => beginKeyPress(key, event)}
                onPointerUp={(event) => releaseKey(key.id, event)}
                onPointerOut={(event) => releaseKey(key.id, event)}
                onPointerOver={stopKeyEvent}
                onClick={stopKeyEvent}
                onDoubleClick={stopKeyEvent}
                onContextMenu={stopKeyEvent}
              >
                <boxGeometry args={[0.044, 0.024, 0.036]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
              </mesh>
            </group>
          </group>
        ))}

        {/* One synchronous atlas draw replaces twenty asynchronous SDF text meshes. */}
        <mesh geometry={keyLabelGeometry} material={labelMaterial} renderOrder={2} />

        <instancedMesh ref={screwsRef} args={[undefined, undefined, PANEL_SCREWS.length]} castShadow>
          <cylinderGeometry args={[0.0031, 0.0031, 0.0018, 16]} />
          <meshStandardMaterial color="#a6aaa4" roughness={0.29} metalness={0.82} />
        </instancedMesh>
      </group>

      {/* Tilted display is readable from the canonical +z player side. */}
      <group position={[0, 0.144, -0.108]} rotation={[-0.2, 0, 0]}>
        <RoundedBox args={[0.217, 0.067, 0.025]} radius={0.008} smoothness={5} castShadow receiveShadow>
          <meshStandardMaterial color="#292d2a" roughness={0.45} metalness={0.32} />
        </RoundedBox>
        <RoundedBox args={[0.187, 0.042, 0.005]} position={[0, 0.004, 0.014]} radius={0.004} smoothness={5}>
          <meshPhysicalMaterial
            ref={displayMaterialRef}
            color="#11261f"
            roughness={0.19}
            metalness={0.08}
            clearcoat={0.72}
            clearcoatRoughness={0.2}
            emissive="#153b2b"
            emissiveIntensity={selected ? 0.58 : 0.24}
          />
        </RoundedBox>
        <mesh
          geometry={displayValueGeometry}
          material={labelMaterial}
          position={[0, 0.0095, DISPLAY_LABEL_Z]}
          renderOrder={2}
        />
        <mesh
          geometry={displayStatusGeometry}
          material={labelMaterial}
          position={[0, -0.006, DISPLAY_LABEL_Z]}
          renderOrder={2}
        />
        <mesh
          geometry={displayHeaderGeometry}
          material={labelMaterial}
          position={[0, -0.0131, DISPLAY_LABEL_Z]}
          renderOrder={2}
        />
      </group>

      {/* Rear tape-printer mechanism, including the roll, guide and cutter. */}
      <group ref={printerMotionRef}>
        <RoundedBox args={[0.155, 0.051, 0.055]} position={[0, 0.142, -0.139]} radius={0.008} smoothness={4} castShadow receiveShadow>
          <meshStandardMaterial color="#4b504a" roughness={0.55} metalness={0.28} />
        </RoundedBox>
        <RoundedBox args={[0.112, 0.008, 0.014]} position={[0, 0.161, -0.116]} radius={0.003} smoothness={3} castShadow>
          <meshStandardMaterial color="#171a18" roughness={0.64} metalness={0.42} />
        </RoundedBox>

        <RoundedBox args={[0.014, 0.082, 0.024]} position={[-0.069, 0.195, -0.153]} radius={0.005} smoothness={4} castShadow receiveShadow>
          <meshStandardMaterial color="#60645e" roughness={0.62} metalness={0.24} />
        </RoundedBox>
        <RoundedBox args={[0.014, 0.082, 0.024]} position={[0.069, 0.195, -0.153]} radius={0.005} smoothness={4} castShadow receiveShadow>
          <meshStandardMaterial color="#60645e" roughness={0.62} metalness={0.24} />
        </RoundedBox>

        <group ref={rollMotionRef} position={[0, 0.222, -0.153]}>
          <mesh rotation={[0, 0, HALF_PI]} castShadow receiveShadow>
            <cylinderGeometry args={[0.036, 0.036, 0.104, 32, 1]} />
            <meshStandardMaterial color="#ece9dc" roughness={0.84} metalness={0.01} />
          </mesh>
          <mesh rotation={[0, 0, HALF_PI]} castShadow>
            <cylinderGeometry args={[0.012, 0.012, 0.119, 24, 1]} />
            <meshStandardMaterial color="#a98562" roughness={0.79} metalness={0.02} />
          </mesh>
          <mesh position={[-0.061, 0, 0]} rotation={[0, 0, HALF_PI]} castShadow>
            <cylinderGeometry args={[0.017, 0.017, 0.006, 20]} />
            <meshStandardMaterial color="#343834" roughness={0.5} metalness={0.5} />
          </mesh>
          <mesh position={[0.061, 0, 0]} rotation={[0, 0, HALF_PI]} castShadow>
            <cylinderGeometry args={[0.017, 0.017, 0.006, 20]} />
            <meshStandardMaterial color="#343834" roughness={0.5} metalness={0.5} />
          </mesh>
        </group>

        {/* The supply web visibly connects the exposed roll to the feed roller and print slot. */}
        <mesh position={[0, 0.182, -0.134]} rotation={[1.83, 0, 0]} castShadow receiveShadow>
          <planeGeometry args={[0.088, 0.048]} />
          <meshStandardMaterial color="#edeade" roughness={0.88} metalness={0} side={DoubleSide} />
        </mesh>

        <mesh position={[0, 0.172, -0.112]} rotation={[0, 0, HALF_PI]} castShadow receiveShadow>
          <cylinderGeometry args={[0.007, 0.007, 0.106, 20]} />
          <meshStandardMaterial color="#a5a9a3" roughness={0.28} metalness={0.85} />
        </mesh>
      </group>

      <group ref={tearBarMotionRef} position={[0, TEAR_BAR_BASE_Y, TEAR_BAR_BASE_Z]}>
        <RoundedBox args={[0.106, 0.008, 0.009]} radius={0.002} smoothness={3} castShadow receiveShadow>
          <meshStandardMaterial color="#8f9690" roughness={0.32} metalness={0.83} />
        </RoundedBox>
        <instancedMesh ref={tearTeethRef} args={[undefined, undefined, 13]} position={[0, -0.001, 0.007]} castShadow>
          <coneGeometry args={[0.0028, 0.006, 3]} />
          <meshStandardMaterial color="#b9bdb6" roughness={0.25} metalness={0.9} />
        </instancedMesh>
      </group>

      <group ref={tapeMotionRef} position={[0, TAPE_BASE_Y, TAPE_BASE_Z]}>
        <mesh geometry={tapeGeometry} castShadow receiveShadow>
          <meshStandardMaterial color="#f0eddf" roughness={0.9} metalness={0} side={DoubleSide} />
        </mesh>
        <mesh
          geometry={tapeLabelGeometry}
          material={labelMaterial}
          position={[0, 0.066, 0.044]}
          rotation={[0.36, 0, 0]}
          renderOrder={2}
        />
      </group>

      {/* Side badge and exposed fasteners help the prop hold up in profile. */}
      <RoundedBox args={[0.005, 0.039, 0.105]} position={[-0.127, 0.079, 0.03]} radius={0.002} smoothness={3} castShadow receiveShadow>
        <meshStandardMaterial color="#4a4e49" roughness={0.52} metalness={0.38} />
      </RoundedBox>
      <mesh position={[-0.1301, 0.086, 0.03]} rotation={[0, -HALF_PI, 0]}>
        <planeGeometry args={[0.075, 0.015]} />
        <meshStandardMaterial color="#9a8350" roughness={0.46} metalness={0.56} />
      </mesh>
      <mesh
        geometry={sideBadgeGeometry}
        material={labelMaterial}
        position={[-0.13045, 0.086, 0.03]}
        rotation={[0, -HALF_PI, 0]}
        renderOrder={2}
      />
    </group>
  )
}

export default DeskCalculator
