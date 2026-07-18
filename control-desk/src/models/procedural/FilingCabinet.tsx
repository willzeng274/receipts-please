import { Text, useCursor } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import labelFontUrl from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { useLabStore } from '../../store/useLabStore'
import type { ProceduralAssetProps } from '../types'

type CabinetEffect = NonNullable<ProceduralAssetProps['effectPreset']>

type MotionState = {
  active: boolean
  elapsed: number
  duration: number
  preset?: CabinetEffect
}

type DrawerGeometry = {
  hardware: THREE.BufferGeometry
  labelCard: THREE.BufferGeometry
  powder: THREE.BufferGeometry
}

type DrawerContentsGeometry = {
  folders: THREE.BufferGeometry
  papers: THREE.BufferGeometry
}

type CabinetMaterials = {
  alarm: THREE.MeshStandardMaterial
  dark: THREE.MeshStandardMaterial
  drawer: THREE.MeshPhysicalMaterial
  folderArchive: THREE.MeshStandardMaterial
  folderPayables: THREE.MeshStandardMaterial
  folderPolicy: THREE.MeshStandardMaterial
  hardware: THREE.MeshStandardMaterial
  hitArea: THREE.MeshBasicMaterial
  paper: THREE.MeshStandardMaterial
  powder: THREE.MeshPhysicalMaterial
  top: THREE.MeshPhysicalMaterial
  wear: THREE.MeshStandardMaterial
}

type DrawerId = 'bottom' | 'middle' | 'top'

type DrawerTravel = Record<DrawerId, number>

const CABINET_WIDTH = 1.2
const CABINET_DEPTH = 0.5
const CABINET_HEIGHT = 0.74
const DRAWER_REST_Z = 0.25
const TOP_REST_Y = CABINET_HEIGHT - 0.0175

const TOP_DRAWER_Y = 0.61
const MIDDLE_DRAWER_Y = 0.438
const BOTTOM_DRAWER_Y = 0.225

const TOP_DRAWER_HEIGHT = 0.12
const LARGE_DRAWER_HEIGHT = 0.2

const DRAWER_IDS: readonly DrawerId[] = ['top', 'middle', 'bottom']
const MANUAL_DRAWER_TRAVEL: Readonly<DrawerTravel> = {
  top: 0.255,
  middle: 0.315,
  bottom: 0.315,
}

const CLOSED_DRAWER_TRAVEL: Readonly<DrawerTravel> = {
  top: 0,
  middle: 0,
  bottom: 0,
}

const EFFECT_DURATIONS: Readonly<Record<CabinetEffect, number>> = {
  'paper-drop': 0.44,
  approve: 0.9,
  reject: 0.74,
  fraud: 1.02,
  'printer-jam': 1.16,
  migration: 1.38,
}

const BLACK = new THREE.Color('#000000')
const SELECTION_GLOW = new THREE.Color('#244c39')
const LOCK_IDLE_GLOW = new THREE.Color('#27332d')
const LOCK_ALARM_GLOW = new THREE.Color('#f04435')
const LOCK_JAM_GLOW = new THREE.Color('#c77a24')
const LOCK_MIGRATION_GLOW = new THREE.Color('#49c77d')

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const smoothstep = (value: number) => {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

const pulse = (time: number, start: number, peak: number, end: number) =>
  smoothstep((time - start) / (peak - start)) *
  (1 - smoothstep((time - peak) / (end - peak)))

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
  rotation?: readonly [number, number, number],
  segments = 2,
) {
  const geometry = new RoundedBoxGeometry(size[0], size[1], size[2], segments, radius)
  if (rotation) geometry.rotateX(rotation[0]).rotateY(rotation[1]).rotateZ(rotation[2])
  geometry.translate(position[0], position[1], position[2])
  return geometry
}

function cylinderPart(
  radius: number,
  height: number,
  position: readonly [number, number, number],
  rotation: readonly [number, number, number] = [0, 0, 0],
  segments = 24,
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
  if (!merged) throw new Error(`Unable to assemble FilingCabinet ${label} geometry`)
  merged.computeBoundingBox()
  merged.computeBoundingSphere()
  return merged
}

function createShellGeometry() {
  const parts: THREE.BufferGeometry[] = [
    // Folded steel carcass: side returns, back skin, floor, and the front rails.
    roundedPart([0.045, 0.615, 0.465], [-0.5775, 0.3975, -0.0075], 0.009),
    roundedPart([0.045, 0.615, 0.465], [0.5775, 0.3975, -0.0075], 0.009),
    roundedPart([1.11, 0.59, 0.018], [0, 0.395, -0.241], 0.006),
    roundedPart([1.11, 0.022, 0.445], [0, 0.109, -0.012], 0.006),
    roundedPart([1.11, 0.027, 0.04], [0, 0.688, 0.225], 0.007),
    roundedPart([0.047, 0.585, 0.04], [-0.5515, 0.395, 0.225], 0.007),
    roundedPart([0.047, 0.585, 0.04], [0.5515, 0.395, 0.225], 0.007),
    roundedPart([1.055, 0.014, 0.04], [0, 0.5435, 0.225], 0.004),
    roundedPart([1.055, 0.014, 0.04], [0, 0.3315, 0.225], 0.004),
    roundedPart([1.055, 0.018, 0.04], [0, 0.113, 0.225], 0.005),
    // Folded rear stiffeners keep the broad back panel from reading as a flat slab.
    roundedPart([0.024, 0.49, 0.017], [-0.43, 0.405, -0.252], 0.004),
    roundedPart([0.024, 0.49, 0.017], [0.43, 0.405, -0.252], 0.004),
    roundedPart([0.83, 0.022, 0.017], [0, 0.66, -0.252], 0.004),
  ]
  return mergeParts(parts, 'shell')
}

