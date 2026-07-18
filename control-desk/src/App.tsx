import { AudioLab } from './components/lab/AudioLab'
import { LabShell } from './components/lab/LabShell'

function App() {
  const path = window.location.pathname

  if (path === '/audio-lab') {
    return <AudioLab />
  }

  const mode = path === '/effects-lab'
    ? 'effects'
    : path === '/animation-lab'
      ? 'animation'
      : path === '/scene-lab'
        ? 'scene'
        : 'models'

  return <LabShell initialMode={mode} />
}

export default App
