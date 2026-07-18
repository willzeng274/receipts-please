import { useEffect } from 'react'
import type { LabMode } from '../../store/useLabStore'
import { useLabStore } from '../../store/useLabStore'
import { AssetRail } from './AssetRail'
import { EffectDeck } from './EffectDeck'
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
      const path = window.location.pathname
      setMode(path === '/animation-lab' ? 'animation' : path === '/scene-lab' ? 'scene' : path === '/effects-lab' ? 'effects' : 'models')
    }
    window.addEventListener('popstate', syncModeFromLocation)
    return () => window.removeEventListener('popstate', syncModeFromLocation)
  }, [setMode])

  const navigateLab = (event: React.MouseEvent<HTMLAnchorElement>, path: string, nextMode: LabMode) => {
    event.preventDefault()
    window.history.pushState({}, '', path)
    setMode(nextMode)
  }

  return (
    <main className={`lab-shell lab-shell--${mode}`}>
      <header className="lab-header">
        <div className="lab-wordmark">
          <span className="lab-kicker">RP / PRODUCTION CONSOLE</span>
          <strong>Artifact inspection</strong>
        </div>

        <nav className="lab-tabs" aria-label="Production labs">
          <a className={mode === 'models' ? 'is-active' : ''} href="/model-lab" onClick={(event) => navigateLab(event, '/model-lab', 'models')}>
            Model floor
          </a>
          <a className={mode === 'animation' ? 'is-active' : ''} href="/animation-lab" onClick={(event) => navigateLab(event, '/animation-lab', 'animation')}>
            Animation stage
          </a>
          <a className={mode === 'scene' ? 'is-active' : ''} href="/scene-lab" onClick={(event) => navigateLab(event, '/scene-lab', 'scene')}>
            Desk scene
          </a>
          <a className={mode === 'effects' ? 'is-active' : ''} href="/effects-lab" onClick={(event) => navigateLab(event, '/effects-lab', 'effects')}>
            System FX
          </a>
          <a href="/audio-lab">Audio intake</a>
        </nav>

        <div className="lab-build-state" title="Local development environment">
          <span aria-hidden="true" />
          LOCAL / READY
        </div>
      </header>

      <section className="lab-body">
        {mode === 'models' || mode === 'effects' ? <AssetRail /> : <StageRail mode={mode} />}
        <LabViewport />
      </section>

      <EffectDeck />
    </main>
  )
}
