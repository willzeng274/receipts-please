import { DESK_LAMP_CONTRACT } from '../models/procedural/DeskLamp'
import { FINANCE_DESK_CONTRACT } from '../models/procedural/FinanceDesk'
import { OFFICE_ROOM_SHELL_CONTRACT } from '../models/procedural/OfficeRoomShell'

export type SceneVector3 = [number, number, number]

export type SceneAssetPlacement = {
  id: string
  position?: SceneVector3
  rotation?: SceneVector3
  scale?: number
}

const deskOrigin: SceneVector3 = [...OFFICE_ROOM_SHELL_CONTRACT.anchors.desk]
const deskSurfaceY = deskOrigin[1] + FINANCE_DESK_CONTRACT.surfaceY
const placeOnDesk = (x: number, z: number, lift = 0): SceneVector3 => [
  deskOrigin[0] + x,
  deskSurfaceY + lift,
  deskOrigin[2] + z,
]
const computerPosition: SceneVector3 = [deskOrigin[0], deskSurfaceY, deskOrigin[2] - 0.38]
const deskLampYaw = 0.08
const deskLampPowerAnchor = DESK_LAMP_CONTRACT.powerGrommet.center
const deskLeftGrommet = FINANCE_DESK_CONTRACT.grommets.left
const rotatedLampPowerX = Math.cos(deskLampYaw) * deskLampPowerAnchor[0]
  + Math.sin(deskLampYaw) * deskLampPowerAnchor[2]
const rotatedLampPowerZ = -Math.sin(deskLampYaw) * deskLampPowerAnchor[0]
  + Math.cos(deskLampYaw) * deskLampPowerAnchor[2]
const deskLampPosition: SceneVector3 = [
  deskOrigin[0] + deskLeftGrommet[0] - rotatedLampPowerX,
  deskSurfaceY,
  deskOrigin[2] + deskLeftGrommet[2] - rotatedLampPowerZ,
]

export const SCENE_LAYOUT_MANIFEST = {
  desk: {
    origin: deskOrigin,
    surfaceY: deskSurfaceY,
    computerPosition,
    receiptPosition: placeOnDesk(0.06, 0.25, 0.007),
  },
  assets: [
    { id: 'office-room-shell' },
    { id: 'office-service-window', position: [...OFFICE_ROOM_SHELL_CONTRACT.anchors.serviceWindowRoot] },
    { id: 'giraffe-reveal', position: [...OFFICE_ROOM_SHELL_CONTRACT.anchors.giraffeReveal.anchor] },
    { id: 'office-plant', position: [...OFFICE_ROOM_SHELL_CONTRACT.anchors.plants.left], rotation: [0, 0.52, 0] },
    { id: 'office-plant', position: [...OFFICE_ROOM_SHELL_CONTRACT.anchors.plants.right], rotation: [0, -0.38, 0], scale: 0.82 },
    { id: 'finance-desk', position: deskOrigin },
    { id: 'filing-cabinet', position: [-2.45, deskOrigin[1], deskOrigin[2] + 0.65], rotation: [0, 1.47, 0] },
    { id: 'desk-computer', position: computerPosition },
    { id: 'desk-lamp', position: deskLampPosition, rotation: [0, deskLampYaw, 0] },
    { id: 'receipt-printer', position: placeOnDesk(-1.06, -0.42), rotation: [0, 0.15, 0] },
    { id: 'desk-phone', position: placeOnDesk(-1.16, 0.4), rotation: [0, 0.28, 0] },
    { id: 'desk-calculator', position: placeOnDesk(-0.62, 0.32), rotation: [0, 0.2, 0], scale: 0.94 },
    { id: 'contractor-nameplate', position: placeOnDesk(-0.34, -0.38), rotation: [0, 0.02, 0], scale: 0.48 },
    { id: 'receipt-tray-set', position: placeOnDesk(0.91, 0.36), rotation: [0, -0.2, 0], scale: 0.88 },
    { id: 'freeze-card-button', position: placeOnDesk(0.61, -0.18), rotation: [0, -0.08, 0], scale: 0.9 },
    { id: 'approval-stamp', position: placeOnDesk(-0.28, 0.08), rotation: [0, 0.04, 0], scale: 0.64 },
    { id: 'fraud-stamp', position: placeOnDesk(0.18, 0.09), rotation: [0, -0.04, 0], scale: 0.5 },
    { id: 'reject-stamp', position: placeOnDesk(0.52, 0.12), rotation: [0, -0.1, 0], scale: 0.64 },
    { id: 'office-chair', position: [0, deskOrigin[1], deskOrigin[2] + 0.92], rotation: [0, Math.PI, 0] },
  ] satisfies SceneAssetPlacement[],
  camera: {
    overview: { position: [3.7, 2.45, 7.6], target: [0, 1.1, -1.2], fov: 42 },
    inspection: { position: [2.65, 1.72, 3.1], target: [0, 0.88, 0.2], fov: 40 },
    player: {
      position: [deskOrigin[0], 1.28, deskOrigin[2] + 0.91] as SceneVector3,
      target: [deskOrigin[0], 0.99, deskOrigin[2] - 0.14] as SceneVector3,
      fov: 54,
    },
    profile: { position: [2.55, 1.55, 1.6], target: [4.02, 1.25, -2.78], fov: 40 },
    left: { position: [-2.55, 1.55, 1.6], target: [-4.02, 1.25, -1.2], fov: 40 },
    rear: { position: [0, 1.68, -3.88], target: [0, 0.9, 0.18], fov: 40 },
    high: { position: [3.5, 2.95, 3.1], target: [0, 0.82, 0.08], fov: 44 },
    low: { position: [3.82, 0.52, 3.78], target: [0, 0.76, 0.16], fov: 40 },
    workstation: {
      offset: [0, 0, 0.72] as SceneVector3,
      targetOffset: [0, 0, 0] as SceneVector3,
      fov: 40,
    },
    giraffe: { position: [0.04, 1.82, -2.72] as SceneVector3, target: [0.76, 2.02, -6.46] as SceneVector3, fov: 25 },
  },
  playerLook: {
    maxPitch: 0.18,
    maxYaw: Math.PI * 0.4,
    minPitch: -0.42,
  },
} as const
