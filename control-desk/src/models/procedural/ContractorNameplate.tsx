import { Instance, Instances, RoundedBox } from '@react-three/drei'
import gsap from 'gsap'
import { useEffect, useMemo, useRef } from 'react'
import { CanvasTexture, LinearFilter, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three'
import type { Group, MeshPhysicalMaterial } from 'three'
import { useLabStore } from '../../store/useLabStore'
import type { ProceduralAssetProps } from '../types'

const PLAQUE_REST_ANGLE = -Math.PI / 24
const PLAQUE_REST_Y = 0.032
const PLAQUE_REST_Z = 0.006
const PLAQUE_FACE_Z = 0.0104
const PLAQUE_LABEL_COLOR = '#25231f'
const PLAQUE_LABEL_CENTER_X = 0
const PLAQUE_LABEL_CENTER_Y = 0.05
const PLAQUE_LABEL_LINE_HALF_GAP = 0.0155
const PLAQUE_TOP_LINE_Y = PLAQUE_LABEL_CENTER_Y + PLAQUE_LABEL_LINE_HALF_GAP
const PLAQUE_BOTTOM_LINE_Y = PLAQUE_LABEL_CENTER_Y - PLAQUE_LABEL_LINE_HALF_GAP

const LABEL_ATLAS_WIDTH = 512
const LABEL_ATLAS_HEIGHT = 256

const LABEL_REGIONS = {
  head: { x: 0, y: 0, width: 310, height: 60 },
  finance: { x: 0, y: 64, width: 314, height: 60 },
  fraud: { x: 0, y: 128, width: 214, height: 60 },
} as const

const GLYPHS: Record<string, readonly string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
}

type LabelRegion = (typeof LABEL_REGIONS)[keyof typeof LABEL_REGIONS]

function measureLabel(text: string) {
  const letterGap = 2
  const spaceWidth = 4

  return [...text].reduce((width, character, index) => {
    const characterWidth = character === ' ' ? spaceWidth : 5
    return width + characterWidth + (index === text.length - 1 ? 0 : letterGap)
  }, 0)
}

function drawLabel(
  context: CanvasRenderingContext2D,
  text: string,
  region: LabelRegion,
  color: string,
) {
  const letterGap = 2
  const spaceWidth = 4
  const labelWidth = measureLabel(text)
  const cellSize = Math.max(
    1,
    Math.floor(Math.min((region.width - 20) / labelWidth, (region.height - 16) / 7)),
  )
  const renderedWidth = labelWidth * cellSize
  const renderedHeight = 7 * cellSize
  let cursorX = region.x + Math.floor((region.width - renderedWidth) / 2)
  const originY = region.y + Math.floor((region.height - renderedHeight) / 2)

  context.fillStyle = color

  for (const character of text) {
    if (character === ' ') {
      cursorX += (spaceWidth + letterGap) * cellSize
      continue
    }

    const glyph = GLYPHS[character]
    if (!glyph) continue

    glyph.forEach((row, rowIndex) => {
      for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
        if (row[columnIndex] === '1') {
          context.fillRect(
            cursorX + columnIndex * cellSize,
            originY + rowIndex * cellSize,
            cellSize,
            cellSize,
          )
        }
      }
    })

    cursorX += (5 + letterGap) * cellSize
  }
}

function createLabelGeometry(width: number, height: number, region: LabelRegion) {
  const geometry = new PlaneGeometry(width, height)
  const uv = geometry.attributes.uv
  const uMin = region.x / LABEL_ATLAS_WIDTH
  const uMax = (region.x + region.width) / LABEL_ATLAS_WIDTH
  const vMin = 1 - (region.y + region.height) / LABEL_ATLAS_HEIGHT
  const vMax = 1 - region.y / LABEL_ATLAS_HEIGHT

  for (let index = 0; index < uv.count; index += 1) {
    const sourceU = uv.getX(index)
    const sourceV = uv.getY(index)
    uv.setXY(index, uMin + sourceU * (uMax - uMin), vMin + sourceV * (vMax - vMin))
  }

  uv.needsUpdate = true
  return geometry
}

