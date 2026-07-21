import type { LabMode } from '../store/useLabStore'

export type LabRoute = {
  label: string
  mode?: LabMode
  path: string
}

export const LAB_ROUTES: readonly LabRoute[] = [
  { label: 'Play game', path: '/' },
  { label: 'Model floor', mode: 'models', path: '/control' },
  { label: 'Animation stage', mode: 'animation', path: '/animation-lab' },
  { label: 'Desk scene', mode: 'scene', path: '/scene-lab' },
  { label: 'System FX', mode: 'effects', path: '/effects-lab' },
  { label: 'Expense OS', path: '/os-lab' },
  { label: 'Audio intake', path: '/audio-lab' },
]

export function getLabMode(pathname: string): LabMode {
  if (pathname === '/model-lab') return 'models'
  return LAB_ROUTES.find((route) => route.path === pathname)?.mode ?? 'models'
}

export function getLabPath(mode: LabMode): string {
  return LAB_ROUTES.find((route) => route.mode === mode)?.path ?? '/model-lab'
}

export function isAudioLabPath(pathname: string): boolean {
  return pathname === '/audio-lab'
}

export function isOsLabPath(pathname: string): boolean {
  return pathname === '/os-lab' || pathname === '/expense-os-lab'
}

export function isGamePath(pathname: string): boolean {
  return pathname === '/' || pathname === '/game'
}
