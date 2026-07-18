import type { ComponentType } from 'react'
import type { ThreeElements } from '@react-three/fiber'
import type { EffectPreset } from '../store/useLabStore'

export type ProceduralAssetProps = ThreeElements['group'] & {
  effectPreset?: EffectPreset
  effectRun?: number
  onGameAction?: (action: 'calculator-complete' | 'freeze-card') => void
  selected?: boolean
}

export type AssetDefinition = {
  id: string
  label: string
  category: string
  status: 'review' | 'wip' | 'blocked'
  scale: number
  component: ComponentType<ProceduralAssetProps>
}
