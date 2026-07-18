import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

import { useLabStore } from '../../store/useLabStore'
import type { ProceduralAssetProps } from '../types'

type GiraffeEffect = NonNullable<ProceduralAssetProps['effectPreset']>

type MotionState = {
  active: boolean
  duration: number
  elapsed: number
  preset?: GiraffeEffect
}

const EFFECT_DURATIONS: Readonly<Record<GiraffeEffect, number>> = {
  'paper-drop': 0.9,
  approve: 1.18,
  reject: 1.12,
  fraud: 1.42,
  'printer-jam': 1.48,
  migration: 3.2,
}

const LEFT_EAR_REST = 1.06
const RIGHT_EAR_REST = -1.06
const LEFT_EYE_POSITION = new THREE.Vector3(-0.235, 0.085, 0.237)
const RIGHT_EYE_POSITION = new THREE.Vector3(0.235, 0.085, 0.237)
const REVEAL_HIDDEN_Y = -2.96

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

function createTaperedNeckGeometry() {
  const curve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-0.025, 0.44, 0.012),
      new THREE.Vector3(0.035, 0.95, 0.025),
      new THREE.Vector3(-0.022, 1.48, -0.008),
      new THREE.Vector3(0.018, 1.82, -0.018),
      new THREE.Vector3(0, 2.09, 0.018),
    ],
    false,
    'centripetal',
  )
  const tubularSegments = 88
  const radialSegments = 36
  const frames = curve.computeFrenetFrames(tubularSegments, false)
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const point = new THREE.Vector3()
  const radial = new THREE.Vector3()

  for (let i = 0; i <= tubularSegments; i += 1) {
    const t = i / tubularSegments
    curve.getPointAt(t, point)
    const radius = THREE.MathUtils.lerp(0.195, 0.105, smootherstep(t))

    for (let j = 0; j <= radialSegments; j += 1) {
      const angle = (j / radialSegments) * Math.PI * 2
      radial
        .copy(frames.normals[i])
        .multiplyScalar(Math.cos(angle))
        .addScaledVector(frames.binormals[i], Math.sin(angle))
      positions.push(
        point.x + radial.x * radius,
        i === 0 ? 0 : point.y + radial.y * radius,
        point.z + radial.z * radius * 0.46,
      )
      uvs.push(j / radialSegments, t)
    }
  }

  for (let i = 0; i < tubularSegments; i += 1) {
    for (let j = 0; j < radialSegments; j += 1) {
      const a = i * (radialSegments + 1) + j
      const b = (i + 1) * (radialSegments + 1) + j
      const c = (i + 1) * (radialSegments + 1) + j + 1
      const d = i * (radialSegments + 1) + j + 1
      indices.push(a, b, d, b, c, d)
    }
  }

  curve.getPointAt(0, point)
  const bottomCenter = positions.length / 3
  positions.push(point.x, point.y, point.z)
  uvs.push(0.5, 0.5)
  for (let j = 0; j < radialSegments; j += 1) {
    indices.push(bottomCenter, j + 1, j)
  }

  curve.getPointAt(1, point)
  const topCenter = positions.length / 3
  positions.push(point.x, point.y, point.z)
  uvs.push(0.5, 0.5)
  const topRing = tubularSegments * (radialSegments + 1)
  for (let j = 0; j < radialSegments; j += 1) {
    indices.push(topCenter, topRing + j, topRing + j + 1)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function createManeGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(0.145, 0.52)
  shape.lineTo(0.15, 0.82)
  shape.lineTo(0.15, 1.12)
  shape.lineTo(0.145, 1.42)
  shape.lineTo(0.15, 1.72)
  shape.lineTo(0.18, 2.04)
  shape.lineTo(0.205, 2.31)
  shape.lineTo(0.305, 2.31)
  shape.lineTo(0.255, 2.19)
  shape.lineTo(0.31, 2.1)
  shape.lineTo(0.255, 1.99)
  shape.lineTo(0.3, 1.89)
  shape.lineTo(0.245, 1.78)
  shape.lineTo(0.29, 1.67)
  shape.lineTo(0.235, 1.56)
  shape.lineTo(0.28, 1.45)
  shape.lineTo(0.225, 1.34)
  shape.lineTo(0.27, 1.23)
  shape.lineTo(0.22, 1.12)
  shape.lineTo(0.26, 1)
  shape.lineTo(0.21, 0.88)
  shape.lineTo(0.245, 0.74)
  shape.lineTo(0.205, 0.59)
  shape.closePath()

  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.006,
    bevelThickness: 0.006,
    curveSegments: 3,
    depth: 0.035,
    steps: 1,
  })
  geometry.rotateY(Math.PI / 2)
  geometry.scale(1, 1, 0.3)
  geometry.translate(-0.0175, 0, 0)
  geometry.computeVertexNormals()
  return geometry
}

