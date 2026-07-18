import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { useLabStore } from '../../store/useLabStore'
import type { ProceduralAssetProps } from '../types'

const HALF_PI = Math.PI / 2
const TWO_PI = Math.PI * 2
const CLUSTER_COUNT = 4
const LEAF_VARIANT_COUNT = 3

const LEAF_COLORS = [new THREE.Color('#315f42'), new THREE.Color('#3d704b'), new THREE.Color('#4c7c53')]
const LEAF_EMISSIVE = new THREE.Color('#102719')
const FRAUD_TINT = new THREE.Color('#a13c2e')
const MIGRATION_TINT = new THREE.Color('#70a66d')

type StemSpec = {
  cluster: number
  points: [number, number, number][]
  leafCount: number
  yaw: number
  phase: number
  radius: number
}

type LeafRecord = {
  basePosition: THREE.Vector3
  baseQuaternion: THREE.Quaternion
  cluster: number
  instanceIndex: number
  length: number
  phase: number
  variant: number
  width: number
  young: boolean
}

type MotionState = {
  active: boolean
  elapsed: number
  preset: ProceduralAssetProps['effectPreset']
}

type PlantData = {
  crownGeometry: THREE.BufferGeometry
  leafCounts: number[]
  leafGeometries: THREE.BufferGeometry[]
  leaves: LeafRecord[]
  pebbleGeometries: THREE.BufferGeometry[]
  planterGeometry: THREE.BufferGeometry
  planterSpeckGeometry: THREE.BufferGeometry
  stemClusterGeometries: THREE.BufferGeometry[]
}

const STEM_SPECS: StemSpec[] = [
  {
    cluster: 0,
    points: [
      [-0.034, 0.394, 0.012],
      [-0.072, 0.67, 0.03],
      [-0.145, 0.98, 0.075],
      [-0.185, 1.235, 0.11],
    ],
    leafCount: 4,
    yaw: -1.05,
    phase: 0.3,
    radius: 0.0105,
  },
  {
    cluster: 1,
    points: [
      [0.026, 0.394, 0.016],
      [0.065, 0.69, 0.045],
      [0.13, 1.015, 0.11],
      [0.185, 1.3, 0.165],
    ],
    leafCount: 4,
    yaw: 0.84,
    phase: 1.15,
    radius: 0.011,
  },
  {
    cluster: 2,
    points: [
      [-0.018, 0.394, -0.026],
      [-0.052, 0.68, -0.08],
      [-0.108, 0.97, -0.17],
      [-0.12, 1.205, -0.245],
    ],
    leafCount: 4,
    yaw: -2.15,
    phase: 2.05,
    radius: 0.0095,
  },
  {
    cluster: 3,
    points: [
      [0.032, 0.394, -0.018],
      [0.082, 0.645, -0.055],
      [0.165, 0.905, -0.145],
      [0.235, 1.145, -0.185],
    ],
    leafCount: 4,
    yaw: 2.22,
    phase: 2.8,
    radius: 0.0097,
  },
  {
    cluster: 0,
    points: [
      [-0.02, 0.394, 0.034],
      [-0.035, 0.63, 0.105],
      [-0.055, 0.865, 0.23],
      [-0.035, 1.075, 0.33],
    ],
    leafCount: 3,
    yaw: -0.25,
    phase: 3.7,
    radius: 0.009,
  },
  {
    cluster: 1,
    points: [
      [0.032, 0.394, 0.032],
      [0.062, 0.625, 0.11],
      [0.105, 0.84, 0.245],
      [0.13, 1.06, 0.315],
    ],
    leafCount: 3,
    yaw: 0.42,
    phase: 4.35,
    radius: 0.0092,
  },
  {
    cluster: 2,
    points: [
      [-0.044, 0.394, 0],
      [-0.12, 0.61, 0.055],
      [-0.225, 0.805, 0.125],
      [-0.31, 0.99, 0.17],
    ],
    leafCount: 3,
    yaw: -1.42,
    phase: 5.1,
    radius: 0.0087,
  },
  {
    cluster: 3,
    points: [
      [0.045, 0.394, 0.002],
      [0.13, 0.605, 0.06],
      [0.23, 0.79, 0.12],
      [0.315, 0.97, 0.155],
    ],
    leafCount: 3,
    yaw: 1.35,
    phase: 5.75,
    radius: 0.0086,
  },
]

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
  const sharedAttributes = Object.keys(mergeableParts[0].attributes).filter((name) =>
    mergeableParts.every((part) => part.getAttribute(name)),
  )
  mergeableParts.forEach((part) => {
    Object.keys(part.attributes).forEach((name) => {
      if (!sharedAttributes.includes(name)) part.deleteAttribute(name)
    })
  })
  const merged = mergeGeometries(mergeableParts, false)
  parts.forEach((part) => part.dispose())
  if (mergeableParts !== parts) {
    mergeableParts.forEach((part, index) => {
      if (part !== parts[index]) part.dispose()
    })
  }
  if (!merged) throw new Error(`Unable to assemble OfficePlant ${label}`)
  merged.computeBoundingBox()
  merged.computeBoundingSphere()
  return merged
}

