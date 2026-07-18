import { lazy, Suspense } from 'react'
import { getLabMode, isAudioLabPath } from './config/labRoutes'

const AudioLab = lazy(() => import('./components/lab/AudioLab').then((module) => ({ default: module.AudioLab })))
const LabShell = lazy(() => import('./components/lab/LabShell').then((module) => ({ default: module.LabShell })))

function App() {
  const path = window.location.pathname
  const route = isAudioLabPath(path)
    ? <AudioLab />
    : <LabShell initialMode={getLabMode(path)} />

  return <Suspense fallback={<div className="webgl-fallback">Loading production lab…</div>}>{route}</Suspense>
}

export default App
