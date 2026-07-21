import { lazy, Suspense } from 'react'
import { getLabMode, isAudioLabPath, isGamePath, isOsLabPath } from './config/labRoutes'

const AudioLab = lazy(() => import('./components/lab/AudioLab').then((module) => ({ default: module.AudioLab })))
const ExpenseOSLab = lazy(() => import('./components/os-lab/ExpenseOSLab').then((module) => ({ default: module.ExpenseOSLab })))
const GameShell = lazy(() => import('./game/GameShell').then((module) => ({ default: module.GameShell })))
const LabShell = lazy(() => import('./components/lab/LabShell').then((module) => ({ default: module.LabShell })))

function App() {
  const path = window.location.pathname
  const route = isGamePath(path)
    ? <GameShell />
    : isAudioLabPath(path)
      ? <AudioLab />
      : isOsLabPath(path)
        ? <ExpenseOSLab />
        : <LabShell initialMode={getLabMode(path)} />

  return <Suspense fallback={<div className="webgl-fallback">Loading production lab…</div>}>{route}</Suspense>
}

export default App
