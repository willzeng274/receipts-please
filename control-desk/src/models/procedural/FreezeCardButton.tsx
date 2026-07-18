import { Instance, Instances, RoundedBox, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Group, Mesh, MeshStandardMaterial } from 'three'
import modelFont from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff?url'
import { useLabStore } from '../../store/useLabStore'
import type { ProceduralAssetProps } from '../types'

const COVER_OPEN_ANGLE = -1.26
const BUTTON_PRESS_TRAVEL = -0.012
const BUTTON_EMISSIVE_IDLE = 0.22
const BUTTON_CAP_EMISSIVE_IDLE = 0.3
const LAMP_EMISSIVE_IDLE = 0.18
const STATUS_EMISSIVE_IDLE = 0.12
const LAMP_EMISSIVE_SELECTED = 0.48
const STATUS_EMISSIVE_SELECTED = 0.32
const FROZEN_BUTTON_EMISSIVE = 0.82
const FROZEN_CAP_EMISSIVE = 0.96
const FROZEN_LAMP_EMISSIVE = 1.35
const FROZEN_STATUS_EMISSIVE = 2.25
const SERVICE_LABEL_FACE_Z = 0.1158
const PANEL_INSTRUCTION_FACE_Y = 0.0246
const PANEL_STATUS_FACE_Y = 0.0266
const GUARD_LABEL_FACE_Z = 0.1553

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const segment = (time: number, start: number, end: number) =>
  clamp01((time - start) / (end - start))
const easeOutCubic = (value: number) => 1 - (1 - value) ** 3
const easeInOutCubic = (value: number) =>
  value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2
const sinePulse = (value: number) => Math.sin(clamp01(value) * Math.PI)

const effectDuration = (preset: ProceduralAssetProps['effectPreset']) => {
  switch (preset) {
    case 'paper-drop':
      return 0.76
    case 'approve':
      return 1.1
    case 'reject':
      return 1.24
    case 'fraud':
      return 2.48
    case 'printer-jam':
      return 1.38
    case 'migration':
      return 1.84
    default:
      return 0
  }
}

/**
 * A 31 cm industrial guarded control for the desk's card-freeze action.
 * Its base rests on y=0 and the operator-facing label is oriented toward +z.
 */