function createTaperedTubeGeometry(
  curve: THREE.CatmullRomCurve3,
  startRadius: number,
  endRadius: number,
  tubularSegments: number,
  radialSegments: number,
) {
  const frames = curve.computeFrenetFrames(tubularSegments, false)
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  const point = new THREE.Vector3()
  const radial = new THREE.Vector3()

  for (let segment = 0; segment <= tubularSegments; segment += 1) {
    const progress = segment / tubularSegments
    const radius = THREE.MathUtils.lerp(startRadius, endRadius, progress)
    curve.getPointAt(progress, point)
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * TWO_PI
      radial
        .copy(frames.normals[segment])
        .multiplyScalar(Math.cos(angle))
        .addScaledVector(frames.binormals[segment], Math.sin(angle))
        .normalize()
      positions.push(
        point.x + radial.x * radius,
        point.y + radial.y * radius,
        point.z + radial.z * radius,
      )
      normals.push(radial.x, radial.y, radial.z)
    }
  }

  for (let segment = 0; segment < tubularSegments; segment += 1) {
    const row = segment * radialSegments
    const nextRow = (segment + 1) * radialSegments
    for (let side = 0; side < radialSegments; side += 1) {
      const nextSide = (side + 1) % radialSegments
      const a = row + side
      const b = row + nextSide
      const c = nextRow + nextSide
      const d = nextRow + side
      indices.push(a, b, d, b, c, d)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function createLeafGeometry(twist: number, fold: number, tipCurl: number) {
  const lengthSegments = 12
  const widthSegments = 8
  const rowSize = widthSegments + 1
  const layerSize = (lengthSegments + 1) * rowSize
  const positions: number[] = []
  const indices: number[] = []
  const thickness = 0.022

  for (let layer = 0; layer < 2; layer += 1) {
    const surface = layer === 0 ? 1 : -1
    for (let lengthIndex = 0; lengthIndex <= lengthSegments; lengthIndex += 1) {
      const progress = lengthIndex / lengthSegments
      const widthProfile =
        (0.035 + 0.965 * Math.pow(Math.sin(Math.PI * progress), 0.72)) *
        (0.9 + progress * 0.1)
      const sectionTwist = twist * (progress - 0.12)
      const cosine = Math.cos(sectionTwist)
      const sine = Math.sin(sectionTwist)
      for (let widthIndex = 0; widthIndex <= widthSegments; widthIndex += 1) {
        const across = (widthIndex / widthSegments) * 2 - 1
        const rawX = across * widthProfile * 0.5
        const centerFold = fold * Math.sin(Math.PI * progress) * (1 - Math.pow(Math.abs(across), 1.45))
        const curledTip = tipCurl * Math.pow(progress, 4) * (1 - Math.abs(across) * 0.3)
        positions.push(
          rawX * cosine,
          progress,
          rawX * sine + centerFold + curledTip + surface * thickness * 0.5,
        )
      }
    }
  }

  for (let layer = 0; layer < 2; layer += 1) {
    const offset = layer * layerSize
    for (let lengthIndex = 0; lengthIndex < lengthSegments; lengthIndex += 1) {
      for (let widthIndex = 0; widthIndex < widthSegments; widthIndex += 1) {
        const a = offset + lengthIndex * rowSize + widthIndex
        const b = a + 1
        const d = a + rowSize
        const c = d + 1
        if (layer === 0) indices.push(a, b, d, b, c, d)
        else indices.push(a, d, b, b, d, c)
      }
    }
  }

  for (let lengthIndex = 0; lengthIndex < lengthSegments; lengthIndex += 1) {
    for (const widthIndex of [0, widthSegments]) {
      const topA = lengthIndex * rowSize + widthIndex
      const topB = topA + rowSize
      const bottomA = topA + layerSize
      const bottomB = topB + layerSize
      if (widthIndex === 0) indices.push(topA, bottomA, topB, topB, bottomA, bottomB)
      else indices.push(topA, topB, bottomA, topB, bottomB, bottomA)
    }
  }

  for (const lengthIndex of [0, lengthSegments]) {
    for (let widthIndex = 0; widthIndex < widthSegments; widthIndex += 1) {
      const topA = lengthIndex * rowSize + widthIndex
      const topB = topA + 1
      const bottomA = topA + layerSize
      const bottomB = topB + layerSize
      if (lengthIndex === 0) indices.push(topA, topB, bottomA, topB, bottomB, bottomA)
      else indices.push(topA, bottomA, topB, topB, bottomA, bottomB)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function createPlanterGeometry() {
  const profile = [
    new THREE.Vector2(0.137, 0.048),
    new THREE.Vector2(0.159, 0.055),
    new THREE.Vector2(0.177, 0.12),
    new THREE.Vector2(0.197, 0.32),
    new THREE.Vector2(0.204, 0.384),
    new THREE.Vector2(0.211, 0.41),
    new THREE.Vector2(0.207, 0.428),
    new THREE.Vector2(0.194, 0.439),
    new THREE.Vector2(0.174, 0.439),
    new THREE.Vector2(0.171, 0.426),
    new THREE.Vector2(0.181, 0.408),
    new THREE.Vector2(0.181, 0.395),
  ]
  const geometry = new THREE.LatheGeometry(profile, 64)
  geometry.computeVertexNormals()
  return geometry
}

function createPlanterSpeckGeometry() {
  const parts: THREE.BufferGeometry[] = []
  for (let index = 0; index < 30; index += 1) {
    const yaw = (index * 2.399963229728653 + (index % 3) * 0.17) % TWO_PI
    const height = 0.095 + ((index * 0.073) % 0.29)
    const radius = 0.175 + ((height - 0.095) / 0.29) * 0.026
    const speck = new THREE.SphereGeometry(1, 7, 5)
    speck.scale(0.0032 + (index % 4) * 0.00055, 0.004 + (index % 3) * 0.0007, 0.0015)
    speck.rotateY(yaw)
    speck.translate(Math.sin(yaw) * (radius + 0.001), height, Math.cos(yaw) * (radius + 0.001))
    parts.push(speck)
  }
  return mergeParts(parts, 'ceramic aggregate flecks')
}

function createPebbleGeometries() {
  const families: THREE.BufferGeometry[][] = [[], []]
  for (let index = 0; index < 30; index += 1) {
    const angle = index * 2.399963229728653
    const radius = 0.025 + ((index * 0.041) % 0.135)
    const pebble = new THREE.SphereGeometry(1, 12, 7)
    const width = 0.012 + (index % 5) * 0.0017
    pebble.scale(width, 0.006 + (index % 3) * 0.0012, width * (0.72 + (index % 4) * 0.07))
    pebble.rotateY(angle * 0.47)
    pebble.translate(Math.sin(angle) * radius, 0.414 + (index % 3) * 0.0014, Math.cos(angle) * radius)
    families[index % 2].push(pebble)
  }
  return families.map((parts, index) => mergeParts(parts, `top-dressing pebbles ${index + 1}`))
}

function createPlantData(): PlantData {
  const clusterParts: THREE.BufferGeometry[][] = Array.from({ length: CLUSTER_COUNT }, () => [])
  const crownParts: THREE.BufferGeometry[] = []
  const leaves: LeafRecord[] = []
  const leafCounts = [0, 0, 0]
  const up = new THREE.Vector3(0, 1, 0)

  STEM_SPECS.forEach((stem, stemIndex) => {
    const curve = new THREE.CatmullRomCurve3(
      stem.points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      false,
      'centripetal',
    )
    clusterParts[stem.cluster].push(
      createTaperedTubeGeometry(curve, stem.radius, stem.radius * 0.53, 36, 10),
    )

    const crown = new THREE.SphereGeometry(1, 14, 9)
    crown.scale(stem.radius * 2.35, 0.025 + stem.radius, stem.radius * 2.1)
    crown.translate(stem.points[0][0], 0.407, stem.points[0][2])
    crownParts.push(crown)

    const nodeTimes = stem.leafCount === 4 ? [0.34, 0.55, 0.75, 0.95] : [0.46, 0.72, 0.95]
    nodeTimes.forEach((nodeTime, leafIndex) => {
      const node = curve.getPointAt(nodeTime)
      const tangent = curve.getTangentAt(nodeTime).normalize()
      const yaw = stem.yaw + leafIndex * 2.18 + stem.phase * 0.23
      const elevation = 0.12 + leafIndex * 0.075 + ((stemIndex + leafIndex) % 3) * 0.045
      const direction = new THREE.Vector3(
        Math.sin(yaw) * Math.cos(elevation),
        Math.sin(elevation),
        Math.cos(yaw) * Math.cos(elevation),
      ).normalize()
      const petioleLength = 0.07 + leafIndex * 0.009 + (stemIndex % 3) * 0.006
      const leafBase = node.clone().addScaledVector(direction, petioleLength - 0.014)
      const petioleEnd = leafBase.clone().addScaledVector(direction, 0.019)
      const petioleMid = node.clone().lerp(petioleEnd, 0.52)
      petioleMid.y += 0.012 + leafIndex * 0.002
      const petioleCurve = new THREE.CatmullRomCurve3(
        [node.clone().addScaledVector(tangent, -0.012), petioleMid, petioleEnd],
        false,
        'centripetal',
      )
      clusterParts[stem.cluster].push(
        createTaperedTubeGeometry(petioleCurve, stem.radius * 0.5, 0.0025, 22, 8),
      )

      const knuckle = new THREE.SphereGeometry(1, 12, 8)
      knuckle.scale(stem.radius * 1.22, stem.radius * 1.45, stem.radius * 1.22)
      knuckle.translate(node.x, node.y, node.z)
      clusterParts[stem.cluster].push(knuckle)

      const variant = (stemIndex + leafIndex * 2) % LEAF_VARIANT_COUNT
      const young = leafIndex === stem.leafCount - 1 && (stemIndex + leafIndex) % 2 === 0
      const length =
        0.235 + ((stemIndex * 3 + leafIndex * 2) % 5) * 0.018 - (young ? 0.018 : 0)
      const width = 0.13 + ((stemIndex + leafIndex * 3) % 4) * 0.012
      const roll = ((stemIndex * 2 + leafIndex) % 5 - 2) * 0.12
      const baseQuaternion = new THREE.Quaternion().setFromUnitVectors(up, direction)
      baseQuaternion.multiply(new THREE.Quaternion().setFromAxisAngle(up, roll))

      leaves.push({
        basePosition: leafBase,
        baseQuaternion,
        cluster: stem.cluster,
        instanceIndex: leafCounts[variant],
        length,
        phase: stem.phase + leafIndex * 1.37,
        variant,
        width,
        young,
      })
      leafCounts[variant] += 1
    })
  })

  return {
    crownGeometry: mergeParts(crownParts, 'soil crown'),
    leafCounts,
    leafGeometries: [
      createLeafGeometry(-0.14, 0.075, -0.055),
      createLeafGeometry(0.12, 0.09, -0.035),
      createLeafGeometry(0.045, 0.115, -0.095),
    ],
    leaves,
    pebbleGeometries: createPebbleGeometries(),
    planterGeometry: createPlanterGeometry(),
    planterSpeckGeometry: createPlanterSpeckGeometry(),
    stemClusterGeometries: clusterParts.map((parts, index) =>
      mergeParts(parts, `stem and petiole cluster ${index + 1}`),
    ),
  }
}

function createMaterials() {
  return {
    ceramic: new THREE.MeshPhysicalMaterial({
      color: '#d7d2c4',
      metalness: 0.02,
      roughness: 0.32,
      clearcoat: 0.48,
      clearcoatRoughness: 0.34,
    }),
    crown: new THREE.MeshStandardMaterial({ color: '#5d4932', metalness: 0.01, roughness: 0.91 }),
    foot: new THREE.MeshPhysicalMaterial({
      color: '#44372b',
      metalness: 0.05,
      roughness: 0.52,
      clearcoat: 0.24,
      clearcoatRoughness: 0.55,
    }),
    hardware: new THREE.MeshStandardMaterial({ color: '#a58d61', metalness: 0.68, roughness: 0.3 }),
    leaf: LEAF_COLORS.map(
      (color, index) =>
        new THREE.MeshPhysicalMaterial({
          color,
          emissive: LEAF_EMISSIVE,
          emissiveIntensity: 0,
          metalness: 0.01,
          roughness: 0.42 + index * 0.055,
          clearcoat: 0.22 - index * 0.035,
          clearcoatRoughness: 0.48,
        }),
    ),
    pebble: [
      new THREE.MeshStandardMaterial({ color: '#b3aa98', metalness: 0.02, roughness: 0.83 }),
      new THREE.MeshStandardMaterial({ color: '#827b6f', metalness: 0.04, roughness: 0.78 }),
    ],
    selection: new THREE.MeshStandardMaterial({
      color: '#8ed5ad',
      emissive: '#4aa575',
      emissiveIntensity: 0.65,
      metalness: 0.08,
      roughness: 0.4,
    }),
    soil: new THREE.MeshStandardMaterial({ color: '#282218', metalness: 0, roughness: 0.98 }),
    speck: new THREE.MeshStandardMaterial({ color: '#6e695f', metalness: 0.04, roughness: 0.68 }),
    stem: new THREE.MeshPhysicalMaterial({
      color: '#526a3c',
      metalness: 0,
      roughness: 0.64,
      clearcoat: 0.08,
      clearcoatRoughness: 0.72,
    }),
  }
}

export function OfficePlant({
  effectPreset,
  effectRun = 0,
  selected = false,
  ...groupProps
}: ProceduralAssetProps) {
  const reducedMotion = useLabStore((state) => state.reducedMotion)
  const reactionRef = useRef<THREE.Group>(null)
  const canopyRef = useRef<THREE.Group>(null)
  const clusterRefs = useRef<(THREE.Group | null)[]>([])
  const leafMeshRefs = useRef<(THREE.InstancedMesh | null)[]>([])
  const motionRef = useRef<MotionState>({ active: false, elapsed: 0, preset: effectPreset })

  const data = useMemo(createPlantData, [])
  const materials = useMemo(createMaterials, [])
  const scratch = useMemo(
    () => ({
      clusterMatrices: Array.from({ length: CLUSTER_COUNT }, () => new THREE.Matrix4()),
      flutterEuler: new THREE.Euler(),
      flutterQuaternion: new THREE.Quaternion(),
      leafMatrix: new THREE.Matrix4(),
      leafQuaternion: new THREE.Quaternion(),
      leafScale: new THREE.Vector3(),
      worldMatrix: new THREE.Matrix4(),
    }),
    [],
  )

  useEffect(
    () => () => {
      data.crownGeometry.dispose()
      data.leafGeometries.forEach((geometry) => geometry.dispose())
      data.pebbleGeometries.forEach((geometry) => geometry.dispose())
      data.planterGeometry.dispose()
      data.planterSpeckGeometry.dispose()
      data.stemClusterGeometries.forEach((geometry) => geometry.dispose())
      materials.ceramic.dispose()
      materials.crown.dispose()
      materials.foot.dispose()
      materials.hardware.dispose()
      materials.leaf.forEach((material) => material.dispose())
      materials.pebble.forEach((material) => material.dispose())
      materials.selection.dispose()
      materials.soil.dispose()
      materials.speck.dispose()
      materials.stem.dispose()
    },
    [data, materials],
  )

  useLayoutEffect(() => {
    clusterRefs.current.forEach((cluster, index) => {
      if (!cluster) return
      cluster.updateMatrix()
      scratch.clusterMatrices[index].copy(cluster.matrix)
    })
    data.leaves.forEach((leaf) => {
      const mesh = leafMeshRefs.current[leaf.variant]
      if (!mesh) return
      scratch.leafScale.set(leaf.width * (leaf.young ? 0.62 : 1), leaf.length, leaf.width)
      scratch.leafMatrix.compose(leaf.basePosition, leaf.baseQuaternion, scratch.leafScale)
      scratch.worldMatrix.multiplyMatrices(scratch.clusterMatrices[leaf.cluster], scratch.leafMatrix)
      mesh.setMatrixAt(leaf.instanceIndex, scratch.worldMatrix)
    })
    leafMeshRefs.current.forEach((mesh) => {
      if (!mesh) return
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    })
  }, [data, scratch])

  useEffect(() => {
    const motion = motionRef.current
    motion.active = effectRun > 0
    motion.elapsed = 0
    motion.preset = effectPreset

    if (reactionRef.current) {
      reactionRef.current.position.set(0, 0, 0)
      reactionRef.current.rotation.set(0, 0, 0)
    }
    if (canopyRef.current) {
      canopyRef.current.position.set(0, 0, 0)
      canopyRef.current.rotation.set(0, 0, 0)
    }
    clusterRefs.current.forEach((cluster) => {
      if (!cluster) return
      cluster.position.set(0, 0, 0)
      cluster.rotation.set(0, 0, 0)
    })
    materials.leaf.forEach((material, index) => {
      material.color.copy(LEAF_COLORS[index])
      material.emissive.copy(LEAF_EMISSIVE)
      material.emissiveIntensity = 0
    })
  }, [effectPreset, effectRun, materials])

  useFrame((_, delta) => {
    const reaction = reactionRef.current
    const canopy = canopyRef.current
    const motion = motionRef.current
    if (!reaction || !canopy) return

    reaction.position.set(0, 0, 0)
    reaction.rotation.set(0, 0, 0)
    canopy.position.set(0, 0, 0)
    canopy.rotation.set(0, 0, 0)
    clusterRefs.current.forEach((cluster) => {
      if (!cluster) return
      cluster.position.set(0, 0, 0)
      cluster.rotation.set(0, 0, 0)
    })
    materials.leaf.forEach((material, index) => {
      material.color.copy(LEAF_COLORS[index])
      material.emissive.copy(LEAF_EMISSIVE)
      material.emissiveIntensity = 0
    })

    if (motion.active && motion.preset) {
      motion.elapsed += Math.min(delta, 0.05)
      const time = motion.elapsed
      const amount = reducedMotion ? 0.26 : 1

      if (motion.preset === 'paper-drop') {
        if (time >= 0.72) motion.active = false
        else {
          const wind = pulse(time, 0.09, 0.29, 0.38)
          const wake = Math.exp(-4.5 * time) * Math.sin(time * 18)
          reaction.position.x = 0.003 * amount * wind
          canopy.rotation.z = -0.028 * amount * wind + 0.007 * amount * wake
          canopy.rotation.x = 0.012 * amount * wind
          clusterRefs.current.forEach((cluster, index) => {
            if (!cluster) return
            const delay = 0.72 + index * 0.09
            cluster.rotation.z = -0.045 * amount * wind * delay
            cluster.rotation.y = 0.009 * amount * wake * (index % 2 === 0 ? 1 : -1)
          })
        }
      } else if (motion.preset === 'approve') {
        if (time >= 0.82) motion.active = false
        else {
          const contact = pulse(time, 0.075, 0.15, 0.22)
          const settle = time > 0.12 ? Math.exp(-(time - 0.12) * 6.5) * Math.sin((time - 0.12) * 19) : 0
          reaction.position.y = -0.0025 * amount * contact
          canopy.position.y = -0.008 * amount * contact + 0.002 * amount * settle
          canopy.rotation.z = 0.008 * amount * settle
          clusterRefs.current.forEach((cluster, index) => {
            if (!cluster) return
            cluster.rotation.z = settle * amount * 0.013 * (index < 2 ? 1 : -1)
          })
        }
      } else if (motion.preset === 'reject') {
        if (time >= 0.92) motion.active = false
        else {
          const anticipation = pulse(time, 0.06, 0.075, 0.08)
          const recoil = pulse(time - 0.09, 0.065, 0.18, 0.42)
          const settle = time > 0.24 ? Math.exp(-(time - 0.24) * 7) * Math.sin((time - 0.24) * 21) : 0
          reaction.position.z = -0.004 * amount * recoil
          canopy.rotation.x = 0.012 * amount * anticipation - 0.057 * amount * recoil + 0.01 * amount * settle
          canopy.position.z = -0.009 * amount * recoil
          clusterRefs.current.forEach((cluster, index) => {
            if (!cluster) return
            cluster.rotation.x = -0.045 * amount * recoil * (0.82 + index * 0.06)
            cluster.rotation.z = settle * amount * 0.012 * (index % 2 === 0 ? 1 : -1)
          })
        }
      } else if (motion.preset === 'fraud') {
        if (time >= 0.98) motion.active = false
        else {
          const first = pulse(time, 0.055, 0.11, 0.17)
          const second = pulse(time - 0.29, 0.045, 0.105, 0.2)
          const alarm = Math.max(first, second * 0.9)
          const shudder = Math.sin(time * 48) * alarm
          reaction.position.x = 0.0032 * amount * shudder
          reaction.rotation.y = 0.006 * amount * shudder
          canopy.rotation.z = 0.031 * amount * shudder
          canopy.position.y = 0.006 * amount * alarm
          clusterRefs.current.forEach((cluster, index) => {
            if (!cluster) return
            cluster.rotation.z = shudder * amount * 0.038 * (index % 2 === 0 ? 1 : -1)
            cluster.rotation.x = alarm * amount * 0.018 * (index < 2 ? -1 : 1)
          })
          materials.leaf.forEach((material, index) => {
            material.color.copy(LEAF_COLORS[index]).lerp(FRAUD_TINT, alarm * 0.42)
            material.emissive.copy(FRAUD_TINT)
            material.emissiveIntensity = alarm * 0.22
          })
        }
      } else if (motion.preset === 'printer-jam') {
        if (time >= 1.02) motion.active = false
        else {
          const envelope = smoothStep(time / 0.08) * (1 - smoothStep((time - 0.76) / 0.19))
          const vibration = Math.sin(time * 78)
          const offbeat = Math.sin(time * 53 + 0.7)
          reaction.position.x = 0.0018 * amount * envelope * vibration
          reaction.position.z = 0.0012 * amount * envelope * offbeat
          canopy.rotation.z = 0.015 * amount * envelope * vibration
          canopy.rotation.x = 0.009 * amount * envelope * offbeat
          clusterRefs.current.forEach((cluster, index) => {
            if (!cluster) return
            cluster.rotation.z =
              envelope * amount * 0.027 * Math.sin(time * (66 + index * 3) + index * 0.8)
            cluster.rotation.x =
              envelope * amount * 0.018 * Math.sin(time * 51 + index * 1.4)
          })
        }
      } else if (motion.preset === 'migration') {
        if (time >= 1.52) motion.active = false
        else {
          const arrive = smootherStep(time / 0.5)
          const depart = 1 - smootherStep((time - 1.19) / 0.28)
          const unfurl = arrive * depart
          canopy.position.y = unfurl * (reducedMotion ? 0.008 : 0.026)
          canopy.rotation.z = unfurl * (reducedMotion ? 0.002 : 0.009)
          clusterRefs.current.forEach((cluster, index) => {
            if (!cluster) return
            cluster.position.y = unfurl * (reducedMotion ? 0.0015 : 0.005 + index * 0.0006)
            cluster.rotation.z = unfurl * 0.008 * amount * (index % 2 === 0 ? -1 : 1)
          })
          materials.leaf.forEach((material, index) => {
            material.color.copy(LEAF_COLORS[index]).lerp(MIGRATION_TINT, unfurl * 0.3)
            material.emissive.copy(MIGRATION_TINT)
            material.emissiveIntensity = unfurl * 0.08
          })
        }
      }
    }

    clusterRefs.current.forEach((cluster, index) => {
      if (!cluster) return
      cluster.updateMatrix()
      scratch.clusterMatrices[index].copy(cluster.matrix)
    })

    const time = motion.elapsed
    const amount = reducedMotion ? 0.26 : 1
    const activePreset = motion.active ? motion.preset : undefined
    data.leaves.forEach((leaf) => {
      const mesh = leafMeshRefs.current[leaf.variant]
      if (!mesh) return
      let pitch = 0
      let yaw = 0
      let roll = 0
      let widthFactor = leaf.young ? 0.62 : 1
      let lengthFactor = 1

      if (activePreset === 'paper-drop') {
        const wind = pulse(time - (leaf.cluster % 2) * 0.018, 0.08, 0.27, 0.39)
        pitch = wind * amount * (0.075 + Math.sin(leaf.phase) * 0.018)
        yaw = wind * amount * 0.045 * Math.sin(time * 19 + leaf.phase)
        roll = wind * amount * 0.09 * Math.sin(time * 22 + leaf.phase * 1.4)
      } else if (activePreset === 'approve') {
        const settle = time > 0.1 ? Math.exp(-(time - 0.1) * 6.2) * Math.sin((time - 0.1) * 20 + leaf.phase) : 0
        pitch = settle * amount * 0.035
        roll = settle * amount * 0.018
      } else if (activePreset === 'reject') {
        const recoil = pulse(time - 0.08, 0.06, 0.18, 0.43)
        pitch = -recoil * amount * (0.09 + (leaf.cluster % 2) * 0.018)
        roll = recoil * amount * 0.055 * Math.sin(leaf.phase)
      } else if (activePreset === 'fraud') {
        const first = pulse(time, 0.05, 0.11, 0.18)
        const second = pulse(time - 0.29, 0.045, 0.105, 0.2)
        const alarm = Math.max(first, second * 0.9)
        pitch = alarm * amount * 0.045 * Math.sin(time * 47 + leaf.phase)
        roll = alarm * amount * 0.075 * Math.sin(time * 55 + leaf.phase * 1.3)
      } else if (activePreset === 'printer-jam') {
        const envelope = smoothStep(time / 0.08) * (1 - smoothStep((time - 0.76) / 0.19))
        pitch = envelope * amount * 0.038 * Math.sin(time * 71 + leaf.phase)
        yaw = envelope * amount * 0.026 * Math.sin(time * 61 + leaf.phase * 0.8)
        roll = envelope * amount * 0.055 * Math.sin(time * 83 + leaf.phase * 1.7)
      } else if (activePreset === 'migration') {
        const unfurl = smootherStep(time / 0.5) * (1 - smootherStep((time - 1.19) / 0.28))
        pitch = unfurl * (leaf.young ? -0.085 : -0.018) * amount
        roll = unfurl * (leaf.young ? -0.12 * Math.sin(leaf.phase) : 0.012 * Math.sin(leaf.phase)) * amount
        widthFactor = leaf.young ? 0.62 + unfurl * 0.38 : 1 + unfurl * 0.018
        lengthFactor = leaf.young ? 1 + unfurl * 0.045 : 1 + unfurl * 0.008
      }

      scratch.flutterEuler.set(pitch, yaw, roll, 'XYZ')
      scratch.flutterQuaternion.setFromEuler(scratch.flutterEuler)
      scratch.leafQuaternion.copy(leaf.baseQuaternion).multiply(scratch.flutterQuaternion)
      scratch.leafScale.set(leaf.width * widthFactor, leaf.length * lengthFactor, leaf.width)
      scratch.leafMatrix.compose(leaf.basePosition, scratch.leafQuaternion, scratch.leafScale)
      scratch.worldMatrix.multiplyMatrices(scratch.clusterMatrices[leaf.cluster], scratch.leafMatrix)
      mesh.setMatrixAt(leaf.instanceIndex, scratch.worldMatrix)
    })
    leafMeshRefs.current.forEach((mesh) => {
      if (mesh) mesh.instanceMatrix.needsUpdate = true
    })
  })

  return (
    <group {...groupProps}>
      <group ref={reactionRef}>
        <mesh geometry={data.planterGeometry} material={materials.ceramic} castShadow receiveShadow />
        <mesh geometry={data.planterSpeckGeometry} material={materials.speck} castShadow />

        <mesh position={[0, 0.028, 0]} material={materials.foot} castShadow receiveShadow>
          <cylinderGeometry args={[0.144, 0.154, 0.056, 48, 1]} />
        </mesh>
        <mesh position={[0, 0.0555, 0]} rotation={[HALF_PI, 0, 0]} material={materials.hardware} castShadow>
          <torusGeometry args={[0.148, 0.004, 10, 48]} />
        </mesh>
        <mesh position={[0, 0.404, 0]} material={materials.soil} receiveShadow>
          <cylinderGeometry args={[0.18, 0.178, 0.018, 48]} />
        </mesh>
        {data.pebbleGeometries.map((geometry, index) => (
          <mesh
            key={index}
            geometry={geometry}
            material={materials.pebble[index]}
            castShadow
            receiveShadow
          />
        ))}

        <group ref={canopyRef}>
          <mesh geometry={data.crownGeometry} material={materials.crown} castShadow receiveShadow />
          {data.stemClusterGeometries.map((geometry, index) => (
            <group
              key={index}
              ref={(node) => {
                clusterRefs.current[index] = node
              }}
            >
              <mesh geometry={geometry} material={materials.stem} castShadow receiveShadow />
            </group>
          ))}
          {data.leafGeometries.map((geometry, index) => (
            <instancedMesh
              key={index}
              ref={(node) => {
                leafMeshRefs.current[index] = node
              }}
              args={[geometry, materials.leaf[index], data.leafCounts[index]]}
              castShadow
              receiveShadow
              frustumCulled={false}
            />
          ))}
        </group>

        <mesh position={[0, 0.68, 0]}>
          <cylinderGeometry args={[0.45, 0.24, 1.36, 16, 1, true]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>

        {selected ? (
          <mesh position={[0, 0.012, 0]} rotation={[HALF_PI, 0, 0]} material={materials.selection}>
            <torusGeometry args={[0.235, 0.004, 10, 64]} />
          </mesh>
        ) : null}
      </group>
    </group>
  )
}
