import modelFont from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff?url'
import { RoundedBox, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import {
  Children,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import * as THREE from 'three'

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
const KEY_GAP = 0.0018
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

  return keys
}

const KEY_LAYOUT = buildKeyboardLayout()
const ESCAPE_KEY = KEY_LAYOUT.find((key) => key.id === 'esc') as KeySpec
const STATIC_KEYS = KEY_LAYOUT.filter((key) => key.id !== 'esc')

const KEYBOARD_LEGEND_BOUNDS = {
  left: -0.246,
  back: -0.082,
  width: 0.492,
  depth: 0.158,
} as const

const MONITOR_REAR_VENTS = Array.from({ length: 18 }, (_, index) => ({
  position: [-0.284 + index * 0.024, 0.548, -0.033] as const,
  rotation: [0, 0, 0] as const,
}))

const TOWER_SIDE_VENTS = Array.from({ length: 10 }, (_, index) => ({
  position: [0.493, 0.062 + index * 0.0135, -0.036] as const,
  rotation: [0, 0, 0] as const,
}))

const MONITOR_REAR_SCREWS = [
  [-0.33, 0.27, -0.033],
  [0.17, 0.27, -0.033],
  [-0.33, 0.54, -0.033],
  [0.17, 0.54, -0.033],
] as const

const TOWER_LED_IDLE_COLOR = new THREE.Color('#69dd92')
const TOWER_LED_IDLE_EMISSIVE = new THREE.Color('#3aff84')
const TOWER_LED_ALERT_COLOR = new THREE.Color('#ff4a3f')
const TOWER_LED_ALERT_EMISSIVE = new THREE.Color('#ff2f25')

const MANUAL_WINDOW_BASES = {
  transaction: [-0.142, 0.007, 0.002] as const,
  policy: [0.138, 0.028, 0.003] as const,
  notification: [0.11, -0.104, 0.004] as const,
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
    bevelSegments: 2,
    bevelSize,
    bevelThickness: 0.0008,
    curveSegments: 3,
    depth: 0.007,
  })
  geometry.rotateX(-HALF_PI)
  geometry.computeVertexNormals()
  return geometry
}

