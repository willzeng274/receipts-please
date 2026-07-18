import type { LabMode } from '../store/useLabStore'

export type LabRoute = {
  label: string
  mode?: LabMode
  path: string
}

export const LAB_ROUTES: readonly LabRoute[] = [
  { label: 'Play game', path: '/game' },
  { label: 'Model floor', mode: 'models', path: '/model-lab' },
  { label: 'Animation stage', mode: 'animation', path: '/animation-lab' },
  { label: 'Desk scene', mode: 'scene', path: '/scene-lab' },
  { label: 'System FX', mode: 'effects', path: '/effects-lab' },
  { label: 'Audio intake', path: '/audio-lab' },
]

export function getLabMode(pathname: string): LabMode {
  return LAB_ROUTES.find((route) => route.path === pathname)?.mode ?? 'models'
}

export function getLabPath(mode: LabMode): string {
  return LAB_ROUTES.find((route) => route.mode === mode)?.path ?? '/model-lab'
}

export function isAudioLabPath(pathname: string): boolean {
  return pathname === '/audio-lab'
}
