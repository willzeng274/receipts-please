import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { useLabStore } from '../../store/useLabStore'
import type { ProceduralAssetProps } from '../types'

const TWO_PI = Math.PI * 2
const CASTER_ANGLES = [0, TWO_PI / 5, (TWO_PI * 2) / 5, (TWO_PI * 3) / 5, (TWO_PI * 4) / 5]
const ARM_SIDES = [-1, 1] as const

const GRAPHITE = '#262b2b'
const GRAPHITE_DARK = '#171b1b'
const UPHOLSTERY = '#343b39'
const UPHOLSTERY_HIGHLIGHT = '#414946'
const THREAD = '#747a72'
const ALUMINUM = '#9ca29f'
const STEEL = '#6e7472'
const RUBBER = '#181b1b'
const CONTROL_ACCENT = '#798e7b'

type MotionState = {
  active: boolean
  elapsed: number
  preset: ProceduralAssetProps['effectPreset']
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function smoothstep(value: number) {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

function pulse(time: number, rise: number, fall: number) {
  return smoothstep(time / rise) * (1 - smoothstep((time - rise) / fall))
}

function createSeatGeometry(width: number, depth: number, thickness: number) {
  const halfWidth = width / 2
  const back = depth * 0.43
  const front = -depth * 0.57
  const shape = new THREE.Shape()

  // Shape y maps to -world z after rotation, so the deeper waterfall edge faces +z.
  shape.moveTo(-halfWidth * 0.73, back)
  shape.bezierCurveTo(-halfWidth * 0.92, back, -halfWidth, back * 0.72, -halfWidth, back * 0.35)
  shape.bezierCurveTo(-halfWidth, 0.01, -halfWidth * 0.98, front * 0.72, -halfWidth * 0.9, front * 0.9)
  shape.quadraticCurveTo(-halfWidth * 0.72, front, 0, front)
  shape.quadraticCurveTo(halfWidth * 0.72, front, halfWidth * 0.9, front * 0.9)
  shape.bezierCurveTo(halfWidth * 0.98, front * 0.72, halfWidth, 0.01, halfWidth, back * 0.35)
  shape.bezierCurveTo(halfWidth, back * 0.72, halfWidth * 0.92, back, halfWidth * 0.73, back)
  shape.quadraticCurveTo(0, back * 0.9, -halfWidth * 0.73, back)
  shape.closePath()

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: Math.min(0.012, thickness * 0.22),
    bevelThickness: Math.min(0.008, thickness * 0.16),
    curveSegments: 10,
    steps: 1,
  })
  geometry.translate(0, 0, -thickness / 2)
  geometry.rotateX(-Math.PI / 2)
  geometry.computeVertexNormals()
  return geometry
}

function createBackGeometry(width: number, height: number, thickness: number, inset: number) {
  const halfWidth = width / 2
  const shape = new THREE.Shape()
  const bottom = inset
  const top = height - inset

  shape.moveTo(-halfWidth * 0.62, bottom)
  shape.bezierCurveTo(-halfWidth * 0.84, bottom, -halfWidth * 0.91, height * 0.13, -halfWidth * 0.9, height * 0.25)
  shape.bezierCurveTo(-halfWidth * 0.89, height * 0.39, -halfWidth, height * 0.62, -halfWidth * 0.96, height * 0.74)
  shape.bezierCurveTo(-halfWidth * 0.91, height * 0.91, -halfWidth * 0.7, top, -halfWidth * 0.45, top)
  shape.quadraticCurveTo(0, height + inset * 0.2, halfWidth * 0.45, top)
  shape.bezierCurveTo(halfWidth * 0.7, top, halfWidth * 0.91, height * 0.91, halfWidth * 0.96, height * 0.74)
  shape.bezierCurveTo(halfWidth, height * 0.62, halfWidth * 0.89, height * 0.39, halfWidth * 0.9, height * 0.25)
  shape.bezierCurveTo(halfWidth * 0.91, height * 0.13, halfWidth * 0.84, bottom, halfWidth * 0.62, bottom)
  shape.quadraticCurveTo(0, bottom + inset * 0.5, -halfWidth * 0.62, bottom)
  shape.closePath()

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: Math.min(0.012, thickness * 0.24),
    bevelThickness: Math.min(0.007, thickness * 0.18),
    curveSegments: 12,
    steps: 1,
  })
  geometry.translate(0, 0, -thickness / 2)
  geometry.computeVertexNormals()
  return geometry
}

