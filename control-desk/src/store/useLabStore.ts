import { create } from 'zustand'

export type LabMode = 'models' | 'effects' | 'animation' | 'scene'
export type LightingPreset = 'manual' | 'studio' | 'ramp' | 'night'
export type CameraPreset = 'overview' | 'inspection' | 'player' | 'profile' | 'left' | 'rear' | 'high' | 'low'
export type EffectPreset = 'paper-drop' | 'approve' | 'reject' | 'fraud' | 'printer-jam' | 'migration'
export type ExperiencePhase = 'manual' | 'migrating' | 'ramp'
export type RenderQuality = 'low' | 'default' | 'capture'

export const RAMP_MIGRATION_STEPS = [
  'Importing cards',
  'Matching receipts',
  'Applying company policy',
  'Syncing travel',
  'Connecting vendors',
  'Reviewing transactions',
] as const

type LabState = {
  assetId: string
  cameraPreset: CameraPreset
  cameraRun: number
  compositionId: string
  effectPreset: EffectPreset
  effectRun: number
  experiencePhase: ExperiencePhase
  fillLightScale: number
  gridVisible: boolean
  keyLightScale: number
  lightingPreset: LightingPreset
  mode: LabMode
  performanceVisible: boolean
  renderQuality: RenderQuality
  rampPromptVisible: boolean
  rampMigrationStep: number
  rampTransitionRun: number
  reducedMotion: boolean
  giraffeFocused: boolean
  giraffeFocusRun: number
  beginRampTransition: () => void
  advanceRampMigration: () => void
  completeRampTransition: () => void
  exitGiraffeFocus: () => void
  queueRampIntroduction: () => void
  runGiraffeReveal: () => void
  setAssetId: (assetId: string) => void
  setCameraPreset: (cameraPreset: CameraPreset) => void
  setCompositionId: (compositionId: string) => void
  setFillLightScale: (fillLightScale: number) => void
  setGridVisible: (gridVisible: boolean) => void
  setKeyLightScale: (keyLightScale: number) => void
  setLightingPreset: (lightingPreset: LightingPreset) => void
  setMode: (mode: LabMode) => void
  setPerformanceVisible: (performanceVisible: boolean) => void
  setRenderQuality: (renderQuality: RenderQuality) => void
  setReducedMotion: (reducedMotion: boolean) => void
  resetCamera: () => void
  triggerEffect: (effectPreset: EffectPreset) => void
  workstationFocused: boolean
  setWorkstationFocused: (workstationFocused: boolean) => void
}

export const useLabStore = create<LabState>((set) => ({
  assetId: 'approval-stamp',
  cameraPreset: 'inspection',
  cameraRun: 0,
  compositionId: 'stamp-paper',
  effectPreset: 'approve',
  effectRun: 0,
  experiencePhase: 'manual',
  fillLightScale: 1,
  gridVisible: true,
  keyLightScale: 1,
  lightingPreset: 'studio',
  mode: 'models',
  performanceVisible: false,
  renderQuality: 'low',
  rampPromptVisible: false,
  rampMigrationStep: 0,
  rampTransitionRun: 0,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  giraffeFocused: false,
  giraffeFocusRun: 0,
  beginRampTransition: () => set((state) => ({
    effectPreset: 'migration',
    effectRun: state.effectRun + 1,
    experiencePhase: 'migrating',
    giraffeFocused: false,
    lightingPreset: 'night',
    rampMigrationStep: 0,
    rampPromptVisible: false,
    rampTransitionRun: state.rampTransitionRun + 1,
    workstationFocused: false,
  })),
  advanceRampMigration: () => set((state) => {
    if (state.experiencePhase !== 'migrating') return state
    const nextStep = state.rampMigrationStep + 1
    if (nextStep >= RAMP_MIGRATION_STEPS.length) {
      return {
        experiencePhase: 'ramp',
        lightingPreset: 'ramp',
        rampMigrationStep: RAMP_MIGRATION_STEPS.length,
      }
    }
    return { rampMigrationStep: nextStep }
  }),
  completeRampTransition: () => set({
    experiencePhase: 'ramp',
    lightingPreset: 'ramp',
    rampMigrationStep: RAMP_MIGRATION_STEPS.length,
  }),
  exitGiraffeFocus: () => set({ giraffeFocused: false }),
  queueRampIntroduction: () => set({
    experiencePhase: 'manual',
    giraffeFocused: false,
    lightingPreset: 'manual',
    rampMigrationStep: 0,
    rampPromptVisible: true,
    workstationFocused: true,
  }),
  runGiraffeReveal: () => set((state) => ({
    effectPreset: 'migration',
    effectRun: state.effectRun + 1,
    giraffeFocused: true,
    giraffeFocusRun: state.giraffeFocusRun + 1,
    workstationFocused: false,
  })),
  setAssetId: (assetId) => set({ assetId }),
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  setCompositionId: (compositionId) => set({
    compositionId,
    ...(compositionId === 'giraffe-window'
      ? { effectPreset: 'paper-drop' as const, effectRun: 0 }
      : {}),
  }),
  setFillLightScale: (fillLightScale) => set({ fillLightScale }),
  setGridVisible: (gridVisible) => set({ gridVisible }),
  setKeyLightScale: (keyLightScale) => set({ keyLightScale }),
  setLightingPreset: (lightingPreset) => set({ lightingPreset }),
  setMode: (mode) => set((state) => ({
    giraffeFocused: mode === 'scene' ? state.giraffeFocused : false,
    mode,
    rampPromptVisible: mode === 'scene' ? state.rampPromptVisible : false,
    workstationFocused: mode === 'scene' ? state.workstationFocused : false,
  })),
  setPerformanceVisible: (performanceVisible) => set({ performanceVisible }),
  setRenderQuality: (renderQuality) => set({ renderQuality }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  resetCamera: () => set((state) => ({ cameraRun: state.cameraRun + 1 })),
  triggerEffect: (effectPreset) => set((state) => ({ effectPreset, effectRun: state.effectRun + 1 })),
  workstationFocused: false,
  setWorkstationFocused: (workstationFocused) => set((state) => ({
    giraffeFocused: workstationFocused ? false : state.giraffeFocused,
    workstationFocused,
  })),
}))
