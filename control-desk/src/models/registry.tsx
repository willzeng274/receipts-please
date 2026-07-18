import { ApprovalStamp } from './procedural/ApprovalStamp'
import { ContractorNameplate } from './procedural/ContractorNameplate'
import { DeskCalculator } from './procedural/DeskCalculator'
import { DeskComputer } from './procedural/DeskComputer'
import { DeskLamp } from './procedural/DeskLamp'
import { DeskPhone } from './procedural/DeskPhone'
import { FreezeCardButton } from './procedural/FreezeCardButton'
import { FraudStamp } from './procedural/FraudStamp'
import { GiraffeReveal } from './procedural/GiraffeReveal'
import { FilingCabinet } from './procedural/FilingCabinet'
import { ReceiptPrinter } from './procedural/ReceiptPrinter'
import { RejectStamp } from './procedural/RejectStamp'
import { FinanceDesk } from './procedural/FinanceDesk'
import { OfficeChair } from './procedural/OfficeChair'
import { OfficePlant } from './procedural/OfficePlant'
import { OfficeRoomShell } from './procedural/OfficeRoomShell'
import { OfficeServiceWindow } from './procedural/OfficeServiceWindow'
import { ReceiptTraySet } from './procedural/ReceiptTraySet'
import type { AssetDefinition } from './types'

export const ASSET_DEFINITIONS = [
  {
    id: 'approval-stamp',
    label: 'Approval stamp',
    category: 'Hero desk prop',
    status: 'review',
    scale: 8,
    component: ApprovalStamp,
  },
  {
    id: 'desk-calculator',
    label: 'Tape calculator',
    category: 'Hero desk mechanism',
    status: 'review',
    scale: 5.2,
    component: DeskCalculator,
  },
  {
    id: 'freeze-card-button',
    label: 'Freeze card control',
    category: 'Hero desk mechanism',
    status: 'review',
    scale: 5.3,
    component: FreezeCardButton,
  },
  {
    id: 'receipt-printer',
    label: 'Receipt printer',
    category: 'Hero desk mechanism',
    status: 'review',
    scale: 6.8,
    component: ReceiptPrinter,
  },
  {
    id: 'receipt-tray-set',
    label: 'Decision tray set',
    category: 'Interaction fixture',
    status: 'review',
    scale: 2.6,
    component: ReceiptTraySet,
  },
  {
    id: 'finance-desk',
    label: 'Finance desk',
    category: 'Environment fixture',
    status: 'review',
    scale: 1,
    component: FinanceDesk,
  },
  {
    id: 'desk-computer',
    label: 'Expense OS workstation',
    category: 'Hero workstation',
    status: 'review',
    scale: 2.15,
    component: DeskComputer,
  },
  {
    id: 'office-chair',
    label: 'Operator chair',
    category: 'Environment furniture',
    status: 'review',
    scale: 1.35,
    component: OfficeChair,
  },
  {
    id: 'filing-cabinet',
    label: 'Payables credenza',
    category: 'Environment storage',
    status: 'review',
    scale: 1.25,
    component: FilingCabinet,
  },
  {
    id: 'desk-lamp',
    label: 'Task lamp',
    category: 'Hero desk lighting',
    status: 'review',
    scale: 2.25,
    component: DeskLamp,
  },
  {
    id: 'desk-phone',
    label: 'Finance desk phone',
    category: 'Hero desk communication',
    status: 'review',
    scale: 4.8,
    component: DeskPhone,
  },
  {
    id: 'contractor-nameplate',
    label: 'Head of Finance nameplate',
    category: 'Hero narrative prop',
    status: 'review',
    scale: 2.6,
    component: ContractorNameplate,
  },
  {
    id: 'reject-stamp',
    label: 'Reject rail stamp',
    category: 'Hero decision prop',
    status: 'review',
    scale: 7.1,
    component: RejectStamp,
  },
  {
    id: 'fraud-stamp',
    label: 'Fraud evidence press',
    category: 'Hero decision prop',
    status: 'review',
    scale: 3.6,
    component: FraudStamp,
  },
  {
    id: 'office-service-window',
    label: 'Service window + skyline',
    category: 'Environment architecture',
    status: 'review',
    scale: 0.45,
    component: OfficeServiceWindow,
  },
  {
    id: 'office-plant',
    label: 'Low-cortisol office plant',
    category: 'Environment set dressing',
    status: 'review',
    scale: 1.1,
    component: OfficePlant,
  },
  {
    id: 'office-room-shell',
    label: 'Finance office shell',
    category: 'Environment architecture',
    status: 'review',
    scale: 0.3,
    component: OfficeRoomShell,
  },
  {
    id: 'giraffe-reveal',
    label: 'Chief Growth Officer giraffe',
    category: 'Comedy reveal character',
    status: 'review',
    scale: 0.7,
    component: GiraffeReveal,
  },
] satisfies AssetDefinition[]

const ASSET_DEFINITIONS_BY_ID = new Map(
  ASSET_DEFINITIONS.map((definition) => [definition.id, definition]),
)

export function findAssetDefinition(id: string) {
  return ASSET_DEFINITIONS_BY_ID.get(id)
}

export function getAssetDefinition(id: string) {
  return findAssetDefinition(id) ?? ASSET_DEFINITIONS[0]
}