function rotatedCasterPart(geometry: THREE.BufferGeometry, angle: number) {
  geometry.rotateY(angle)
  return geometry
}

function mergeChairParts(parts: THREE.BufferGeometry[], label: string) {
  const compatibleParts = parts.map((part) => (part.index ? part.toNonIndexed() : part))
  const merged = mergeGeometries(compatibleParts, false)
  parts.forEach((part) => part.dispose())
  compatibleParts.forEach((part, index) => {
    if (part !== parts[index]) part.dispose()
  })
  if (!merged) throw new Error(`Unable to assemble OfficeChair ${label} geometry`)
  merged.computeBoundingBox()
  merged.computeBoundingSphere()
  return merged
}

function createBaseGeometries() {
  const aluminum: THREE.BufferGeometry[] = []
  const graphite: THREE.BufferGeometry[] = []
  const steel: THREE.BufferGeometry[] = []
  const rubber: THREE.BufferGeometry[] = []

  CASTER_ANGLES.forEach((angle) => {
    // The spoke overlaps both the hub and caster stem. Its slight downward rake
    // puts visual weight over the wheel without leaving daylight at either end.
    const spoke = new RoundedBoxGeometry(0.072, 0.038, 0.26, 5, 0.018)
    spoke.rotateX(0.055)
    spoke.translate(0, 0.115, 0.178)
    aluminum.push(rotatedCasterPart(spoke, angle))

    const spokeUnderside = new RoundedBoxGeometry(0.052, 0.022, 0.232, 4, 0.011)
    spokeUnderside.rotateX(0.055)
    spokeUnderside.translate(0, 0.094, 0.178)
    graphite.push(rotatedCasterPart(spokeUnderside, angle))

    const stem = new THREE.CylinderGeometry(0.009, 0.009, 0.06, 20)
    stem.translate(0, 0.122, 0.306)
    steel.push(rotatedCasterPart(stem, angle))

    // A narrow central yoke occupies the gap between the dual wheels instead of
    // intersecting their tread. It overlaps the stem above and axle below.
    const fork = new RoundedBoxGeometry(0.022, 0.069, 0.052, 5, 0.009)
    fork.translate(0, 0.0695, 0.326)
    graphite.push(rotatedCasterPart(fork, angle))

    const axle = new THREE.CylinderGeometry(0.0065, 0.0065, 0.084, 18)
    axle.rotateZ(Math.PI / 2)
    axle.translate(0, 0.032, 0.326)
    steel.push(rotatedCasterPart(axle, angle))

    ARM_SIDES.forEach((side) => {
      const wheel = new THREE.CylinderGeometry(0.032, 0.032, 0.017, 28)
      wheel.rotateZ(Math.PI / 2)
      wheel.translate(side * 0.0225, 0.032, 0.326)
      rubber.push(rotatedCasterPart(wheel, angle))

      const hub = new THREE.CylinderGeometry(0.016, 0.016, 0.003, 20)
      hub.rotateZ(Math.PI / 2)
      hub.translate(side * 0.0325, 0.032, 0.326)
      graphite.push(rotatedCasterPart(hub, angle))
    })
  })

  const topHub = new THREE.CylinderGeometry(0.098, 0.076, 0.07, 32)
  topHub.translate(0, 0.132, 0)
  aluminum.push(topHub)

  const collar = new THREE.CylinderGeometry(0.058, 0.068, 0.034, 28)
  collar.translate(0, 0.169, 0)
  graphite.push(collar)

  return {
    aluminum: mergeChairParts(aluminum, 'aluminum base'),
    graphite: mergeChairParts(graphite, 'graphite base'),
    rubber: mergeChairParts(rubber, 'caster tread'),
    steel: mergeChairParts(steel, 'caster hardware'),
  }
}

