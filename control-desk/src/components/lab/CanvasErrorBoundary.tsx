import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  resetKeys?: readonly unknown[]
}
type State = {
  error: Error | null
  resetKeys: readonly unknown[]
}

export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKeys: this.props.resetKeys ?? [] }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    const nextKeys = props.resetKeys ?? []
    const changed = state.resetKeys.length !== nextKeys.length
      || nextKeys.some((key, index) => !Object.is(key, state.resetKeys[index]))

    return changed ? { error: null, resetKeys: nextKeys } : null
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