function createLabelResources() {
  const canvas = document.createElement('canvas')
  canvas.width = LABEL_ATLAS_WIDTH
  canvas.height = LABEL_ATLAS_HEIGHT

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('ContractorNameplate label atlas requires a 2D canvas context.')
  }

  context.clearRect(0, 0, LABEL_ATLAS_WIDTH, LABEL_ATLAS_HEIGHT)
  drawLabel(context, 'HEAD OF', LABEL_REGIONS.head, PLAQUE_LABEL_COLOR)
  drawLabel(context, 'FINANCE', LABEL_REGIONS.finance, PLAQUE_LABEL_COLOR)
  drawLabel(context, 'FRAUD', LABEL_REGIONS.fraud, '#f2d7b8')

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.generateMipmaps = false
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.name = 'contractor-nameplate-label-atlas'

  const material = new MeshBasicMaterial({
    alphaTest: 0.18,
    map: texture,
    toneMapped: false,
    transparent: true,
  })
  material.name = 'contractor-nameplate-label-material'

  return {
    texture,
    material,
    headGeometry: createLabelGeometry(0.126, 0.0245, LABEL_REGIONS.head),
    financeGeometry: createLabelGeometry(0.136, 0.026, LABEL_REGIONS.finance),
    fraudGeometry: createLabelGeometry(0.064, 0.018, LABEL_REGIONS.fraud),
  }
}