function AdjustableArm({ side }: { side: (typeof ARM_SIDES)[number] }) {
  return (
    <group position={[side * 0.278, 0, -0.005]}>
      {/* The mounting shoe intersects the seat shell and receives the upright. */}
      <RoundedBox
        args={[0.09, 0.04, 0.095]}
        position={[-side * 0.032, 0.053, -0.035]}
        radius={0.014}
        smoothness={5}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={GRAPHITE_DARK} metalness={0.28} roughness={0.46} />
      </RoundedBox>
      <RoundedBox
        args={[0.046, 0.226, 0.052]}
        position={[0, 0.177, -0.045]}
        radius={0.014}
        smoothness={5}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial color={ALUMINUM} metalness={0.83} roughness={0.27} clearcoat={0.22} />
      </RoundedBox>
      <RoundedBox
        args={[0.058, 0.112, 0.064]}
        position={[0, 0.244, -0.045]}
        radius={0.014}
        smoothness={5}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={GRAPHITE} metalness={0.12} roughness={0.48} />
      </RoundedBox>
      <RoundedBox
        args={[0.078, 0.035, 0.252]}
        position={[0, 0.304, 0.026]}
        rotation={[-0.025, 0, 0]}
        radius={0.018}
        smoothness={6}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={GRAPHITE_DARK} metalness={0.06} roughness={0.62} />
      </RoundedBox>
      <RoundedBox
        args={[0.068, 0.018, 0.232]}
        position={[0, 0.328, 0.031]}
        rotation={[-0.025, 0, 0]}
        radius={0.009}
        smoothness={6}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          color="#424846"
          metalness={0.02}
          roughness={0.74}
          clearcoat={0.08}
          clearcoatRoughness={0.8}
        />
      </RoundedBox>
      <mesh
        position={[side * 0.03, 0.248, -0.045]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.012, 0.012, 0.008, 20]} />
        <meshStandardMaterial color={RUBBER} metalness={0.01} roughness={0.82} />
      </mesh>
      {[0.205, 0.232, 0.259].map((height) => (
        <RoundedBox
          key={height}
          args={[0.003, 0.012, 0.034]}
          position={[-side * 0.029, height, -0.045]}
          radius={0.0015}
          smoothness={3}
        >
          <meshStandardMaterial color={STEEL} metalness={0.68} roughness={0.34} />
        </RoundedBox>
      ))}
    </group>
  )
}

