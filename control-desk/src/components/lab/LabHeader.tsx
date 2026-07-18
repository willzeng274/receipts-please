import { LAB_ROUTES, type LabRoute } from '../../config/labRoutes'

type LabHeaderProps = {
  activePath: string
  status: string
  statusPending?: boolean
  title: string
  onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>, route: LabRoute) => void
}

export function LabHeader({
  activePath,
  onNavigate,
  status,
  statusPending = false,
  title,
}: LabHeaderProps) {
  return (
    <header className="lab-header">
      <div className="lab-wordmark">
        <span className="lab-kicker">RP / PRODUCTION CONSOLE</span>
        <strong>{title}</strong>
      </div>

      <nav className="lab-tabs" aria-label="Production labs">
        {LAB_ROUTES.map((route) => (
          <a
            className={route.path === activePath ? 'is-active' : ''}
            href={route.path}
            key={route.path}
            onClick={onNavigate ? (event) => onNavigate(event, route) : undefined}
          >
            {route.label}
          </a>
        ))}
      </nav>

      <div
        className={`lab-build-state${statusPending ? ' lab-build-state--pending' : ''}`}
        title="Local development environment"
      >
        <span aria-hidden="true" />
        {status}
      </div>
    </header>
  )
}