export function FreezeCardButton({
  effectPreset,
  effectRun = 0,
  selected = false,
  ...groupProps
}: ProceduralAssetProps) {
  const chassisRef = useRef<Group>(null)
  const coverRef = useRef<Group>(null)
  const buttonRef = useRef<Group>(null)
  const pulseRef = useRef<Mesh>(null)
  const buttonMaterialRef = useRef<MeshStandardMaterial>(null)
  const buttonCapMaterialRef = useRef<MeshStandardMaterial>(null)
  const lampMaterialRef = useRef<MeshStandardMaterial>(null)
  const statusMaterialRef = useRef<MeshStandardMaterial>(null)
  const pulseMaterialRef = useRef<MeshStandardMaterial>(null)
  const playheadRef = useRef(-1)
  const presetRef = useRef<ProceduralAssetProps['effectPreset']>(effectPreset)
  const selectedRef = useRef(selected)
  const coverOpenRef = useRef(false)
  const coverAngleRef = useRef(0)
  const frozenRef = useRef(false)
  const effectFrozenRef = useRef(false)
  const manualPressRef = useRef(-1)
  const [frozen, setFrozen] = useState(false)
  const [effectFrozen, setEffectFrozen] = useState(false)
  const reducedMotion = useLabStore((state) => state.reducedMotion)
  selectedRef.current = selected

  const restoreIdleMaterials = useCallback(() => {
    const isFrozen = frozenRef.current
    if (buttonMaterialRef.current) {
      buttonMaterialRef.current.emissiveIntensity = isFrozen
        ? FROZEN_BUTTON_EMISSIVE
        : BUTTON_EMISSIVE_IDLE
    }
    if (buttonCapMaterialRef.current) {
      buttonCapMaterialRef.current.emissiveIntensity = isFrozen
        ? FROZEN_CAP_EMISSIVE
        : BUTTON_CAP_EMISSIVE_IDLE
    }
    if (lampMaterialRef.current) {
      lampMaterialRef.current.emissiveIntensity = isFrozen
        ? FROZEN_LAMP_EMISSIVE
        : selectedRef.current
          ? LAMP_EMISSIVE_SELECTED
          : LAMP_EMISSIVE_IDLE
    }
    if (statusMaterialRef.current) {
      statusMaterialRef.current.color.set(isFrozen ? '#8f271d' : '#4e7469')
      statusMaterialRef.current.emissive.set(isFrozen ? '#ff311d' : '#77d8b4')
      statusMaterialRef.current.emissiveIntensity = isFrozen
        ? FROZEN_STATUS_EMISSIVE
        : selectedRef.current
          ? STATUS_EMISSIVE_SELECTED
          : STATUS_EMISSIVE_IDLE
    }
  }, [])

  const resetAssembly = useCallback(() => {
    if (chassisRef.current) {
      chassisRef.current.position.set(0, 0, 0)
      chassisRef.current.rotation.set(0, 0, 0)
    }
    const restoredCoverAngle = coverOpenRef.current ? COVER_OPEN_ANGLE : 0
    coverAngleRef.current = restoredCoverAngle
    if (coverRef.current) coverRef.current.rotation.x = restoredCoverAngle
    if (buttonRef.current) buttonRef.current.position.y = 0
    manualPressRef.current = -1
    if (pulseRef.current) {
      pulseRef.current.visible = false
      pulseRef.current.scale.setScalar(1)
    }
    if (pulseMaterialRef.current) pulseMaterialRef.current.opacity = 0
    restoreIdleMaterials()
  }, [restoreIdleMaterials])

  useEffect(() => {
    presetRef.current = effectPreset
    effectFrozenRef.current = false
    setEffectFrozen(false)
    resetAssembly()
    playheadRef.current = effectPreset && effectRun > 0 ? 0 : -1
  }, [effectPreset, effectRun, resetAssembly])

  useEffect(() => {
    if (playheadRef.current < 0 && manualPressRef.current < 0) restoreIdleMaterials()
  }, [frozen, restoreIdleMaterials, selected])

  useEffect(
    () => () => {
      document.body.style.cursor = ''
    },
    [],
  )

  const setPointerCursor = useCallback((active: boolean) => {
    document.body.style.cursor = active ? 'pointer' : ''
  }, [])

  const handleCoverClick = useCallback((event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    coverOpenRef.current = !coverOpenRef.current
  }, [])

  const handleButtonClick = useCallback((event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    const guardIsExposed = coverAngleRef.current <= COVER_OPEN_ANGLE * 0.82
    if (!guardIsExposed || playheadRef.current >= 0) return

    frozenRef.current = true
    setFrozen(true)
    manualPressRef.current = 0
  }, [])

  useFrame((_state, delta) => {
    const preset = presetRef.current
    if (playheadRef.current < 0 || !preset) {
      const targetCoverAngle = coverOpenRef.current ? COVER_OPEN_ANGLE : 0
      const coverDamping = reducedMotion ? 30 : 12
      coverAngleRef.current +=
        (targetCoverAngle - coverAngleRef.current) * (1 - Math.exp(-coverDamping * delta))
      if (Math.abs(targetCoverAngle - coverAngleRef.current) < 0.0002) {
        coverAngleRef.current = targetCoverAngle
      }
      if (coverRef.current) coverRef.current.rotation.x = coverAngleRef.current

      if (manualPressRef.current < 0) return

      const pressDuration = reducedMotion ? 0.28 : 0.52
      const pressTime = Math.min(pressDuration, manualPressRef.current + Math.min(delta, 0.05))
      const pressProgress = pressTime / pressDuration
      manualPressRef.current = pressTime
      const downProgress = easeOutCubic(segment(pressProgress, 0, 0.34))
      const releaseProgress = easeInOutCubic(segment(pressProgress, 0.42, 0.84))
      const pressEnvelope = downProgress * (1 - releaseProgress)
      const activationFlash = (1 - pressProgress) ** 2

      if (buttonRef.current) {
        buttonRef.current.position.y = BUTTON_PRESS_TRAVEL * pressEnvelope
      }
      if (buttonMaterialRef.current) {
        buttonMaterialRef.current.emissiveIntensity =
          FROZEN_BUTTON_EMISSIVE + activationFlash * 3.2
      }
      if (buttonCapMaterialRef.current) {
        buttonCapMaterialRef.current.emissiveIntensity =
          FROZEN_CAP_EMISSIVE + activationFlash * 3.8
      }
      if (lampMaterialRef.current) {
        lampMaterialRef.current.emissiveIntensity =
          FROZEN_LAMP_EMISSIVE + activationFlash * 4.4
      }
      if (statusMaterialRef.current) {
        statusMaterialRef.current.emissiveIntensity =
          FROZEN_STATUS_EMISSIVE + sinePulse(pressProgress) * 2.2
      }
      if (pulseRef.current && pulseMaterialRef.current) {
        const pulseProgress = segment(pressProgress, 0.12, 1)
        pulseRef.current.visible = pulseProgress < 1
        pulseRef.current.scale.setScalar(
          reducedMotion ? 1.1 : 1 + easeOutCubic(pulseProgress) * 1.2,
        )
        pulseMaterialRef.current.opacity = (1 - pulseProgress) ** 2 * 0.78
      }

      if (pressTime >= pressDuration) {
        if (buttonRef.current) buttonRef.current.position.y = 0
        if (pulseRef.current) {
          pulseRef.current.visible = false
          pulseRef.current.scale.setScalar(1)
        }
        if (pulseMaterialRef.current) pulseMaterialRef.current.opacity = 0
        manualPressRef.current = -1
        restoreIdleMaterials()
      }
      return
    }

    const duration = effectDuration(preset)
    const time = Math.min(
      duration,
      playheadRef.current + Math.min(delta, 0.05),
    )
    playheadRef.current = time

    let coverAngle = 0
    let buttonTravel = 0
    let chassisY = 0
    let chassisRotationX = 0
    let chassisRotationZ = 0
    let buttonGlow = BUTTON_EMISSIVE_IDLE
    let capGlow = BUTTON_CAP_EMISSIVE_IDLE
    let lampGlow = selectedRef.current ? LAMP_EMISSIVE_SELECTED : LAMP_EMISSIVE_IDLE
    let statusGlow = selectedRef.current ? STATUS_EMISSIVE_SELECTED : STATUS_EMISSIVE_IDLE
    let pulseProgress = 1
    let pulseOpacity = 0

    switch (preset) {
      case 'paper-drop': {
        const progress = segment(time, 0.04, 0.72)
        const envelope = (1 - progress) ** 2
        const response = Math.abs(Math.sin(progress * Math.PI * 2.5)) * envelope
        coverAngle = -0.035 * response
        statusGlow += 0.9 * sinePulse(segment(time, 0.08, 0.48))
        break
      }
      case 'approve': {
        const acknowledgement = sinePulse(segment(time, 0.08, 0.96))
        coverAngle = -0.16 * acknowledgement
        buttonTravel = 0.0022 * sinePulse(segment(time, 0.24, 0.82))
        statusGlow += 2.5 * acknowledgement
        break
      }
      case 'reject': {
        const open = easeOutCubic(segment(time, 0.04, 0.3))
        const close = easeInOutCubic(segment(time, 0.72, 1.14))
        coverAngle = -0.43 * open * (1 - close)
        const blockedPress = sinePulse(segment(time, 0.38, 0.72))
        buttonTravel = -0.0032 * blockedPress
        const warning = Math.abs(Math.sin(segment(time, 0.27, 0.95) * Math.PI * 2))
        lampGlow += 3.2 * warning
        chassisRotationZ =
          Math.sin(segment(time, 0.5, 1.08) * Math.PI * 3) *
          (1 - segment(time, 0.5, 1.08)) *
          (reducedMotion ? 0.002 : 0.007)
        break
      }
      case 'fraud': {
        const openProgress = easeOutCubic(segment(time, 0.05, 0.51))
        const closeProgress = easeInOutCubic(segment(time, 1.72, 2.38))
        const openingOvershoot = -0.075 * sinePulse(segment(time, 0.05, 0.51))
        coverAngle = (COVER_OPEN_ANGLE * openProgress + openingOvershoot) * (1 - closeProgress)

        if (time >= 0.34 && time < 0.55) {
          buttonTravel = easeOutCubic(segment(time, 0.34, 0.55)) * 0.006
        } else if (time >= 0.55 && time < 0.64) {
          buttonTravel = 0.006
        } else if (time >= 0.64 && time < 0.75) {
          buttonTravel = 0.006 - easeInOutCubic(segment(time, 0.64, 0.75)) * 0.014
        } else if (time >= 0.75 && time < 1.04) {
          const settle = segment(time, 0.75, 1.04)
          buttonTravel = -0.006 - Math.exp(-5.5 * settle) * Math.cos(settle * Math.PI * 3) * 0.002
        } else if (time >= 1.04 && time < 1.58) {
          buttonTravel = -0.006
        } else if (time >= 1.58 && time < 1.86) {
          buttonTravel = -0.006 * (1 - easeInOutCubic(segment(time, 1.58, 1.86)))
        }

        const armed = easeOutCubic(segment(time, 0.31, 0.56)) * (1 - segment(time, 1.55, 2.08))
        const impactDecay = time >= 0.75 ? Math.exp(-4.6 * segment(time, 0.75, 1.7)) : 0
        buttonGlow += armed * 2.7 + impactDecay * 2.8
        capGlow += armed * 3.1 + impactDecay * 3.2
        lampGlow += armed * 3.8 + impactDecay * 4.6
        statusGlow = STATUS_EMISSIVE_IDLE * (1 - segment(time, 0.45, 0.72))

        if (time >= 0.75 && !effectFrozenRef.current) {
          effectFrozenRef.current = true
          setEffectFrozen(true)
          if (statusMaterialRef.current) {
            statusMaterialRef.current.color.set('#8f271d')
            statusMaterialRef.current.emissive.set('#ff311d')
          }
        }

        if (time >= 0.75 && time < 1.34) {
          const impactTime = segment(time, 0.75, 1.34)
          const impactWave = Math.exp(-6.5 * impactTime) * Math.sin(impactTime * Math.PI * 5)
          const motionScale = reducedMotion ? 0.22 : 1
          chassisRotationX = Math.abs(impactWave) * 0.012 * motionScale
          chassisRotationZ = impactWave * 0.018 * motionScale
        }

        pulseProgress = segment(time, 0.75, 1.7)
        if (time >= 0.75 && pulseProgress < 1) {
          pulseOpacity = (1 - pulseProgress) ** 2 * 0.72
        }
        break
      }
      case 'printer-jam': {
        const progress = segment(time, 0.04, 1.32)
        const envelope = (1 - progress) ** 1.6
        const rattle = Math.sin(progress * Math.PI * 11) * envelope
        const motionScale = reducedMotion ? 0.24 : 1
        coverAngle = -Math.abs(rattle) * 0.06 * motionScale
        chassisRotationX = Math.abs(rattle) * 0.005 * motionScale
        chassisRotationZ = rattle * 0.011 * motionScale
        lampGlow += Math.abs(Math.sin(progress * Math.PI * 6)) * 3.4
        break
      }
      case 'migration': {
        const open = easeInOutCubic(segment(time, 0.08, 0.52))
        const close = easeInOutCubic(segment(time, 1.12, 1.72))
        coverAngle = -0.5 * open * (1 - close)
        const actuatorTest = sinePulse(segment(time, 0.38, 1.28))
        buttonTravel = 0.004 * actuatorTest
        statusGlow += 3.1 * sinePulse(segment(time, 0.18, 1.64))
        buttonGlow += 0.65 * actuatorTest
        capGlow += 0.72 * actuatorTest
        break
      }
    }

    // Rock about the feet without sending any contact point through the desk.
    chassisY =
      Math.abs(Math.sin(chassisRotationX)) * 0.093 +
      Math.abs(Math.sin(chassisRotationZ)) * 0.138

    coverAngleRef.current = coverAngle
    if (coverRef.current) coverRef.current.rotation.x = coverAngle
    if (buttonRef.current) buttonRef.current.position.y = buttonTravel
    if (chassisRef.current) {
      chassisRef.current.position.set(0, chassisY, 0)
      chassisRef.current.rotation.set(chassisRotationX, 0, chassisRotationZ)
    }
    if (buttonMaterialRef.current) buttonMaterialRef.current.emissiveIntensity = buttonGlow
    if (buttonCapMaterialRef.current) buttonCapMaterialRef.current.emissiveIntensity = capGlow
    if (lampMaterialRef.current) lampMaterialRef.current.emissiveIntensity = lampGlow
    if (statusMaterialRef.current) statusMaterialRef.current.emissiveIntensity = statusGlow

    if (pulseRef.current && pulseMaterialRef.current) {
      const pulseIsActive = pulseOpacity > 0
      pulseRef.current.visible = pulseIsActive
      pulseRef.current.scale.setScalar(
        pulseIsActive ? 1 + easeOutCubic(pulseProgress) * 1.35 : 1,
      )
      pulseMaterialRef.current.opacity = pulseOpacity
    }

    if (time >= duration) {
      effectFrozenRef.current = false
      setEffectFrozen(false)
      resetAssembly()
      playheadRef.current = -1
    }
  })

  return (
    <group {...groupProps}>
      <group ref={chassisRef}>
        {/* Rubber isolation feet establish a clean y=0 contact plane. */}
        <Instances limit={4} range={4} castShadow receiveShadow>
          <cylinderGeometry args={[0.016, 0.018, 0.008, 20]} />
          <meshStandardMaterial color="#151718" roughness={0.88} metalness={0.04} />
          <Instance position={[-0.12, 0.004, -0.075]} />
          <Instance position={[0.12, 0.004, -0.075]} />
          <Instance position={[-0.12, 0.004, 0.075]} />
          <Instance position={[0.12, 0.004, 0.075]} />
        </Instances>

        <RoundedBox
          args={[0.31, 0.07, 0.22]}
          radius={0.012}
          smoothness={5}
          position={[0, 0.043, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#282c2e" roughness={0.36} metalness={0.66} />
        </RoundedBox>

        <RoundedBox
          args={[0.292, 0.014, 0.202]}
          radius={0.006}
          smoothness={4}
          position={[0, 0.014, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#111415" roughness={0.64} metalness={0.22} />
        </RoundedBox>

        {/* Front service label, gasket line, and tamper-resistant fasteners. */}
        <RoundedBox
          args={[0.232, 0.04, 0.006]}
          radius={0.004}
          smoothness={4}
          position={[0, 0.047, 0.1105]}
          castShadow
        >
          <meshStandardMaterial color="#b8b39f" roughness={0.5} metalness={0.3} />
        </RoundedBox>
        <mesh position={[0, 0.047, 0.114]} castShadow>
          <boxGeometry args={[0.208, 0.003, 0.0012]} />
          <meshStandardMaterial color="#a91d16" roughness={0.38} metalness={0.42} />
        </mesh>
        <Text
          font={modelFont}
          fontSize={0.016}
          letterSpacing={0.085}
          color="#202426"
          anchorX="center"
          anchorY="middle"
          position={[0, 0.052, SERVICE_LABEL_FACE_Z]}
        >
          CARD FREEZE
        </Text>
        <Text
          font={modelFont}
          fontSize={0.007}
          letterSpacing={0.14}
          color="#4b4b43"
          anchorX="center"
          anchorY="middle"
          position={[0, 0.036, SERVICE_LABEL_FACE_Z]}
        >
          CONTROL  FC-04
        </Text>

        <Instances limit={4} range={4} castShadow>
          <cylinderGeometry args={[0.0034, 0.0034, 0.0024, 16]} />
          <meshStandardMaterial color="#686d6e" roughness={0.24} metalness={0.92} />
          <Instance position={[-0.105, 0.0605, 0.114]} rotation={[Math.PI / 2, 0, 0]} />
          <Instance position={[0.105, 0.0605, 0.114]} rotation={[Math.PI / 2, 0, 0]} />
          <Instance position={[-0.105, 0.0335, 0.114]} rotation={[Math.PI / 2, 0, 0]} />
          <Instance position={[0.105, 0.0335, 0.114]} rotation={[Math.PI / 2, 0, 0]} />
        </Instances>

        {/* Raked operator panel; all mechanisms share its local face normal. */}
        <group position={[0, 0.092, -0.006]} rotation={[0.18, 0, 0]}>
          <RoundedBox
            args={[0.282, 0.028, 0.184]}
            radius={0.009}
            smoothness={5}
            position={[0, 0, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#131719" roughness={0.45} metalness={0.76} />
          </RoundedBox>
          <RoundedBox
            args={[0.268, 0.018, 0.17]}
            radius={0.006}
            smoothness={4}
            position={[0, 0.014, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#34393b" roughness={0.31} metalness={0.76} />
          </RoundedBox>

          <Instances limit={4} range={4} castShadow>
            <cylinderGeometry args={[0.0036, 0.0036, 0.0026, 16]} />
            <meshStandardMaterial color="#8b9090" roughness={0.2} metalness={0.95} />
            <Instance position={[-0.119, 0.0242, -0.068]} />
            <Instance position={[0.119, 0.0242, -0.068]} />
            <Instance position={[-0.119, 0.0242, 0.068]} />
            <Instance position={[0.119, 0.0242, 0.068]} />
          </Instances>

          <Text
            font={modelFont}
            fontSize={0.0072}
            letterSpacing={0.1}
            color="#d1aa47"
            anchorX="center"
            anchorY="middle"
            position={[0, PANEL_INSTRUCTION_FACE_Y, 0.078]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            LIFT  •  ARM  •  PRESS
          </Text>

          {/* Bonded card pictogram and independent system-ready indicator. */}
          <RoundedBox
            args={[0.018, 0.0016, 0.027]}
            radius={0.002}
            smoothness={3}
            position={[-0.121, 0.0235, 0.018]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#252b2d" roughness={0.42} metalness={0.72} />
          </RoundedBox>
          <mesh position={[-0.123, 0.0245, 0.014]} castShadow>
            <boxGeometry args={[0.006, 0.001, 0.006]} />
            <meshStandardMaterial color="#b7a15c" roughness={0.31} metalness={0.72} />
          </mesh>
          <mesh position={[0.121, 0.0248, 0.018]} castShadow>
            <cylinderGeometry args={[0.006, 0.006, 0.004, 28]} />
            <meshStandardMaterial
              ref={statusMaterialRef}
              color="#4e7469"
              emissive="#77d8b4"
              emissiveIntensity={selected ? STATUS_EMISSIVE_SELECTED : STATUS_EMISSIVE_IDLE}
              roughness={0.22}
              metalness={0.18}
            />
          </mesh>
          <mesh position={[0.121, 0.0269, 0.018]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[0.0064, 0.0012, 12, 32]} />
            <meshStandardMaterial color="#8d9393" roughness={0.24} metalness={0.9} />
          </mesh>
          <RoundedBox
            args={[0.068, 0.0024, 0.021]}
            radius={0.0025}
            smoothness={3}
            position={[0.086, 0.0242, 0.052]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={frozen || effectFrozen ? '#6f211b' : '#273634'}
              roughness={0.36}
              metalness={0.58}
            />
          </RoundedBox>
          <Text
            font={modelFont}
            fontSize={0.0084}
            letterSpacing={0.1}
            color={frozen || effectFrozen ? '#ffb19d' : '#a9e8d2'}
            anchorX="center"
            anchorY="middle"
            position={[0.086, PANEL_STATUS_FACE_Y, 0.052]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            {frozen || effectFrozen ? 'FROZEN' : 'READY'}
          </Text>

          {/* Recessed guard collar and illuminated latching mushroom actuator. */}
          <mesh position={[0, 0.027, 0.006]} castShadow receiveShadow>
            <cylinderGeometry args={[0.052, 0.056, 0.019, 56]} />
            <meshStandardMaterial color="#111416" roughness={0.34} metalness={0.82} />
          </mesh>
          <mesh position={[0, 0.038, 0.006]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[0.044, 0.005, 16, 64]} />
            <meshStandardMaterial color="#8f9495" roughness={0.23} metalness={0.94} />
          </mesh>
          <mesh ref={pulseRef} position={[0, 0.044, 0.006]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.043, 0.003, 12, 64]} />
            <meshStandardMaterial
              ref={pulseMaterialRef}
              color="#ff2a18"
              emissive="#ff1a0a"
              emissiveIntensity={5}
              roughness={0.24}
              metalness={0.08}
              transparent
              opacity={0}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[0, 0.0405, 0.006]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[0.038, 0.0042, 16, 64]} />
            <meshStandardMaterial
              ref={lampMaterialRef}
              color="#b2341f"
              emissive="#ff2915"
              emissiveIntensity={selected ? LAMP_EMISSIVE_SELECTED : LAMP_EMISSIVE_IDLE}
              roughness={0.26}
              metalness={0.22}
            />
          </mesh>

          <group
            ref={buttonRef}
            position={[0, 0, 0.006]}
            onClick={handleButtonClick}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerOver={(event) => {
              event.stopPropagation()
              setPointerCursor(true)
            }}
            onPointerOut={() => setPointerCursor(false)}
          >
            <mesh position={[0, 0.031, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.018, 0.018, 0.022, 40]} />
              <meshStandardMaterial color="#5f6667" roughness={0.22} metalness={0.9} />
            </mesh>
            <mesh position={[0, 0.048, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.034, 0.037, 0.027, 56]} />
              <meshStandardMaterial
                ref={buttonMaterialRef}
                color="#a51f18"
                emissive="#ef2818"
                emissiveIntensity={0.22}
                roughness={0.28}
                metalness={0.3}
              />
            </mesh>
            <mesh
              position={[0, 0.061, 0]}
              scale={[1, 0.38, 1]}
              castShadow
              receiveShadow
            >
              <sphereGeometry args={[0.034, 56, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial
                ref={buttonCapMaterialRef}
                color="#bb271d"
                emissive="#ff2e1b"
                emissiveIntensity={0.3}
                roughness={0.24}
                metalness={0.22}
              />
            </mesh>
            <mesh position={[0, 0.052, 0]}>
              <cylinderGeometry args={[0.046, 0.046, 0.058, 32]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
            </mesh>
          </group>

          {/* Fixed hinge leaf: two knuckles and a continuous stainless pin. */}
          <mesh position={[0, 0.035, -0.077]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.006, 0.006, 0.222, 24]} />
            <meshStandardMaterial color="#777d7e" roughness={0.2} metalness={0.96} />
          </mesh>
          <Instances limit={2} range={2} castShadow>
            <cylinderGeometry args={[0.011, 0.011, 0.052, 28]} />
            <meshStandardMaterial color="#282d2f" roughness={0.3} metalness={0.86} />
            <Instance position={[-0.077, 0.035, -0.077]} rotation={[0, 0, Math.PI / 2]} />
            <Instance position={[0.077, 0.035, -0.077]} rotation={[0, 0, Math.PI / 2]} />
          </Instances>
          <Instances limit={2} range={2} castShadow>
            <cylinderGeometry args={[0.0085, 0.0085, 0.008, 24]} />
            <meshStandardMaterial color="#8c9293" roughness={0.18} metalness={0.97} />
            <Instance position={[-0.115, 0.035, -0.077]} rotation={[0, 0, Math.PI / 2]} />
            <Instance position={[0.115, 0.035, -0.077]} rotation={[0, 0, Math.PI / 2]} />
          </Instances>
          <RoundedBox
            args={[0.04, 0.012, 0.016]}
            radius={0.003}
            smoothness={3}
            position={[0, 0.032, 0.077]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#5c6263" roughness={0.25} metalness={0.9} />
          </RoundedBox>

          {/* Transparent polycarbonate guard, authored around the rear hinge pivot. */}
          <group
            ref={coverRef}
            position={[0, 0.035, -0.077]}
            onClick={handleCoverClick}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerOver={(event) => {
              event.stopPropagation()
              setPointerCursor(true)
            }}
            onPointerOut={() => setPointerCursor(false)}
          >
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.012, 0.012, 0.078, 28]} />
              <meshStandardMaterial color="#4e5557" roughness={0.27} metalness={0.88} />
            </mesh>

            <RoundedBox
              args={[0.212, 0.008, 0.148]}
              radius={0.006}
              smoothness={4}
              position={[0, 0.084, 0.073]}
              castShadow
              receiveShadow
            >
              <meshPhysicalMaterial
                color="#b9d2d2"
                roughness={0.12}
                metalness={0.02}
                transparent
                opacity={0.28}
                clearcoat={0.8}
                clearcoatRoughness={0.12}
                depthWrite={false}
              />
            </RoundedBox>
            <Instances limit={3} range={3} castShadow receiveShadow>
              <boxGeometry args={[1, 1, 1]} />
              <meshPhysicalMaterial
                color="#a9c7c7"
                roughness={0.14}
                transparent
                opacity={0.25}
                clearcoat={0.7}
                depthWrite={false}
              />
              <Instance position={[-0.105, 0.044, 0.073]} scale={[0.008, 0.08, 0.148]} />
              <Instance position={[0.105, 0.044, 0.073]} scale={[0.008, 0.08, 0.148]} />
              <Instance position={[0, 0.044, 0.147]} scale={[0.212, 0.08, 0.008]} />
            </Instances>

            <Instances limit={4} range={4} castShadow>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#343a3c" roughness={0.3} metalness={0.84} />
              <Instance position={[0, 0.086, 0.149]} scale={[0.224, 0.009, 0.009]} />
              <Instance position={[-0.11, 0.086, 0.074]} scale={[0.009, 0.009, 0.158]} />
              <Instance position={[0.11, 0.086, 0.074]} scale={[0.009, 0.009, 0.158]} />
              <Instance position={[0, 0.007, 0.15]} scale={[0.224, 0.012, 0.013]} />
            </Instances>

            <RoundedBox
              args={[0.09, 0.018, 0.005]}
              radius={0.003}
              smoothness={3}
              position={[0, 0.041, 0.1517]}
              castShadow
            >
              <meshStandardMaterial color="#d68c1d" roughness={0.37} metalness={0.45} />
            </RoundedBox>
            <Text
              font={modelFont}
              fontSize={0.008}
              letterSpacing={0.13}
              color="#241d12"
              anchorX="center"
              anchorY="middle"
              position={[0, 0.041, GUARD_LABEL_FACE_Z]}
            >
              SAFETY GUARD
            </Text>
            <mesh position={[0, 0.049, 0.074]}>
              <boxGeometry args={[0.226, 0.098, 0.162]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}