function createDarkGeometry() {
  const parts: THREE.BufferGeometry[] = [
    // A recessed anti-tip plinth carries the visual mass without touching the floor plane.
    roundedPart([1.105, 0.071, 0.432], [0, 0.0645, -0.016], 0.012),
    roundedPart([1.055, 0.058, 0.026], [0, 0.067, 0.207], 0.007),
    // Shadow rails sit behind the drawer faces instead of being painted lines.
    roundedPart([1.075, 0.01, 0.018], [0, 0.544, 0.239], 0.003),
    roundedPart([1.075, 0.01, 0.018], [0, 0.332, 0.239], 0.003),
    roundedPart([0.012, 0.555, 0.018], [-0.545, 0.397, 0.239], 0.003),
    roundedPart([0.012, 0.555, 0.018], [0.545, 0.397, 0.239], 0.003),
    // Printer ventilation/cable slots remain useful from the rear inspection view.
    roundedPart([0.12, 0.011, 0.008], [-0.33, 0.568, -0.263], 0.005),
    roundedPart([0.12, 0.011, 0.008], [-0.165, 0.568, -0.263], 0.005),
    roundedPart([0.12, 0.011, 0.008], [0, 0.568, -0.263], 0.005),
    roundedPart([0.12, 0.011, 0.008], [0.165, 0.568, -0.263], 0.005),
    roundedPart([0.12, 0.011, 0.008], [0.33, 0.568, -0.263], 0.005),
  ]

  ;[-0.52, 0.52].forEach((x) => {
    ;[-0.185, 0.185].forEach((z) => {
      parts.push(cylinderPart(0.022, 0.022, [x, 0.011, z], [0, 0, 0], 24))
    })
  })

  return mergeParts(parts, 'plinth and shadow details')
}

function createTopGeometry() {
  return mergeParts(
    [
      roundedPart([CABINET_WIDTH, 0.035, CABINET_DEPTH], [0, 0, 0], 0.014, undefined, 4),
      roundedPart([1.17, 0.014, 0.021], [0, -0.007, 0.241], 0.006, undefined, 3),
    ],
    'laminate top',
  )
}

function createStaticHardwareGeometry() {
  const parts: THREE.BufferGeometry[] = []
  const frontFastenerYs = [0.13, 0.677]
  const rearFastenerYs = [0.145, 0.645]

  ;[-0.577, 0.577].forEach((x) => {
    frontFastenerYs.forEach((y) => {
      parts.push(cylinderPart(0.006, 0.004, [x, y, 0.247], [Math.PI / 2, 0, 0], 18))
    })
  })
  ;[-0.5, 0.5].forEach((x) => {
    rearFastenerYs.forEach((y) => {
      parts.push(cylinderPart(0.006, 0.004, [x, y, -0.263], [Math.PI / 2, 0, 0], 18))
    })
  })

  // Two folded rear anchors communicate anti-tip installation rather than decorative feet.
  parts.push(roundedPart([0.045, 0.09, 0.012], [-0.505, 0.13, -0.263], 0.003))
  parts.push(roundedPart([0.045, 0.09, 0.012], [0.505, 0.13, -0.263], 0.003))
  parts.push(roundedPart([0.085, 0.018, 0.045], [-0.505, 0.09, -0.247], 0.004))
  parts.push(roundedPart([0.085, 0.018, 0.045], [0.505, 0.09, -0.247], 0.004))

  // Cabinet-side members remain fixed while the drawer-local telescoping tongues move.
  ;[0.582, 0.37, 0.157].forEach((y) => {
    ;[-0.538, 0.538].forEach((x) => {
      parts.push(roundedPart([0.011, 0.034, 0.35], [x, y, -0.055], 0.004))
      parts.push(cylinderPart(0.006, 0.003, [x, y, 0.088], [0, 0, Math.PI / 2], 16))
      parts.push(cylinderPart(0.006, 0.003, [x, y, -0.198], [0, 0, Math.PI / 2], 16))
    })
  })

  return mergeParts(parts, 'fasteners and anti-tip anchors')
}

function createWearGeometry() {
  return mergeParts(
    [
      roundedPart([0.19, 0.0012, 0.003], [-0.31, 0.0181, 0.2493], 0.0005, [0, -0.025, 0]),
      roundedPart([0.075, 0.0011, 0.003], [0.18, 0.0181, 0.2493], 0.0005, [0, 0.04, 0]),
      roundedPart([0.052, 0.001, 0.0026], [0.44, 0.0181, 0.2493], 0.0004, [0, -0.06, 0]),
      roundedPart([0.0012, 0.035, 0.003], [-0.5993, 0, 0.135], 0.0004, [0.16, 0, 0]),
    ],
    'restrained edge wear',
  )
}

