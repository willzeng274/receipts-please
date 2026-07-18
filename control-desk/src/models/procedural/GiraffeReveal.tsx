import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

import { useLabStore } from '../../store/useLabStore'
import { Model as GeneratedGiraffe } from '../generated/Giraffe'
import type { ProceduralAssetProps } from '../types'

type GiraffeEffect = NonNullable<ProceduralAssetProps['effectPreset']>

type MotionState = {
  active: boolean
  duration: number
  elapsed: number
  preset?: GiraffeEffect
}

/**
 * The supplied GLB is authored in +Y-up source units with its face toward +Z.
 * Scaling it uniformly by this value gives a 2.78 m standing height while
 * preserving the source origin at the feet.
 */
const GIRAFFE_REVEAL_CONTRACT = Object.freeze({
  axes: Object.freeze({ forward: '+Z', up: '+Y' }),
  dimensions: Object.freeze([0.559, 2.78, 1.813] as const),
  modelScale: 0.136591,
  revealHiddenY: -3.08,
})

const EFFECT_DURATIONS: Readonly<Record<GiraffeEffect, number>> = {
  'paper-drop': 0.9,
  approve: 1.18,
  reject: 1.12,
  fraud: 1.42,
  'printer-jam': 1.48,
  migration: 3.2,
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const smoothstep = (value: number) => {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

const smootherstep = (value: number) => {
  const t = clamp01(value)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

const pulse = (time: number, start: number, end: number) => {
  const phase = clamp01((time - start) / (end - start))
  return Math.sin(phase * Math.PI) ** 2
}

function createBadgeTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const context = canvas.getContext('2d')

  if (context) {
    context.fillStyle = '#fff8df'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#d96924'
    context.fillRect(0, 0, canvas.width, 92)
    context.fillRect(0, 472, canvas.width, 40)
    context.strokeStyle = '#211a16'
    context.lineWidth = 24
    context.strokeRect(12, 12, 1000, 488)
    context.fillStyle = '#211a16'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = '900 108px Arial, Helvetica, sans-serif'
    context.fillText('CHIEF GROWTH', 512, 236)
    context.font = '900 126px Arial, Helvetica, sans-serif'
    context.fillText('OFFICER', 512, 382)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.name = 'chief-growth-officer-badge'
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

function GiraffeBadge({ badgeRef }: { badgeRef: React.RefObject<THREE.Group | null> }) {
  const badgeTexture = useMemo(() => createBadgeTexture(), [])
  const badgeGeometry = useMemo(() => new RoundedBoxGeometry(0.72, 0.36, 0.026, 5, 0.03), [])
  const faceGeometry = useMemo(() => new THREE.PlaneGeometry(0.68, 0.32), [])
  const clipGeometry = useMemo(() => new RoundedBoxGeometry(0.12, 0.072, 0.035, 3, 0.012), [])
  const strapGeometry = useMemo(() => {
    const strapPath = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(-0.14, 2.2, 0.68),
        new THREE.Vector3(-0.17, 2.12, 0.82),
        new THREE.Vector3(0, 2.02, 0.93),
        new THREE.Vector3(0.17, 2.12, 0.82),
        new THREE.Vector3(0.14, 2.2, 0.68),
      ],
      false,
      'centripetal',
    )
    return new THREE.TubeGeometry(strapPath, 52, 0.014, 12, false)
  }, [])

  useEffect(
    () => () => {
      badgeTexture.dispose()
      badgeGeometry.dispose()
      faceGeometry.dispose()
      clipGeometry.dispose()
      strapGeometry.dispose()
    },
    [badgeGeometry, badgeTexture, clipGeometry, faceGeometry, strapGeometry],
  )

  return (
    <>
      <mesh castShadow geometry={strapGeometry}>
        <meshPhysicalMaterial color="#bf4f25" roughness={0.76} sheen={0.5} sheenColor="#f1a36f" />
      </mesh>
      <group ref={badgeRef} position={[0, 1.84, 0.94]}>
        <mesh castShadow geometry={clipGeometry} position={[0, 0.205, -0.005]}>
          <meshPhysicalMaterial color="#b7a36d" metalness={0.78} roughness={0.25} />
        </mesh>
        <mesh castShadow receiveShadow geometry={badgeGeometry}>
          <meshPhysicalMaterial
            clearcoat={0.72}
            clearcoatRoughness={0.24}
            color="#eadfc7"
            roughness={0.34}
          />
        </mesh>
        <mesh geometry={faceGeometry} position={[0, 0, 0.0141]}>
          <meshStandardMaterial map={badgeTexture} roughness={0.42} />
        </mesh>
        <mesh geometry={faceGeometry} position={[0, 0, -0.0141]} rotation={[0, Math.PI, 0]}>
          <meshStandardMaterial map={badgeTexture} roughness={0.42} />
        </mesh>
      </group>
    </>
  )
}

export function GiraffeReveal({
  effectPreset,
  effectRun = 0,
  selected = false,
  ...groupProps
}: ProceduralAssetProps) {
  const reducedMotion = useLabStore((state) => state.reducedMotion)
  const revealRef = useRef<THREE.Group>(null)
  const modelRef = useRef<THREE.Group>(null)
  const badgeRef = useRef<THREE.Group>(null)
  const motionRef = useRef<MotionState>({ active: false, duration: 1, elapsed: 0 })

  const resetPose = useCallback(() => {
    revealRef.current?.position.set(0, 0, 0)
    modelRef.current?.position.set(0, 0, 0)
    modelRef.current?.rotation.set(0, 0, 0)
    badgeRef.current?.rotation.set(0, 0, 0)
  }, [])

  const setMigrationStartPose = useCallback(() => {
    resetPose()
    if (revealRef.current) revealRef.current.position.y = GIRAFFE_REVEAL_CONTRACT.revealHiddenY
  }, [resetPose])

  useLayoutEffect(() => {
    if (effectPreset === 'migration') setMigrationStartPose()
    else resetPose()

    motionRef.current = {
      active: Boolean(effectPreset),
      duration: effectPreset ? EFFECT_DURATIONS[effectPreset] : 1,
      elapsed: 0,
      preset: effectPreset,
    }

    return () => {
      motionRef.current.active = false
    }
  }, [effectPreset, effectRun, reducedMotion, resetPose, setMigrationStartPose])

  useFrame((_, delta) => {
    const motion = motionRef.current
    if (!motion.active || !motion.preset) return

    motion.elapsed = Math.min(motion.duration, motion.elapsed + Math.min(delta, 0.05))
    const time = motion.elapsed / motion.duration
    const motionScale = reducedMotion ? 0.35 : 1
    resetPose()

    if (motion.preset === 'paper-drop') {
      const attention = pulse(time, 0.02, 0.78)
      if (modelRef.current) {
        modelRef.current.rotation.x = 0.032 * attention * motionScale
        modelRef.current.rotation.y = -0.024 * attention * motionScale
      }
      if (badgeRef.current) {
        badgeRef.current.rotation.z = 0.05 * Math.sin(time * Math.PI * 4) * (1 - time) * motionScale
      }
    }

    if (motion.preset === 'approve') {
      const nod = pulse(time, 0.08, 0.64)
      if (modelRef.current) {
        modelRef.current.rotation.x = 0.048 * nod * motionScale
        modelRef.current.position.y = -0.018 * nod * motionScale
      }
      if (badgeRef.current) {
        badgeRef.current.rotation.z = -0.09 * Math.sin(time * Math.PI * 3) * (1 - time) * motionScale
      }
    }

    if (motion.preset === 'reject') {
      const skepticism = pulse(time, 0.05, 0.8)
      if (modelRef.current) {
        modelRef.current.rotation.y = -0.075 * skepticism * motionScale
        modelRef.current.rotation.z = 0.036 * skepticism * motionScale
      }
      if (badgeRef.current) {
        badgeRef.current.rotation.z = 0.11 * Math.sin(time * Math.PI * 3.5) * (1 - time) * motionScale
      }
    }

    if (motion.preset === 'fraud') {
      const firstLook = pulse(time, 0.02, 0.32)
      const secondLook = pulse(time, 0.28, 0.61)
      if (modelRef.current) {
        modelRef.current.rotation.y = (0.085 * firstLook - 0.065 * secondLook) * motionScale
        modelRef.current.position.x = 0.025 * (firstLook - secondLook) * motionScale
      }
      if (badgeRef.current) {
        badgeRef.current.rotation.z = 0.18 * Math.sin(time * Math.PI * 6) * (1 - time) * motionScale
      }
    }

    if (motion.preset === 'printer-jam') {
      const irritation = pulse(time, 0.03, 0.86)
      const shake = Math.sin(time * Math.PI * 9) * irritation * motionScale
      if (modelRef.current) {
        modelRef.current.rotation.y = shake * 0.036
        modelRef.current.position.x = shake * 0.012
      }
      if (badgeRef.current) badgeRef.current.rotation.z = shake * 0.085 * (1 - time)
    }

    if (motion.preset === 'migration') {
      const rise = smootherstep(time / (reducedMotion ? 0.43 : 0.61))
      const settle = pulse(time, 0.34, 0.76)
      const swingEnvelope = smoothstep((time - 0.27) / 0.13) * (1 - time)
      if (revealRef.current) {
        revealRef.current.position.y = GIRAFFE_REVEAL_CONTRACT.revealHiddenY * (1 - rise)
      }
      if (modelRef.current) {
        modelRef.current.rotation.y = 0.06 * (1 - smoothstep((time - 0.35) / 0.24)) * rise * motionScale
        modelRef.current.rotation.x = -0.025 * settle * motionScale
      }
      if (badgeRef.current) {
        badgeRef.current.rotation.z = Math.sin((time - 0.27) * Math.PI * 8) * 0.28 * swingEnvelope * motionScale
        badgeRef.current.rotation.x = Math.sin((time - 0.27) * Math.PI * 5) * 0.07 * swingEnvelope * motionScale
      }
    }

    if (time >= 1) {
      resetPose()
      motion.active = false
    }
  })

  return (
    <group {...groupProps}>
      <group ref={revealRef}>
        <group ref={modelRef}>
          <GeneratedGiraffe scale={GIRAFFE_REVEAL_CONTRACT.modelScale} />
          <GiraffeBadge badgeRef={badgeRef} />
        </group>
        {selected ? (
          <mesh position={[0, 0.018, 0.25]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.56, 0.012, 10, 72]} />
            <meshBasicMaterial color="#f0b84b" transparent opacity={0.9} toneMapped={false} />
          </mesh>
        ) : null}
      </group>
    </group>
  )
}