export function OfficeChair({
  effectPreset,
  effectRun = 0,
  selected = false,
  ...groupProps
}: ProceduralAssetProps) {
  const reducedMotion = useLabStore((state) => state.reducedMotion)
  const groundReactionRef = useRef<THREE.Group>(null)
  const casterReactionRef = useRef<THREE.Group>(null)
  const swivelRef = useRef<THREE.Group>(null)
  const tiltRef = useRef<THREE.Group>(null)
  const motionRef = useRef<MotionState>({ active: false, elapsed: 0, preset: effectPreset })

  const baseGeometry = useMemo(createBaseGeometries, [])
  const seatShellGeometry = useMemo(() => createSeatGeometry(0.535, 0.49, 0.044), [])
  const seatCushionGeometry = useMemo(() => createSeatGeometry(0.518, 0.475, 0.072), [])
  const seatTopGeometry = useMemo(() => createSeatGeometry(0.465, 0.41, 0.024), [])
  const backShellGeometry = useMemo(() => createBackGeometry(0.49, 0.505, 0.052, 0.006), [])
  const backCushionGeometry = useMemo(() => createBackGeometry(0.445, 0.463, 0.043, 0.026), [])

  useEffect(
    () => () => {
      Object.values(baseGeometry).forEach((geometry) => geometry.dispose())
      seatShellGeometry.dispose()
      seatCushionGeometry.dispose()
      seatTopGeometry.dispose()
      backShellGeometry.dispose()
      backCushionGeometry.dispose()
    },
    [
      backCushionGeometry,
      backShellGeometry,
      baseGeometry,
      seatCushionGeometry,
      seatShellGeometry,
      seatTopGeometry,
    ],
  )

  useEffect(() => {
    const motion = motionRef.current
    motion.active = effectRun > 0
    motion.elapsed = 0
    motion.preset = effectPreset

    if (groundReactionRef.current) {
      groundReactionRef.current.position.set(0, 0, 0)
      groundReactionRef.current.rotation.set(0, 0, 0)
    }
    if (casterReactionRef.current) casterReactionRef.current.rotation.set(0, 0, 0)
    if (swivelRef.current) swivelRef.current.rotation.set(0, 0, 0)
    if (tiltRef.current) {
      tiltRef.current.position.set(0, 0, 0)
      tiltRef.current.rotation.set(0, 0, 0)
    }
  }, [effectPreset, effectRun])

  useFrame((_, delta) => {
    const ground = groundReactionRef.current
    const casterReaction = casterReactionRef.current
    const swivel = swivelRef.current
    const tilt = tiltRef.current
    const motion = motionRef.current
    if (!ground || !casterReaction || !swivel || !tilt) return

    ground.position.set(0, 0, 0)
    ground.rotation.set(0, 0, 0)
    casterReaction.rotation.set(0, 0, 0)
    swivel.rotation.set(0, 0, 0)
    tilt.position.set(0, 0, 0)
    tilt.rotation.set(0, 0, 0)

    if (!motion.active || !motion.preset) return

    motion.elapsed += Math.min(delta, 0.05)
    const time = motion.elapsed
    const amount = reducedMotion ? 0.32 : 1

    if (motion.preset === 'paper-drop') {
      const envelope = pulse(time, 0.11, 0.32)
      const settle = Math.exp(-7 * time) * Math.sin(time * 24)
      ground.position.x = 0.0045 * amount * envelope
      ground.position.z = -0.003 * amount * envelope
      casterReaction.rotation.y = 0.018 * amount * settle
      swivel.rotation.y = -0.009 * amount * settle
      if (time > 0.62) motion.active = false
      return
    }

    if (motion.preset === 'approve') {
      const anticipation = pulse(time, 0.1, 0.12)
      const turn = pulse(time - 0.09, 0.24, 0.5)
      const settle = Math.exp(-5.8 * Math.max(0, time - 0.27)) * Math.sin(Math.max(0, time - 0.27) * 17)
      swivel.rotation.y = amount * (-0.022 * anticipation + 0.09 * turn + 0.009 * settle)
      tilt.rotation.x = amount * (-0.018 * turn - 0.006 * settle)
      tilt.rotation.z = amount * 0.006 * turn
      if (time > 0.95) motion.active = false
      return
    }

    if (motion.preset === 'reject') {
      const anticipation = pulse(time, 0.065, 0.075)
      const turn = pulse(time - 0.055, 0.14, 0.36)
      const snap = Math.exp(-8 * Math.max(0, time - 0.17)) * Math.sin(Math.max(0, time - 0.17) * 27)
      swivel.rotation.y = amount * (0.025 * anticipation - 0.115 * turn - 0.012 * snap)
      tilt.rotation.x = amount * (0.026 * turn + 0.008 * snap)
      tilt.rotation.z = amount * -0.009 * turn
      if (time > 0.72) motion.active = false
      return
    }

    if (motion.preset === 'fraud') {
      const brace = pulse(time, 0.13, 0.13)
      const recoil = pulse(time - 0.1, 0.15, 0.62)
      const settleTime = Math.max(0, time - 0.31)
      const settle = Math.exp(-5.2 * settleTime) * Math.sin(settleTime * 18)
      ground.position.z = amount * (-0.017 * recoil + 0.002 * settle)
      casterReaction.rotation.y = amount * 0.026 * settle
      swivel.rotation.y = amount * (-0.028 * brace + 0.05 * recoil + 0.012 * settle)
      tilt.position.y = amount * -0.004 * recoil
      tilt.rotation.x = amount * (-0.06 * recoil - 0.012 * settle)
      tilt.rotation.z = amount * (0.018 * recoil + 0.007 * settle)
      if (time > 1.12) motion.active = false
      return
    }

    if (motion.preset === 'printer-jam') {
      const envelope = pulse(time, 0.12, 0.76)
      const shudder = Math.sin(time * 69) + 0.45 * Math.sin(time * 113 + 0.7)
      ground.position.x = amount * 0.0022 * envelope * shudder
      ground.position.z = amount * 0.0014 * envelope * Math.sin(time * 83 + 0.4)
      casterReaction.rotation.y = amount * 0.006 * envelope * shudder
      swivel.rotation.y = amount * 0.008 * envelope * Math.sin(time * 51)
      tilt.rotation.x = amount * 0.005 * envelope * Math.sin(time * 77 + 0.5)
      tilt.rotation.z = amount * 0.004 * envelope * shudder
      if (time > 1.02) motion.active = false
      return
    }

    const anticipation = pulse(time, 0.18, 0.2)
    const composedTurn = pulse(time - 0.15, 0.52, 0.86)
    const settleTime = Math.max(0, time - 0.69)
    const settle = Math.exp(-4.8 * settleTime) * Math.sin(settleTime * 12)
    swivel.rotation.y = amount * (-0.045 * anticipation + 0.235 * composedTurn + 0.016 * settle)
    tilt.rotation.x = amount * (-0.024 * composedTurn - 0.007 * settle)
    ground.position.z = amount * 0.007 * composedTurn
    casterReaction.rotation.y = amount * -0.014 * composedTurn
    if (time > 1.72) motion.active = false
  })

  return (
    <group {...groupProps}>
      <group ref={groundReactionRef}>
        {/* Floor assembly: dual-wheel casters touch y=0; the polished five-star base floats above them. */}
        <group ref={casterReactionRef}>
          <mesh geometry={baseGeometry.aluminum} castShadow receiveShadow>
            <meshPhysicalMaterial
              color={ALUMINUM}
              metalness={0.92}
              roughness={0.22}
              clearcoat={0.35}
              clearcoatRoughness={0.16}
            />
          </mesh>
          <mesh geometry={baseGeometry.graphite} castShadow receiveShadow>
            <meshStandardMaterial color={GRAPHITE} metalness={0.16} roughness={0.5} />
          </mesh>
          <mesh geometry={baseGeometry.steel} castShadow receiveShadow>
            <meshStandardMaterial color={STEEL} metalness={0.82} roughness={0.29} />
          </mesh>
          <mesh geometry={baseGeometry.rubber} castShadow receiveShadow>
            <meshStandardMaterial color={RUBBER} metalness={0.01} roughness={0.9} />
          </mesh>
        </group>

        {/* Every lift section inserts into its neighbor: base collar, boot, shaft, cap, mechanism. */}
        <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.047, 0.057, 0.192, 32]} />
          <meshStandardMaterial color={GRAPHITE_DARK} metalness={0.2} roughness={0.52} />
        </mesh>
        <mesh position={[0, 0.348, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.13, 28]} />
          <meshPhysicalMaterial color={STEEL} metalness={0.9} roughness={0.2} clearcoat={0.3} />
        </mesh>
        <mesh position={[0, 0.414, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.043, 0.035, 0.034, 28]} />
          <meshStandardMaterial color={GRAPHITE} metalness={0.18} roughness={0.48} />
        </mesh>

        {/* The swivel owns yaw. The nested tilt group owns only seat/back pitch and recoil. */}
        <group ref={swivelRef} position={[0, 0.4, 0]}>
          <group ref={tiltRef}>
            <RoundedBox
              args={[0.36, 0.065, 0.285]}
              position={[0, 0, -0.005]}
              radius={0.025}
              smoothness={6}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color={GRAPHITE_DARK} metalness={0.26} roughness={0.48} />
            </RoundedBox>
            <RoundedBox
              args={[0.29, 0.016, 0.22]}
              position={[0, 0.037, -0.01]}
              radius={0.008}
              smoothness={4}
              castShadow
            >
              <meshStandardMaterial color={STEEL} metalness={0.72} roughness={0.31} />
            </RoundedBox>

            <mesh geometry={seatShellGeometry} position={[0, 0.06, 0.012]} castShadow receiveShadow>
              <meshStandardMaterial color={GRAPHITE} metalness={0.12} roughness={0.48} />
            </mesh>
            <mesh geometry={seatCushionGeometry} position={[0, 0.104, 0.024]} castShadow receiveShadow>
              <meshPhysicalMaterial
                color={UPHOLSTERY}
                metalness={0.01}
                roughness={0.68}
                clearcoat={0.05}
                clearcoatRoughness={0.85}
              />
            </mesh>
            <mesh geometry={seatTopGeometry} position={[0, 0.143, 0.005]} castShadow receiveShadow>
              <meshPhysicalMaterial
                color={UPHOLSTERY_HIGHLIGHT}
                emissive={selected ? '#17231d' : '#000000'}
                emissiveIntensity={selected ? 0.35 : 0}
                metalness={0.01}
                roughness={0.73}
                clearcoat={0.04}
                clearcoatRoughness={0.9}
              />
            </mesh>

            {/* Tailored seat seams sit above the crown and terminate before the waterfall edge. */}
            {ARM_SIDES.map((side) => (
              <RoundedBox
                key={side}
                args={[0.004, 0.004, 0.31]}
                position={[side * 0.192, 0.154, 0.005]}
                radius={0.0018}
                smoothness={3}
                castShadow
              >
                <meshStandardMaterial color={THREAD} metalness={0} roughness={0.88} />
              </RoundedBox>
            ))}
            <RoundedBox
              args={[0.366, 0.004, 0.004]}
              position={[0, 0.154, 0.191]}
              radius={0.0018}
              smoothness={3}
              castShadow
            >
              <meshStandardMaterial color={THREAD} metalness={0} roughness={0.88} />
            </RoundedBox>

            {ARM_SIDES.map((side) => (
              <AdjustableArm key={side} side={side} />
            ))}

            {/* Under-seat controls remain readable in close inspection without becoming toy-like. */}
            <mesh position={[0.238, -0.005, 0.096]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.008, 0.008, 0.13, 18]} />
              <meshStandardMaterial color={STEEL} metalness={0.75} roughness={0.32} />
            </mesh>
            <RoundedBox
              args={[0.062, 0.022, 0.032]}
              position={[0.325, -0.005, 0.096]}
              rotation={[0, 0, -0.08]}
              radius={0.011}
              smoothness={5}
              castShadow
            >
              <meshStandardMaterial color={RUBBER} metalness={0.02} roughness={0.82} />
            </RoundedBox>
            <mesh position={[-0.197, -0.014, 0.118]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.008, 0.008, 0.05, 18]} />
              <meshStandardMaterial color={STEEL} metalness={0.74} roughness={0.32} />
            </mesh>
            <mesh position={[-0.229, -0.014, 0.118]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.029, 0.029, 0.028, 24]} />
              <meshStandardMaterial color={GRAPHITE} metalness={0.12} roughness={0.54} />
            </mesh>
            <mesh position={[-0.244, -0.014, 0.118]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.017, 0.017, 0.006, 20]} />
              <meshStandardMaterial
                color={CONTROL_ACCENT}
                emissive={selected ? '#26442f' : '#000000'}
                emissiveIntensity={selected ? 0.8 : 0}
                metalness={0.2}
                roughness={0.48}
              />
            </mesh>

            {/* Rear spine and Y-brace transfer back load into the tilt mechanism. */}
            <RoundedBox
              args={[0.074, 0.22, 0.052]}
              position={[0, 0.11, -0.178]}
              rotation={[-0.13, 0, 0]}
              radius={0.022}
              smoothness={6}
              castShadow
              receiveShadow
            >
              <meshPhysicalMaterial color={ALUMINUM} metalness={0.84} roughness={0.27} clearcoat={0.24} />
            </RoundedBox>
            {ARM_SIDES.map((side) => (
              <RoundedBox
                key={side}
                args={[0.046, 0.22, 0.042]}
                position={[side * 0.069, 0.214, -0.211]}
                rotation={[-0.1, 0, side * -0.38]}
                radius={0.018}
                smoothness={5}
                castShadow
                receiveShadow
              >
                <meshPhysicalMaterial color={ALUMINUM} metalness={0.84} roughness={0.27} clearcoat={0.24} />
              </RoundedBox>
            ))}
            <RoundedBox
              args={[0.28, 0.04, 0.04]}
              position={[0, 0.3, -0.225]}
              radius={0.016}
              smoothness={5}
              castShadow
              receiveShadow
            >
              <meshPhysicalMaterial color={ALUMINUM} metalness={0.84} roughness={0.27} clearcoat={0.24} />
            </RoundedBox>

            <group position={[0, 0.15, -0.195]} rotation={[-0.09, 0, 0]}>
              <mesh geometry={backShellGeometry} castShadow receiveShadow>
                <meshStandardMaterial color={GRAPHITE} metalness={0.1} roughness={0.47} />
              </mesh>
              <mesh geometry={backCushionGeometry} position={[0, 0.008, 0.045]} castShadow receiveShadow>
                <meshPhysicalMaterial
                  color={UPHOLSTERY}
                  emissive={selected ? '#121c18' : '#000000'}
                  emissiveIntensity={selected ? 0.22 : 0}
                  metalness={0.01}
                  roughness={0.67}
                  clearcoat={0.05}
                  clearcoatRoughness={0.86}
                />
              </mesh>
              <RoundedBox
                args={[0.335, 0.005, 0.007]}
                position={[0, 0.194, 0.068]}
                radius={0.0023}
                smoothness={4}
                castShadow
              >
                <meshStandardMaterial color={THREAD} metalness={0} roughness={0.9} />
              </RoundedBox>
              <RoundedBox
                args={[0.006, 0.18, 0.007]}
                position={[0, 0.344, 0.068]}
                radius={0.0024}
                smoothness={4}
                castShadow
              >
                <meshStandardMaterial color={THREAD} metalness={0} roughness={0.9} />
              </RoundedBox>
              <RoundedBox
                args={[0.35, 0.045, 0.025]}
                position={[0, 0.15, -0.037]}
                radius={0.016}
                smoothness={5}
                castShadow
              >
                <meshStandardMaterial color={GRAPHITE_DARK} metalness={0.18} roughness={0.5} />
              </RoundedBox>
              <RoundedBox
                args={[0.12, 0.032, 0.012]}
                position={[0, 0.151, -0.048]}
                radius={0.009}
                smoothness={5}
                castShadow
              >
                <meshStandardMaterial color={STEEL} metalness={0.65} roughness={0.34} />
              </RoundedBox>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}
