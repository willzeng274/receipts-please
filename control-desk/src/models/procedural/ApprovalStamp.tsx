import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useLabStore } from "../../store/useLabStore";
import type { ProceduralAssetProps } from "../types";

type StampEffect = NonNullable<ProceduralAssetProps["effectPreset"]>;

const EFFECT_DURATIONS: Record<StampEffect, number> = {
  "paper-drop": 0.46,
  approve: 0.72,
  reject: 0.58,
  fraud: 0.98,
  "printer-jam": 0.86,
  migration: 1.14,
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const easeInCubic = (value: number) => {
  const t = clamp01(value);
  return t * t * t;
};
const easeOutCubic = (value: number) => {
  const t = 1 - clamp01(value);
  return 1 - t * t * t;
};

const easeOutBack = (value: number) => {
  const t = clamp01(value) - 1;
  const overshoot = 1.35;
  return 1 + (overshoot + 1) * t * t * t + overshoot * t * t;
};

function resolveStampEffect(
  preset: ProceduralAssetProps["effectPreset"],
): StampEffect {
  switch (preset) {
    case "paper-drop":
    case "approve":
    case "reject":
    case "fraud":
    case "printer-jam":
    case "migration":
      return preset;
    default:
      return "approve";
  }
}

export function ApprovalStamp({
  effectPreset,
  effectRun = 0,
  selected = false,
  ...groupProps
}: ProceduralAssetProps) {
  const actionRef = useRef<THREE.Group>(null);
  const handleRef = useRef<THREE.Group>(null);
  const rubberPadRef = useRef<THREE.Group>(null);
  const accentMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const rubberMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const previousRunRef = useRef(effectRun);
  const startTimeRef = useRef(Number.POSITIVE_INFINITY);
  const effectRef = useRef<StampEffect>("approve");
  const reducedMotion = useLabStore((state) => state.reducedMotion);

  const gripShape = useMemo(() => {
    const shape = new THREE.Shape();

    // A flattened, broad T silhouette: narrow at the ferrule, shouldered below
    // the palm, and nearly horizontal across the cap. The silhouette is
    // deliberately non-axisymmetric so it reads as an office tool, not a knob.
    shape.moveTo(-0.015, 0.08);
    shape.lineTo(-0.016, 0.096);
    shape.quadraticCurveTo(-0.0165, 0.1, -0.023, 0.103);
    shape.lineTo(-0.033, 0.107);
    shape.quadraticCurveTo(-0.039, 0.109, -0.039, 0.116);
    shape.lineTo(-0.039, 0.123);
    shape.quadraticCurveTo(-0.039, 0.131, -0.03, 0.132);
    shape.lineTo(0.03, 0.132);
    shape.quadraticCurveTo(0.039, 0.131, 0.039, 0.123);
    shape.lineTo(0.039, 0.116);
    shape.quadraticCurveTo(0.039, 0.109, 0.033, 0.107);
    shape.lineTo(0.023, 0.103);
    shape.quadraticCurveTo(0.0165, 0.1, 0.016, 0.096);
    shape.lineTo(0.015, 0.08);
    shape.closePath();

    return shape;
  }, []);

  const gripExtrusion = useMemo<THREE.ExtrudeGeometryOptions>(
    () => ({
      bevelEnabled: true,
      bevelOffset: 0,
      bevelSegments: 5,
      bevelSize: 0.0025,
      bevelThickness: 0.0022,
      curveSegments: 12,
      depth: 0.038,
      steps: 1,
    }),
    [],
  );

  const effectColors = useMemo(
    () => ({
      approve: new THREE.Color("#4d9468"),
      reject: new THREE.Color("#b63f38"),
      fraud: new THREE.Color("#e36b27"),
      "paper-drop": new THREE.Color("#cdbb8c"),
      "printer-jam": new THREE.Color("#d49a39"),
      migration: new THREE.Color("#68ad7c"),
    }),
    [],
  );
  const baseAccentColor = useMemo(() => new THREE.Color("#426c53"), []);
  const baseEmissiveColor = useMemo(() => new THREE.Color("#183522"), []);
  const baseRubberColor = useMemo(() => new THREE.Color("#252722"), []);

  useFrame(({ clock }) => {
    const action = actionRef.current;
    const handle = handleRef.current;
    const rubberPad = rubberPadRef.current;
    const accentMaterial = accentMaterialRef.current;
    const rubberMaterial = rubberMaterialRef.current;
    if (
      !action ||
      !handle ||
      !rubberPad ||
      !accentMaterial ||
      !rubberMaterial
    ) {
      return;
    }

    if (effectRun !== previousRunRef.current) {
      previousRunRef.current = effectRun;
      startTimeRef.current = clock.elapsedTime;
      effectRef.current = resolveStampEffect(effectPreset);
    }

    const elapsed = clock.elapsedTime - startTimeRef.current;
    const effect = effectRef.current;
    const duration = EFFECT_DURATIONS[effect];
    const translationScale = reducedMotion ? 0.52 : 1;
    const rotationScale = reducedMotion ? 0.18 : 1;

    let lift = 0;
    let lateral = 0;
    let foreAft = 0;
    let pitch = 0;
    let roll = 0;
    let yaw = 0;
    let handlePitch = 0;
    let handleRoll = 0;
    let handleYaw = 0;
    let plateCompression = 1;
    let responsePulse = 0;

    if (elapsed >= 0 && elapsed < duration) {
      switch (effect) {
        case "paper-drop": {
          if (elapsed < 0.075) {
            const t = smoothstep(elapsed / 0.075);
            lift = 0.0015 * translationScale * t;
            lateral = 0.0012 * translationScale * t;
            foreAft = -0.0007 * translationScale * t;
            pitch = -0.024 * rotationScale * t;
            roll = 0.018 * rotationScale * t;
            responsePulse = 0.05 * t;
          } else if (elapsed < 0.14) {
            const t = smoothstep((elapsed - 0.075) / 0.065);
            lift = 0.0015 * translationScale * (1 - t);
            lateral = 0.0012 * translationScale * (1 - t);
            foreAft = -0.0007 * translationScale * (1 - t);
            pitch = -0.024 * rotationScale * (1 - t);
            roll = 0.018 * rotationScale * (1 - t);
            plateCompression = 1 - 0.028 * t;
            responsePulse = 0.05 + 0.23 * t;
          } else {
            const t = (elapsed - 0.14) / 0.32;
            const decay = Math.exp(-6.5 * t);
            lift =
              0.0014 *
              translationScale *
              decay *
              Math.abs(Math.sin(t * Math.PI * 2.4));
            lateral =
              0.0008 * translationScale * decay * Math.sin(t * Math.PI * 4.8);
            pitch =
              0.016 *
              rotationScale *
              decay *
              Math.sin(t * Math.PI * 4.8 + 0.35);
            roll = -0.012 * rotationScale * decay * Math.sin(t * Math.PI * 4.8);
            plateCompression = 1 - 0.028 * decay;
            responsePulse = 0.24 * decay;
          }
          break;
        }

        case "approve": {
          const liftHeight = 0.064 * translationScale;
          const tilt = -0.075 * rotationScale;
          const sideTilt = 0.028 * rotationScale;

          if (elapsed < 0.18) {
            const t = easeOutBack(elapsed / 0.18);
            lift = liftHeight * t;
            foreAft = -0.0015 * translationScale * smoothstep(elapsed / 0.18);
            pitch = tilt * t;
            roll = sideTilt * t;
          } else if (elapsed < 0.23) {
            const t = (elapsed - 0.18) / 0.05;
            const hover =
              (reducedMotion ? 0.00035 : 0.0014) * Math.sin(t * Math.PI);
            lift = liftHeight + hover;
            foreAft = -0.0015 * translationScale;
            pitch = tilt * (1 - 0.08 * t);
            roll = sideTilt * (1 - 0.12 * t);
          } else if (elapsed < 0.34) {
            const t = easeInCubic((elapsed - 0.23) / 0.11);
            lift = liftHeight * (1 - t);
            foreAft = -0.0015 * translationScale * (1 - t);
            pitch = tilt * (1 - t);
            roll = sideTilt * (1 - t);
          } else if (elapsed < 0.47) {
            const t = (elapsed - 0.34) / 0.13;
            lift =
              0.027 * translationScale * Math.sin(Math.PI * easeOutCubic(t));
            foreAft = -0.001 * translationScale * Math.sin(Math.PI * t);
            pitch = -tilt * 0.16 * Math.sin(Math.PI * t);
            roll = -sideTilt * 0.2 * Math.sin(Math.PI * t);
            plateCompression = 1 - 0.075 * Math.exp(-7 * t);
            responsePulse = 0.78 * Math.exp(-2.6 * t);
          } else {
            const t = (elapsed - 0.47) / 0.25;
            const decay = Math.exp(-7.5 * t);
            lift =
              0.006 *
              translationScale *
              decay *
              Math.abs(Math.sin(t * Math.PI * 2.75));
            pitch = 0.009 * rotationScale * decay * Math.sin(t * Math.PI * 5.5);
            roll =
              0.006 * rotationScale * decay * Math.sin(t * Math.PI * 5.5 + 0.6);
            yaw =
              0.004 * rotationScale * decay * Math.sin(t * Math.PI * 5.5 + 1.1);
            plateCompression =
              1 - 0.025 * decay * Math.abs(Math.sin(t * Math.PI * 2.75));
            responsePulse = 0.42 * decay;
          }
          break;
        }

        case "reject": {
          const liftHeight = 0.052 * translationScale;
          const tilt = -0.055 * rotationScale;
          const sideTilt = -0.068 * rotationScale;
          const yawTilt = 0.105 * rotationScale;
          const sideTravel = -0.007 * translationScale;

          if (elapsed < 0.12) {
            const t = easeOutBack(elapsed / 0.12);
            lift = liftHeight * t;
            lateral = sideTravel * smoothstep(elapsed / 0.12);
            foreAft = 0.002 * translationScale * smoothstep(elapsed / 0.12);
            pitch = tilt * t;
            roll = sideTilt * t;
            yaw = yawTilt * t;
          } else if (elapsed < 0.15) {
            lift = liftHeight;
            lateral = sideTravel;
            foreAft = 0.002 * translationScale;
            pitch = tilt;
            roll = sideTilt;
            yaw = yawTilt;
          } else if (elapsed < 0.23) {
            const t = easeInCubic((elapsed - 0.15) / 0.08);
            lift = liftHeight * (1 - t);
            lateral = sideTravel * (1 - t);
            foreAft = 0.002 * translationScale * (1 - t);
            pitch = tilt * (1 - t);
            roll = sideTilt * (1 - t);
            yaw = yawTilt * (1 - t);
          } else if (elapsed < 0.32) {
            const t = (elapsed - 0.23) / 0.09;
            lift =
              0.016 * translationScale * Math.sin(Math.PI * easeOutCubic(t));
            lateral = 0.0038 * translationScale * Math.sin(Math.PI * t);
            foreAft = -0.001 * translationScale * Math.sin(Math.PI * t);
            pitch = -tilt * 0.16 * Math.sin(Math.PI * t);
            roll = -sideTilt * 0.34 * Math.sin(Math.PI * t);
            yaw = -yawTilt * 0.2 * Math.sin(Math.PI * t);
            plateCompression = 1 - 0.1 * Math.exp(-7 * t);
            responsePulse = 1.1 * Math.exp(-2.6 * t);
          } else {
            const t = (elapsed - 0.32) / 0.26;
            const decay = Math.exp(-7.5 * t);
            lift =
              0.0045 *
              translationScale *
              decay *
              Math.abs(Math.sin(t * Math.PI * 2.2));
            lateral =
              0.0022 * translationScale * decay * Math.sin(t * Math.PI * 4.4);
            pitch = 0.009 * rotationScale * decay * Math.sin(t * Math.PI * 4.4);
            roll =
              -0.016 *
              rotationScale *
              decay *
              Math.sin(t * Math.PI * 4.4 + 0.6);
            yaw =
              0.012 * rotationScale * decay * Math.sin(t * Math.PI * 4.4 + 1.1);
            plateCompression =
              1 - 0.025 * decay * Math.abs(Math.sin(t * Math.PI * 2.2));
            responsePulse = 0.72 * decay;
          }
          break;
        }

        case "fraud": {
          const liftHeight = 0.078 * translationScale;
          const tilt = -0.105 * rotationScale;
          const sideTilt = 0.025 * rotationScale;
          const yawTilt = -0.018 * rotationScale;

          if (elapsed < 0.25) {
            const t = easeOutBack(elapsed / 0.25);
            lift = liftHeight * t;
            lateral = 0.002 * translationScale * smoothstep(elapsed / 0.25);
            foreAft = -0.004 * translationScale * smoothstep(elapsed / 0.25);
            pitch = tilt * t;
            roll = sideTilt * t;
            yaw = yawTilt * t;
          } else if (elapsed < 0.34) {
            const t = (elapsed - 0.25) / 0.09;
            const hover =
              (reducedMotion ? 0.00035 : 0.0014) * Math.sin(t * Math.PI);
            lift = liftHeight + hover;
            lateral = 0.002 * translationScale;
            foreAft = -0.004 * translationScale;
            pitch = tilt * (1 - 0.08 * t);
            roll = sideTilt * (1 - 0.12 * t);
            yaw = yawTilt * (1 - 0.06 * t);
          } else if (elapsed < 0.48) {
            const t = easeInCubic((elapsed - 0.34) / 0.14);
            lift = liftHeight * (1 - t);
            lateral = 0.002 * translationScale * (1 - t);
            foreAft = -0.004 * translationScale * (1 - t);
            pitch = tilt * (1 - t);
            roll = sideTilt * (1 - t);
            yaw = yawTilt * (1 - t);
          } else if (elapsed < 0.61) {
            const t = (elapsed - 0.48) / 0.13;
            lift =
              0.024 * translationScale * Math.sin(Math.PI * easeOutCubic(t));
            lateral = -0.0015 * translationScale * Math.sin(Math.PI * t);
            foreAft = 0.002 * translationScale * Math.sin(Math.PI * t);
            pitch = -tilt * 0.16 * Math.sin(Math.PI * t);
            roll = -sideTilt * 0.2 * Math.sin(Math.PI * t);
            yaw = -yawTilt * 0.2 * Math.sin(Math.PI * t);
            plateCompression = 1 - 0.16 * Math.exp(-8 * t);
            responsePulse = 1.45 * Math.exp(-2.5 * t);
          } else if (elapsed < 0.7) {
            const t = (elapsed - 0.61) / 0.09;
            lift =
              0.0095 * translationScale * Math.sin(Math.PI * easeOutCubic(t));
            lateral = 0.0013 * translationScale * Math.sin(Math.PI * t);
            pitch = 0.011 * rotationScale * Math.sin(Math.PI * t);
            roll = -0.008 * rotationScale * Math.sin(Math.PI * t);
            plateCompression = 1 - 0.11 * Math.exp(-9 * t);
            responsePulse =
              1.2 *
              Math.exp(-3.1 * t) *
              (0.82 + 0.18 * Math.abs(Math.cos(t * Math.PI * 2)));
          } else {
            const t = (elapsed - 0.7) / 0.28;
            const decay = Math.exp(-5.5 * t);
            lift =
              0.007 *
              translationScale *
              decay *
              Math.abs(Math.sin(t * Math.PI * 2.3));
            lateral =
              -0.0012 * translationScale * decay * Math.sin(t * Math.PI * 4.6);
            pitch = 0.014 * rotationScale * decay * Math.sin(t * Math.PI * 4.6);
            roll =
              0.006 * rotationScale * decay * Math.sin(t * Math.PI * 4.6 + 0.6);
            yaw =
              -0.005 *
              rotationScale *
              decay *
              Math.sin(t * Math.PI * 4.6 + 1.1);
            plateCompression =
              1 - 0.03 * decay * Math.abs(Math.sin(t * Math.PI * 2.3));
            responsePulse =
              0.82 *
              decay *
              (0.72 + 0.28 * Math.abs(Math.cos(t * Math.PI * 3)));
          }
          break;
        }

        case "printer-jam": {
          if (elapsed < 0.12) {
            const t = easeOutBack(elapsed / 0.12);
            lift = 0.026 * translationScale * t;
            pitch = -0.025 * rotationScale * t;
            handleYaw = 0.018 * rotationScale * Math.sin(t * Math.PI);
            responsePulse = 0.08 * t;
          } else if (elapsed < 0.52) {
            const t = (elapsed - 0.12) / 0.4;
            lift =
              0.026 * translationScale +
              0.0014 * translationScale * Math.sin(t * Math.PI * 14);
            lateral = 0.0016 * translationScale * Math.sin(t * Math.PI * 12);
            foreAft =
              0.0011 * translationScale * Math.sin(t * Math.PI * 16 + 0.4);
            pitch =
              -0.025 * rotationScale +
              0.006 * rotationScale * Math.sin(t * Math.PI * 12);
            handlePitch =
              0.024 * rotationScale * Math.sin(t * Math.PI * 14 + 0.3);
            handleRoll =
              0.045 * rotationScale * Math.sin(t * Math.PI * 18 + 0.4);
            handleYaw = 0.07 * rotationScale * Math.sin(t * Math.PI * 14);
            responsePulse = 0.16 + 0.16 * Math.abs(Math.sin(t * Math.PI * 7));
          } else if (elapsed < 0.64) {
            const rawT = (elapsed - 0.52) / 0.12;
            const t = easeInCubic(rawT);
            const jitter = 1 - rawT;
            lift =
              0.026 * translationScale * (1 - t) +
              0.0012 *
                translationScale *
                jitter *
                Math.abs(Math.sin(rawT * Math.PI * 5));
            lateral =
              0.0012 * translationScale * jitter * Math.sin(rawT * Math.PI * 6);
            pitch = -0.025 * rotationScale * (1 - t);
            handlePitch =
              0.018 *
              rotationScale *
              jitter *
              Math.sin(rawT * Math.PI * 7 + 0.3);
            handleRoll =
              0.035 *
              rotationScale *
              jitter *
              Math.sin(rawT * Math.PI * 9 + 0.4);
            handleYaw =
              0.055 * rotationScale * jitter * Math.sin(rawT * Math.PI * 7);
            responsePulse = 0.28 + 0.18 * t;
          } else {
            const t = (elapsed - 0.64) / 0.22;
            const decay = Math.exp(-7 * t);
            lift =
              0.004 *
              translationScale *
              decay *
              Math.abs(Math.sin(t * Math.PI * 3));
            roll = 0.012 * rotationScale * decay * Math.sin(t * Math.PI * 6);
            handleRoll =
              0.024 * rotationScale * decay * Math.sin(t * Math.PI * 8 + 0.4);
            handleYaw =
              0.038 * rotationScale * decay * Math.sin(t * Math.PI * 7);
            plateCompression = 1 - 0.065 * decay;
            responsePulse = 0.62 * decay;
          }
          break;
        }

        case "migration": {
          if (elapsed < 0.28) {
            const t = smoothstep(elapsed / 0.28);
            lift = 0.04 * translationScale * t;
            lateral = 0.006 * translationScale * t;
            foreAft = -0.004 * translationScale * t;
            pitch = -0.025 * rotationScale * t;
            yaw = 0.16 * rotationScale * t;
            responsePulse = 0.08 * t;
          } else if (elapsed < 0.55) {
            const t = smoothstep((elapsed - 0.28) / 0.27);
            lift =
              0.04 * translationScale +
              (reducedMotion ? 0.00025 : 0.001) * Math.sin(t * Math.PI);
            lateral = (0.006 + 0.004 * t) * translationScale;
            foreAft = (-0.004 - 0.002 * t) * translationScale;
            pitch = -0.025 * rotationScale * (1 - 0.25 * t);
            roll = -0.018 * rotationScale * t;
            yaw = (0.16 + 0.16 * t) * rotationScale;
            responsePulse = 0.08 + 0.08 * t;
          } else if (elapsed < 0.9) {
            const t = smoothstep((elapsed - 0.55) / 0.35);
            lift = (0.04 * (1 - t) + 0.006 * t) * translationScale;
            lateral = 0.01 * translationScale * (1 - t);
            foreAft = -0.006 * translationScale * (1 - t);
            pitch = -0.01875 * rotationScale * (1 - t);
            roll = -0.018 * rotationScale * (1 - t);
            yaw = 0.32 * rotationScale * (1 - t);
            responsePulse = 0.16 + 0.12 * t;
          } else if (elapsed < 1.02) {
            const t = smoothstep((elapsed - 0.9) / 0.12);
            lift = 0.006 * translationScale * (1 - t);
            responsePulse = 0.28 + 0.3 * t;
          } else {
            const t = (elapsed - 1.02) / 0.12;
            const decay = Math.exp(-6.5 * t);
            lift =
              0.0035 *
              translationScale *
              decay *
              Math.abs(Math.sin(t * Math.PI * 1.7));
            pitch = 0.004 * rotationScale * decay * Math.sin(t * Math.PI * 3.4);
            plateCompression = 1 - 0.035 * decay;
            responsePulse = 0.58 * decay;
          }
          break;
        }
      }
    }

    action.position.x = lateral;
    action.position.y = lift;
    action.position.z = foreAft;
    action.rotation.x = pitch;
    action.rotation.y = yaw;
    action.rotation.z = roll;
    handle.rotation.x = handlePitch;
    handle.rotation.y = handleYaw;
    handle.rotation.z = handleRoll;
    rubberPad.scale.y = plateCompression;

    const responseColor = effectColors[effect];
    const colorBlendGain =
      effect === "paper-drop"
        ? 0.12
        : effect === "migration"
          ? 0.18
          : effect === "approve"
            ? 0.24
            : effect === "printer-jam"
              ? 0.3
              : 0.38;
    const emissiveGain =
      effect === "paper-drop"
        ? 0.25
        : effect === "migration"
          ? 0.42
          : effect === "printer-jam"
            ? 0.55
            : effect === "fraud"
              ? 0.95
              : effect === "reject"
                ? 0.72
                : 0.65;
    const colorBlend = clamp01(responsePulse * colorBlendGain);
    accentMaterial.color.copy(baseAccentColor).lerp(responseColor, colorBlend);
    accentMaterial.emissive
      .copy(baseEmissiveColor)
      .lerp(responseColor, clamp01(responsePulse));
    accentMaterial.emissiveIntensity =
      (selected ? 0.55 : 0.08) + responsePulse * emissiveGain;
    rubberMaterial.color
      .copy(baseRubberColor)
      .lerp(responseColor, clamp01(responsePulse * 0.075));
  });

  return (
    <group {...groupProps}>
      <group ref={actionRef}>
        <group>
          <group ref={rubberPadRef}>
            <RoundedBox
              args={[0.116, 0.009, 0.078]}
              position={[0, 0.0045, 0]}
              radius={0.004}
              smoothness={5}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                ref={rubberMaterialRef}
                color="#252722"
                roughness={0.88}
                metalness={0.02}
              />
            </RoundedBox>
          </group>

          <RoundedBox
            args={[0.112, 0.018, 0.074]}
            position={[0, 0.0165, 0]}
            radius={0.006}
            smoothness={6}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial
              color="#aeb2ac"
              roughness={0.29}
              metalness={0.86}
              clearcoat={0.45}
              clearcoatRoughness={0.2}
            />
          </RoundedBox>

          <RoundedBox
            args={[0.096, 0.005, 0.005]}
            position={[0, 0.016, 0.0372]}
            radius={0.002}
            smoothness={4}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial
              ref={accentMaterialRef}
              color="#426c53"
              roughness={0.4}
              metalness={0.18}
              clearcoat={0.3}
              emissive="#183522"
              emissiveIntensity={selected ? 0.55 : 0.08}
            />
          </RoundedBox>

          {[-0.043, 0.043].map((x) => (
            <group key={x} position={[x, 0.021, 0.0372]}>
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.0041, 0.0041, 0.0024, 32]} />
                <meshStandardMaterial
                  color="#7d827d"
                  roughness={0.34}
                  metalness={0.88}
                />
              </mesh>
              <mesh position={[0, 0, 0.00135]} castShadow>
                <boxGeometry args={[0.0051, 0.0008, 0.0007]} />
                <meshStandardMaterial
                  color="#363b3a"
                  roughness={0.48}
                  metalness={0.8}
                />
              </mesh>
            </group>
          ))}

          <RoundedBox
            args={[0.032, 0.016, 0.003]}
            position={[0, 0.019, 0.0394]}
            radius={0.004}
            smoothness={5}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial
              color="#365e47"
              roughness={0.3}
              metalness={0.34}
              clearcoat={0.55}
              clearcoatRoughness={0.18}
            />
          </RoundedBox>

          <group position={[0, 0.019, 0.0411]}>
            <RoundedBox
              args={[0.004, 0.009, 0.0015]}
              position={[-0.005, -0.001, 0]}
              rotation={[0, 0, -0.67]}
              radius={0.0012}
              smoothness={4}
              castShadow
            >
              <meshStandardMaterial
                color="#d6d7c7"
                roughness={0.53}
                metalness={0.08}
              />
            </RoundedBox>
            <RoundedBox
              args={[0.004, 0.017, 0.0015]}
              position={[0.004, 0.0017, 0]}
              rotation={[0, 0, 0.72]}
              radius={0.0012}
              smoothness={4}
              castShadow
            >
              <meshStandardMaterial
                color="#d6d7c7"
                roughness={0.53}
                metalness={0.08}
              />
            </RoundedBox>
          </group>
        </group>

        <group ref={handleRef} position={[0, 0.0255, 0]}>
          <group position={[0, -0.0255, 0]}>
            <mesh position={[0, 0.064, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.0105, 0.013, 0.079, 48]} />
              <meshPhysicalMaterial
                color="#9ba19e"
                roughness={0.25}
                metalness={0.92}
                clearcoat={0.38}
                clearcoatRoughness={0.16}
              />
            </mesh>

            <mesh position={[0, 0.039, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.021, 0.023, 0.015, 64]} />
              <meshPhysicalMaterial
                color="#7f8581"
                roughness={0.31}
                metalness={0.88}
                clearcoat={0.35}
                clearcoatRoughness={0.22}
              />
            </mesh>

            <mesh
              position={[0, 0.0472, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
              receiveShadow
            >
              <torusGeometry args={[0.0184, 0.0016, 12, 64]} />
              <meshStandardMaterial
                color="#494d4a"
                roughness={0.42}
                metalness={0.76}
              />
            </mesh>

            <mesh position={[0, 0, -0.019]} castShadow receiveShadow>
              <extrudeGeometry args={[gripShape, gripExtrusion]} />
              <meshPhysicalMaterial
                color="#5f2d1c"
                roughness={0.29}
                metalness={0.03}
                clearcoat={0.68}
                clearcoatRoughness={0.25}
              />
            </mesh>

            <RoundedBox
              args={[0.032, 0.012, 0.0438]}
              position={[0, 0.087, 0]}
              radius={0.0045}
              smoothness={5}
              castShadow
              receiveShadow
            >
              <meshPhysicalMaterial
                color="#74442d"
                roughness={0.34}
                metalness={0.025}
                clearcoat={0.58}
                clearcoatRoughness={0.3}
              />
            </RoundedBox>

            <RoundedBox
              args={[0.037, 0.011, 0.0016]}
              position={[0, 0.1185, 0.0215]}
              radius={0.0038}
              smoothness={5}
              castShadow
              receiveShadow
            >
              <meshPhysicalMaterial
                color="#a47e45"
                roughness={0.28}
                metalness={0.72}
                clearcoat={0.32}
                clearcoatRoughness={0.22}
              />
            </RoundedBox>

            {[-0.013, 0.013].map((x) => (
              <mesh
                key={x}
                position={[x, 0.1185, 0.02245]}
                rotation={[Math.PI / 2, 0, 0]}
                castShadow
              >
                <cylinderGeometry args={[0.00165, 0.00165, 0.0011, 24]} />
                <meshStandardMaterial
                  color="#4a3927"
                  roughness={0.38}
                  metalness={0.82}
                />
              </mesh>
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}

export default ApprovalStamp;