function createSpotTexture() {
  const size = 160
  const data = new Uint8Array(size * size * 4)
  const seeds: Array<{ x: number; y: number; shade: number }> = []
  let randomState = 0x9e3779b9
  const random = () => {
    randomState = (Math.imul(randomState ^ (randomState >>> 15), 1 | randomState) + 0x6d2b79f5) | 0
    return ((randomState ^ (randomState >>> 14)) >>> 0) / 4294967296
  }

  for (let index = 0; index < 17; index += 1) {
    seeds.push({ x: random(), y: random(), shade: random() })
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size
      const v = (y + 0.5) / size
      let nearest = Number.POSITIVE_INFINITY
      let second = Number.POSITIVE_INFINITY
      let seedShade = 0.5

      for (const seed of seeds) {
        const deltaX = Math.min(Math.abs(u - seed.x), 1 - Math.abs(u - seed.x))
        const deltaY = Math.min(Math.abs(v - seed.y), 1 - Math.abs(v - seed.y))
        const distance = deltaX * deltaX + deltaY * deltaY
        if (distance < nearest) {
          second = nearest
          nearest = distance
          seedShade = seed.shade
        } else if (distance < second) {
          second = distance
        }
      }

      const boundary = second - nearest
      const grain = (((x * 17 + y * 31 + ((x * y) % 29)) % 19) - 9) * 0.8
      const offset = (y * size + x) * 4
      if (boundary < 0.0075) {
        data[offset] = Math.round(220 + grain)
        data[offset + 1] = Math.round(174 + grain * 0.55)
        data[offset + 2] = Math.round(92 + grain * 0.35)
      } else {
        data[offset] = Math.round(91 + seedShade * 25 + grain)
        data[offset + 1] = Math.round(43 + seedShade * 13 + grain * 0.35)
        data[offset + 2] = Math.round(22 + seedShade * 8)
      }
      data[offset + 3] = 255
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType)
  texture.name = 'giraffe-coat-voronoi'
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1.65, 3.25)
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

function createBadgeTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 416
  const context = canvas.getContext('2d')

  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.beginPath()
    context.moveTo(34, 8)
    context.lineTo(734, 8)
    context.quadraticCurveTo(760, 8, 760, 34)
    context.lineTo(760, 382)
    context.quadraticCurveTo(760, 408, 734, 408)
    context.lineTo(34, 408)
    context.quadraticCurveTo(8, 408, 8, 382)
    context.lineTo(8, 34)
    context.quadraticCurveTo(8, 8, 34, 8)
    context.closePath()
    context.fillStyle = '#f3ead4'
    context.fill()
    context.lineWidth = 12
    context.strokeStyle = '#30251c'
    context.stroke()

    context.fillStyle = '#d57328'
    context.fillRect(20, 20, 728, 68)
    context.fillStyle = '#fff8e8'
    context.font = '700 30px Arial, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('EMPLOYEE  •  EXECUTIVE', 384, 54)

    context.fillStyle = '#2d2119'
    context.font = '800 72px Arial, sans-serif'
    context.fillText('CHIEF', 384, 151)
    context.font = '800 79px Arial, sans-serif'
    context.fillText('GROWTH', 384, 238)
    context.font = '800 72px Arial, sans-serif'
    context.fillText('OFFICER', 384, 326)

    context.fillStyle = '#d57328'
    context.fillRect(78, 372, 612, 8)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.name = 'chief-growth-officer-badge'
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