function createDrawerGeometry(
  height: number,
  handleY: number,
  labelY: number,
): DrawerGeometry {
  const halfHeight = height / 2
  const powderParts: THREE.BufferGeometry[] = [
    // The drawer front is a folded tray, not a floating faceplate.
    roundedPart([1.075, height, 0.026], [0, 0, -0.013], 0.009, undefined, 3),
    roundedPart([1.045, 0.009, 0.009], [0, halfHeight - 0.013, 0.003], 0.003),
    roundedPart([1.045, 0.009, 0.009], [0, -halfHeight + 0.013, 0.003], 0.003),
    roundedPart([0.009, height - 0.026, 0.009], [-0.522, 0, 0.003], 0.003),
    roundedPart([0.009, height - 0.026, 0.009], [0.522, 0, 0.003], 0.003),
    // The open-backed steel box becomes visible during approval/rejection/migration travel.
    roundedPart([0.024, height - 0.032, 0.42], [-0.506, -0.006, -0.22], 0.006),
    roundedPart([0.024, height - 0.032, 0.42], [0.506, -0.006, -0.22], 0.006),
    roundedPart([1.012, 0.018, 0.42], [0, -halfHeight + 0.018, -0.22], 0.005),
    roundedPart([1.012, height - 0.046, 0.018], [0, -0.006, -0.43], 0.005),
  ]

  const handleX = 0.14
  const labelX = -0.35
  const hardwareParts: THREE.BufferGeometry[] = [
    roundedPart([0.43, 0.023, 0.027], [handleX, handleY, 0.046], 0.01, undefined, 3),
    roundedPart([0.03, 0.036, 0.045], [handleX - 0.18, handleY, 0.022], 0.009, undefined, 3),
    roundedPart([0.03, 0.036, 0.045], [handleX + 0.18, handleY, 0.022], 0.009, undefined, 3),
    // Four separate folded returns make the card holder read as a manufactured pocket.
    roundedPart([0.21, 0.006, 0.008], [labelX, labelY + 0.023, 0.009], 0.002),
    roundedPart([0.21, 0.006, 0.008], [labelX, labelY - 0.023, 0.009], 0.002),
    roundedPart([0.006, 0.052, 0.008], [labelX - 0.102, labelY, 0.009], 0.002),
    roundedPart([0.006, 0.052, 0.008], [labelX + 0.102, labelY, 0.009], 0.002),
    // Telescoping rail tongues only emerge when the drawer travels forward.
    roundedPart([0.01, 0.026, 0.37], [-0.524, -halfHeight + 0.032, -0.205], 0.004),
    roundedPart([0.01, 0.026, 0.37], [0.524, -halfHeight + 0.032, -0.205], 0.004),
  ]

  ;[handleX - 0.18, handleX + 0.18].forEach((x) => {
    hardwareParts.push(cylinderPart(0.004, 0.004, [x, handleY, 0.047], [Math.PI / 2, 0, 0], 16))
  })

  return {
    hardware: mergeParts(hardwareParts, 'drawer hardware'),
    labelCard: mergeParts(
      [roundedPart([0.194, 0.04, 0.0022], [labelX, labelY, 0.0122], 0.002)],
      'drawer label card',
    ),
    powder: mergeParts(powderParts, 'drawer shell'),
  }
}

function createDrawerContentsGeometry(
  height: number,
  tabXs: readonly number[],
): DrawerContentsGeometry {
  const halfHeight = height / 2
  const folderHeight = height - 0.048
  const folderBottom = -halfHeight + 0.026
  const folderCenterY = folderBottom + folderHeight / 2
  const folderTop = folderBottom + folderHeight
  const fileZs = [-0.115, -0.177, -0.239, -0.301, -0.363]
  const folderParts: THREE.BufferGeometry[] = []
  const paperParts: THREE.BufferGeometry[] = []

  fileZs.forEach((z, index) => {
    const tabX = tabXs[index % tabXs.length]
    folderParts.push(roundedPart([0.91, folderHeight, 0.006], [0, folderCenterY, z], 0.002))
    folderParts.push(
      roundedPart([0.16, 0.021, 0.007], [tabX, folderTop + 0.0085, z], 0.0025),
    )
    // Each sheet stays inside its hanging folder and below the drawer's upper return.
    paperParts.push(
      roundedPart(
        [0.82, folderHeight * 0.82, 0.0024],
        [0, folderCenterY + 0.002, z + 0.0045],
        0.0012,
      ),
    )
  })

  return {
    folders: mergeParts(folderParts, 'hanging folders and tabs'),
    papers: mergeParts(paperParts, 'filed paper contents'),
  }
}

function createAlarmGeometry() {
  const parts: THREE.BufferGeometry[] = [
    cylinderPart(0.018, 0.007, [0.483, 0.017, 0.011], [Math.PI / 2, 0, 0], 28),
    cylinderPart(0.0065, 0.004, [0.445, 0.017, 0.013], [Math.PI / 2, 0, 0], 20),
  ]
  return mergeParts(parts, 'lock and alarm lens')
}