export function ContractorNameplate({ effectPreset, effectRun = 0, selected = false, ...groupProps }: ProceduralAssetProps) {
  const reducedMotion = useLabStore((state) => state.reducedMotion)
  const labelResources = useMemo(createLabelResources, [])
  const bodyRef = useRef<Group>(null)
  const plaqueRef = useRef<Group>(null)
  const memoRef = useRef<Group>(null)
  const approveTabRef = useRef<Group>(null)
  const rejectTabRef = useRef<Group>(null)
  const fraudFinRef = useRef<Group>(null)
  const jamPacketRef = useRef<Group>(null)
  const migrationBarRef = useRef<Group>(null)
  const leftLensMaterialRef = useRef<MeshPhysicalMaterial>(null)
  const rightLensMaterialRef = useRef<MeshPhysicalMaterial>(null)
  const migrationMaterialRef = useRef<MeshPhysicalMaterial>(null)

  useEffect(
    () => () => {
      labelResources.headGeometry.dispose()
      labelResources.financeGeometry.dispose()
      labelResources.fraudGeometry.dispose()
      labelResources.material.dispose()
      labelResources.texture.dispose()
    },
    [labelResources],
  )

  useEffect(() => {
    const body = bodyRef.current
    const plaque = plaqueRef.current
    const memo = memoRef.current
    const approveTab = approveTabRef.current
    const rejectTab = rejectTabRef.current
    const fraudFin = fraudFinRef.current
    const jamPacket = jamPacketRef.current
    const migrationBar = migrationBarRef.current
    const leftLensMaterial = leftLensMaterialRef.current
    const rightLensMaterial = rightLensMaterialRef.current
    const migrationMaterial = migrationMaterialRef.current

    if (
      !body ||
      !plaque ||
      !memo ||
      !approveTab ||
      !rejectTab ||
      !fraudFin ||
      !jamPacket ||
      !migrationBar ||
      !leftLensMaterial ||
      !rightLensMaterial ||
      !migrationMaterial
    ) {
      return
    }

    gsap.set(body.position, { x: 0, y: 0, z: 0 })
    gsap.set(body.rotation, { x: 0, y: 0, z: 0 })
    gsap.set(body.scale, { x: 1, y: 1, z: 1 })
    gsap.set(plaque.position, { x: 0, y: PLAQUE_REST_Y, z: PLAQUE_REST_Z })
    gsap.set(plaque.rotation, { x: PLAQUE_REST_ANGLE, y: 0, z: 0 })

    gsap.set(memo, { visible: false })
    gsap.set(memo.position, { x: 0.112, y: 0.205, z: -0.013 })
    gsap.set(memo.rotation, { x: -0.045, y: 0, z: -0.07 })
    gsap.set(memo.scale, { x: 1, y: 1, z: 1 })

    gsap.set(approveTab, { visible: false })
    gsap.set(approveTab.position, { x: 0.168, y: 0.022, z: 0.069 })
    gsap.set(approveTab.rotation, { x: 0, y: 0, z: 0 })
    gsap.set(approveTab.scale, { x: 0.24, y: 1, z: 1 })

    gsap.set(rejectTab, { visible: false })
    gsap.set(rejectTab.position, { x: -0.168, y: 0.022, z: 0.069 })
    gsap.set(rejectTab.rotation, { x: 0, y: 0, z: 0 })
    gsap.set(rejectTab.scale, { x: 0.24, y: 1, z: 1 })

    gsap.set(fraudFin, { visible: false })
    gsap.set(fraudFin.position, { x: 0, y: 0.129, z: -0.012 })
    gsap.set(fraudFin.rotation, { x: -Math.PI / 2, y: 0, z: 0 })
    gsap.set(fraudFin.scale, { x: 1, y: 1, z: 1 })

    gsap.set(jamPacket, { visible: false })
    gsap.set(jamPacket.position, { x: 0, y: -0.035, z: 0.041 })
    gsap.set(jamPacket.rotation, { x: 0, y: 0, z: 0.05 })
    gsap.set(jamPacket.scale, { x: 0.6, y: 0.16, z: 0.6 })

    gsap.set(migrationBar, { visible: false })
    gsap.set(migrationBar.position, { x: -0.17, y: 0.017, z: 0.012 })
    gsap.set(migrationBar.scale, { x: 0.035, y: 1, z: 1 })

    leftLensMaterial.emissiveIntensity = 0.08
    rightLensMaterial.emissiveIntensity = 0.08
    migrationMaterial.emissiveIntensity = 0

    if (!effectPreset || effectRun <= 0) return

    const travel = reducedMotion ? 0.28 : 1
    const timeline = gsap.timeline({ defaults: { overwrite: true } })

    if (effectPreset === 'paper-drop') {
      memo.visible = true
      gsap.set(memo.position, { y: reducedMotion ? 0.111 : 0.205 })
      timeline
        .to(memo.position, { duration: reducedMotion ? 0.1 : 0.2, ease: 'power2.in', y: 0.083 })
        .to(memo.position, { duration: reducedMotion ? 0.06 : 0.08, ease: 'back.out(2.2)', y: 0.087 })
        .to(plaque.rotation, { duration: 0.07, ease: 'power2.out', x: PLAQUE_REST_ANGLE - 0.032 * travel }, '<')
        .to(plaque.rotation, { duration: reducedMotion ? 0.12 : 0.28, ease: 'elastic.out(1, 0.42)', x: PLAQUE_REST_ANGLE })
    }

    if (effectPreset === 'approve') {
      approveTab.visible = true
      timeline
        .to(plaque.rotation, { duration: 0.08, ease: 'power2.in', x: PLAQUE_REST_ANGLE + 0.016 * travel })
        .to(approveTab.scale, { duration: reducedMotion ? 0.1 : 0.16, ease: 'power3.out', x: 1 }, '<0.02')
        .to(approveTab.position, { duration: reducedMotion ? 0.1 : 0.18, ease: 'back.out(1.7)', x: 0.214 }, '<')
        .to(rightLensMaterial, { duration: 0.07, emissiveIntensity: 4.2 }, '<0.02')
        .to(plaque.rotation, { duration: 0.1, ease: 'power3.out', x: PLAQUE_REST_ANGLE - 0.021 * travel }, '<0.04')
        .to(plaque.rotation, { duration: reducedMotion ? 0.12 : 0.25, ease: 'elastic.out(1, 0.5)', x: PLAQUE_REST_ANGLE })
        .to(rightLensMaterial, { duration: 0.22, emissiveIntensity: 0.8 }, '<')
    }

    if (effectPreset === 'reject') {
      rejectTab.visible = true
      timeline
        .to(body.position, { duration: 0.06, ease: 'power2.in', x: 0.008 * travel })
        .to(rejectTab.scale, { duration: reducedMotion ? 0.08 : 0.11, ease: 'power4.out', x: 1 }, '<')
        .to(rejectTab.position, { duration: reducedMotion ? 0.09 : 0.12, ease: 'back.out(2.4)', x: -0.222 }, '<')
        .to(body.position, { duration: 0.07, ease: 'power4.out', x: -0.019 * travel }, '<0.03')
        .to(plaque.rotation, { duration: 0.07, ease: 'power4.out', z: 0.038 * travel }, '<')
        .to(leftLensMaterial, { duration: 0.05, emissiveIntensity: 5 }, '<')
        .to(body.position, { duration: reducedMotion ? 0.12 : 0.24, ease: 'elastic.out(1, 0.4)', x: 0 })
        .to(plaque.rotation, { duration: reducedMotion ? 0.12 : 0.23, ease: 'elastic.out(1, 0.45)', z: 0 }, '<')
        .to(leftLensMaterial, { duration: 0.2, emissiveIntensity: 0.9 }, '<')
    }

    if (effectPreset === 'fraud') {
      fraudFin.visible = true
      timeline
        .to(body.position, { duration: 0.09, ease: 'power2.in', y: 0.006 * travel })
        .to(fraudFin.rotation, { duration: reducedMotion ? 0.14 : 0.24, ease: 'back.out(1.9)', x: 0 }, '<0.02')
        .to(body.position, { duration: 0.065, ease: 'power4.out', y: -0.006 * travel }, '<0.1')
        .to(plaque.rotation, { duration: 0.065, ease: 'power4.out', x: PLAQUE_REST_ANGLE - 0.067 * travel }, '<')
        .to([leftLensMaterial, rightLensMaterial], { duration: 0.06, emissiveIntensity: 7 }, '<')
        .to([leftLensMaterial, rightLensMaterial], { duration: 0.09, emissiveIntensity: 0.15 })
        .to([leftLensMaterial, rightLensMaterial], { duration: 0.07, emissiveIntensity: 5.5 })
        .to(body.position, { duration: reducedMotion ? 0.14 : 0.34, ease: 'elastic.out(1, 0.36)', y: 0 }, '<')
        .to(plaque.rotation, { duration: reducedMotion ? 0.15 : 0.36, ease: 'elastic.out(1, 0.38)', x: PLAQUE_REST_ANGLE }, '<')
        .to([leftLensMaterial, rightLensMaterial], { duration: 0.25, emissiveIntensity: 1.1 }, '<0.08')
    }

    if (effectPreset === 'printer-jam') {
      jamPacket.visible = true
      timeline
        .to(jamPacket.scale, { duration: reducedMotion ? 0.1 : 0.17, ease: 'power3.out', x: 1, y: 1, z: 1 })
        .to(jamPacket.position, { duration: reducedMotion ? 0.13 : 0.25, ease: 'back.out(1.5)', y: 0.075 }, '<')
        .to(body.position, { duration: 0.05, ease: 'power4.out', x: -0.011 * travel, y: 0.004 * travel }, '<0.06')
        .to(body.position, { duration: 0.055, ease: 'none', x: 0.013 * travel, y: -0.003 * travel })
        .to(body.position, { duration: 0.055, ease: 'none', x: -0.009 * travel, y: 0.002 * travel })
        .to(plaque.rotation, { duration: 0.06, ease: 'power2.out', z: -0.044 * travel }, '<')
        .to(body.position, { duration: reducedMotion ? 0.12 : 0.27, ease: 'elastic.out(1, 0.35)', x: 0, y: 0 })
        .to(plaque.rotation, { duration: reducedMotion ? 0.12 : 0.29, ease: 'elastic.out(1, 0.4)', z: 0 }, '<')
    }

    if (effectPreset === 'migration') {
      approveTab.visible = true
      rejectTab.visible = true
      migrationBar.visible = true
      gsap.set(approveTab.position, { x: 0.214, y: 0.022, z: 0.069 })
      gsap.set(approveTab.scale, { x: 1, y: 1, z: 1 })
      gsap.set(rejectTab.position, { x: -0.222, y: 0.022, z: 0.069 })
      gsap.set(rejectTab.scale, { x: 1, y: 1, z: 1 })
      timeline
        .to(approveTab.position, { duration: reducedMotion ? 0.1 : 0.2, ease: 'power2.in', x: 0.166 })
        .to(rejectTab.position, { duration: reducedMotion ? 0.1 : 0.2, ease: 'power2.in', x: -0.166 }, '<')
        .set([approveTab, rejectTab], { visible: false })
        .to(plaque.position, { duration: reducedMotion ? 0.14 : 0.34, ease: 'power3.inOut', y: 0.036 }, '<')
        .to(plaque.rotation, { duration: reducedMotion ? 0.14 : 0.38, ease: 'power3.inOut', x: -0.04 }, '<')
        .to(migrationBar.position, { duration: reducedMotion ? 0.16 : 0.4, ease: 'power3.out', x: 0 }, '<0.03')
        .to(migrationBar.scale, { duration: reducedMotion ? 0.16 : 0.4, ease: 'power3.out', x: 1 }, '<')
        .to(migrationMaterial, { duration: 0.1, emissiveIntensity: 3.8 }, '<')
        .to(migrationMaterial, { duration: 0.34, ease: 'power2.out', emissiveIntensity: 1.1 })
    }

    return () => {
      timeline.kill()
    }
  }, [effectPreset, effectRun, reducedMotion])

  return (
    <group {...groupProps}>
      <group ref={bodyRef}>
        <Instances castShadow receiveShadow>
          <boxGeometry args={[0.09, 0.006, 0.05]} />
          <meshStandardMaterial color="#252420" metalness={0.02} roughness={0.98} />
          <Instance position={[-0.17, 0.003, 0]} />
          <Instance position={[0.17, 0.003, 0]} />
        </Instances>

        <RoundedBox args={[0.5, 0.028, 0.15]} castShadow position={[0, 0.02, 0]} radius={0.008} receiveShadow smoothness={6}>
          <meshPhysicalMaterial
            clearcoat={0.28}
            clearcoatRoughness={0.48}
            color="#34251c"
            emissive={selected ? '#18120d' : '#000000'}
            emissiveIntensity={selected ? 0.24 : 0}
            metalness={0.03}
            roughness={0.42}
          />
        </RoundedBox>

        <RoundedBox args={[0.456, 0.011, 0.008]} castShadow position={[0, 0.018, 0.07]} radius={0.002} smoothness={5}>
          <meshPhysicalMaterial color="#a87632" metalness={0.88} roughness={0.24} />
        </RoundedBox>

        <RoundedBox args={[0.182, 0.01, 0.006]} castShadow position={[0, 0.028, 0.071]} radius={0.002} smoothness={4}>
          <meshStandardMaterial color="#171815" metalness={0.58} roughness={0.3} />
        </RoundedBox>

        <Instances castShadow>
          <cylinderGeometry args={[0.0065, 0.0082, 0.074, 24]} />
          <meshPhysicalMaterial color="#b7863d" metalness={0.9} roughness={0.22} />
          <Instance position={[-0.217, 0.066, 0.002]} />
          <Instance position={[0.217, 0.066, 0.002]} />
        </Instances>

        <group ref={memoRef} visible={false}>
          <RoundedBox args={[0.126, 0.076, 0.002]} castShadow position={[0, 0.038, 0]} radius={0.004} smoothness={4}>
            <meshStandardMaterial color="#e8dec0" metalness={0} roughness={0.88} />
          </RoundedBox>
          <mesh position={[0, 0.047, 0.0014]}>
            <boxGeometry args={[0.084, 0.005, 0.0008]} />
            <meshStandardMaterial color="#9b6149" metalness={0} roughness={0.86} />
          </mesh>
        </group>

        <group ref={plaqueRef} position={[0, PLAQUE_REST_Y, PLAQUE_REST_Z]} rotation={[PLAQUE_REST_ANGLE, 0, 0]}>
          <RoundedBox args={[0.468, 0.1, 0.012]} castShadow position={[0, 0.05, 0]} radius={0.006} receiveShadow smoothness={6}>
            <meshPhysicalMaterial color="#ad7d39" metalness={0.9} roughness={0.2} />
          </RoundedBox>
          <RoundedBox args={[0.446, 0.078, 0.004]} castShadow position={[0, 0.05, 0.007]} radius={0.0035} receiveShadow smoothness={5}>
            <meshPhysicalMaterial clearcoat={0.18} clearcoatRoughness={0.42} color="#d8caaa" metalness={0.08} roughness={0.34} />
          </RoundedBox>

          <mesh
            geometry={labelResources.headGeometry}
            material={labelResources.material}
            position={[PLAQUE_LABEL_CENTER_X, PLAQUE_TOP_LINE_Y, PLAQUE_FACE_Z]}
          />
          <mesh
            geometry={labelResources.financeGeometry}
            material={labelResources.material}
            position={[PLAQUE_LABEL_CENTER_X, PLAQUE_BOTTOM_LINE_Y, PLAQUE_FACE_Z]}
          />

          <Instances castShadow>
            <cylinderGeometry args={[0.0042, 0.0042, 0.003, 24]} />
            <meshPhysicalMaterial color="#c59a53" metalness={0.92} roughness={0.2} />
            <Instance position={[-0.211, 0.018, 0.011]} rotation={[Math.PI / 2, 0, 0]} />
            <Instance position={[0.211, 0.018, 0.011]} rotation={[Math.PI / 2, 0, 0]} />
            <Instance position={[-0.211, 0.082, 0.011]} rotation={[Math.PI / 2, 0, 0]} />
            <Instance position={[0.211, 0.082, 0.011]} rotation={[Math.PI / 2, 0, 0]} />
          </Instances>

          <group ref={migrationBarRef} visible={false}>
            <RoundedBox args={[0.36, 0.004, 0.003]} castShadow radius={0.0015} smoothness={4}>
              <meshPhysicalMaterial
                ref={migrationMaterialRef}
                color="#5aa992"
                emissive="#55d4aa"
                emissiveIntensity={0}
                metalness={0.5}
                roughness={0.2}
              />
            </RoundedBox>
          </group>
        </group>

        <Instances castShadow>
          <cylinderGeometry args={[0.0072, 0.0078, 0.003, 24]} />
          <meshPhysicalMaterial ref={leftLensMaterialRef} color="#7e2d25" emissive="#ef3d2d" emissiveIntensity={0.08} metalness={0.1} roughness={0.22} />
          <Instance position={[-0.215, 0.043, 0.066]} rotation={[Math.PI / 2, 0, 0]} />
        </Instances>
        <Instances castShadow>
          <cylinderGeometry args={[0.0072, 0.0078, 0.003, 24]} />
          <meshPhysicalMaterial ref={rightLensMaterialRef} color="#355d45" emissive="#54d878" emissiveIntensity={0.08} metalness={0.1} roughness={0.22} />
          <Instance position={[0.215, 0.043, 0.066]} rotation={[Math.PI / 2, 0, 0]} />
        </Instances>

        <group ref={approveTabRef} visible={false}>
          <RoundedBox args={[0.078, 0.014, 0.007]} castShadow radius={0.003} smoothness={5}>
            <meshPhysicalMaterial clearcoat={0.5} clearcoatRoughness={0.2} color="#3f8254" metalness={0.18} roughness={0.3} />
          </RoundedBox>
        </group>
        <group ref={rejectTabRef} visible={false}>
          <RoundedBox args={[0.078, 0.014, 0.007]} castShadow radius={0.003} smoothness={5}>
            <meshPhysicalMaterial clearcoat={0.5} clearcoatRoughness={0.2} color="#9b3a2f" metalness={0.18} roughness={0.3} />
          </RoundedBox>
        </group>

        <group ref={fraudFinRef} visible={false}>
          <RoundedBox args={[0.162, 0.035, 0.008]} castShadow position={[0, 0.0175, 0]} radius={0.004} smoothness={5}>
            <meshPhysicalMaterial clearcoat={0.48} clearcoatRoughness={0.16} color="#8e2b26" metalness={0.26} roughness={0.24} />
          </RoundedBox>
          <mesh
            geometry={labelResources.fraudGeometry}
            material={labelResources.material}
            position={[0, 0.0175, 0.005]}
          />
        </group>

        <group ref={jamPacketRef} visible={false}>
          <Instances castShadow>
            <boxGeometry args={[0.108, 0.002, 0.15]} />
            <meshStandardMaterial color="#e6dbc1" metalness={0} roughness={0.86} />
            <Instance position={[-0.105, 0, 0]} rotation={[1.16, 0.08, -0.15]} />
            <Instance position={[0.01, 0.018, 0]} rotation={[1.28, -0.04, 0.07]} />
            <Instance position={[0.115, -0.006, -0.006]} rotation={[1.08, 0.05, 0.18]} />
          </Instances>
        </group>
      </group>
    </group>
  )
}
