import { useEffect, useState } from 'react'
import { LabHeader } from './LabHeader'

const AUDIO_GROUPS = [
  { cues: ['Approve stamp', 'Reject stamp', 'Fraud stamp', 'Freeze card'], label: 'IMPACT' },
  { cues: ['Receipt pickup', 'Paper slide', 'Printer feed', 'Printer jam'], label: 'PAPER' },
  { cues: ['Slack ping', 'Migration complete', 'Card decline', 'Evidence link'], label: 'SYSTEM' },
  { cues: ['Manual office loop', 'Low cortisol loop', 'Fluorescent hum', 'Giraffe chew'], label: 'AMBIENCE' },
] as const

const AUDIO_CUE_COUNT = AUDIO_GROUPS.reduce((total, group) => total + group.cues.length, 0)

export function AudioLab() {
  const [candidate, setCandidate] = useState<{ name: string; url: string } | null>(null)

  useEffect(() => () => {
    if (candidate) URL.revokeObjectURL(candidate.url)
  }, [candidate])

  const chooseCandidate = (file?: File) => {
    if (!file) return
    setCandidate({ name: file.name, url: URL.createObjectURL(file) })
  }

  return (
    <main className="audio-lab">
      <LabHeader
        activePath="/audio-lab"
        status="MANIFEST / EMPTY"
        statusPending
        title="Audio intake"
      />

      <section className="audio-workspace">
        <div className="audio-intro">
          <span>Intake queue / {AUDIO_CUE_COUNT} currently tracked cues</span>
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
          {AUDIO_GROUPS.map((group) => (
            <section key={group.label}>
              <header><strong>{group.label}</strong><span>0 / {group.cues.length}</span></header>
              {group.cues.map((cue) => <div className="audio-row" key={cue}><span className="audio-play">·</span><span>{cue}</span><small>UNSOURCED</small></div>)}
            </section>
          ))}
        </div>
      </section>
    </main>
  )
}
