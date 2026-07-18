import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { useLabStore, type LightingPreset } from '../../store/useLabStore'
import type { ProceduralAssetProps } from '../types'

const HALF_PI = Math.PI / 2
const TWO_PI = Math.PI * 2

const LOWER_ARM_LENGTH = 0.255
const UPPER_ARM_LENGTH = 0.245
const LOWER_ARM_ANGLE = -0.35
const UPPER_ARM_ANGLE = 1.03
const SHADE_ANGLE = -0.82

const DEFAULT_LIGHT_INTENSITY = 2.2
const DEFAULT_WARM = new THREE.Color('#ffd7a1')
const DEFAULT_INDICATOR = new THREE.Color('#77d39c')
const APPROVE_GREEN = new THREE.Color('#77ef9e')
const REJECT_RED = new THREE.Color('#ff5646')
const FRAUD_RED = new THREE.Color('#ff2f2b')
const JAM_AMBER = new THREE.Color('#ffb44e')
const MIGRATION_MINT = new THREE.Color('#dfffee')

/** Local model datums used to seat the lamp's power hardware on a desk. */
// oxlint-disable-next-line react/only-export-components -- scene integration reads this co-located asset contract.
export const DESK_LAMP_CONTRACT = Object.freeze({
  baseContactY: 0,
  footprint: Object.freeze({
    x: Object.freeze([-0.12, 0.12] as const),
    z: Object.freeze([-0.089, 0.089] as const),
  }),
  powerGrommet: Object.freeze({
    center: Object.freeze([-0.17, 0.004, -0.285] as const),
    lowerContactY: 0,
  }),
})

const SCENE_TASK_LIGHT_SCALE = {
  manual: 0.3,
  studio: 0.45,
  ramp: 0.32,
  night: 0.28,
} satisfies Record<LightingPreset, number>

type LampMotion = {
  active: boolean
  elapsed: number
  preset: ProceduralAssetProps['effectPreset']
}

