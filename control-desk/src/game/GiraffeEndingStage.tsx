import { Canvas } from '@react-three/fiber'
import { GiraffeReveal } from '../models/procedural/GiraffeReveal'

type GiraffeEndingStageProps = {
  onSkip: () => void
}

export function GiraffeEndingStage({ onSkip }: GiraffeEndingStageProps) {
  return (
    <section aria-label="Chief Growth Officer reveal" className="game-giraffe-stage">
      <div className="game-giraffe-window" aria-hidden="true">
        <div className="game-giraffe-skyline" />
        <Canvas camera={{ fov: 25, position: [0, 1.25, 5.8] }} dpr={[1, 1.5]} shadows>
          <ambientLight color="#d8e8df" intensity={1.15} />
          <directionalLight castShadow color="#fff1ce" intensity={2.3} position={[3.2, 5.5, 4.8]} />
          <pointLight color="#e97645" intensity={4.2} position={[-2.4, 1.8, 2.5]} />
          <GiraffeReveal effectPreset="migration" effectRun={1} position={[0, -0.65, 0]} />
        </Canvas>
        <div className="game-giraffe-window-frame" />
        <div className="game-giraffe-glass" />
      </div>

      <div className="game-giraffe-caption">
        <span>EMPLOYEE SERVICE WINDOW</span>
        <strong>Chief Growth Officer</strong>
        <small>Badge verified · start date: Monday</small>
      </div>

      <button className="game-giraffe-skip" onClick={onSkip} type="button">
        Cut to title
      </button>
    </section>
  )
}
