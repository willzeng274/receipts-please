import type { EffectPreset } from '../../store/useLabStore'

export const EFFECTS: { id: EffectPreset; label: string; key: string }[] = [
  { id: 'paper-drop', label: 'Paper drop', key: '01' },
  { id: 'approve', label: 'Approve', key: '02' },
  { id: 'reject', label: 'Reject', key: '03' },
  { id: 'fraud', label: 'Fraud hit', key: '04' },
  { id: 'printer-jam', label: 'Printer jam', key: '05' },
  { id: 'migration', label: 'Migration', key: '06' },
]