type LampMaterials = ReturnType<typeof createLampMaterials>

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function smoothStep(value: number) {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

function smootherStep(value: number) {
  const t = clamp01(value)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function pulse(time: number, attack: number, releaseStart: number, release: number) {
  return smoothStep(time / attack) * (1 - smoothStep((time - releaseStart) / release))
}

function mergeParts(parts: THREE.BufferGeometry[], label: string) {
  const mixesIndexedAndNonIndexed = parts.some((part) => part.index) && parts.some((part) => !part.index)
  const mergeableParts = mixesIndexedAndNonIndexed
    ? parts.map((part) => part.index ? part.toNonIndexed() : part)
    : parts
  const merged = mergeGeometries(mergeableParts, false)
  parts.forEach((part) => part.dispose())
  if (mergeableParts !== parts) {
    mergeableParts.forEach((part, index) => {
      if (part !== parts[index]) part.dispose()
    })
  }
  if (!merged) throw new Error(`Unable to assemble DeskLamp ${label}`)
  merged.computeBoundingBox()
  merged.computeBoundingSphere()
  return merged
}

function createLinkGeometry(length: number) {
  const parts = [-1, 1].map((side) => {
    const geometry = new RoundedBoxGeometry(0.022, length, 0.014, 4, 0.006)
    geometry.translate(side * 0.018, length / 2, 0)
    return geometry
  })
  return mergeParts(parts, 'parallel arm links')
}

function createLinkInlayGeometry(length: number) {
  const parts = [-1, 1].map((side) => {
    const geometry = new RoundedBoxGeometry(0.008, length - 0.036, 0.004, 3, 0.002)
    geometry.translate(side * 0.018, length / 2, 0.009)
    return geometry
  })
  return mergeParts(parts, 'arm inlays')
}

function createSpringGeometry() {
  const springs: THREE.BufferGeometry[] = []

  for (const side of [-1, 1]) {
    const points: THREE.Vector3[] = []
    const coils = 12
    const steps = 96
    for (let index = 0; index <= steps; index += 1) {
      const progress = index / steps
      const angle = progress * coils * TWO_PI
      points.push(
        new THREE.Vector3(
          side * 0.035 + Math.cos(angle) * 0.0047,
          0.037 + progress * 0.143,
          0.003 + Math.sin(angle) * 0.0047,
        ),
      )
    }
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal')
    springs.push(new THREE.TubeGeometry(curve, steps, 0.00115, 6, false))
  }

  return mergeParts(springs, 'counterbalance springs')
}

function createFeetGeometry() {
  const parts: THREE.BufferGeometry[] = []
  for (const x of [-0.076, 0.076]) {
    for (const z of [-0.052, 0.052]) {
      const geometry = new RoundedBoxGeometry(0.052, 0.007, 0.036, 3, 0.004)
      geometry.translate(x, 0.0035, z)
      parts.push(geometry)
    }
  }
  return mergeParts(parts, 'rubber feet')
}

function createBaseFastenerGeometry() {
  const parts: THREE.BufferGeometry[] = []
  for (const x of [-0.087, 0.087]) {
    for (const z of [-0.048, 0.048]) {
      const geometry = new THREE.CylinderGeometry(0.004, 0.0045, 0.0022, 18)
      geometry.translate(x, 0.0562, z)
      parts.push(geometry)
    }
  }
  const indicatorBezel = new THREE.CylinderGeometry(0.009, 0.009, 0.004, 24)
  indicatorBezel.translate(0.062, 0.0585, 0.042)
  parts.push(indicatorBezel)
  return mergeParts(parts, 'base fasteners')
}

function createDarkStaticGeometry() {
  const topPlate = new RoundedBoxGeometry(0.202, 0.008, 0.14, 6, 0.017)
  topPlate.translate(0, 0.056, 0)
  const switchHousing = new RoundedBoxGeometry(0.062, 0.012, 0.036, 4, 0.007)
  switchHousing.translate(0, 0.058, 0.047)
  return mergeParts([topPlate, switchHousing], 'static dark trim')
}

function createPivotCapGeometry() {
  const parts = [-1, 1].map((side) => {
    const geometry = new THREE.CylinderGeometry(0.017, 0.017, 0.004, 28)
    geometry.rotateZ(HALF_PI)
    geometry.translate(side * 0.033, 0, 0)
    return geometry
  })
  return mergeParts(parts, 'pivot caps')
}

function createPivotSlotGeometry() {
  const parts = [-1, 1].map((side) => {
    const geometry = new RoundedBoxGeometry(0.0022, 0.004, 0.019, 2, 0.001)
    geometry.translate(side * 0.0353, 0, 0)
    return geometry
  })
  return mergeParts(parts, 'pivot slots')
}

function createCableGeometry() {
  const points = [
    new THREE.Vector3(0, 0.026, -0.086),
    new THREE.Vector3(0, 0.024, -0.111),
    new THREE.Vector3(-0.019, 0.012, -0.136),
    new THREE.Vector3(-0.056, 0.0037, -0.153),
    new THREE.Vector3(-0.105, 0.0036, -0.184),
    new THREE.Vector3(-0.151, 0.004, -0.222),
    new THREE.Vector3(-0.169, 0.012, -0.247),
    new THREE.Vector3(-0.17, 0.015, -0.264),
  ]
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal')
  return new THREE.TubeGeometry(curve, 64, 0.0035, 8, false)
}

function createPowerFixtureGeometry() {
  const parts: THREE.BufferGeometry[] = []

  const rearCollar = new THREE.CylinderGeometry(0.0092, 0.0092, 0.009, 24)
  rearCollar.rotateX(HALF_PI)
  rearCollar.translate(0, 0.026, -0.09)
  parts.push(rearCollar)

  const reliefSections = [
    { radiusBack: 0.0087, radiusFront: 0.0078, length: 0.012, z: -0.1 },
    { radiusBack: 0.0078, radiusFront: 0.0065, length: 0.011, z: -0.1115 },
    { radiusBack: 0.0065, radiusFront: 0.0052, length: 0.011, z: -0.1225 },
  ]
  for (const section of reliefSections) {
    const geometry = new THREE.CylinderGeometry(
      section.radiusFront,
      section.radiusBack,
      section.length,
      24,
    )
    geometry.rotateX(HALF_PI)
    geometry.translate(0, 0.026, section.z)
    parts.push(geometry)
  }

  const grommetBody = new THREE.CylinderGeometry(0.041, 0.041, 0.008, 40)
  grommetBody.translate(-0.17, 0.004, -0.285)
  parts.push(grommetBody)

  const socketCap = new RoundedBoxGeometry(0.047, 0.023, 0.057, 5, 0.008)
  socketCap.translate(-0.17, 0.0195, -0.281)
  parts.push(socketCap)

  const plugNeck = new THREE.CylinderGeometry(0.0061, 0.0074, 0.018, 24)
  plugNeck.rotateX(HALF_PI)
  plugNeck.translate(-0.17, 0.015, -0.247)
  parts.push(plugNeck)

  return mergeParts(parts, 'cable relief and seated power fixture')
}

function createPowerHardwareGeometry() {
  const parts: THREE.BufferGeometry[] = []

  const grommetRing = new THREE.TorusGeometry(0.0367, 0.0024, 10, 40)
  grommetRing.rotateX(HALF_PI)
  grommetRing.translate(-0.17, 0.009, -0.285)
  parts.push(grommetRing)

  const capPlate = new RoundedBoxGeometry(0.03, 0.0024, 0.034, 3, 0.0035)
  capPlate.translate(-0.17, 0.0322, -0.282)
  parts.push(capPlate)

  const reliefClamp = new THREE.TorusGeometry(0.0097, 0.0014, 8, 28)
  reliefClamp.translate(0, 0.026, -0.0946)
  parts.push(reliefClamp)

  return mergeParts(parts, 'power grommet hardware')
}

function createShadeYokeGeometry() {
  const left = new RoundedBoxGeometry(0.009, 0.076, 0.012, 4, 0.004)
  left.translate(-0.067, -0.035, 0)
  const right = left.clone()
  right.translate(0.134, 0, 0)
  const bridge = new RoundedBoxGeometry(0.143, 0.01, 0.014, 4, 0.004)
  bridge.translate(0, 0.004, 0)
  return mergeParts([left, right, bridge], 'shade yoke')
}

function createOuterShadeGeometry() {
  const geometry = new THREE.SphereGeometry(0.092, 48, 22, 0, TWO_PI, 0, HALF_PI)
  geometry.scale(1, 0.54, 1)
  geometry.translate(0, -0.075, 0)
  return geometry
}

function createInnerShadeGeometry() {
  const geometry = new THREE.SphereGeometry(0.0855, 48, 20, 0, TWO_PI, 0, HALF_PI)
  geometry.scale(1, 0.52, 1)
  geometry.translate(0, -0.0755, 0)
  return geometry
}

function createShadeRimGeometry() {
  const geometry = new THREE.TorusGeometry(0.0887, 0.0042, 12, 48)
  geometry.rotateX(HALF_PI)
  geometry.translate(0, -0.075, 0)
  return geometry
}

function createLampMaterials() {
  return {
    paint: new THREE.MeshPhysicalMaterial({
      color: '#263a36',
      metalness: 0.48,
      roughness: 0.27,
      clearcoat: 0.62,
      clearcoatRoughness: 0.24,
    }),
    paintDark: new THREE.MeshStandardMaterial({
      color: '#17231f',
      metalness: 0.28,
      roughness: 0.42,
    }),
    metal: new THREE.MeshStandardMaterial({
      color: '#a9aca6',
      metalness: 0.86,
      roughness: 0.25,
    }),
    brass: new THREE.MeshStandardMaterial({
      color: '#b79a5e',
      metalness: 0.8,
      roughness: 0.29,
    }),
    rubber: new THREE.MeshStandardMaterial({
      color: '#141918',
      metalness: 0.01,
      roughness: 0.9,
    }),
    cable: new THREE.MeshStandardMaterial({
      color: '#202725',
      metalness: 0,
      roughness: 0.78,
    }),
    ceramic: new THREE.MeshStandardMaterial({
      color: '#d7d2bf',
      metalness: 0.02,
      roughness: 0.4,
    }),
    reflector: new THREE.MeshPhysicalMaterial({
      color: '#eee8d7',
      emissive: DEFAULT_WARM,
      emissiveIntensity: 0.11,
      metalness: 0.16,
      roughness: 0.2,
      clearcoat: 0.34,
      clearcoatRoughness: 0.26,
      side: THREE.BackSide,
    }),
    bulb: new THREE.MeshPhysicalMaterial({
      color: '#eadfc5',
      emissive: DEFAULT_WARM,
      emissiveIntensity: 0.62,
      metalness: 0,
      roughness: 0.16,
      transmission: 0.08,
      transparent: true,
      opacity: 0.9,
    }),
    indicator: new THREE.MeshStandardMaterial({
      color: '#315c43',
      emissive: DEFAULT_INDICATOR,
      emissiveIntensity: 0.68,
      metalness: 0.08,
      roughness: 0.32,
    }),
    switch: new THREE.MeshPhysicalMaterial({
      color: '#202b28',
      metalness: 0.18,
      roughness: 0.38,
      clearcoat: 0.24,
    }),
    slot: new THREE.MeshStandardMaterial({
      color: '#47391f',
      metalness: 0.68,
      roughness: 0.36,
    }),
  }
}

function PivotJoint({
  capGeometry,
  materials,
  slotGeometry,
}: {
  capGeometry: THREE.BufferGeometry
  materials: LampMaterials
  slotGeometry: THREE.BufferGeometry
}) {
  return (
    <>
      <mesh rotation={[0, 0, HALF_PI]} material={materials.paintDark} castShadow receiveShadow>
        <cylinderGeometry args={[0.034, 0.034, 0.062, 32]} />
      </mesh>
      <mesh geometry={capGeometry} material={materials.brass} castShadow />
      <mesh geometry={slotGeometry} material={materials.slot} castShadow />
    </>
  )
}

export function DeskLamp({
  effectPreset,
  effectRun = 0,
  selected = false,
  ...groupProps
}: ProceduralAssetProps) {
  const fillLightScale = useLabStore((state) => state.fillLightScale)
  const lightingPreset = useLabStore((state) => state.lightingPreset)
  const mode = useLabStore((state) => state.mode)
  const reducedMotion = useLabStore((state) => state.reducedMotion)
  const lightIntensityScale = mode === 'scene'
    ? fillLightScale * SCENE_TASK_LIGHT_SCALE[lightingPreset]
    : 1
  const baseLightIntensity = DEFAULT_LIGHT_INTENSITY * lightIntensityScale
  const lowerArmRef = useRef<THREE.Group>(null)
  const upperArmRef = useRef<THREE.Group>(null)
  const shadeRef = useRef<THREE.Group>(null)
  const switchRef = useRef<THREE.Group>(null)
  const spotLightRef = useRef<THREE.SpotLight>(null)
  const lightTargetRef = useRef<THREE.Object3D>(null)
  const motionRef = useRef<LampMotion>({ active: false, elapsed: 0, preset: effectPreset })

  const lowerLinkGeometry = useMemo(() => createLinkGeometry(LOWER_ARM_LENGTH), [])
  const upperLinkGeometry = useMemo(() => createLinkGeometry(UPPER_ARM_LENGTH), [])
  const lowerInlayGeometry = useMemo(() => createLinkInlayGeometry(LOWER_ARM_LENGTH), [])
  const upperInlayGeometry = useMemo(() => createLinkInlayGeometry(UPPER_ARM_LENGTH), [])
  const springGeometry = useMemo(createSpringGeometry, [])
  const feetGeometry = useMemo(createFeetGeometry, [])
  const baseFastenerGeometry = useMemo(createBaseFastenerGeometry, [])
  const darkStaticGeometry = useMemo(createDarkStaticGeometry, [])
  const pivotCapGeometry = useMemo(createPivotCapGeometry, [])
  const pivotSlotGeometry = useMemo(createPivotSlotGeometry, [])
  const cableGeometry = useMemo(createCableGeometry, [])
  const powerFixtureGeometry = useMemo(createPowerFixtureGeometry, [])
  const powerHardwareGeometry = useMemo(createPowerHardwareGeometry, [])
  const shadeYokeGeometry = useMemo(createShadeYokeGeometry, [])
  const outerShadeGeometry = useMemo(createOuterShadeGeometry, [])
  const innerShadeGeometry = useMemo(createInnerShadeGeometry, [])
  const shadeRimGeometry = useMemo(createShadeRimGeometry, [])
  const materials = useMemo(createLampMaterials, [])

  useEffect(
    () => () => {
      lowerLinkGeometry.dispose()
      upperLinkGeometry.dispose()
      lowerInlayGeometry.dispose()
      upperInlayGeometry.dispose()
      springGeometry.dispose()
      feetGeometry.dispose()
      baseFastenerGeometry.dispose()
      darkStaticGeometry.dispose()
      pivotCapGeometry.dispose()
      pivotSlotGeometry.dispose()
      cableGeometry.dispose()
      powerFixtureGeometry.dispose()
      powerHardwareGeometry.dispose()
      shadeYokeGeometry.dispose()
      outerShadeGeometry.dispose()
      innerShadeGeometry.dispose()
      shadeRimGeometry.dispose()
      Object.values(materials).forEach((material) => material.dispose())
    },
    [
      baseFastenerGeometry,
      cableGeometry,
      darkStaticGeometry,
      feetGeometry,
      innerShadeGeometry,
      lowerInlayGeometry,
      lowerLinkGeometry,
      materials,
      outerShadeGeometry,
      pivotCapGeometry,
      pivotSlotGeometry,
      powerFixtureGeometry,
      powerHardwareGeometry,
      shadeRimGeometry,
      shadeYokeGeometry,
      springGeometry,
      upperInlayGeometry,
      upperLinkGeometry,
    ],
  )

  useLayoutEffect(() => {
    if (!spotLightRef.current || !lightTargetRef.current) return
    spotLightRef.current.target = lightTargetRef.current
    lightTargetRef.current.updateMatrixWorld()
  }, [])

  const resetAssembly = useCallback(() => {
    const lowerArm = lowerArmRef.current
    const upperArm = upperArmRef.current
    const shade = shadeRef.current
    const rocker = switchRef.current
    const light = spotLightRef.current

    if (lowerArm) lowerArm.rotation.set(LOWER_ARM_ANGLE, 0, 0)
    if (upperArm) upperArm.rotation.set(UPPER_ARM_ANGLE, 0, 0)
    if (shade) {
      shade.position.set(0, UPPER_ARM_LENGTH, 0)
      shade.rotation.set(SHADE_ANGLE, 0, 0)
    }
    if (rocker) {
      rocker.position.set(0, 0.0595, 0.047)
      rocker.rotation.set(-0.12, 0, 0)
    }

    materials.indicator.emissive.copy(DEFAULT_INDICATOR)
    materials.indicator.emissiveIntensity = selected ? 0.86 : 0.68
    materials.reflector.emissive.copy(DEFAULT_WARM)
    materials.reflector.emissiveIntensity = 0.11
    materials.bulb.emissive.copy(DEFAULT_WARM)
    materials.bulb.emissiveIntensity = 0.62

    if (light) {
      light.color.copy(DEFAULT_WARM)
      light.intensity = baseLightIntensity
    }
  }, [baseLightIntensity, materials, selected])

  const applyLightCue = useCallback(
    (color: THREE.Color, mix: number, intensity: number) => {
      const cue = clamp01(mix)
      materials.indicator.emissive.copy(DEFAULT_INDICATOR).lerp(color, cue)
      materials.indicator.emissiveIntensity = (selected ? 0.86 : 0.68) + cue * 1.4
      materials.reflector.emissive.copy(DEFAULT_WARM).lerp(color, cue * 0.72)
      materials.reflector.emissiveIntensity = 0.11 + cue * 0.19
      materials.bulb.emissive.copy(DEFAULT_WARM).lerp(color, cue * 0.84)
      materials.bulb.emissiveIntensity = 0.62 + cue * 0.74

      if (spotLightRef.current) {
        spotLightRef.current.color.copy(DEFAULT_WARM).lerp(color, cue)
        spotLightRef.current.intensity = Math.max(0, intensity)
      }
    },
    [materials, selected],
  )

  useEffect(() => {
    resetAssembly()
    motionRef.current.active = effectRun > 0
    motionRef.current.elapsed = 0
    motionRef.current.preset = effectPreset
  }, [effectPreset, effectRun, resetAssembly])

  useFrame((_, delta) => {
    resetAssembly()

    const lowerArm = lowerArmRef.current
    const upperArm = upperArmRef.current
    const shade = shadeRef.current
    const rocker = switchRef.current
    const motion = motionRef.current
    if (!lowerArm || !upperArm || !shade || !rocker || !motion.active || !motion.preset) return

    motion.elapsed += Math.min(delta, 0.05)
    const time = motion.elapsed
    const motionScale = reducedMotion ? 0.28 : 1

    if (motion.preset === 'paper-drop') {
      const dip = pulse(time - 0.025, 0.055, 0.105, 0.2)
      const acknowledgement = pulse(time - 0.17, 0.1, 0.23, 0.22)
      shade.rotation.x += motionScale * (0.027 * dip - 0.015 * acknowledgement)
      upperArm.rotation.x += motionScale * 0.011 * dip
      const intensity = baseLightIntensity * (1 - 0.72 * dip + 0.16 * acknowledgement)
      applyLightCue(JAM_AMBER, dip * 0.38, intensity)
      if (time > 0.72) motion.active = false
      return
    }

    if (motion.preset === 'approve') {
      const anticipation = pulse(time, 0.075, 0.085, 0.1)
      const focus = pulse(time - 0.075, 0.17, 0.72, 0.25)
      const settleTime = Math.max(0, time - 0.26)
      const settle = Math.exp(-6.3 * settleTime) * Math.sin(settleTime * 22)
      lowerArm.rotation.x -= motionScale * 0.009 * focus
      upperArm.rotation.x += motionScale * 0.027 * focus
      shade.rotation.x += motionScale * (0.018 * anticipation - 0.075 * focus + 0.009 * settle)
      rocker.position.y -= 0.0025 * focus
      applyLightCue(APPROVE_GREEN, focus, baseLightIntensity + 1.85 * lightIntensityScale * focus)
      if (time > 1.08) motion.active = false
      return
    }

    if (motion.preset === 'reject') {
      const anticipation = pulse(time, 0.06, 0.075, 0.08)
      const snap = pulse(time - 0.055, 0.09, 0.36, 0.24)
      const recoilTime = Math.max(0, time - 0.18)
      const recoil = Math.exp(-7.2 * recoilTime) * Math.sin(recoilTime * 28)
      upperArm.rotation.x -= motionScale * (0.036 * snap + 0.008 * recoil)
      shade.rotation.x += motionScale * (0.034 * anticipation - 0.13 * snap + 0.016 * recoil)
      shade.rotation.z += motionScale * (0.055 * snap - 0.01 * recoil)
      rocker.position.y -= 0.003 * snap
      applyLightCue(REJECT_RED, snap, baseLightIntensity + 1.7 * lightIntensityScale * snap)
      if (time > 0.9) motion.active = false
      return
    }

    if (motion.preset === 'fraud') {
      const alarm = pulse(time, 0.075, 1.1, 0.23)
      const sweep = Math.sin(time * 11.6) * alarm
      const tremor = Math.sin(time * 31) * alarm
      lowerArm.rotation.x -= motionScale * 0.022 * alarm
      upperArm.rotation.x += motionScale * (0.049 * alarm + 0.009 * tremor)
      shade.rotation.y += motionScale * 0.25 * sweep
      shade.rotation.z += motionScale * (0.035 * Math.sin(time * 23) * alarm)
      rocker.position.y -= 0.002 * alarm
      const alarmPulse = 0.58 + 0.42 * (0.5 + 0.5 * Math.sin(time * 30))
      applyLightCue(
        FRAUD_RED,
        alarm,
        baseLightIntensity + 2.25 * lightIntensityScale * alarm * alarmPulse,
      )
      if (time > 1.45) motion.active = false
      return
    }

    if (motion.preset === 'printer-jam') {
      const rattleEnvelope = pulse(time, 0.045, 1, 0.24)
      const rattle = Math.sin(time * 76) * 0.62 + Math.sin(time * 47) * 0.38
      lowerArm.rotation.x += motionScale * 0.008 * rattle * rattleEnvelope
      upperArm.rotation.x -= motionScale * 0.018 * rattle * rattleEnvelope
      shade.rotation.x += motionScale * 0.014 * rattle * rattleEnvelope
      shade.rotation.z += motionScale * 0.026 * Math.sin(time * 83) * rattleEnvelope

      const rawFlicker = clamp01(0.48 + Math.sin(time * 39) * 0.48 + Math.sin(time * 73) * 0.24)
      const flicker = reducedMotion ? 0.8 + rawFlicker * 0.2 : 0.16 + rawFlicker * 0.84
      const intensity = baseLightIntensity * (1 - rattleEnvelope + rattleEnvelope * flicker)
      applyLightCue(JAM_AMBER, rattleEnvelope * 0.9, intensity)
      if (time > 1.34) motion.active = false
      return
    }

    const blackout = pulse(time, 0.055, 0.14, 0.18)
    const composeIn = smootherStep((time - 0.15) / 0.48)
    const composeOut = 1 - smoothStep((time - 1.22) / 0.34)
    const alignment = composeIn * composeOut
    const cleanLight = pulse(time - 0.3, 0.26, 1.28, 0.27)

    // Equal-and-opposite joint changes keep the shade level while the mechanism composes itself.
    lowerArm.rotation.x += motionScale * 0.052 * alignment
    upperArm.rotation.x -= motionScale * 0.104 * alignment
    shade.rotation.x += motionScale * 0.052 * alignment
    rocker.position.y -= 0.0028 * cleanLight
    const intensity = baseLightIntensity * (1 - 0.94 * blackout)
      + 1.55 * lightIntensityScale * cleanLight
    applyLightCue(MIGRATION_MINT, cleanLight, intensity)
    if (time > 1.75) motion.active = false
  })

  return (
    <group {...groupProps}>
      <mesh geometry={feetGeometry} material={materials.rubber} receiveShadow />

      <RoundedBox
        args={[0.24, 0.052, 0.178]}
        position={[0, 0.03, 0]}
        radius={0.026}
        smoothness={7}
        material={materials.paint}
        castShadow
        receiveShadow
      />
      <mesh geometry={darkStaticGeometry} material={materials.paintDark} castShadow />
      <mesh geometry={baseFastenerGeometry} material={materials.brass} castShadow />

      <group ref={switchRef} position={[0, 0.0595, 0.047]} rotation={[-0.12, 0, 0]}>
        <RoundedBox
          args={[0.043, 0.011, 0.025]}
          radius={0.005}
          smoothness={5}
          material={materials.switch}
          castShadow
        />
        <RoundedBox args={[0.027, 0.0015, 0.003]} position={[0, 0.006, 0]} radius={0.001} smoothness={2}>
          <meshStandardMaterial color="#72817a" metalness={0.42} roughness={0.38} />
        </RoundedBox>
      </group>

      <mesh position={[0.062, 0.061, 0.042]} material={materials.indicator}>
        <cylinderGeometry args={[0.0055, 0.006, 0.003, 24]} />
      </mesh>

      <group position={[0, 0.077, -0.046]}>
        <PivotJoint capGeometry={pivotCapGeometry} materials={materials} slotGeometry={pivotSlotGeometry} />
        <group ref={lowerArmRef} rotation={[LOWER_ARM_ANGLE, 0, 0]}>
          <mesh geometry={lowerLinkGeometry} material={materials.paint} castShadow receiveShadow />
          <mesh geometry={lowerInlayGeometry} material={materials.brass} castShadow />
          <mesh geometry={springGeometry} material={materials.metal} castShadow />

          <group ref={upperArmRef} position={[0, LOWER_ARM_LENGTH, 0]} rotation={[UPPER_ARM_ANGLE, 0, 0]}>
            <PivotJoint capGeometry={pivotCapGeometry} materials={materials} slotGeometry={pivotSlotGeometry} />
            <mesh geometry={upperLinkGeometry} material={materials.paint} castShadow receiveShadow />
            <mesh geometry={upperInlayGeometry} material={materials.brass} castShadow />

            <group ref={shadeRef} position={[0, UPPER_ARM_LENGTH, 0]} rotation={[SHADE_ANGLE, 0, 0]}>
              <mesh geometry={shadeYokeGeometry} material={materials.metal} castShadow />
              <mesh position={[0, 0.0065, 0]} rotation={[0, 0, HALF_PI]} material={materials.brass} castShadow>
                <cylinderGeometry args={[0.014, 0.014, 0.156, 28]} />
              </mesh>
              <mesh position={[0, -0.031, 0]} material={materials.ceramic} castShadow>
                <cylinderGeometry args={[0.022, 0.019, 0.046, 28]} />
              </mesh>
              <mesh geometry={outerShadeGeometry} material={materials.paint} castShadow receiveShadow />
              <mesh geometry={innerShadeGeometry} material={materials.reflector} receiveShadow />
              <mesh geometry={shadeRimGeometry} material={materials.brass} castShadow />
              <mesh position={[0, -0.085, 0]} scale={[1, 1.18, 1]} material={materials.bulb}>
                <sphereGeometry args={[0.018, 28, 18]} />
              </mesh>

              <spotLight
                ref={spotLightRef}
                position={[0, -0.095, 0]}
                color={DEFAULT_WARM}
                intensity={baseLightIntensity}
                distance={0.92}
                angle={0.52}
                penumbra={0.78}
                decay={2}
                castShadow={false}
              />
              <object3D ref={lightTargetRef} position={[0, -0.78, 0.14]} />
            </group>
          </group>
        </group>
      </group>

      <mesh geometry={cableGeometry} material={materials.cable} castShadow receiveShadow />
      <mesh geometry={powerFixtureGeometry} material={materials.rubber} castShadow receiveShadow />
      <mesh geometry={powerHardwareGeometry} material={materials.metal} castShadow receiveShadow />
    </group>
  )
}
