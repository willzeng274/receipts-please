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

const APPROVED_BITMAPS = [
  ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
] as const;

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

  const approvedGlyphShapes = useMemo(() => {
    const cell = 0.0012;
    const pitch = 0.00145;
    const letterPitch = 0.00845;
    const totalWidth = APPROVED_BITMAPS.length * letterPitch - 0.0012;
    const totalHeight = 7 * pitch - (pitch - cell);
    const shapes: THREE.Shape[] = [];

    APPROVED_BITMAPS.forEach((bitmap, letterIndex) => {
      bitmap.forEach((row, rowIndex) => {
        [...row].forEach((pixel, columnIndex) => {
          if (pixel !== "1") return;

          const x =
            -totalWidth / 2 + letterIndex * letterPitch + columnIndex * pitch;
          const y = totalHeight / 2 - (rowIndex + 1) * pitch + (pitch - cell);
          const shape = new THREE.Shape();
          shape.moveTo(x, y);
          shape.lineTo(x + cell, y);
          shape.lineTo(x + cell, y + cell);
          shape.lineTo(x, y + cell);
          shape.closePath();
          shapes.push(shape);
        });
      });
    });

    return shapes;
  }, []);

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
              args={[0.112, 0.006, 0.066]}
              position={[0, 0.003, 0]}
              radius={0.003}
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
            args={[0.108, 0.012, 0.07]}
            position={[0, 0.01, 0]}
            radius={0.004}
            smoothness={6}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial
              color="#9fa8a3"
              roughness={0.27}
              metalness={0.9}
              clearcoat={0.28}
              clearcoatRoughness={0.24}
            />
          </RoundedBox>

          <RoundedBox
            args={[0.103, 0.027, 0.067]}
            position={[0, 0.024, 0]}
            radius={0.007}
            smoothness={6}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial
              color="#26302d"
              roughness={0.34}
              metalness={0.38}
              clearcoat={0.48}
              clearcoatRoughness={0.25}
            />
          </RoundedBox>

          <RoundedBox
            args={[0.084, 0.018, 0.0028]}
            position={[0, 0.024, 0.03485]}
            radius={0.0035}
            smoothness={5}
            castShadow
          >
            <meshPhysicalMaterial
              ref={accentMaterialRef}
              color="#426c53"
              roughness={0.27}
              metalness={0.24}
              clearcoat={0.58}
              clearcoatRoughness={0.18}
              emissive="#183522"
              emissiveIntensity={selected ? 0.55 : 0.08}
            />
          </RoundedBox>

          <mesh position={[0, 0.024, 0.03632]} castShadow>
            <shapeGeometry args={[approvedGlyphShapes]} />
            <meshStandardMaterial
              color="#e8ede4"
              roughness={0.39}
              metalness={0.08}
            />
          </mesh>

          <RoundedBox
            args={[0.058, 0.014, 0.0026]}
            position={[0, 0.0245, -0.03478]}
            radius={0.0025}
            smoothness={4}
            castShadow
          >
            <meshPhysicalMaterial
              color="#59635f"
              roughness={0.31}
              metalness={0.72}
              clearcoat={0.24}
              clearcoatRoughness={0.24}
            />
          </RoundedBox>

          <RoundedBox
            args={[0.028, 0.0022, 0.0012]}
            position={[0, 0.0245, -0.0367]}
            radius={0.0008}
            smoothness={3}
          >
            <meshStandardMaterial
              color="#1a211f"
              roughness={0.58}
              metalness={0.28}
            />
          </RoundedBox>

          {[-0.049, 0.049].map((x) => (
            <group key={x}>
              <RoundedBox
                args={[0.007, 0.052, 0.01]}
                position={[x, 0.052, 0]}
                radius={0.003}
                smoothness={5}
                castShadow
                receiveShadow
              >
                <meshPhysicalMaterial
                  color="#8f9994"
                  roughness={0.25}
                  metalness={0.91}
                  clearcoat={0.22}
                  clearcoatRoughness={0.2}
                />
              </RoundedBox>

              <mesh
                position={[x, 0.028, 0]}
                rotation={[0, 0, Math.PI / 2]}
                castShadow
                receiveShadow
              >
                <cylinderGeometry args={[0.007, 0.007, 0.004, 40]} />
                <meshStandardMaterial
                  color="#aeb5b1"
                  roughness={0.25}
                  metalness={0.92}
                />
              </mesh>

              <mesh
                position={[x + Math.sign(x) * 0.00215, 0.028, 0]}
                rotation={[0, Math.PI / 2, 0]}
                castShadow
              >
                <torusGeometry args={[0.0043, 0.0008, 10, 36]} />
                <meshStandardMaterial
                  color="#35403c"
                  roughness={0.41}
                  metalness={0.74}
                />
              </mesh>
            </group>
          ))}

          <RoundedBox
            args={[0.102, 0.012, 0.014]}
            position={[0, 0.078, 0]}
            radius={0.004}
            smoothness={5}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial
              color="#87928d"
              roughness={0.25}
              metalness={0.9}
              clearcoat={0.24}
              clearcoatRoughness={0.2}
            />
          </RoundedBox>

          <RoundedBox
            args={[0.029, 0.017, 0.018]}
            position={[0, 0.082, 0]}
            radius={0.005}
            smoothness={5}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial
              color="#303a36"
              roughness={0.34}
              metalness={0.44}
              clearcoat={0.38}
              clearcoatRoughness={0.24}
            />
          </RoundedBox>
        </group>

        <group ref={handleRef} position={[0, 0.0255, 0]}>
          <group position={[0, -0.0255, 0]}>
            <mesh position={[0, 0.068, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.0095, 0.0115, 0.056, 48]} />
              <meshPhysicalMaterial
                color="#a6afaa"
                roughness={0.22}
                metalness={0.93}
                clearcoat={0.26}
                clearcoatRoughness={0.18}
              />
            </mesh>

            <mesh position={[0, 0.044, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.015, 0.018, 0.014, 64]} />
              <meshPhysicalMaterial
                color="#68726d"
                roughness={0.3}
                metalness={0.84}
                clearcoat={0.28}
                clearcoatRoughness={0.22}
              />
            </mesh>

            {[0.052, 0.0595, 0.067].map((y) => (
              <mesh
                key={y}
                position={[0, y, 0]}
                rotation={[Math.PI / 2, 0, 0]}
                castShadow
                receiveShadow
              >
                <torusGeometry args={[0.0125, 0.00105, 10, 48]} />
                <meshStandardMaterial
                  color="#4f5955"
                  roughness={0.36}
                  metalness={0.81}
                />
              </mesh>
            ))}

            <mesh position={[0, 0.096, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.0125, 0.0105, 0.014, 56]} />
              <meshPhysicalMaterial
                color="#7d8782"
                roughness={0.27}
                metalness={0.88}
                clearcoat={0.3}
                clearcoatRoughness={0.2}
              />
            </mesh>

            <RoundedBox
              args={[0.038, 0.013, 0.032]}
              position={[0, 0.1025, 0]}
              radius={0.006}
              smoothness={6}
              castShadow
              receiveShadow
            >
              <meshPhysicalMaterial
                color="#343e3a"
                roughness={0.33}
                metalness={0.36}
                clearcoat={0.46}
                clearcoatRoughness={0.24}
              />
            </RoundedBox>

            <RoundedBox
              args={[0.078, 0.032, 0.044]}
              position={[0, 0.117, 0]}
              radius={0.0115}
              smoothness={8}
              castShadow
              receiveShadow
            >
              <meshPhysicalMaterial
                color="#1d2724"
                roughness={0.31}
                metalness={0.22}
                clearcoat={0.52}
                clearcoatRoughness={0.2}
              />
            </RoundedBox>

            {[-1, 1].map((side) => (
              <RoundedBox
                key={side}
                args={[0.055, 0.014, 0.0023]}
                position={[0, 0.116, side * 0.0223]}
                radius={0.0045}
                smoothness={5}
                castShadow
              >
                <meshPhysicalMaterial
                  color="#2d7150"
                  roughness={0.48}
                  metalness={0.05}
                  clearcoat={0.2}
                  clearcoatRoughness={0.34}
                />
              </RoundedBox>
            ))}

            <RoundedBox
              args={[0.047, 0.0032, 0.036]}
              position={[0, 0.1331, 0]}
              radius={0.0015}
              smoothness={4}
              castShadow
              receiveShadow
            >
              <meshPhysicalMaterial
                color="#9da7a2"
                roughness={0.24}
                metalness={0.9}
                clearcoat={0.25}
                clearcoatRoughness={0.18}
              />
            </RoundedBox>

            {[-0.024, 0.024].map((x) => (
              <mesh key={x} position={[x, 0.13325, 0.014]} castShadow>
                <cylinderGeometry args={[0.00165, 0.00165, 0.001, 24]} />
                <meshStandardMaterial
                  color="#39433f"
                  roughness={0.35}
                  metalness={0.86}
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
