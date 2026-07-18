import { Instance, Instances, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { ThreeElements } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useLabStore } from "../../store/useLabStore";
import type { ProceduralAssetProps } from "../types";

type FraudStampEffect = NonNullable<ProceduralAssetProps["effectPreset"]>;
type LabelAtlasRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const LABEL_ATLAS_WIDTH = 512;
const LABEL_ATLAS_HEIGHT = 160;
const EVIDENCE_LABEL_REGION = {
  x: 0,
  y: 0,
  width: 512,
  height: 64,
} satisfies LabelAtlasRegion;
const CARRIAGE_LABEL_REGION = {
  x: 0,
  y: 64,
  width: 256,
  height: 96,
} satisfies LabelAtlasRegion;
const INK_LABEL_REGION = {
  x: 256,
  y: 64,
  width: 256,
  height: 96,
} satisfies LabelAtlasRegion;

const EFFECT_DURATIONS: Record<FraudStampEffect, number> = {
  "paper-drop": 0.62,
  approve: 0.78,
  reject: 0.74,
  fraud: 1.35,
  "printer-jam": 1.05,
  migration: 1.22,
};

const REST_HANDLE_ANGLE = 0.2;
const REST_ALARM_SWEEP_X = -0.033;

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
  const overshoot = 1.1;
  return 1 + (overshoot + 1) * t * t * t + overshoot * t * t;
};

function drawTrackedLabel(
  context: CanvasRenderingContext2D,
  copy: string,
  centerX: number,
  centerY: number,
  tracking: number,
) {
  const glyphWidths = Array.from(copy, (glyph) =>
    context.measureText(glyph).width,
  );
  const copyWidth =
    glyphWidths.reduce((total, width) => total + width, 0) +
    tracking * Math.max(0, copy.length - 1);
  let cursor = centerX - copyWidth / 2;

  Array.from(copy).forEach((glyph, index) => {
    context.fillText(glyph, cursor, centerY);
    cursor += glyphWidths[index] + tracking;
  });
}

function createLabelAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = LABEL_ATLAS_WIDTH;
  canvas.height = LABEL_ATLAS_HEIGHT;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("FraudStamp label atlas requires a 2D canvas context.");
  }

  context.clearRect(0, 0, LABEL_ATLAS_WIDTH, LABEL_ATLAS_HEIGHT);
  context.textAlign = "left";
  context.textBaseline = "middle";

  context.fillStyle = "#382c22";
  context.font = "700 27px Arial, Helvetica, sans-serif";
  drawTrackedLabel(context, "EVIDENCE / F-03", 256, 32, 2.25);

  context.fillStyle = "#64151c";
  context.font = "800 60px Arial, Helvetica, sans-serif";
  drawTrackedLabel(context, "FRAUD", 128, 112, 4);

  context.fillStyle = "#95101a";
  drawTrackedLabel(context, "FRAUD", 384, 112, 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = "FraudStampLabelAtlas";
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function AtlasLabelPlane({
  material,
  region,
  width,
  height,
  ...meshProps
}: Omit<ThreeElements["mesh"], "geometry" | "material"> & {
  material: THREE.MeshBasicMaterial;
  region: LabelAtlasRegion;
  width: number;
  height: number;
}) {
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(width, height);
    const uv = plane.getAttribute("uv");
    const uOffset = region.x / LABEL_ATLAS_WIDTH;
    const vOffset =
      1 - (region.y + region.height) / LABEL_ATLAS_HEIGHT;
    const uScale = region.width / LABEL_ATLAS_WIDTH;
    const vScale = region.height / LABEL_ATLAS_HEIGHT;

    for (let index = 0; index < uv.count; index += 1) {
      uv.setXY(
        index,
        uOffset + uv.getX(index) * uScale,
        vOffset + uv.getY(index) * vScale,
      );
    }
    uv.needsUpdate = true;
    return plane;
  }, [height, region, width]);

  return <mesh {...meshProps} geometry={geometry} material={material} />;
}

function resolveFraudStampEffect(
  preset: ProceduralAssetProps["effectPreset"],
): FraudStampEffect {
  switch (preset) {
    case "paper-drop":
    case "approve":
    case "reject":
    case "fraud":
    case "printer-jam":
    case "migration":
      return preset;
    default:
      return "fraud";
  }
}

