const AUDIO_GROUPS = [
  ['IMPACT', 'Approve stamp', 'Reject stamp', 'Fraud stamp', 'Freeze card'],
  ['PAPER', 'Receipt pickup', 'Paper slide', 'Printer feed', 'Printer jam'],
  ['SYSTEM', 'Slack ping', 'Migration complete', 'Card decline', 'Evidence link'],
  ['AMBIENCE', 'Manual office loop', 'Low cortisol loop', 'Fluorescent hum', 'Giraffe chew'],
]

export function AudioLab() {
  const [candidate, setCandidate] = useState<{ name: string; url: string } | null>(null)

  useEffect(() => () => {
    if (candidate) URL.revokeObjectURL(candidate.url)
  }, [candidate])

  const chooseCandidate = (file?: File) => {
    if (!file) return
    if (candidate) URL.revokeObjectURL(candidate.url)
    setCandidate({ name: file.name, url: URL.createObjectURL(file) })
  }

  return (
    <main className="audio-lab">
      <header className="lab-header">
        <div className="lab-wordmark">
          <span className="lab-kicker">RP / PRODUCTION CONSOLE</span>
          <strong>Audio intake</strong>
        </div>
        <nav className="lab-tabs" aria-label="Production labs">
          <a href="/model-lab">Model floor</a>
          <a href="/animation-lab">Animation stage</a>
          <a href="/scene-lab">Desk scene</a>
          <a href="/effects-lab">Impact deck</a>
          <a className="is-active" href="/audio-lab">Audio intake</a>
        </nav>
        <div className="lab-build-state lab-build-state--pending"><span /> MANIFEST / EMPTY</div>
      </header>

      <section className="audio-workspace">
        <div className="audio-intro">
          <span>Intake queue / 24 required cues</span>
          <h1>Sound has to carry the joke.</h1>
          <p>This route accepts a local prototype reference for immediate audition. Shipping clearance and the final manifest stay a separate gate.</p>
          <label className="audio-import-control">
            Preview local candidate
            <input accept="audio/*" onChange={(event) => chooseCandidate(event.target.files?.[0])} type="file" />
          </label>
          {candidate ? (
            <div className="audio-candidate">
              <strong>{candidate.name}</strong>
              <audio controls src={candidate.url} />
            </div>
          ) : <small>Local preview only · no file is uploaded or added to the manifest.</small>}
        </div>

        <div className="audio-board">
          {AUDIO_GROUPS.map(([group, ...items]) => (
            <section key={group}>
              <header><strong>{group}</strong><span>0 / {items.length}</span></header>
              {items.map((item) => <div className="audio-row" key={item}><span className="audio-play">·</span><span>{item}</span><small>UNSOURCED</small></div>)}
            </section>
          ))}
        </div>
      </section>
    </main>
  )
}
import { useEffect, useState } from 'react'