function createKeywayGeometry() {
  return mergeParts(
    [
      roundedPart([0.004, 0.015, 0.0025], [0.483, 0.017, 0.0152], 0.0014),
      roundedPart([0.01, 0.004, 0.0025], [0.483, 0.011, 0.0152], 0.0014),
    ],
    'lock keyway',
  )
}

function DrawerAssembly({
  contentsGeometry,
  contentsRef,
  drawerId,
  drawerRef,
  folderMaterial,
  geometry,
  groupY,
  handleY,
  label,
  labelY,
  materials,
  onToggle,
  paperRef,
  pullHitGeometry,
  showLock = false,
  alarmGeometry,
  keywayGeometry,
}: {
  contentsGeometry: DrawerContentsGeometry
  contentsRef: RefObject<THREE.Group | null>
  drawerId: DrawerId
  drawerRef: RefObject<THREE.Group | null>
  folderMaterial: THREE.Material
  geometry: DrawerGeometry
  groupY: number
  handleY: number
  label: string
  labelY: number
  materials: CabinetMaterials
  onToggle: (drawerId: DrawerId) => void
  paperRef: RefObject<THREE.Mesh | null>
  pullHitGeometry: THREE.BufferGeometry
  showLock?: boolean
  alarmGeometry?: THREE.BufferGeometry
  keywayGeometry?: THREE.BufferGeometry
}) {
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  return (
    <group ref={drawerRef} position={[0, groupY, DRAWER_REST_Z]}>
      <mesh geometry={geometry.powder} material={materials.drawer} castShadow receiveShadow />
      <mesh geometry={geometry.hardware} material={materials.hardware} castShadow receiveShadow />
      <mesh geometry={geometry.labelCard} material={materials.paper} receiveShadow />

      <group ref={contentsRef}>
        <mesh
          geometry={contentsGeometry.folders}
          material={folderMaterial}
          castShadow
          receiveShadow
        />
        <mesh
          ref={paperRef}
          geometry={contentsGeometry.papers}
          material={materials.paper}
          castShadow
          receiveShadow
        />
      </group>

      {/* Troika text shares the drawer transform, so labels cannot drift during effects. */}
      <Text
        position={[-0.35, labelY, 0.0142]}
        font={labelFontUrl}
        fontSize={0.018}
        letterSpacing={0.075}
        color="#e5dcc7"
        anchorX="center"
        anchorY="middle"
        maxWidth={0.18}
      >
        {label}
      </Text>

      {showLock && alarmGeometry && keywayGeometry ? (
        <>
          <mesh geometry={alarmGeometry} material={materials.alarm} castShadow />
          <mesh geometry={keywayGeometry} material={materials.dark} castShadow />
        </>
      ) : null}

      {/* Invisible ergonomic target follows the same local datum as the visible pull. */}
      <mesh
        geometry={pullHitGeometry}
        material={materials.hitArea}
        position={[0.14, handleY, 0.052]}
        onClick={(event) => {
          event.stopPropagation()
          onToggle(drawerId)
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerOver={(event) => {
          event.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      />
    </group>
  )
}

export function FilingCabinet({
  effectPreset,
  effectRun = 0,
  selected = false,
  ...groupProps
}: ProceduralAssetProps) {
  const shellRef = useRef<THREE.Group>(null)
  const topRef = useRef<THREE.Group>(null)
  const topDrawerRef = useRef<THREE.Group>(null)
  const middleDrawerRef = useRef<THREE.Group>(null)
  const bottomDrawerRef = useRef<THREE.Group>(null)
  const topContentsRef = useRef<THREE.Group>(null)
  const middleContentsRef = useRef<THREE.Group>(null)
  const bottomContentsRef = useRef<THREE.Group>(null)
  const topPaperRef = useRef<THREE.Mesh>(null)
  const middlePaperRef = useRef<THREE.Mesh>(null)
  const bottomPaperRef = useRef<THREE.Mesh>(null)
  const previousRunRef = useRef(effectRun)
  const lockBaseIntensityRef = useRef(selected ? 0.24 : 0.06)
  const manualOpenRef = useRef<DrawerId | null>(null)
  const manualSettledRef = useRef(true)
  const manualTravelRef = useRef<DrawerTravel>({ ...CLOSED_DRAWER_TRAVEL })
  const effectBaselineRef = useRef<DrawerTravel>({ ...CLOSED_DRAWER_TRAVEL })
  const reducedMotion = useLabStore((state) => state.reducedMotion)
  const motionRef = useRef<MotionState>({
    active: false,
    duration: 0,
    elapsed: 0,
    preset: effectPreset,
  })

  const geometry = useMemo(
    () => ({
      alarm: createAlarmGeometry(),
      bottomDrawer: createDrawerGeometry(LARGE_DRAWER_HEIGHT, 0.044, -0.044),
      bottomContents: createDrawerContentsGeometry(LARGE_DRAWER_HEIGHT, [
        -0.31, -0.1, 0.12, 0.3, -0.22,
      ]),
      dark: createDarkGeometry(),
      keyway: createKeywayGeometry(),
      middleDrawer: createDrawerGeometry(LARGE_DRAWER_HEIGHT, 0.044, -0.044),
      middleContents: createDrawerContentsGeometry(LARGE_DRAWER_HEIGHT, [
        -0.28, -0.04, 0.21, 0.34, -0.18,
      ]),
      pullHit: new THREE.BoxGeometry(0.49, 0.076, 0.09),
      shell: createShellGeometry(),
      staticHardware: createStaticHardwareGeometry(),
      top: createTopGeometry(),
      topDrawer: createDrawerGeometry(TOP_DRAWER_HEIGHT, 0, 0),
      topContents: createDrawerContentsGeometry(TOP_DRAWER_HEIGHT, [
        -0.32, -0.12, 0.08, 0.29, -0.22,
      ]),
      wear: createWearGeometry(),
    }),
    [],
  )

  const materials = useMemo<CabinetMaterials>(
    () => ({
      alarm: new THREE.MeshStandardMaterial({
        color: '#727d78',
        emissive: LOCK_IDLE_GLOW,
        emissiveIntensity: 0.06,
        metalness: 0.76,
        roughness: 0.27,
      }),
      dark: new THREE.MeshStandardMaterial({
        color: '#1b211f',
        metalness: 0.3,
        roughness: 0.66,
      }),
      drawer: new THREE.MeshPhysicalMaterial({
        clearcoat: 0.12,
        clearcoatRoughness: 0.7,
        color: '#66716b',
        metalness: 0.55,
        roughness: 0.43,
      }),
      folderArchive: new THREE.MeshStandardMaterial({
        color: '#6f6550',
        metalness: 0.015,
        roughness: 0.84,
      }),
      folderPayables: new THREE.MeshStandardMaterial({
        color: '#958158',
        metalness: 0.012,
        roughness: 0.82,
      }),
      folderPolicy: new THREE.MeshStandardMaterial({
        color: '#536d64',
        metalness: 0.018,
        roughness: 0.8,
      }),
      hardware: new THREE.MeshStandardMaterial({
        color: '#a7aca8',
        metalness: 0.88,
        roughness: 0.25,
      }),
      hitArea: new THREE.MeshBasicMaterial({
        colorWrite: false,
        depthWrite: false,
        opacity: 0,
        transparent: true,
      }),
      paper: new THREE.MeshStandardMaterial({
        color: '#ded5bd',
        metalness: 0,
        roughness: 0.79,
      }),
      powder: new THREE.MeshPhysicalMaterial({
        clearcoat: 0.1,
        clearcoatRoughness: 0.72,
        color: '#535e59',
        metalness: 0.58,
        roughness: 0.46,
      }),
      top: new THREE.MeshPhysicalMaterial({
        clearcoat: 0.22,
        clearcoatRoughness: 0.55,
        color: '#735d49',
        emissive: BLACK,
        emissiveIntensity: 0,
        metalness: 0.025,
        roughness: 0.48,
      }),
      wear: new THREE.MeshStandardMaterial({
        color: '#aa8c70',
        metalness: 0.17,
        roughness: 0.67,
      }),
    }),
    [],
  )

  useEffect(
    () => () => {
      geometry.alarm.dispose()
      geometry.bottomDrawer.hardware.dispose()
      geometry.bottomDrawer.labelCard.dispose()
      geometry.bottomDrawer.powder.dispose()
      geometry.bottomContents.folders.dispose()
      geometry.bottomContents.papers.dispose()
      geometry.dark.dispose()
      geometry.keyway.dispose()
      geometry.middleDrawer.hardware.dispose()
      geometry.middleDrawer.labelCard.dispose()
      geometry.middleDrawer.powder.dispose()
      geometry.middleContents.folders.dispose()
      geometry.middleContents.papers.dispose()
      geometry.pullHit.dispose()
      geometry.shell.dispose()
      geometry.staticHardware.dispose()
      geometry.top.dispose()
      geometry.topDrawer.hardware.dispose()
      geometry.topDrawer.labelCard.dispose()
      geometry.topDrawer.powder.dispose()
      geometry.topContents.folders.dispose()
      geometry.topContents.papers.dispose()
      geometry.wear.dispose()
      Object.values(materials).forEach((material) => material.dispose())
    },
    [geometry, materials],
  )

  const toggleDrawer = useCallback((drawerId: DrawerId) => {
    manualOpenRef.current = manualOpenRef.current === drawerId ? null : drawerId
    manualSettledRef.current = false
  }, [])

  const resetPose = useCallback((travel: Readonly<DrawerTravel> = CLOSED_DRAWER_TRAVEL) => {
    const shell = shellRef.current
    const top = topRef.current
    const topDrawer = topDrawerRef.current
    const middleDrawer = middleDrawerRef.current
    const bottomDrawer = bottomDrawerRef.current
    const contentGroups = [topContentsRef.current, middleContentsRef.current, bottomContentsRef.current]
    const paperMeshes = [topPaperRef.current, middlePaperRef.current, bottomPaperRef.current]

    if (shell) {
      shell.position.set(0, 0, 0)
      shell.rotation.set(0, 0, 0)
    }
    if (top) {
      top.position.set(0, TOP_REST_Y, 0)
      top.rotation.set(0, 0, 0)
    }
    if (topDrawer) {
      topDrawer.position.set(0, TOP_DRAWER_Y, DRAWER_REST_Z + travel.top)
      topDrawer.rotation.set(0, 0, 0)
    }
    if (middleDrawer) {
      middleDrawer.position.set(0, MIDDLE_DRAWER_Y, DRAWER_REST_Z + travel.middle)
      middleDrawer.rotation.set(0, 0, 0)
    }
    if (bottomDrawer) {
      bottomDrawer.position.set(0, BOTTOM_DRAWER_Y, DRAWER_REST_Z + travel.bottom)
      bottomDrawer.rotation.set(0, 0, 0)
    }

    contentGroups.forEach((content) => {
      if (!content) return
      content.position.set(0, 0, 0)
      content.rotation.set(0, 0, 0)
      content.scale.set(1, 1, 1)
    })
    paperMeshes.forEach((paper) => {
      if (!paper) return
      paper.position.set(0, 0, 0)
      paper.rotation.set(0, 0, 0)
      paper.scale.set(1, 1, 1)
    })

    materials.alarm.emissive.copy(LOCK_IDLE_GLOW)
    materials.alarm.emissiveIntensity = lockBaseIntensityRef.current
  }, [materials.alarm])

  useEffect(() => {
    lockBaseIntensityRef.current = selected ? 0.24 : 0.06
    materials.top.emissive.copy(selected ? SELECTION_GLOW : BLACK)
    materials.top.emissiveIntensity = selected ? 0.17 : 0
    if (!motionRef.current.active) {
      materials.alarm.emissive.copy(LOCK_IDLE_GLOW)
      materials.alarm.emissiveIntensity = lockBaseIntensityRef.current
    }
  }, [materials.alarm, materials.top, selected])

  useEffect(() => {
    if (effectRun === previousRunRef.current) return
    previousRunRef.current = effectRun
    effectBaselineRef.current = { ...manualTravelRef.current }
    resetPose(effectBaselineRef.current)

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
    if ((!motion.active || !motion.preset) && manualSettledRef.current) return
    const shell = shellRef.current
    const top = topRef.current
    const topDrawer = topDrawerRef.current
    const middleDrawer = middleDrawerRef.current
    const bottomDrawer = bottomDrawerRef.current
    const topContents = topContentsRef.current
    const middleContents = middleContentsRef.current
    const bottomContents = bottomContentsRef.current
    const topPaper = topPaperRef.current
    const middlePaper = middlePaperRef.current
    const bottomPaper = bottomPaperRef.current
    if (
      !shell ||
      !top ||
      !topDrawer ||
      !middleDrawer ||
      !bottomDrawer ||
      !topContents ||
      !middleContents ||
      !bottomContents ||
      !topPaper ||
      !middlePaper ||
      !bottomPaper
    ) {
      return
    }

    const frameDelta = Math.min(delta, 0.05)

    if (!motion.active || !motion.preset) {
      const openDrawer = manualOpenRef.current
      const travel = manualTravelRef.current
      const otherDrawersClosed = (drawerId: DrawerId) =>
        DRAWER_IDS.every((otherId) => otherId === drawerId || travel[otherId] < 0.0025)
      let allDrawersSettled = true

      DRAWER_IDS.forEach((drawerId) => {
        const target =
          openDrawer === drawerId && otherDrawersClosed(drawerId)
            ? MANUAL_DRAWER_TRAVEL[drawerId]
            : 0
        travel[drawerId] = THREE.MathUtils.damp(
          travel[drawerId],
          target,
          reducedMotion ? 22 : 12,
          frameDelta,
        )
        if (Math.abs(travel[drawerId] - target) < 0.0001) travel[drawerId] = target
        else allDrawersSettled = false
      })

      resetPose(travel)
      manualSettledRef.current = allDrawersSettled
      return
    }

    motion.elapsed += frameDelta
    const time = Math.min(1, motion.elapsed / motion.duration)
    const cabinetScale = reducedMotion ? 0.22 : 1
    const drawerScale = reducedMotion ? 0.58 : 1
    const baseline = effectBaselineRef.current
    const topBaseZ = DRAWER_REST_Z + baseline.top
    const middleBaseZ = DRAWER_REST_Z + baseline.middle
    const bottomBaseZ = DRAWER_REST_Z + baseline.bottom
    const topOpenRoom = Math.max(0, MANUAL_DRAWER_TRAVEL.top - baseline.top)
    const middleOpenRoom = Math.max(0, MANUAL_DRAWER_TRAVEL.middle - baseline.middle)
    const bottomOpenRoom = Math.max(0, MANUAL_DRAWER_TRAVEL.bottom - baseline.bottom)

    // Author every frame from the preserved manual pose; effects never accumulate drift.
    resetPose(baseline)

    switch (motion.preset) {
      case 'paper-drop': {
        const contact = pulse(time, 0.03, 0.14, 0.34)
        const settle = dampedOscillation(time, 0.13, 2.1, 4.4)
        top.position.y = TOP_REST_Y + cabinetScale * (-0.0015 * contact + 0.00028 * settle)
        top.rotation.x = cabinetScale * (-0.0022 * contact + 0.0005 * settle)
        topDrawer.position.z = topBaseZ + cabinetScale * 0.00055 * settle
        topPaper.position.y = -0.0038 * contact + 0.0006 * settle
        topPaper.rotation.z = cabinetScale * 0.008 * settle
        topPaper.scale.y = 1 - 0.045 * contact
        break
      }

      case 'approve': {
        // A top stationery drawer presents briefly, then the soft-close catches and settles flush.
        const present = smoothstep(time / 0.22)
        const close = smoothstep((time - 0.31) / 0.38)
        const catchPulse = pulse(time, 0.58, 0.69, 0.82)
        const settle = dampedOscillation(time, 0.66, 1.75, 4.9)
        topDrawer.position.z =
          topBaseZ +
          drawerScale *
            (topOpenRoom * present * (1 - close) -
              0.0024 * catchPulse +
              0.00125 * settle)
        topDrawer.position.y = TOP_DRAWER_Y + cabinetScale * 0.00036 * settle
        topDrawer.rotation.x = cabinetScale * -0.0011 * settle
        topContents.rotation.x = drawerScale * -0.015 * present * (1 - close)
        topPaper.position.z = drawerScale * 0.004 * present * (1 - close)
        topPaper.position.y = cabinetScale * (0.0015 * catchPulse + 0.0004 * settle)
        break
      }

      case 'reject': {
        // The central file drawer opens decisively and returns against a harder mechanical stop.
        const open = smoothstep(time / 0.14)
        const slam = smoothstep((time - 0.2) / 0.18)
        const impact = pulse(time, 0.34, 0.4, 0.52)
        const railRing = dampedOscillation(time, 0.38, 3.1, 4.2)
        middleDrawer.position.z =
          middleBaseZ +
          drawerScale *
            (middleOpenRoom * open * (1 - slam) - 0.0045 * impact + 0.0042 * railRing)
        middleDrawer.position.y = MIDDLE_DRAWER_Y + cabinetScale * 0.00075 * railRing
        shell.position.z = cabinetScale * (-0.0012 * impact + 0.00055 * railRing)
        shell.rotation.x = cabinetScale * 0.0013 * railRing
        middleContents.rotation.x = drawerScale * -0.012 * open * (1 - slam)
        middlePaper.rotation.z = cabinetScale * (0.024 * impact + 0.009 * railRing)
        middlePaper.position.y = cabinetScale * (0.0032 * impact + 0.0008 * railRing)
        break
      }

      case 'fraud': {
        // Repeated forward pulls stop at the lock; the red lens carries meaning under reduced motion.
        const attemptEnvelope =
          smoothstep(time / 0.09) * (1 - smoothstep((time - 0.69) / 0.22))
        const pullWave = Math.max(0, Math.sin(time * Math.PI * 10)) ** 3
        const lateralRattle = Math.sin(time * Math.PI * 21) * attemptEnvelope
        const alarmEnvelope =
          smoothstep((time - 0.08) / 0.12) * (1 - smoothstep((time - 0.82) / 0.16))
        const stop = pulse(time, 0.64, 0.72, 0.84)

        topDrawer.position.z =
          topBaseZ + drawerScale * (0.0062 * pullWave * attemptEnvelope - 0.0015 * stop)
        topDrawer.position.x = cabinetScale * 0.00125 * lateralRattle
        topDrawer.rotation.z = cabinetScale * 0.0018 * lateralRattle
        shell.position.x = cabinetScale * -0.00045 * lateralRattle
        topContents.position.x = cabinetScale * 0.0011 * lateralRattle
        topPaper.rotation.z = cabinetScale * 0.006 * lateralRattle
        materials.alarm.emissive.copy(LOCK_ALARM_GLOW)
        materials.alarm.emissiveIntensity =
          lockBaseIntensityRef.current + alarmEnvelope * (2.1 + 1.15 * Math.sin(time * Math.PI * 18) ** 2)
        break
      }

      case 'printer-jam': {
        // A printer on the top transmits motor torque through the laminate and into all three rails.
        const spinUp = smoothstep(time / 0.12)
        const shutDown = 1 - smoothstep((time - 0.78) / 0.18)
        const envelope = spinUp * shutDown
        const rumble = Math.sin(time * Math.PI * 34) * envelope
        const counterRumble = Math.sin(time * Math.PI * 23 + 0.7) * envelope
        const stall = pulse(time, 0.43, 0.55, 0.72)
        const alarmEnvelope = pulse(time, 0.46, 0.61, 0.9)

        top.position.x = cabinetScale * 0.0016 * rumble
        top.position.y = TOP_REST_Y + cabinetScale * (0.00065 * counterRumble - 0.0018 * stall)
        top.position.z = cabinetScale * 0.0007 * rumble
        top.rotation.x = cabinetScale * (0.0014 * rumble - 0.0023 * stall)
        top.rotation.z = cabinetScale * 0.0011 * counterRumble
        shell.position.x = cabinetScale * 0.0005 * counterRumble
        topDrawer.position.z = topBaseZ + cabinetScale * 0.0008 * rumble
        middleDrawer.position.z = middleBaseZ - cabinetScale * 0.00065 * counterRumble
        bottomDrawer.position.z = bottomBaseZ + cabinetScale * 0.0005 * rumble
        topPaper.rotation.z = cabinetScale * 0.014 * rumble
        topPaper.position.y = cabinetScale * 0.0014 * counterRumble
        middlePaper.rotation.z = cabinetScale * -0.011 * counterRumble
        middlePaper.position.x = cabinetScale * 0.0012 * rumble
        bottomPaper.rotation.z = cabinetScale * 0.008 * rumble
        bottomPaper.position.y = cabinetScale * -0.001 * counterRumble
        materials.alarm.emissive.copy(LOCK_JAM_GLOW)
        materials.alarm.emissiveIntensity = lockBaseIntensityRef.current + 0.9 * alarmEnvelope
        break
      }

      case 'migration': {
        // Mis-staged files present in sequence, then the interlock aligns them top-to-bottom.
        const topPresent = smoothstep(time / 0.16)
        const topAlign = smoothstep((time - 0.25) / 0.23)
        const middlePresent = smoothstep((time - 0.07) / 0.18)
        const middleAlign = smoothstep((time - 0.4) / 0.24)
        const bottomPresent = smoothstep((time - 0.14) / 0.2)
        const bottomAlign = smoothstep((time - 0.56) / 0.26)
        const topLatch = pulse(time, 0.43, 0.49, 0.57)
        const middleLatch = pulse(time, 0.59, 0.65, 0.73)
        const bottomLatch = pulse(time, 0.76, 0.82, 0.91)
        const completion = pulse(time, 0.8, 0.91, 1)

        topDrawer.position.z =
          topBaseZ +
          drawerScale *
            (topOpenRoom * topPresent * (1 - topAlign) - 0.0016 * topLatch)
        middleDrawer.position.z =
          middleBaseZ +
          drawerScale *
            (middleOpenRoom * middlePresent * (1 - middleAlign) - 0.0018 * middleLatch)
        bottomDrawer.position.z =
          bottomBaseZ +
          drawerScale *
            (bottomOpenRoom * bottomPresent * (1 - bottomAlign) - 0.002 * bottomLatch)
        topContents.rotation.z = drawerScale * -0.022 * topPresent * (1 - topAlign)
        middleContents.rotation.z = drawerScale * 0.028 * middlePresent * (1 - middleAlign)
        bottomContents.rotation.z = drawerScale * -0.018 * bottomPresent * (1 - bottomAlign)
        topPaper.position.x = drawerScale * -0.004 * topPresent * (1 - topAlign)
        middlePaper.position.x = drawerScale * 0.005 * middlePresent * (1 - middleAlign)
        bottomPaper.position.x = drawerScale * -0.003 * bottomPresent * (1 - bottomAlign)
        top.position.y = TOP_REST_Y - cabinetScale * 0.00035 * completion
        materials.alarm.emissive.copy(LOCK_MIGRATION_GLOW)
        materials.alarm.emissiveIntensity = lockBaseIntensityRef.current + 2.25 * completion
        break
      }
    }

    if (time >= 1) {
      motion.active = false
      resetPose(baseline)
      manualSettledRef.current = false
    }
  })

  return (
    <group {...groupProps}>
      <group ref={shellRef}>
        <mesh geometry={geometry.shell} material={materials.powder} castShadow receiveShadow />
        <mesh geometry={geometry.dark} material={materials.dark} castShadow receiveShadow />
        <mesh
          geometry={geometry.staticHardware}
          material={materials.hardware}
          castShadow
          receiveShadow
        />
      </group>

      <group ref={topRef} position={[0, TOP_REST_Y, 0]}>
        <mesh geometry={geometry.top} material={materials.top} castShadow receiveShadow />
        <mesh geometry={geometry.wear} material={materials.wear} castShadow receiveShadow />
      </group>

      <DrawerAssembly
        contentsGeometry={geometry.topContents}
        contentsRef={topContentsRef}
        drawerId="top"
        drawerRef={topDrawerRef}
        folderMaterial={materials.folderPayables}
        geometry={geometry.topDrawer}
        groupY={TOP_DRAWER_Y}
        handleY={0}
        label="PAYABLES"
        labelY={0}
        materials={materials}
        onToggle={toggleDrawer}
        paperRef={topPaperRef}
        pullHitGeometry={geometry.pullHit}
        showLock
        alarmGeometry={geometry.alarm}
        keywayGeometry={geometry.keyway}
      />
      <DrawerAssembly
        contentsGeometry={geometry.middleContents}
        contentsRef={middleContentsRef}
        drawerId="middle"
        drawerRef={middleDrawerRef}
        folderMaterial={materials.folderPolicy}
        geometry={geometry.middleDrawer}
        groupY={MIDDLE_DRAWER_Y}
        handleY={0.044}
        label="POLICY"
        labelY={-0.044}
        materials={materials}
        onToggle={toggleDrawer}
        paperRef={middlePaperRef}
        pullHitGeometry={geometry.pullHit}
      />
      <DrawerAssembly
        contentsGeometry={geometry.bottomContents}
        contentsRef={bottomContentsRef}
        drawerId="bottom"
        drawerRef={bottomDrawerRef}
        folderMaterial={materials.folderArchive}
        geometry={geometry.bottomDrawer}
        groupY={BOTTOM_DRAWER_Y}
        handleY={0.044}
        label="ARCHIVE"
        labelY={-0.044}
        materials={materials}
        onToggle={toggleDrawer}
        paperRef={bottomPaperRef}
        pullHitGeometry={geometry.pullHit}
      />

      {/* Real-scale contract: 1.20 m wide, 0.50 m carcass depth, 0.74 m high, +z front. */}
    </group>
  )
}