export function FraudStamp({
  effectPreset,
  effectRun = 0,
  selected = false,
  ...groupProps
}: ProceduralAssetProps) {
  const frameRef = useRef<THREE.Group>(null);
  const carriageRef = useRef<THREE.Group>(null);
  const cassetteRef = useRef<THREE.Group>(null);
  const handleRef = useRef<THREE.Group>(null);
  const platenRef = useRef<THREE.Group>(null);
  const padRef = useRef<THREE.Group>(null);
  const alarmSweepRef = useRef<THREE.Group>(null);
  const inkMarkRef = useRef<THREE.Group>(null);
  const alarmMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const inkMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const previousRunRef = useRef(effectRun);
  const startTimeRef = useRef(Number.POSITIVE_INFINITY);
  const effectRef = useRef<FraudStampEffect>("fraud");
  const reducedMotion = useLabStore((state) => state.reducedMotion);

  const effectColors = useMemo<Record<FraudStampEffect, THREE.Color>>(
    () => ({
      "paper-drop": new THREE.Color("#d49a44"),
      approve: new THREE.Color("#56a979"),
      reject: new THREE.Color("#d8483f"),
      fraud: new THREE.Color("#f02f27"),
      "printer-jam": new THREE.Color("#e99031"),
      migration: new THREE.Color("#67bab9"),
    }),
    [],
  );
  const alarmRestColor = useMemo(() => new THREE.Color("#57181c"), []);
  const inkRestColor = useMemo(() => new THREE.Color("#4c1017"), []);
  const labelAtlas = useMemo(createLabelAtlas, []);
  const labelMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: labelAtlas,
        transparent: true,
        alphaTest: 0.22,
        depthWrite: false,
        toneMapped: false,
      }),
    [labelAtlas],
  );

  useFrame(({ clock }) => {
    const frame = frameRef.current;
    const carriage = carriageRef.current;
    const cassette = cassetteRef.current;
    const handle = handleRef.current;
    const platen = platenRef.current;
    const pad = padRef.current;
    const alarmSweep = alarmSweepRef.current;
    const inkMark = inkMarkRef.current;
    const alarmMaterial = alarmMaterialRef.current;
    const inkMaterial = inkMaterialRef.current;

    if (
      !frame ||
      !carriage ||
      !cassette ||
      !handle ||
      !platen ||
      !pad ||
      !alarmSweep ||
      !inkMark ||
      !alarmMaterial ||
      !inkMaterial
    ) {
      return;
    }

    if (effectRun !== previousRunRef.current) {
      previousRunRef.current = effectRun;
      startTimeRef.current = clock.elapsedTime;
      effectRef.current = resolveFraudStampEffect(effectPreset);
    }

    const elapsed = clock.elapsedTime - startTimeRef.current;
    const effect = effectRef.current;
    const duration = EFFECT_DURATIONS[effect];
    const translationScale = reducedMotion ? 0.46 : 1;
    const rotationScale = reducedMotion ? 0.28 : 1;

    let carriageY = 0;
    let cassetteX = 0;
    let frameX = 0;
    let frameZ = 0;
    let frameRoll = 0;
    let frameYaw = 0;
    let handleDelta = 0;
    let platenY = 0;
    let platenZ = 0;
    let padCompression = 1;
    let alarmSweepX = 0;
    let alarmPulse = 0;
    let inkPulse = 0;
    let markScale = 0;

    if (elapsed >= 0 && elapsed < duration) {
      switch (effect) {
        case "paper-drop": {
          if (elapsed < 0.12) {
            const t = easeOutCubic(elapsed / 0.12);
            platenY = -0.0015 * translationScale * t;
            platenZ = -0.0032 * translationScale * t;
            handleDelta = 0.018 * rotationScale * t;
            alarmPulse = 0.11 * t;
          } else if (elapsed < 0.28) {
            const t = smoothstep((elapsed - 0.12) / 0.16);
            platenY = -0.0015 * translationScale * (1 - t);
            platenZ =
              -0.0032 * translationScale * (1 - t) +
              0.001 * translationScale * Math.sin(t * Math.PI);
            handleDelta = 0.018 * rotationScale * (1 - t);
            alarmPulse = 0.11 * (1 - t);
          } else {
            const t = (elapsed - 0.28) / 0.34;
            const decay = Math.exp(-7 * t);
            platenY =
              -0.00055 *
              translationScale *
              decay *
              Math.abs(Math.sin(t * Math.PI * 2.5));
            platenZ =
              0.0007 *
              translationScale *
              decay *
              Math.sin(t * Math.PI * 5);
          }
          break;
        }

        case "approve": {
          if (elapsed < 0.18) {
            const t = easeOutBack(elapsed / 0.18);
            carriageY = 0.008 * translationScale * t;
            handleDelta = 0.17 * rotationScale * t;
            cassetteX = -0.004 * translationScale * smoothstep(t);
            alarmPulse = 0.36 * smoothstep(t);
            alarmSweepX = 0.022 * smoothstep(t);
          } else if (elapsed < 0.34) {
            const t = (elapsed - 0.18) / 0.16;
            carriageY = 0.008 * translationScale;
            handleDelta = 0.17 * rotationScale;
            cassetteX =
              (-0.004 - 0.0015 * Math.sin(t * Math.PI)) * translationScale;
            alarmPulse = 0.36 + 0.16 * Math.sin(t * Math.PI);
            alarmSweepX = 0.022 + 0.035 * t;
          } else if (elapsed < 0.6) {
            const t = smoothstep((elapsed - 0.34) / 0.26);
            carriageY = 0.008 * translationScale * (1 - t);
            handleDelta = 0.17 * rotationScale * (1 - t);
            cassetteX = -0.004 * translationScale * (1 - t);
            alarmPulse = 0.36 * (1 - t);
            alarmSweepX = 0.057 * (1 - t);
          } else {
            const t = (elapsed - 0.6) / 0.18;
            const decay = Math.exp(-8 * t);
            handleDelta =
              0.022 * rotationScale * decay * Math.sin(t * Math.PI * 3);
            carriageY =
              0.0011 *
              translationScale *
              decay *
              Math.abs(Math.sin(t * Math.PI * 3));
          }
          break;
        }

        case "reject": {
          if (elapsed < 0.14) {
            const t = easeOutBack(elapsed / 0.14);
            carriageY = 0.009 * translationScale * t;
            handleDelta = 0.1 * rotationScale * t;
            cassetteX = 0.0025 * translationScale * t;
          } else if (elapsed < 0.25) {
            const t = easeInCubic((elapsed - 0.14) / 0.11);
            carriageY =
              (0.009 * (1 - t) - 0.0055 * t) * translationScale;
            handleDelta =
              (0.1 * (1 - t) - 0.34 * t) * rotationScale;
            cassetteX = 0.0025 * translationScale * (1 - t);
            padCompression = 1 - 0.12 * t;
            platenY = -0.0012 * translationScale * t;
            alarmPulse = 0.95 * t;
            inkPulse = 0.3 * t;
            alarmSweepX = 0.06 * t;
          } else if (elapsed < 0.46) {
            const t = easeOutCubic((elapsed - 0.25) / 0.21);
            carriageY =
              (-0.0055 * (1 - t) + 0.0035 * Math.sin(t * Math.PI)) *
              translationScale;
            handleDelta = -0.34 * rotationScale * (1 - t);
            padCompression = 0.88 + 0.12 * t;
            platenY = -0.0012 * translationScale * (1 - t);
            frameRoll =
              -0.01 * rotationScale * (1 - t) * Math.sin(t * Math.PI * 2);
            alarmPulse = 0.95 * (1 - t);
            inkPulse = 0.3 * (1 - t);
            alarmSweepX = 0.06 * (1 - t);
          } else {
            const t = (elapsed - 0.46) / 0.28;
            const decay = Math.exp(-7.5 * t);
            carriageY =
              0.0018 *
              translationScale *
              decay *
              Math.abs(Math.sin(t * Math.PI * 3));
            handleDelta =
              0.03 * rotationScale * decay * Math.sin(t * Math.PI * 3);
            frameRoll =
              0.006 * rotationScale * decay * Math.sin(t * Math.PI * 6);
            alarmPulse = 0.28 * decay;
          }
          break;
        }

        case "fraud": {
          if (elapsed < 0.22) {
            const t = easeOutBack(elapsed / 0.22);
            carriageY = 0.014 * translationScale * t;
            handleDelta = 0.2 * rotationScale * t;
            cassetteX = -0.003 * translationScale * t;
            alarmPulse = 0.25 * t;
            alarmSweepX = 0.018 * t;
          } else if (elapsed < 0.34) {
            const t = (elapsed - 0.22) / 0.12;
            carriageY =
              0.014 * translationScale +
              (reducedMotion ? 0.00015 : 0.00055) * Math.sin(t * Math.PI);
            handleDelta = 0.2 * rotationScale;
            cassetteX = -0.003 * translationScale;
            alarmPulse = 0.25 + 0.2 * t;
            alarmSweepX = 0.018 + 0.018 * t;
          } else if (elapsed < 0.52) {
            const t = easeInCubic((elapsed - 0.34) / 0.18);
            carriageY =
              (0.014 * (1 - t) - 0.011 * t) * translationScale;
            handleDelta =
              (0.2 * (1 - t) - 0.66 * t) * rotationScale;
            cassetteX = -0.003 * translationScale * (1 - t);
            padCompression = 1 - 0.25 * t;
            platenY = -0.0022 * translationScale * t;
            alarmPulse = 0.45 + 1.65 * t;
            inkPulse = 1.5 * t;
            alarmSweepX = 0.036 + 0.03 * t;
          } else if (elapsed < 0.69) {
            const t = (elapsed - 0.52) / 0.17;
            carriageY = -0.011 * translationScale;
            handleDelta = -0.66 * rotationScale;
            cassetteX =
              0.0016 *
              translationScale *
              Math.sin(t * Math.PI * 4) *
              (1 - t);
            padCompression = 0.75 + 0.07 * t;
            platenY = -0.0022 * translationScale * (1 - 0.18 * t);
            frameX =
              0.003 *
              translationScale *
              Math.sin(t * Math.PI * 7) *
              (1 - t);
            frameZ =
              0.0013 *
              translationScale *
              Math.sin(t * Math.PI * 5) *
              (1 - t);
            frameRoll =
              0.021 *
              rotationScale *
              Math.sin(t * Math.PI * 6) *
              (1 - t);
            frameYaw =
              0.014 *
              rotationScale *
              Math.sin(t * Math.PI * 5) *
              (1 - t);
            alarmPulse = 2.1 + 1.15 * Math.abs(Math.sin(t * Math.PI * 3));
            inkPulse = 1.5 - 0.25 * t;
            alarmSweepX = 0.066 - 0.132 * t;
            markScale = easeOutBack(t);
          } else if (elapsed < 0.98) {
            const t = easeOutCubic((elapsed - 0.69) / 0.29);
            carriageY =
              (-0.011 * (1 - t) + 0.006 * Math.sin(t * Math.PI)) *
              translationScale;
            handleDelta = -0.66 * rotationScale * (1 - t);
            padCompression = 0.82 + 0.18 * t;
            platenY = -0.0018 * translationScale * (1 - t);
            const decay = 1 - t;
            frameX =
              0.002 *
              translationScale *
              decay *
              Math.sin(t * Math.PI * 6);
            frameRoll =
              0.013 * rotationScale * decay * Math.sin(t * Math.PI * 6);
            alarmPulse =
              0.82 + 1.2 * decay * Math.abs(Math.sin(t * Math.PI * 3));
            inkPulse = 1.2 * decay;
            alarmSweepX = -0.066 + 0.132 * t;
            markScale = 1 + 0.055 * decay * Math.sin(t * Math.PI * 2);
          } else {
            const t = (elapsed - 0.98) / 0.37;
            const decay = Math.exp(-6.2 * t);
            carriageY =
              0.0024 *
              translationScale *
              decay *
              Math.abs(Math.sin(t * Math.PI * 3.2));
            handleDelta =
              0.065 * rotationScale * decay * Math.sin(t * Math.PI * 3.2);
            frameRoll =
              0.007 * rotationScale * decay * Math.sin(t * Math.PI * 6.4);
            alarmPulse =
              (0.7 + 0.6 * Math.abs(Math.sin(t * Math.PI * 3))) *
              (1 - smoothstep(t));
            alarmSweepX = 0.05 * (1 - smoothstep(t));
            markScale = 1 - smoothstep(clamp01((t - 0.7) / 0.3));
            inkPulse = 0.32 * decay;
          }
          break;
        }

        case "printer-jam": {
          if (elapsed < 0.18) {
            const t = easeOutBack(elapsed / 0.18);
            carriageY = 0.007 * translationScale * t;
            handleDelta = -0.14 * rotationScale * t;
            cassetteX = 0.004 * translationScale * t;
            alarmPulse = 0.45 * t;
          } else if (elapsed < 0.68) {
            const t = (elapsed - 0.18) / 0.5;
            const chatter = Math.sin(t * Math.PI * 10);
            const ratchet = Math.max(0, Math.sin(t * Math.PI * 5));
            carriageY =
              (0.007 - 0.0042 * ratchet + 0.001 * chatter) *
              translationScale;
            handleDelta =
              (-0.14 + 0.13 * chatter * (1 - 0.45 * t)) * rotationScale;
            cassetteX = 0.005 * translationScale * chatter;
            frameX = 0.0015 * translationScale * chatter;
            frameRoll = 0.009 * rotationScale * chatter;
            alarmPulse = 0.62 + 0.82 * Math.abs(chatter);
            alarmSweepX = 0.06 * Math.sin(t * Math.PI * 3);
          } else if (elapsed < 0.87) {
            const t = easeInCubic((elapsed - 0.68) / 0.19);
            carriageY =
              (0.007 * (1 - t) - 0.004 * t) * translationScale;
            handleDelta = -0.14 * rotationScale * (1 - t);
            cassetteX = 0.003 * translationScale * (1 - t);
            padCompression = 1 - 0.08 * t;
            platenY = -0.001 * translationScale * t;
            alarmPulse = 1.15 * (1 - 0.35 * t);
          } else {
            const t = (elapsed - 0.87) / 0.18;
            const decay = Math.exp(-8 * t);
            carriageY =
              -0.004 * translationScale * decay * Math.cos(t * Math.PI * 3);
            handleDelta =
              0.06 * rotationScale * decay * Math.sin(t * Math.PI * 3);
            platenY = -0.001 * translationScale * decay;
            padCompression = 1 - 0.08 * decay;
            frameRoll =
              0.007 * rotationScale * decay * Math.sin(t * Math.PI * 6);
            alarmPulse = 0.72 * decay;
          }
          break;
        }

        case "migration": {
          if (elapsed < 0.2) {
            const t = easeOutCubic(elapsed / 0.2);
            carriageY = 0.012 * translationScale * t;
            handleDelta = 0.23 * rotationScale * t;
            cassetteX = 0.006 * translationScale * t;
            platenZ = -0.004 * translationScale * t;
            alarmPulse = 0.38 * t;
            alarmSweepX = 0.032 * t;
          } else if (elapsed < 0.44) {
            const t = (elapsed - 0.2) / 0.24;
            carriageY =
              (0.012 - 0.004 * smoothstep(t)) * translationScale;
            handleDelta =
              (0.23 - 0.1 * smoothstep(t)) * rotationScale;
            cassetteX = 0.006 * translationScale;
            platenZ = -0.004 * translationScale;
            alarmPulse = 0.38 + 0.44 * Math.sin(t * Math.PI);
            alarmSweepX = 0.032 + 0.033 * t;
          } else if (elapsed < 0.8) {
            const t = (elapsed - 0.44) / 0.36;
            const cycle = Math.sin(t * Math.PI);
            carriageY = (0.008 - 0.012 * cycle) * translationScale;
            handleDelta = (0.13 - 0.3 * cycle) * rotationScale;
            cassetteX = 0.006 * translationScale * (1 - t);
            platenZ = -0.004 * translationScale * (1 - t);
            padCompression = 1 - 0.07 * cycle;
            alarmPulse = 0.54 + 0.27 * Math.sin(t * Math.PI * 2);
            alarmSweepX = 0.065 - 0.13 * t;
          } else {
            const t = smoothstep((elapsed - 0.8) / 0.42);
            carriageY = 0.008 * translationScale * (1 - t);
            handleDelta = 0.13 * rotationScale * (1 - t);
            padCompression = 0.98 + 0.02 * t;
            alarmPulse = 0.54 * (1 - t);
            alarmSweepX = -0.065 * (1 - t);
          }
          break;
        }
      }
    }

    frame.position.set(frameX, 0, frameZ);
    frame.rotation.set(0, frameYaw, frameRoll);
    carriage.position.set(0, carriageY, 0);
    cassette.position.set(cassetteX, 0, 0);
    handle.rotation.set(REST_HANDLE_ANGLE + handleDelta, 0, 0);
    platen.position.set(0, platenY, platenZ);
    pad.scale.set(1, padCompression, 1);
    alarmSweep.position.set(REST_ALARM_SWEEP_X + alarmSweepX, 0, 0);
    inkMark.visible = markScale > 0.001;
    inkMark.scale.setScalar(markScale);

    if (alarmPulse > 0.001) {
      alarmMaterial.color.copy(effectColors[effect]);
      alarmMaterial.emissive.copy(effectColors[effect]);
      alarmMaterial.emissiveIntensity = 0.25 + alarmPulse * 1.55;
    } else {
      alarmMaterial.color.copy(alarmRestColor);
      alarmMaterial.emissive.copy(alarmRestColor);
      alarmMaterial.emissiveIntensity = 0.16;
    }

    inkMaterial.color.copy(inkRestColor);
    inkMaterial.emissive.copy(inkRestColor);
    inkMaterial.emissiveIntensity = 0.06 + inkPulse * 0.5;
  });

  return (
    <group {...groupProps}>
      <Instances castShadow receiveShadow limit={4}>
        <boxGeometry args={[0.03, 0.008, 0.026]} />
        <meshStandardMaterial color="#1c2224" roughness={0.86} />
        <Instance position={[-0.082, 0.004, -0.059]} />
        <Instance position={[0.082, 0.004, -0.059]} />
        <Instance position={[-0.082, 0.004, 0.059]} />
        <Instance position={[0.082, 0.004, 0.059]} />
      </Instances>

      <RoundedBox
        args={[0.216, 0.028, 0.164]}
        position={[0, 0.021, 0]}
        radius={0.009}
        smoothness={6}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color="#2a3032"
          metalness={0.72}
          roughness={0.42}
        />
      </RoundedBox>
      <RoundedBox
        args={[0.198, 0.018, 0.148]}
        position={[0, 0.041, -0.001]}
        radius={0.005}
        smoothness={5}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color="#4a1a20"
          metalness={0.5}
          roughness={0.36}
        />
      </RoundedBox>

      <Instances castShadow limit={2}>
        <boxGeometry args={[0.055, 0.006, 0.003]} />
        <meshStandardMaterial
          color={selected ? "#e66a52" : "#4c2022"}
          emissive={selected ? "#c4382e" : "#321416"}
          emissiveIntensity={selected ? 1.25 : 0.08}
          metalness={0.32}
          roughness={0.34}
        />
        <Instance position={[-0.064, 0.026, 0.0822]} />
        <Instance position={[0.064, 0.026, 0.0822]} />
      </Instances>

      <RoundedBox
        args={[0.095, 0.013, 0.004]}
        position={[0, 0.019, 0.083]}
        radius={0.0015}
        smoothness={4}
        castShadow
      >
        <meshStandardMaterial
          color="#b59b68"
          metalness={0.7}
          roughness={0.34}
        />
      </RoundedBox>
      <AtlasLabelPlane
        position={[0, 0.019, 0.0852]}
        material={labelMaterial}
        region={EVIDENCE_LABEL_REGION}
        width={0.082}
        height={0.01025}
      />

      <group ref={platenRef}>
        <RoundedBox
          args={[0.148, 0.012, 0.108]}
          position={[0, 0.058, 0.016]}
          radius={0.004}
          smoothness={5}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color="#242a2c"
            metalness={0.68}
            roughness={0.45}
          />
        </RoundedBox>
        <RoundedBox
          args={[0.122, 0.004, 0.08]}
          position={[0, 0.066, 0.019]}
          radius={0.0018}
          smoothness={4}
          receiveShadow
        >
          <meshStandardMaterial color="#3b3032" roughness={0.88} />
        </RoundedBox>
        <Instances castShadow limit={3}>
          <boxGeometry args={[0.004, 0.007, 0.086]} />
          <meshStandardMaterial
            color="#a88b58"
            metalness={0.7}
            roughness={0.34}
          />
          <Instance position={[-0.063, 0.069, 0.019]} />
          <Instance position={[0.063, 0.069, 0.019]} />
          <Instance
            position={[0, 0.069, -0.022]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[1, 1, 1.47]}
          />
        </Instances>
      </group>

      <group ref={inkMarkRef} position={[0, 0.0685, 0.019]} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[0.1, 0.054]} />
          <meshStandardMaterial
            color="#76121a"
            roughness={0.9}
            transparent
            opacity={0.26}
          />
        </mesh>
        <AtlasLabelPlane
          position={[0, 0.0004, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={labelMaterial}
          region={INK_LABEL_REGION}
          width={0.078}
          height={0.02925}
        />
      </group>

      <group ref={frameRef}>
        <Instances castShadow receiveShadow limit={2}>
          <cylinderGeometry args={[0.0105, 0.0125, 0.16, 48]} />
          <meshStandardMaterial
            color="#aeb6b5"
            metalness={0.88}
            roughness={0.21}
          />
          <Instance position={[-0.074, 0.145, -0.047]} />
          <Instance position={[0.074, 0.145, -0.047]} />
        </Instances>

        <Instances castShadow receiveShadow limit={4}>
          <cylinderGeometry args={[0.015, 0.015, 0.013, 40]} />
          <meshStandardMaterial
            color="#343a3c"
            metalness={0.76}
            roughness={0.34}
          />
          <Instance position={[-0.074, 0.0715, -0.047]} />
          <Instance position={[0.074, 0.0715, -0.047]} />
          <Instance position={[-0.074, 0.2185, -0.047]} />
          <Instance position={[0.074, 0.2185, -0.047]} />
        </Instances>

        <RoundedBox
          args={[0.204, 0.052, 0.094]}
          position={[0, 0.236, -0.022]}
          radius={0.009}
          smoothness={6}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color="#303638"
            metalness={0.78}
            roughness={0.36}
          />
        </RoundedBox>
        <RoundedBox
          args={[0.142, 0.014, 0.006]}
          position={[0, 0.236, 0.026]}
          radius={0.0025}
          smoothness={4}
          castShadow
        >
          <meshStandardMaterial
            color="#6b1b21"
            metalness={0.5}
            roughness={0.34}
          />
        </RoundedBox>

        <Instances castShadow limit={4}>
          <cylinderGeometry args={[0.004, 0.004, 0.004, 28]} />
          <meshStandardMaterial
            color="#b9a473"
            metalness={0.78}
            roughness={0.28}
          />
          <Instance
            position={[-0.082, 0.248, 0.0265]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <Instance
            position={[0.082, 0.248, 0.0265]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <Instance
            position={[-0.082, 0.224, 0.0265]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <Instance
            position={[0.082, 0.224, 0.0265]}
            rotation={[Math.PI / 2, 0, 0]}
          />
        </Instances>

        <RoundedBox
          args={[0.112, 0.026, 0.042]}
          position={[0, 0.271, -0.011]}
          radius={0.006}
          smoothness={5}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color="#242a2c"
            metalness={0.78}
            roughness={0.34}
          />
        </RoundedBox>
        <RoundedBox
          args={[0.092, 0.015, 0.006]}
          position={[0, 0.271, 0.011]}
          radius={0.0035}
          smoothness={5}
        >
          <meshStandardMaterial
            ref={alarmMaterialRef}
            color="#57181c"
            emissive="#57181c"
            emissiveIntensity={0.16}
            metalness={0.12}
            roughness={0.27}
            transparent
            opacity={0.94}
          />
        </RoundedBox>
        <Instances castShadow limit={4}>
          <boxGeometry args={[0.005, 0.021, 0.008]} />
          <meshStandardMaterial
            color="#454b4d"
            metalness={0.82}
            roughness={0.3}
          />
          <Instance position={[-0.043, 0.271, 0.014]} />
          <Instance position={[-0.014, 0.271, 0.014]} />
          <Instance position={[0.014, 0.271, 0.014]} />
          <Instance position={[0.043, 0.271, 0.014]} />
        </Instances>
        <group ref={alarmSweepRef} position={[REST_ALARM_SWEEP_X, 0, 0]}>
          <mesh position={[0, 0.271, 0.015]}>
            <boxGeometry args={[0.004, 0.012, 0.002]} />
            <meshBasicMaterial color="#ffd0ad" transparent opacity={0.58} />
          </mesh>
        </group>

        <group ref={carriageRef}>
          <mesh position={[0, 0.178, -0.021]} castShadow>
            <boxGeometry args={[0.032, 0.1, 0.032]} />
            <meshStandardMaterial
              color="#aeb5b4"
              metalness={0.88}
              roughness={0.2}
            />
          </mesh>
          <RoundedBox
            args={[0.108, 0.052, 0.074]}
            position={[0, 0.128, 0.002]}
            radius={0.008}
            smoothness={6}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color="#671820"
              metalness={0.5}
              roughness={0.34}
            />
          </RoundedBox>
          <RoundedBox
            args={[0.094, 0.035, 0.008]}
            position={[0, 0.128, 0.0415]}
            radius={0.0025}
            smoothness={4}
            castShadow
          >
            <meshStandardMaterial
              color="#c5b27e"
              metalness={0.56}
              roughness={0.38}
            />
          </RoundedBox>
          <AtlasLabelPlane
            position={[0, 0.128, 0.046]}
            material={labelMaterial}
            region={CARRIAGE_LABEL_REGION}
            width={0.078}
            height={0.02925}
          />

          <group ref={cassetteRef}>
            <RoundedBox
              args={[0.086, 0.025, 0.066]}
              position={[0, 0.096, 0.002]}
              radius={0.004}
              smoothness={5}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                color="#363b3d"
                metalness={0.68}
                roughness={0.42}
              />
            </RoundedBox>
          </group>
          <group ref={padRef} position={[0, 0.075, 0.006]}>
            <RoundedBox
              args={[0.08, 0.012, 0.056]}
              radius={0.0028}
              smoothness={4}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                ref={inkMaterialRef}
                color="#4c1017"
                emissive="#4c1017"
                emissiveIntensity={0.06}
                roughness={0.9}
              />
            </RoundedBox>
            <mesh position={[0, -0.0065, 0]}>
              <boxGeometry args={[0.064, 0.002, 0.042]} />
              <meshStandardMaterial color="#21191b" roughness={0.96} />
            </mesh>
          </group>
        </group>

        <Instances castShadow receiveShadow limit={2}>
          <cylinderGeometry args={[0.017, 0.017, 0.022, 40]} />
          <meshStandardMaterial
            color="#aa925f"
            metalness={0.8}
            roughness={0.27}
          />
          <Instance
            position={[-0.097, 0.22, -0.035]}
            rotation={[0, 0, Math.PI / 2]}
          />
          <Instance
            position={[0.097, 0.22, -0.035]}
            rotation={[0, 0, Math.PI / 2]}
          />
        </Instances>

        <group
          ref={handleRef}
          position={[0, 0.22, -0.035]}
          rotation={[REST_HANDLE_ANGLE, 0, 0]}
        >
          <Instances castShadow limit={2}>
            <boxGeometry args={[0.017, 0.085, 0.015]} />
            <meshStandardMaterial
              color="#aeb5b4"
              metalness={0.86}
              roughness={0.23}
            />
            <Instance position={[-0.097, 0.039, 0.025]} />
            <Instance position={[0.097, 0.039, 0.025]} />
          </Instances>
          <RoundedBox
            args={[0.268, 0.027, 0.034]}
            position={[0, 0.077, 0.052]}
            radius={0.012}
            smoothness={6}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color="#4b191f"
              metalness={0.2}
              roughness={0.62}
            />
          </RoundedBox>
          <Instances castShadow limit={2}>
            <boxGeometry args={[0.013, 0.064, 0.012]} />
            <meshStandardMaterial
              color="#aa925f"
              metalness={0.78}
              roughness={0.29}
            />
            <Instance
              position={[-0.055, -0.019, 0.012]}
              rotation={[0.34, 0, -0.23]}
            />
            <Instance
              position={[0.055, -0.019, 0.012]}
              rotation={[0.34, 0, 0.23]}
            />
          </Instances>
        </group>
      </group>

      <mesh position={[0, 0.152, 0]}>
        <boxGeometry args={[0.297, 0.304, 0.18]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
