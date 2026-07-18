import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('R3F stage failed', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="webgl-fallback" role="alert">
        <div>
          <strong>3D stage halted</strong>
          <p>{this.state.error.message}</p>
          <button onClick={() => window.location.reload()} type="button">Reload WebGL stage</button>
        </div>
      </div>
    )
  }
}
