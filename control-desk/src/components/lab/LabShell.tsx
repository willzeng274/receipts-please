import { useEffect } from 'react'
import { getLabMode, getLabPath, type LabRoute } from '../../config/labRoutes'
import type { LabMode } from '../../store/useLabStore'
import { useLabStore } from '../../store/useLabStore'
import { AssetRail } from './AssetRail'
import { EffectDeck } from './EffectDeck'
import { LabHeader } from './LabHeader'
import { LabViewport } from './LabViewport'
import { StageRail } from './StageRail'

type LabShellProps = {
  initialMode: LabMode
}

export function LabShell({ initialMode }: LabShellProps) {
  const mode = useLabStore((state) => state.mode)
  const setMode = useLabStore((state) => state.setMode)

  useEffect(() => setMode(initialMode), [initialMode, setMode])

  useEffect(() => {
    const syncModeFromLocation = () => {
      setMode(getLabMode(window.location.pathname))
    }
    window.addEventListener('popstate', syncModeFromLocation)
    return () => window.removeEventListener('popstate', syncModeFromLocation)
  }, [setMode])

  const navigateLab = (event: React.MouseEvent<HTMLAnchorElement>, route: LabRoute) => {
    if (!route.mode) return
    event.preventDefault()
    window.history.pushState({}, '', route.path)
    setMode(route.mode)
  }

  return (
    <main className={`lab-shell lab-shell--${mode}`}>
      <LabHeader
        activePath={getLabPath(mode)}
        onNavigate={navigateLab}
        status="LOCAL / READY"
        title="Artifact inspection"
      />

      <section className="lab-body">
        {mode === 'models' || mode === 'effects' ? <AssetRail /> : <StageRail mode={mode} />}
        <LabViewport />
      </section>

      <EffectDeck />
    </main>
  )
}