export function GiraffeReveal({
  effectPreset,
  effectRun = 0,
  selected = false,
  ...groupProps
}: ProceduralAssetProps) {
  const reducedMotion = useLabStore((state) => state.reducedMotion)
  const initialRevealPosition = useRef<[number, number, number]>([
    0,
    effectPreset === 'migration' ? REVEAL_HIDDEN_Y : 0,
    0,
  ]).current
  const revealRef = useRef<THREE.Group>(null)
  const headRef = useRef<THREE.Group>(null)
  const jawRef = useRef<THREE.Group>(null)
  const leftEarRef = useRef<THREE.Group>(null)
  const rightEarRef = useRef<THREE.Group>(null)
  const leftEyeRef = useRef<THREE.Group>(null)
  const rightEyeRef = useRef<THREE.Group>(null)
  const leftLidRef = useRef<THREE.Group>(null)
  const rightLidRef = useRef<THREE.Group>(null)
  const badgeRef = useRef<THREE.Group>(null)
  const nostrilsRef = useRef<THREE.InstancedMesh>(null)
  const ossiconeStemsRef = useRef<THREE.InstancedMesh>(null)
  const ossiconeTipsRef = useRef<THREE.InstancedMesh>(null)
  const motionRef = useRef<MotionState>({ active: false, duration: 1, elapsed: 0 })

  const spotTexture = useMemo(() => createSpotTexture(), [])
  const badgeTexture = useMemo(() => createBadgeTexture(), [])
  const geometries = useMemo(() => {
    const strapCurve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(-0.13, 1.69, 0.105),
        new THREE.Vector3(-0.16, 1.54, 0.205),
        new THREE.Vector3(0, 1.335, 0.255),
        new THREE.Vector3(0.16, 1.54, 0.205),
        new THREE.Vector3(0.13, 1.69, 0.105),
      ],
      false,
      'centripetal',
    )

    return {
      badge: new RoundedBoxGeometry(0.5, 0.285, 0.018, 5, 0.025),
      badgeFace: new THREE.PlaneGeometry(0.472, 0.257),
      clip: new RoundedBoxGeometry(0.095, 0.058, 0.026, 3, 0.012),
      earInner: new THREE.CapsuleGeometry(0.044, 0.13, 10, 28),
      earOuter: new THREE.CapsuleGeometry(0.068, 0.19, 12, 32),
      lip: new THREE.CapsuleGeometry(0.008, 0.205, 8, 24),
      mane: createManeGeometry(),
      neck: createTaperedNeckGeometry(),
      ossiconeStem: new THREE.CylinderGeometry(0.023, 0.034, 0.22, 28, 4),
      sphere: new THREE.SphereGeometry(1, 64, 40),
      strap: new THREE.TubeGeometry(strapCurve, 48, 0.014, 12, false),
    }
  }, [])
  const materials = useMemo(
    () => ({
      badge: new THREE.MeshPhysicalMaterial({
        color: '#e8dfc9',
        clearcoat: 0.75,
        clearcoatRoughness: 0.25,
        metalness: 0.02,
        roughness: 0.35,
      }),
      badgeFace: new THREE.MeshStandardMaterial({
        alphaTest: 0.4,
        map: badgeTexture,
        metalness: 0,
        roughness: 0.42,
        transparent: true,
      }),
      coat: new THREE.MeshPhysicalMaterial({
        color: '#fff8ea',
        clearcoat: 0.05,
        clearcoatRoughness: 0.7,
        map: spotTexture,
        metalness: 0,
        roughness: 0.68,
        sheen: 0.16,
        sheenColor: new THREE.Color('#aa6a32'),
        sheenRoughness: 0.82,
      }),
      dark: new THREE.MeshStandardMaterial({ color: '#1d1714', metalness: 0.02, roughness: 0.72 }),
      innerEar: new THREE.MeshPhysicalMaterial({
        color: '#8d503f',
        clearcoat: 0.03,
        roughness: 0.83,
        sheen: 0.25,
        sheenColor: new THREE.Color('#d58a74'),
      }),
      iris: new THREE.MeshPhysicalMaterial({
        color: '#a66a2f',
        clearcoat: 0.75,
        clearcoatRoughness: 0.12,
        roughness: 0.25,
      }),
      mane: new THREE.MeshPhysicalMaterial({
        color: '#321d14',
        roughness: 0.8,
        sheen: 0.34,
        sheenColor: new THREE.Color('#724227'),
      }),
      metal: new THREE.MeshPhysicalMaterial({
        color: '#b9a36d',
        clearcoat: 0.35,
        metalness: 0.78,
        roughness: 0.24,
      }),
      muzzle: new THREE.MeshPhysicalMaterial({
        color: '#b78362',
        clearcoat: 0.04,
        roughness: 0.84,
        sheen: 0.22,
        sheenColor: new THREE.Color('#e4b491'),
      }),
      pupil: new THREE.MeshPhysicalMaterial({
        color: '#090807',
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        roughness: 0.12,
      }),
      sclera: new THREE.MeshPhysicalMaterial({
        color: '#e8d9bd',
        clearcoat: 0.55,
        clearcoatRoughness: 0.14,
        roughness: 0.26,
      }),
      strap: new THREE.MeshPhysicalMaterial({
        color: '#b94f2c',
        roughness: 0.78,
        sheen: 0.48,
        sheenColor: new THREE.Color('#f4aa72'),
      }),
    }),
    [badgeTexture, spotTexture],
  )

  useEffect(() => {
    materials.coat.emissive.set(selected ? '#4a2d0e' : '#000000')
    materials.coat.emissiveIntensity = selected ? 0.08 : 0
  }, [materials.coat, selected])

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()

    if (nostrilsRef.current) {
      ;[-1, 1].forEach((direction, index) => {
        dummy.position.set(direction * 0.115, -0.235, 0.69)
        dummy.rotation.set(-0.12, 0, direction * 0.12)
        dummy.scale.set(0.044, 0.024, 0.014)
        dummy.updateMatrix()
        nostrilsRef.current?.setMatrixAt(index, dummy.matrix)
      })
      nostrilsRef.current.instanceMatrix.needsUpdate = true
    }

    if (ossiconeStemsRef.current) {
      ;[-1, 1].forEach((direction, index) => {
        dummy.position.set(direction * 0.115, 0.385, -0.025)
        dummy.rotation.set(0, 0, direction * -0.1)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        ossiconeStemsRef.current?.setMatrixAt(index, dummy.matrix)
      })
      ossiconeStemsRef.current.instanceMatrix.needsUpdate = true
    }

    if (ossiconeTipsRef.current) {
      ;[-1, 1].forEach((direction, index) => {
        dummy.position.set(direction * 0.126, 0.515, -0.025)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(0.057, 0.062, 0.057)
        dummy.updateMatrix()
        ossiconeTipsRef.current?.setMatrixAt(index, dummy.matrix)
      })
      ossiconeTipsRef.current.instanceMatrix.needsUpdate = true
    }
  }, [])

  useEffect(
    () => () => {
      spotTexture.dispose()
      badgeTexture.dispose()
      Object.values(geometries).forEach((geometry) => geometry.dispose())
      Object.values(materials).forEach((material) => material.dispose())
    },
    [badgeTexture, geometries, materials, spotTexture],
  )

  const setEyeOpen = useCallback((leftOpen: number, rightOpen = leftOpen) => {
    if (leftEyeRef.current) leftEyeRef.current.scale.y = Math.max(0.08, leftOpen)
    if (rightEyeRef.current) rightEyeRef.current.scale.y = Math.max(0.08, rightOpen)
    if (leftLidRef.current) {
      leftLidRef.current.position.y = LEFT_EYE_POSITION.y + 0.055 - (1 - leftOpen) * 0.044
      leftLidRef.current.scale.y = 1 + (1 - leftOpen) * 1.25
    }
    if (rightLidRef.current) {
      rightLidRef.current.position.y = RIGHT_EYE_POSITION.y + 0.055 - (1 - rightOpen) * 0.044
      rightLidRef.current.scale.y = 1 + (1 - rightOpen) * 1.25
    }
  }, [])

  const resetPose = useCallback(() => {
    revealRef.current?.position.set(0, 0, 0)
    headRef.current?.rotation.set(0, 0, 0)
    jawRef.current?.rotation.set(0, 0, 0)
    leftEarRef.current?.rotation.set(0, 0, LEFT_EAR_REST)
    rightEarRef.current?.rotation.set(0, 0, RIGHT_EAR_REST)
    badgeRef.current?.rotation.set(0, 0, 0)
    leftEyeRef.current?.scale.set(1, 1, 1)
    rightEyeRef.current?.scale.set(1, 1, 1)
    leftLidRef.current?.position.set(
      LEFT_EYE_POSITION.x,
      LEFT_EYE_POSITION.y + 0.055,
      LEFT_EYE_POSITION.z + 0.018,
    )
    rightLidRef.current?.position.set(
      RIGHT_EYE_POSITION.x,
      RIGHT_EYE_POSITION.y + 0.055,
      RIGHT_EYE_POSITION.z + 0.018,
    )
    leftLidRef.current?.scale.set(1, 1, 1)
    rightLidRef.current?.scale.set(1, 1, 1)
  }, [])

  const setMigrationStartPose = useCallback(() => {
    resetPose()
    if (revealRef.current) revealRef.current.position.y = REVEAL_HIDDEN_Y
    setEyeOpen(0.08)
  }, [resetPose, setEyeOpen])

  const holdMigrationPose = useCallback(() => {
    if (revealRef.current) revealRef.current.position.y = 0
    if (headRef.current) headRef.current.rotation.set(0, 0, 0)
    if (jawRef.current) jawRef.current.rotation.set(0, 0, 0)
    if (leftEarRef.current) leftEarRef.current.rotation.set(0, 0, LEFT_EAR_REST)
    if (rightEarRef.current) rightEarRef.current.rotation.set(0, 0, RIGHT_EAR_REST)
    if (badgeRef.current) badgeRef.current.rotation.set(0, 0, 0)
    setEyeOpen(1)
  }, [setEyeOpen])

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
    resetPose()

    if (motion.preset === 'paper-drop') {
      const attention = pulse(time, 0.02, 0.78)
      const blink = pulse(time, 0.12, 0.3)
      if (headRef.current) {
        headRef.current.rotation.x = 0.095 * attention
        headRef.current.rotation.y = -0.035 * attention
      }
      if (leftEarRef.current) leftEarRef.current.rotation.z += 0.11 * pulse(time, 0.02, 0.36)
      if (rightEarRef.current) rightEarRef.current.rotation.z -= 0.045 * attention
      if (jawRef.current) jawRef.current.rotation.x = 0.025 * pulse(time, 0.5, 0.82)
      if (badgeRef.current) badgeRef.current.rotation.z = 0.045 * Math.sin(time * Math.PI * 4) * (1 - time)
      setEyeOpen(1 - blink * 0.9)
    }

    if (motion.preset === 'approve') {
      const nod = pulse(time, 0.08, 0.62)
      const chewOne = pulse(time, 0.26, 0.55)
      const chewTwo = pulse(time, 0.55, 0.84)
      if (headRef.current) {
        headRef.current.rotation.x = 0.12 * nod
        headRef.current.rotation.z = -0.025 * nod
      }
      if (jawRef.current) jawRef.current.rotation.x = 0.105 * chewOne + 0.065 * chewTwo
      if (leftEarRef.current) leftEarRef.current.rotation.z -= 0.045 * nod
      if (rightEarRef.current) rightEarRef.current.rotation.z += 0.045 * nod
      if (badgeRef.current) badgeRef.current.rotation.z = -0.075 * Math.sin(time * Math.PI * 3) * (1 - time)
      setEyeOpen(1 - pulse(time, 0.08, 0.28) * 0.78)
    }

    if (motion.preset === 'reject') {
      const skepticism = pulse(time, 0.05, 0.8)
      if (headRef.current) {
        headRef.current.rotation.y = -0.13 * skepticism
        headRef.current.rotation.z = 0.095 * skepticism
      }
      if (jawRef.current) jawRef.current.rotation.x = 0.045 * pulse(time, 0.52, 0.78)
      if (leftEarRef.current) leftEarRef.current.rotation.z += 0.13 * skepticism
      if (rightEarRef.current) rightEarRef.current.rotation.z += 0.1 * skepticism
      if (badgeRef.current) badgeRef.current.rotation.z = 0.115 * Math.sin(time * Math.PI * 3.5) * (1 - time)
      setEyeOpen(1 - 0.48 * skepticism, 1 - pulse(time, 0.1, 0.3) * 0.86)
    }

    if (motion.preset === 'fraud') {
      const firstLook = pulse(time, 0.02, 0.32)
      const secondLook = pulse(time, 0.28, 0.61)
      const alert = pulse(time, 0.04, 0.75)
      if (headRef.current) {
        headRef.current.rotation.y = 0.18 * firstLook - 0.135 * secondLook
        headRef.current.rotation.x = -0.055 * alert
      }
      if (leftEarRef.current) leftEarRef.current.rotation.z -= 0.24 * alert
      if (rightEarRef.current) rightEarRef.current.rotation.z += 0.24 * alert
      if (jawRef.current) jawRef.current.rotation.x = 0.075 * pulse(time, 0.6, 0.84)
      if (badgeRef.current) badgeRef.current.rotation.z = 0.19 * Math.sin(time * Math.PI * 6) * (1 - time)
      setEyeOpen(1 - pulse(time, 0.04, 0.16) * 0.92)
    }

    if (motion.preset === 'printer-jam') {
      const irritation = pulse(time, 0.03, 0.86)
      const shake = Math.sin(time * Math.PI * 9) * irritation
      if (headRef.current) {
        headRef.current.rotation.y = shake * 0.085
        headRef.current.rotation.z = -shake * 0.024
      }
      if (jawRef.current) {
        jawRef.current.rotation.x =
          0.075 * pulse(time, 0.14, 0.4) + 0.095 * pulse(time, 0.44, 0.72)
      }
      if (leftEarRef.current) leftEarRef.current.rotation.z += shake * 0.08
      if (rightEarRef.current) rightEarRef.current.rotation.z += shake * 0.08
      if (badgeRef.current) badgeRef.current.rotation.z = shake * 0.11 * (1 - time)
      setEyeOpen(1 - pulse(time, 0.08, 0.24) * 0.65, 1 - pulse(time, 0.16, 0.32) * 0.65)
    }

    if (motion.preset === 'migration') {
      const rise = smootherstep(time / (reducedMotion ? 0.46 : 0.61))
      const eyeReveal = smoothstep((time - 0.34) / 0.22)
      const settle = pulse(time, 0.34, 0.74)
      const migrationBlink = pulse(time, 0.64, 0.73)
      const swingEnvelope = smoothstep((time - 0.28) / 0.13) * (1 - time)
      if (revealRef.current) revealRef.current.position.y = REVEAL_HIDDEN_Y * (1 - rise)
      if (headRef.current) {
        headRef.current.rotation.y = 0.11 * (1 - smoothstep((time - 0.35) / 0.24)) * rise
        headRef.current.rotation.x = -0.05 * settle
      }
      if (leftEarRef.current) leftEarRef.current.rotation.z -= 0.15 * settle
      if (rightEarRef.current) rightEarRef.current.rotation.z += 0.15 * settle
      if (jawRef.current) {
        jawRef.current.rotation.x =
          0.115 * pulse(time, 0.61, 0.76) + 0.072 * pulse(time, 0.76, 0.91)
      }
      if (badgeRef.current) {
        badgeRef.current.rotation.z = Math.sin((time - 0.28) * Math.PI * 8) * 0.31 * swingEnvelope
        badgeRef.current.rotation.x = Math.sin((time - 0.28) * Math.PI * 5) * 0.075 * swingEnvelope
      }
      setEyeOpen(Math.max(0.08, eyeReveal * (1 - migrationBlink * 0.9)))
    }

    if (time >= 1) {
      if (motion.preset === 'migration') holdMigrationPose()
      else resetPose()
      motion.active = false
    }
  })

  return (
    <group {...groupProps}>
      <group ref={revealRef} position={initialRevealPosition}>
        <mesh castShadow receiveShadow geometry={geometries.neck} material={materials.coat} />
        <mesh castShadow receiveShadow geometry={geometries.mane} material={materials.mane} />

        <mesh castShadow geometry={geometries.strap} material={materials.strap} />
        <group ref={badgeRef} position={[0, 1.335, 0.265]}>
          <mesh castShadow geometry={geometries.clip} material={materials.metal} position={[0, -0.018, 0]} />
          <mesh
            castShadow
            receiveShadow
            geometry={geometries.badge}
            material={materials.badge}
            position={[0, -0.18, 0]}
          />
          <mesh
            geometry={geometries.badgeFace}
            material={materials.badgeFace}
            position={[0, -0.18, 0.0101]}
          />
          <mesh
            geometry={geometries.badgeFace}
            material={materials.badgeFace}
            position={[0, -0.18, -0.0101]}
            rotation={[0, Math.PI, 0]}
          />
        </group>

        <group ref={headRef} position={[0, 2.15, 0.035]}>
          <mesh
            castShadow
            receiveShadow
            geometry={geometries.sphere}
            material={materials.coat}
            scale={[0.31, 0.34, 0.285]}
          />
          <mesh
            castShadow
            receiveShadow
            geometry={geometries.sphere}
            material={materials.coat}
            position={[0, -0.105, 0.245]}
            rotation={[0.1, 0, 0]}
            scale={[0.225, 0.205, 0.31]}
          />
          <mesh
            castShadow
            receiveShadow
            geometry={geometries.sphere}
            material={materials.muzzle}
            position={[0, -0.23, 0.47]}
            rotation={[0.08, 0, 0]}
            scale={[0.245, 0.165, 0.255]}
          />

          <group ref={jawRef} position={[0, -0.215, 0.255]}>
            <mesh
              castShadow
              receiveShadow
              geometry={geometries.sphere}
              material={materials.muzzle}
              position={[0, -0.085, 0.19]}
              rotation={[0.04, 0, 0]}
              scale={[0.225, 0.115, 0.23]}
            />
            <mesh
              geometry={geometries.lip}
              material={materials.dark}
              position={[0, -0.028, 0.418]}
              rotation={[0, 0, Math.PI / 2]}
            />
          </group>

          <instancedMesh ref={nostrilsRef} args={[geometries.sphere, materials.dark, 2]} castShadow />

          <group ref={leftEarRef} position={[-0.285, 0.205, -0.018]} rotation={[0, 0, LEFT_EAR_REST]}>
            <mesh
              castShadow
              receiveShadow
              geometry={geometries.earOuter}
              material={materials.coat}
              position={[0, 0.13, 0]}
              scale={[1, 1, 0.58]}
            />
            <mesh
              geometry={geometries.earInner}
              material={materials.innerEar}
              position={[0, 0.14, 0.042]}
              scale={[1, 1, 0.38]}
            />
          </group>
          <group ref={rightEarRef} position={[0.285, 0.205, -0.018]} rotation={[0, 0, RIGHT_EAR_REST]}>
            <mesh
              castShadow
              receiveShadow
              geometry={geometries.earOuter}
              material={materials.coat}
              position={[0, 0.13, 0]}
              scale={[1, 1, 0.58]}
            />
            <mesh
              geometry={geometries.earInner}
              material={materials.innerEar}
              position={[0, 0.14, 0.042]}
              scale={[1, 1, 0.38]}
            />
          </group>

          <instancedMesh
            ref={ossiconeStemsRef}
            args={[geometries.ossiconeStem, materials.coat, 2]}
            castShadow
            receiveShadow
          />
          <instancedMesh ref={ossiconeTipsRef} args={[geometries.sphere, materials.mane, 2]} castShadow />

          <group ref={leftEyeRef} position={LEFT_EYE_POSITION}>
            <mesh geometry={geometries.sphere} material={materials.sclera} scale={[0.085, 0.062, 0.035]} />
            <mesh
              geometry={geometries.sphere}
              material={materials.iris}
              position={[0, 0, 0.031]}
              scale={[0.044, 0.044, 0.012]}
            />
            <mesh
              geometry={geometries.sphere}
              material={materials.pupil}
              position={[0, 0, 0.041]}
              scale={[0.021, 0.029, 0.008]}
            />
          </group>
          <group ref={rightEyeRef} position={RIGHT_EYE_POSITION}>
            <mesh geometry={geometries.sphere} material={materials.sclera} scale={[0.085, 0.062, 0.035]} />
            <mesh
              geometry={geometries.sphere}
              material={materials.iris}
              position={[0, 0, 0.031]}
              scale={[0.044, 0.044, 0.012]}
            />
            <mesh
              geometry={geometries.sphere}
              material={materials.pupil}
              position={[0, 0, 0.041]}
              scale={[0.021, 0.029, 0.008]}
            />
          </group>
          <group
            ref={leftLidRef}
            position={[
              LEFT_EYE_POSITION.x,
              LEFT_EYE_POSITION.y + 0.055,
              LEFT_EYE_POSITION.z + 0.018,
            ]}
          >
            <mesh geometry={geometries.sphere} material={materials.coat} scale={[0.094, 0.024, 0.024]} />
          </group>
          <group
            ref={rightLidRef}
            position={[
              RIGHT_EYE_POSITION.x,
              RIGHT_EYE_POSITION.y + 0.055,
              RIGHT_EYE_POSITION.z + 0.018,
            ]}
          >
            <mesh geometry={geometries.sphere} material={materials.coat} scale={[0.094, 0.024, 0.024]} />
          </group>
        </group>
      </group>
    </group>
  )
}