function makeKeyboardLegendTexture(keys: readonly KeySpec[]) {
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 672

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to create keyboard legend canvas')

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.lineJoin = 'round'

  keys.forEach((key) => {
    if (key.id === 'esc') return

    const x =
      ((key.x - KEYBOARD_LEGEND_BOUNDS.left) / KEYBOARD_LEGEND_BOUNDS.width) *
      canvas.width
    const y =
      ((key.z - KEYBOARD_LEGEND_BOUNDS.back) / KEYBOARD_LEGEND_BOUNDS.depth) *
      canvas.height
    const keyPixelWidth =
      (key.width / KEYBOARD_LEGEND_BOUNDS.width) * canvas.width
    const lines = key.label.split('\n')
    if (key.label.length === 0) return

    const longestLine = Math.max(...lines.map((line) => line.length))
    const sizeFromWidth = keyPixelWidth / Math.max(longestLine * 0.63, 1.65)
    const fontSize = THREE.MathUtils.clamp(
      sizeFromWidth,
      lines.length > 1 ? 17 : 19,
      31,
    )
    const lineHeight = fontSize * 0.86

    context.font = `600 ${fontSize}px "IBM Plex Mono", "SFMono-Regular", monospace`
    context.fillStyle = '#cbd4cd'

    lines.forEach((line, lineIndex) => {
      const lineY = y + (lineIndex - (lines.length - 1) / 2) * lineHeight
      context.fillText(line, x, lineY)
    })
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
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

function ScreenPanel({
  color,
  height,
  position,
  width,
}: {
  color: string
  height: number
  position: [number, number, number]
  width: number
}) {
  return (
    <RoundedBox
      args={[width, height, 0.0015]}
      position={position}
      radius={0.006}
      smoothness={4}
    >
      <meshBasicMaterial color={color} toneMapped={false} />
    </RoundedBox>
  )
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
  const screenContentRef = useRef<THREE.Group>(null)
  const manualUiRef = useRef<THREE.Group>(null)
  const manualTransactionRef = useRef<THREE.Group>(null)
  const manualPolicyRef = useRef<THREE.Group>(null)
  const manualNotificationRef = useRef<THREE.Group>(null)
  const rampUiRef = useRef<THREE.Group>(null)
  const statusOverlayRef = useRef<THREE.Group>(null)
  const mouseLeftButtonRef = useRef<THREE.Mesh>(null)
  const escapeKeyRef = useRef<THREE.Group>(null)

  const screenGlassRef = useRef<THREE.MeshPhysicalMaterial>(null)
  const blackoutRef = useRef<THREE.MeshBasicMaterial>(null)
  const statusPanelRef = useRef<THREE.MeshStandardMaterial>(null)
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
  const keyboardLegendTexture = useMemo(
    () => makeKeyboardLegendTexture(KEY_LAYOUT),
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
          [0.08, 0.292, -0.046],
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
          [0, 0.051, -0.006],
          [0, 0.05, 0.012],
          [0, 0.0505, 0.032],
          [0, 0.0438, 0.051],
        ],
        0.00062,
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
        color: '#343a37',
        roughness: 0.46,
        metalness: 0.018,
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

  const statusStyle = useMemo(() => {
    switch (effectPreset) {
      case 'paper-drop':
        return { color: '#78c8ff', label: 'INBOX +1' }
      case 'approve':
        return { color: '#4fd981', label: 'APPROVED  ✓' }
      case 'reject':
        return { color: '#ff6658', label: 'REJECTED  ×' }
      case 'fraud':
        return { color: '#ff453c', label: 'FRAUD FLAGGED' }
      case 'printer-jam':
        return { color: '#ffad3d', label: 'PRINTER JAM' }
      default:
        return { color: '#55dc8a', label: 'WORKSPACE READY' }
    }
  }, [effectPreset])

  useEffect(
    () => () => {
      keyGeometry.dispose()
      keyboardLegendTexture.dispose()
      keyboardCableGeometry.dispose()
      mouseCableGeometry.dispose()
      mouseShellSeamGeometry.dispose()
      rearCableGeometry.dispose()
      Object.values(materials).forEach((material) => material.dispose())
    },
    [
      keyGeometry,
      keyboardCableGeometry,
      keyboardLegendTexture,
      materials,
      mouseCableGeometry,
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
    const screenContent = screenContentRef.current
    const manualUi = manualUiRef.current
    const manualTransaction = manualTransactionRef.current
    const manualPolicy = manualPolicyRef.current
    const manualNotification = manualNotificationRef.current
    const rampUi = rampUiRef.current
    const status = statusOverlayRef.current
    const mouseButton = mouseLeftButtonRef.current
    const escapeKey = escapeKeyRef.current

    if (assembly) {
      assembly.position.set(0, 0, 0)
      assembly.rotation.set(0, 0, 0)
      assembly.scale.set(1, 1, 1)
    }
    if (screenContent) {
      screenContent.position.set(0, 0, 0)
      screenContent.rotation.set(0, 0, 0)
      screenContent.scale.set(1, 1, 1)
    }
    if (manualUi) {
      manualUi.visible = true
      manualUi.position.set(0, 0, 0)
      manualUi.scale.set(1, 1, 1)
    }
    if (manualTransaction) {
      manualTransaction.position.set(...MANUAL_WINDOW_BASES.transaction)
      manualTransaction.scale.set(1, 1, 1)
    }
    if (manualPolicy) {
      manualPolicy.position.set(...MANUAL_WINDOW_BASES.policy)
      manualPolicy.scale.set(1, 1, 1)
    }
    if (manualNotification) {
      manualNotification.position.set(...MANUAL_WINDOW_BASES.notification)
      manualNotification.scale.set(1, 1, 1)
    }
    if (rampUi) {
      rampUi.visible = false
      rampUi.position.set(0, -0.026, 0)
      rampUi.scale.set(0.86, 0.86, 1)
    }
    if (status) {
      status.visible = false
      status.position.set(0, 0, 0.008)
      status.rotation.set(0, 0, 0)
      status.scale.set(0.86, 0.86, 1)
    }
    if (mouseButton) {
      mouseButton.position.set(-0.016, 0.0495, -0.031)
      mouseButton.rotation.set(-0.045, 0, 0.008)
      mouseButton.scale.set(1, 1, 1)
    }
    if (escapeKey) {
      escapeKey.position.set(ESCAPE_KEY.x, ESCAPE_KEY.y, ESCAPE_KEY.z)
      escapeKey.rotation.set(ESCAPE_KEY.rotationX, 0, 0)
      escapeKey.scale.set(1, 1, 1)
    }
    if (screenGlassRef.current) screenGlassRef.current.emissiveIntensity = 0.26
    if (blackoutRef.current) blackoutRef.current.opacity = 0
    if (statusPanelRef.current) {
      statusPanelRef.current.color.set(statusStyle.color)
      statusPanelRef.current.emissive.set(statusStyle.color)
      statusPanelRef.current.opacity = 0
    }
    if (powerLedRef.current) powerLedRef.current.emissiveIntensity = 1.65
    if (towerLedRef.current) {
      towerLedRef.current.color.set('#69dd92')
      towerLedRef.current.emissive.set('#3aff84')
      towerLedRef.current.emissiveIntensity = 1.4
    }
  }, [statusStyle.color])

  const finishMigration = useCallback(() => {
    resetAssembly()
    if (manualUiRef.current) manualUiRef.current.visible = false
    if (rampUiRef.current) {
      rampUiRef.current.visible = true
      rampUiRef.current.position.set(0, 0, 0)
      rampUiRef.current.scale.set(1, 1, 1)
    }
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
    const screenContent = screenContentRef.current
    const manualUi = manualUiRef.current
    const manualTransaction = manualTransactionRef.current
    const manualPolicy = manualPolicyRef.current
    const manualNotification = manualNotificationRef.current
    const rampUi = rampUiRef.current
    const status = statusOverlayRef.current
    const mouseButton = mouseLeftButtonRef.current
    const escapeKey = escapeKeyRef.current
    const screenGlass = screenGlassRef.current
    const blackout = blackoutRef.current
    const statusPanel = statusPanelRef.current
    const powerLed = powerLedRef.current
    const towerLed = towerLedRef.current

    if (
      !assembly ||
      !screenContent ||
      !manualUi ||
      !manualTransaction ||
      !manualPolicy ||
      !manualNotification ||
      !rampUi ||
      !status ||
      !mouseButton ||
      !escapeKey ||
      !screenGlass ||
      !blackout ||
      !statusPanel ||
      !powerLed ||
      !towerLed
    ) {
      return
    }

    state.elapsed += Math.min(delta, 0.05)
    const time = state.elapsed
    const motionScale = reducedMotion ? 0.18 : 1
    const mechanismScale = reducedMotion ? 0.45 : 1
    const uiMotionScale = reducedMotion ? 0 : 1

    resetAssembly()

    if (state.preset === 'migration') {
      const preShake = pulseEnvelope(time, 0.11, 0.31, 0.18)
      const collapse = smootherStep((time - 0.18) / 0.32)
      const powerOff = smoothStep((time - 0.2) / 0.2)
      const powerOn = smootherStep((time - 0.7) / 0.23)
      const unified = smootherStep((time - 0.84) / 0.46)
      const ledOff = smootherStep((time - 0.27) / 0.09)
      const ledOn = smootherStep((time - 0.65) / 0.13)
      const ledLevel = 1 - ledOff * (1 - ledOn)
      const tremor = Math.sin(time * 58) * preShake * motionScale

      assembly.position.x = tremor * 0.0026
      assembly.rotation.z = tremor * 0.006

      manualTransaction.position.x =
        MANUAL_WINDOW_BASES.transaction[0] * (1 - collapse * uiMotionScale)
      manualTransaction.position.y =
        MANUAL_WINDOW_BASES.transaction[1] * (1 - collapse * uiMotionScale)
      manualTransaction.scale.setScalar(1 - collapse * 0.74 * uiMotionScale)
      manualPolicy.position.x =
        MANUAL_WINDOW_BASES.policy[0] * (1 - collapse * uiMotionScale)
      manualPolicy.position.y =
        MANUAL_WINDOW_BASES.policy[1] * (1 - collapse * uiMotionScale)
      manualPolicy.scale.setScalar(1 - collapse * 0.74 * uiMotionScale)
      manualNotification.position.x =
        MANUAL_WINDOW_BASES.notification[0] * (1 - collapse * uiMotionScale)
      manualNotification.position.y =
        MANUAL_WINDOW_BASES.notification[1] * (1 - collapse * uiMotionScale)
      manualNotification.scale.setScalar(1 - collapse * 0.74 * uiMotionScale)

      manualUi.visible = time < 0.58
      blackout.opacity = Math.max(0, powerOff - powerOn) * 0.98
      powerLed.emissiveIntensity = 0.03 + 1.62 * ledLevel
      towerLed.emissiveIntensity = 0.02 + 1.38 * ledLevel
      screenGlass.emissiveIntensity = 0.26 * (1 - powerOff) + 0.46 * powerOn

      rampUi.visible = time >= 0.68
      rampUi.position.y = -0.026 * (1 - unified) * uiMotionScale
      const rampScale = 1 - (1 - unified) * 0.14 * uiMotionScale
      rampUi.scale.set(rampScale, rampScale, 1)

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
    const statusIn = smootherStep((time - 0.055) / 0.14)
    const statusOut =
      1 - smoothStep((time - duration * 0.69) / (duration * 0.24))
    const overlayEnvelope = statusIn * statusOut

    status.visible = overlayEnvelope > 0.001
    const statusScale = 1 - (1 - statusIn) * 0.14 * uiMotionScale
    status.scale.set(statusScale, statusScale, 1)
    status.position.y = -0.013 * (1 - statusIn) * uiMotionScale
    statusPanel.opacity = 0.88 * overlayEnvelope
    screenGlass.emissiveIntensity = 0.26 + 0.3 * overlayEnvelope

    if (state.preset === 'paper-drop') {
      const nod = pulseEnvelope(time, 0.045, 0.19, 0.27)
      assembly.rotation.x = -0.0045 * nod * motionScale
      assembly.position.y = 0.0007 * nod * motionScale
      manualUi.position.y = 0.004 * overlayEnvelope * uiMotionScale
      powerLed.emissiveIntensity = 1.65 + 1.5 * overlayEnvelope
    } else if (state.preset === 'approve') {
      const click = pulseEnvelope(time, 0.035, 0.14, 0.16)
      assembly.position.y = -0.0016 * impact * motionScale
      assembly.rotation.x = 0.0025 * Math.sin(time * 34) * impact * motionScale
      mouseButton.position.y = 0.0495 - 0.0022 * click * mechanismScale
      mouseButton.rotation.x = -0.045 + 0.032 * click * mechanismScale
      powerLed.emissiveIntensity = 1.65 + 2.1 * overlayEnvelope
    } else if (state.preset === 'reject') {
      const keyPress = pulseEnvelope(time, 0.03, 0.14, 0.17)
      const snap = Math.sin(time * 41) * impact
      assembly.position.x = 0.0032 * snap * motionScale
      assembly.rotation.z =
        -0.007 * impact * motionScale + 0.0025 * snap * motionScale
      screenContent.position.x = -0.006 * impact * uiMotionScale
      escapeKey.position.y = ESCAPE_KEY.y - 0.0045 * keyPress * mechanismScale
      status.rotation.z = -0.018 * impact * uiMotionScale
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
      if (!reducedMotion) {
        status.scale.set(
          0.82 + 0.18 * statusIn + 0.035 * heavy,
          0.82 + 0.18 * statusIn,
          1,
        )
      }
    } else if (state.preset === 'printer-jam') {
      const motor = pulseEnvelope(time, 0.075, 0.77, 0.36)
      const rattle = Math.sin(time * 64) * motor
      assembly.position.x = rattle * 0.0042 * motionScale
      assembly.position.y =
        Math.abs(Math.sin(time * 49)) * motor * 0.0017 * motionScale
      assembly.rotation.z = rattle * 0.01 * motionScale
      screenContent.position.x = rattle * 0.0025 * uiMotionScale
      manualTransaction.position.x =
        MANUAL_WINDOW_BASES.transaction[0] + rattle * 0.002 * uiMotionScale
      manualPolicy.position.y =
        MANUAL_WINDOW_BASES.policy[1] - rattle * 0.0017 * uiMotionScale
      towerLed.color.set('#ffae3f')
      towerLed.emissive.set('#ff9b24')
      towerLed.emissiveIntensity = 1.1 + 3.2 * motor
    }

    if (time >= duration) {
      resetAssembly()
      state.active = false
    }
  })

  return (
    <group {...groupProps}>
      <group ref={assemblyMotionRef}>
        {/* 29-inch 16:9 monitor: slim front frame, stepped rear housing, VESA hinge, and grounded stand. */}
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
          args={[0.286, 0.034, 0.178]}
          material={materials.shellDark}
          position={[-0.08, 0.021, MONITOR_STAND_FOOT_Z]}
          radius={0.012}
          smoothness={7}
          castShadow
          receiveShadow
        />
        <RoundedBox
          args={[0.064, 0.29, 0.046]}
          material={materials.metal}
          position={[-0.08, 0.172, 0.004]}
          radius={0.015}
          smoothness={7}
          castShadow
          receiveShadow
        />
        <RoundedBox
          args={[0.038, 0.238, 0.049]}
          material={materials.shellDark}
          position={[-0.08, 0.17, 0.006]}
          radius={0.012}
          smoothness={6}
          castShadow
        />
        <RoundedBox
          args={[0.096, 0.032, 0.076]}
          material={materials.metal}
          position={[-0.08, 0.041, 0.012]}
          radius={0.011}
          smoothness={7}
          castShadow
          receiveShadow
        />
        <RoundedBox
          args={[0.116, 0.06, 0.054]}
          material={materials.metal}
          position={[-0.08, 0.309, -0.007]}
          radius={0.016}
          smoothness={7}
          castShadow
        />
        <mesh
          material={materials.metal}
          position={[-0.08, 0.313, -0.009]}
          rotation={[0, 0, HALF_PI]}
          castShadow
        >
          <cylinderGeometry args={[0.022, 0.022, 0.112, 36]} />
        </mesh>
        <RoundedBox
          args={[0.162, 0.142, 0.018]}
          material={materials.metal}
          position={[-0.08, 0.365, -0.035]}
          radius={0.012}
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
          args={[0.69, 0.4, 0.018]}
          material={materials.shellDark}
          position={[-0.08, 0.405, 0.087]}
          radius={0.025}
          smoothness={9}
          castShadow
          receiveShadow
        />
        <RoundedBox
          args={[0.662, 0.382, 0.01]}
          material={materials.trim}
          position={[-0.08, 0.405, 0.093]}
          radius={0.021}
          smoothness={9}
          castShadow
        />
        <RoundedBox
          args={[
            DESK_COMPUTER_SCREEN.glassWidth,
            DESK_COMPUTER_SCREEN.glassHeight,
            0.006,
          ]}
          position={[
            DESK_COMPUTER_SCREEN.position[0],
            DESK_COMPUTER_SCREEN.position[1],
            DESK_COMPUTER_SCREEN.position[2] - 0.005,
          ]}
          radius={0.017}
          smoothness={10}
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
          args={[0.54, 0.31, 0.058]}
          material={materials.shellDark}
          position={[-0.08, 0.405, 0.019]}
          radius={0.025}
          smoothness={8}
          castShadow
        />
        <RoundedBox
          args={[0.49, 0.274, 0.026]}
          material={materials.shell}
          position={[-0.08, 0.405, -0.019]}
          radius={0.021}
          smoothness={7}
          castShadow
        />
        <RoundedBox
          args={[0.22, 0.056, 0.009]}
          material={materials.trim}
          position={[-0.08, 0.486, -0.032]}
          radius={0.009}
          smoothness={6}
          castShadow
        />
        <Text
          anchorX="center"
          anchorY="middle"
          color="#9daaa2"
          font={modelFont}
          fontSize={0.0095}
          position={[-0.08, 0.486, -0.038]}
          rotation={[0, Math.PI, 0]}
        >
          EXPENSE OS / DISPLAY 29
        </Text>

        <RoundedBox
          args={[0.046, 0.026, 0.014]}
          material={materials.trim}
          position={[0.08, 0.292, -0.034]}
          radius={0.004}
          smoothness={4}
          castShadow
        />
        <RoundedBox
          args={[0.034, 0.016, 0.01]}
          material={materials.rubber}
          position={[0.08, 0.292, -0.044]}
          radius={0.004}
          smoothness={4}
          castShadow
        />
        <RoundedBox
          args={[0.048, 0.023, 0.01]}
          material={materials.trim}
          position={[-0.215, 0.292, -0.032]}
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

        <RoundedBox
          args={[0.102, 0.022, 0.012]}
          material={materials.trim}
          position={[-0.22, 0.205, 0.088]}
          radius={0.004}
          smoothness={4}
          castShadow
        />
        <Text
          anchorX="center"
          anchorY="middle"
          color="#d6ddd5"
          font={modelFont}
          fontSize={0.0084}
          position={[-0.22, 0.205, 0.095]}
        >
          EXPENSE OS 29
        </Text>
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

        {/* The fallback stays mounted for refs/animation, but a live Html child owns the visible screen. */}
        <group
          name="desk-computer-screen-anchor"
          position={DESK_COMPUTER_SCREEN.position}
          rotation={DESK_COMPUTER_SCREEN.rotation}
          userData={DESK_COMPUTER_SCREEN}
        >
          <group ref={screenContentRef} visible={!hasLiveScreen}>
            <group ref={manualUiRef}>
              <mesh position={[0, 0, -0.001]}>
                <planeGeometry
                  args={[
                    DESK_COMPUTER_SCREEN.safeWidth,
                    DESK_COMPUTER_SCREEN.safeHeight,
                  ]}
                />
                <meshBasicMaterial color="#102126" toneMapped={false} />
              </mesh>
              <ScreenPanel
                color="#31555b"
                height={0.034}
                position={[0, 0.15, 0.001]}
                width={0.604}
              />
              <Text
                anchorX="left"
                anchorY="middle"
                color="#daf0e9"
                font={modelFont}
                fontSize={0.015}
                position={[-0.292, 0.15, 0.004]}
              >
                EXPENSE OS / INBOX 47 / 11:54
              </Text>

              <group
                ref={manualTransactionRef}
                position={MANUAL_WINDOW_BASES.transaction}
              >
                <ScreenPanel
                  color="#243b42"
                  height={0.21}
                  position={[0, 0, 0]}
                  width={0.292}
                />
                <ScreenPanel
                  color="#41616a"
                  height={0.028}
                  position={[0, 0.084, 0.002]}
                  width={0.278}
                />
                <Text
                  anchorX="left"
                  anchorY="middle"
                  color="#f1dc97"
                  font={modelFont}
                  fontSize={0.017}
                  lineHeight={1.5}
                  position={[-0.126, 0.012, 0.005]}
                >
                  {
                    'TRANSACTION\nCHOPPED    $18.40\nRECEIPT    $81.40\nSTATUS     REVIEW'
                  }
                </Text>
              </group>

              <group
                ref={manualPolicyRef}
                position={MANUAL_WINDOW_BASES.policy}
              >
                <ScreenPanel
                  color="#29313a"
                  height={0.158}
                  position={[0, 0, 0]}
                  width={0.25}
                />
                <ScreenPanel
                  color="#4b5361"
                  height={0.026}
                  position={[0, 0.061, 0.002]}
                  width={0.236}
                />
                <Text
                  anchorX="left"
                  anchorY="middle"
                  color="#dce2eb"
                  font={modelFont}
                  fontSize={0.0135}
                  lineHeight={1.55}
                  position={[-0.108, 0.004, 0.005]}
                >
                  {'POLICY.PDF\nMEALS $35 / PERSON\nTIP >25%  REVIEW'}
                </Text>
              </group>

              <group
                ref={manualNotificationRef}
                position={MANUAL_WINDOW_BASES.notification}
              >
                <ScreenPanel
                  color="#493138"
                  height={0.052}
                  position={[0, 0, 0]}
                  width={0.28}
                />
                <Text
                  anchorX="center"
                  anchorY="middle"
                  color="#ffb2a5"
                  font={modelFont}
                  fontSize={0.013}
                  position={[0, 0, 0.004]}
                >
                  9 UNREAD / FINANCE OPS
                </Text>
              </group>
            </group>

            <group ref={rampUiRef} visible={false}>
              <mesh position={[0, 0, -0.001]}>
                <planeGeometry
                  args={[
                    DESK_COMPUTER_SCREEN.safeWidth,
                    DESK_COMPUTER_SCREEN.safeHeight,
                  ]}
                />
                <meshBasicMaterial color="#10241f" toneMapped={false} />
              </mesh>
              <ScreenPanel
                color="#23483c"
                height={0.038}
                position={[0, 0.148, 0.001]}
                width={0.604}
              />
              <Text
                anchorX="left"
                anchorY="middle"
                color="#e0f8ed"
                font={modelFont}
                fontSize={0.0155}
                position={[-0.29, 0.148, 0.004]}
              >
                UNIFIED WORKFLOW 6 NEED ATTENTION
              </Text>
              <ScreenPanel
                color="#18352e"
                height={0.246}
                position={[-0.154, -0.015, 0.001]}
                width={0.276}
              />
              <Text
                anchorX="left"
                anchorY="middle"
                color="#eafaf3"
                font={modelFont}
                fontSize={0.016}
                lineHeight={1.58}
                position={[-0.272, -0.005, 0.004]}
              >
                {
                  '47 CHECKED\n\nRECEIPT MATCH  ✓\nPOLICY STATUS  !\nTRAVEL LINKED  ✓'
                }
              </Text>
              <ScreenPanel
                color="#1e3e34"
                height={0.113}
                position={[0.155, 0.053, 0.001]}
                width={0.292}
              />
              <ScreenPanel
                color="#1e3e34"
                height={0.103}
                position={[0.155, -0.078, 0.001]}
                width={0.292}
              />
              <Text
                anchorX="left"
                anchorY="middle"
                color="#7fe2a9"
                font={modelFont}
                fontSize={0.0145}
                lineHeight={1.5}
                position={[0.025, 0.052, 0.004]}
              >
                {'AMOUNT MISMATCH\n$18.40 / $81.40'}
              </Text>
              <Text
                anchorX="left"
                anchorY="middle"
                color="#c7ded5"
                font={modelFont}
                fontSize={0.0135}
                lineHeight={1.5}
                position={[0.025, -0.078, 0.004]}
              >
                {'EVIDENCE CONNECTED\nREADY FOR JUDGMENT'}
              </Text>
            </group>

            <group
              ref={statusOverlayRef}
              visible={false}
              position={[0, 0, 0.008]}
            >
              <RoundedBox
                args={[0.43, 0.088, 0.004]}
                radius={0.012}
                smoothness={6}
              >
                <meshStandardMaterial
                  ref={statusPanelRef}
                  color={statusStyle.color}
                  emissive={statusStyle.color}
                  emissiveIntensity={0.42}
                  opacity={0}
                  transparent
                  depthWrite={false}
                  roughness={0.4}
                />
              </RoundedBox>
              <Text
                anchorX="center"
                anchorY="middle"
                color="#f5fff9"
                font={modelFont}
                fontSize={0.027}
                outlineColor="#15211e"
                outlineWidth={0.0008}
                position={[0, 0, 0.004]}
              >
                {statusStyle.label}
              </Text>
            </group>

            <mesh position={[0, 0, 0.015]}>
              <planeGeometry
                args={[
                  DESK_COMPUTER_SCREEN.safeWidth,
                  DESK_COMPUTER_SCREEN.safeHeight,
                ]}
              />
              <meshBasicMaterial
                ref={blackoutRef}
                color="#020504"
                opacity={0}
                transparent
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          </group>

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
        <Text
          anchorX="center"
          anchorY="middle"
          color="#28302c"
          font={modelFont}
          fontSize={0.0078}
          position={[0.389, 0.125, 0.136]}
        >
          ARCHIVE / CARD I-O
        </Text>
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
        <Text
          anchorX="center"
          anchorY="middle"
          color="#91a89e"
          font={modelFont}
          fontSize={0.0076}
          position={[0.4, 0.041, 0.133]}
        >
          FINANCE DOCK / REV 04
        </Text>
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
          <RoundedBox
            args={[0.51, 0.028, 0.178]}
            material={materials.shellDark}
            position={[0, 0.014, 0]}
            radius={0.015}
            smoothness={8}
            castShadow
            receiveShadow
          />
          <RoundedBox
            args={[0.492, 0.014, 0.158]}
            material={materials.trim}
            position={[0, 0.03, -0.003]}
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
            <Text
              anchorX="center"
              anchorY="middle"
              color="#edf4ed"
              font={modelFont}
              fontSize={0.0054}
              position={[0, 0.0087, 0]}
              rotation={[-HALF_PI, 0, 0]}
            >
              Esc
            </Text>
          </group>

          <mesh
            position={[0, 0.04455, -0.003]}
            rotation={[-HALF_PI, 0, 0]}
            renderOrder={2}
          >
            <planeGeometry
              args={[
                KEYBOARD_LEGEND_BOUNDS.width,
                KEYBOARD_LEGEND_BOUNDS.depth,
              ]}
            />
            <meshBasicMaterial
              alphaTest={0.08}
              depthWrite
              map={keyboardLegendTexture}
              polygonOffset
              polygonOffsetFactor={-1}
              toneMapped={false}
              transparent
            />
          </mesh>

          <RoundedBox
            args={[0.078, 0.008, 0.012]}
            material={materials.shellLight}
            position={[-0.205, 0.021, 0.082]}
            radius={0.003}
            smoothness={4}
            castShadow
          />
          <Text
            anchorX="center"
            anchorY="middle"
            color="#303733"
            font={modelFont}
            fontSize={0.0062}
            position={[-0.205, 0.026, 0.082]}
            rotation={[-HALF_PI, 0, 0]}
          >
            EXPENSE OS / K104
          </Text>
          <RoundedBox
            args={[0.052, 0.018, 0.019]}
            material={materials.rubber}
            position={[0.186, 0.019, -0.089]}
            radius={0.006}
            smoothness={5}
            castShadow
          />
        </group>

        {/* Right-handed mouse: one continuous molded shell with inset controls, grip, skids, and cable. */}
        <group position={[MOUSE_X, 0, MOUSE_Z]} rotation={[0, -0.035, 0]}>
          <RoundedBox
            args={[0.07, 0.009, 0.116]}
            material={materials.rubber}
            position={[0, 0.0045, 0]}
            radius={0.018}
            smoothness={8}
            castShadow
            receiveShadow
          />
          <mesh
            material={materials.shellDark}
            position={[0, 0.0275, 0.003]}
            rotation={[HALF_PI, 0, 0]}
            scale={[1, 1, 0.65]}
            castShadow
            receiveShadow
          >
            <capsuleGeometry args={[0.036, 0.05, 12, 32]} />
          </mesh>
          <mesh
            geometry={mouseShellSeamGeometry}
            material={materials.trim}
            castShadow
          />
          <RoundedBox
            ref={mouseLeftButtonRef}
            args={[0.029, 0.004, 0.044]}
            material={materials.shellDark}
            position={[-0.016, 0.0495, -0.031]}
            rotation={[-0.045, 0, 0.008]}
            radius={0.007}
            smoothness={7}
            castShadow
          />
          <RoundedBox
            args={[0.029, 0.004, 0.044]}
            material={materials.shellDark}
            position={[0.016, 0.0495, -0.031]}
            rotation={[-0.045, 0, -0.008]}
            radius={0.007}
            smoothness={7}
            castShadow
          />
          <RoundedBox
            args={[0.016, 0.004, 0.028]}
            material={materials.trim}
            position={[0, 0.0505, -0.029]}
            radius={0.005}
            smoothness={5}
            castShadow
          />
          <RoundedBox
            args={[0.0012, 0.002, 0.039]}
            material={materials.trim}
            position={[0, 0.052, -0.035]}
            radius={0.0005}
            smoothness={3}
          />
          <mesh
            material={materials.rubber}
            position={[0, 0.0565, -0.029]}
            rotation={[0, 0, HALF_PI]}
            castShadow
          >
            <cylinderGeometry args={[0.007, 0.007, 0.014, 24]} />
          </mesh>
          <mesh
            material={materials.trim}
            position={[-0.0036, 0.0565, -0.029]}
            rotation={[0, HALF_PI, 0]}
          >
            <torusGeometry args={[0.0068, 0.00045, 6, 20]} />
          </mesh>
          <mesh
            material={materials.trim}
            position={[0, 0.0565, -0.029]}
            rotation={[0, HALF_PI, 0]}
          >
            <torusGeometry args={[0.0068, 0.00045, 6, 20]} />
          </mesh>
          <mesh
            material={materials.trim}
            position={[0.0036, 0.0565, -0.029]}
            rotation={[0, HALF_PI, 0]}
          >
            <torusGeometry args={[0.0068, 0.00045, 6, 20]} />
          </mesh>
          <RoundedBox
            args={[0.003, 0.014, 0.038]}
            material={materials.rubber}
            position={[-0.035, 0.021, 0.012]}
            radius={0.002}
            smoothness={4}
          />
          <RoundedBox
            args={[0.003, 0.014, 0.038]}
            material={materials.rubber}
            position={[0.035, 0.021, 0.012]}
            radius={0.002}
            smoothness={4}
          />
          <RoundedBox
            args={[0.018, 0.018, 0.024]}
            material={materials.rubber}
            position={[0, 0.014, -0.061]}
            radius={0.006}
            smoothness={5}
            castShadow
          />
          <RoundedBox
            args={[0.014, 0.003, 0.052]}
            material={materials.rubber}
            position={[-0.02, 0.0015, 0.012]}
            radius={0.002}
            smoothness={4}
          />
          <RoundedBox
            args={[0.014, 0.003, 0.052]}
            material={materials.rubber}
            position={[0.02, 0.0015, 0.012]}
            radius={0.002}
            smoothness={4}
          />
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
          position={[0.08, 0.292, -0.047]}
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
        <Text
          anchorX="center"
          anchorY="middle"
          color="#dde2d9"
          font={modelFont}
          fontSize={0.0068}
          position={[-0.08, 0.043, 0.048]}
          rotation={[-HALF_PI, 0, 0]}
        >
          EXPENSE OS
        </Text>
      </group>
    </group>
  )
}
