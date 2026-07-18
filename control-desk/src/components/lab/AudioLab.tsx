import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LabHeader } from './LabHeader'

type PrototypeCue = {
  auditioned: boolean
  durationSeconds: number
  id: string
  loop: boolean
  path: string
  role: string
  status: string
  tags: string[]
  title: string
}

type PrototypeCatalog = {
  assets: PrototypeCue[]
  distribution: string
  lane: string
}

type CaseAudioEntry = {
  available: string[]
  caseId: string
  direction: string
  planned: string[]
  title: string
}

type CaseAudioPlan = {
  cases: CaseAudioEntry[]
}

const AUDIO_GROUPS = [
  { cueIds: ['paper-pickup', 'paper-slide', 'receipt-drop', 'paper-crumple'], label: 'PAPER' },
  { cueIds: ['calculator-key', 'calculator-print', 'printer-feed', 'printer-jam'], label: 'DESK MECHANISMS' },
  { cueIds: ['stamp-pickup', 'approve-stamp', 'reject-stamp', 'fraud-stamp', 'freeze-cover', 'freeze-button'], label: 'IMPACT' },
  { cueIds: ['evidence-link', 'slack-ping', 'card-decline', 'migration-complete', 'decision-correct', 'decision-wrong'], label: 'SYSTEM' },
  { cueIds: ['phone-ring', 'monitor-power-off', 'monitor-power-on', 'office-light-flicker'], label: 'OFFICE EVENTS' },
  { cueIds: ['giraffe-chew', 'badge-jingle'], label: 'ENDING' },
  { cueIds: ['fluorescent-light-loop', 'printer-motor-loop', 'office-chatter-loop', 'keyboard-typing-loop', 'phone-ringing-loop', 'air-conditioning-loop', 'employee-cough'], label: 'MANUAL AMBIENCE LAYERS' },
  { cueIds: ['soft-office-loop', 'quiet-keyboard-loop', 'gentle-ui-ticks-loop', 'sparse-printer-loop'], label: 'RAMP AMBIENCE LAYERS' },
  { cueIds: ['low-cortisol-music-loop', 'manual-adaptive-music-loop', 'ramp-adaptive-music-loop'], label: 'MUSIC' },
  { cueIds: ['manual-office-loop', 'ramp-office-loop'], label: 'REFERENCE MIXES' },
] as const

export function AudioLab() {
  const [candidate, setCandidate] = useState<{ name: string; url: string } | null>(null)
  const [catalog, setCatalog] = useState<PrototypeCatalog | null>(null)
  const [casePlan, setCasePlan] = useState<CaseAudioPlan | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [playingCueId, setPlayingCueId] = useState<string | null>(null)
  const [selectedCaseId, setSelectedCaseId] = useState('manual-01-amount-mismatch')
  const activeAudio = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([
      fetch('/audio/prototype-catalog.json').then((response) => {
        if (!response.ok) throw new Error(`Audio catalog returned ${response.status}`)
        return response.json() as Promise<PrototypeCatalog>
      }),
      fetch('/audio/case-audio-plan.json').then((response) => {
        if (!response.ok) throw new Error(`Case audio plan returned ${response.status}`)
        return response.json() as Promise<CaseAudioPlan>
      }),
    ]).then(([nextCatalog, nextPlan]) => {
      if (!active) return
      setCatalog(nextCatalog)
      setCasePlan(nextPlan)
    }).catch((error: unknown) => {
      if (!active) return
      setLoadError(error instanceof Error ? error.message : 'Unable to load prototype audio')
    })

    return () => {
      active = false
      activeAudio.current?.pause()
      activeAudio.current = null
    }
  }, [])

  useEffect(() => () => {
    if (candidate) URL.revokeObjectURL(candidate.url)
  }, [candidate])

  const cueById = useMemo(() => new Map(catalog?.assets.map((cue) => [cue.id, cue]) ?? []), [catalog])
  const selectedCase = casePlan?.cases.find((entry) => entry.caseId === selectedCaseId) ?? casePlan?.cases[0]

  const chooseCandidate = (file?: File) => {
    if (!file) return
    setCandidate({ name: file.name, url: URL.createObjectURL(file) })
  }

  const stopPlayback = useCallback(() => {
    activeAudio.current?.pause()
    activeAudio.current = null
    setPlayingCueId(null)
  }, [])

  const playCue = useCallback((cue: PrototypeCue) => {
    if (playingCueId === cue.id) {
      stopPlayback()
      return
    }

    activeAudio.current?.pause()
    const audio = new Audio(cue.path)
    audio.loop = cue.loop
    audio.volume = cue.tags.includes('music') ? 0.34 : cue.tags.includes('ambience') ? 0.42 : 0.72
    audio.addEventListener('ended', () => {
      activeAudio.current = null
      setPlayingCueId(null)
    }, { once: true })
    activeAudio.current = audio
    setPlayingCueId(cue.id)
    void audio.play().catch(() => {
      activeAudio.current = null
      setPlayingCueId(null)
      setLoadError(`Unable to play ${cue.title}`)
    })
  }, [playingCueId, stopPlayback])

  return (
    <main className="audio-lab">
      <LabHeader
        activePath="/audio-lab"
        status={catalog ? `${catalog.assets.length} CUES / PROTOTYPE` : 'AUDIO / LOADING'}
        statusPending={!catalog}
        title="Audio intake"
      />

      <section className="audio-workspace">
        <div className="audio-intro">
          <span>Original prototype pack / {catalog?.assets.length ?? 0} available cues</span>
          <h1>Sound has to carry the joke.</h1>
          <p>The current pack is procedurally synthesized and project-owned. It is ready for local playback and case timing, but every cue remains marked for listening review before shipping.</p>
          <label className="audio-import-control">
            Compare local candidate
            <input accept="audio/*" onChange={(event) => chooseCandidate(event.target.files?.[0])} type="file" />
          </label>
          {candidate ? (
            <div className="audio-candidate">
              <strong>{candidate.name}</strong>
              <audio controls src={candidate.url} />
            </div>
          ) : <small>Use the case selector to see what plays now and what still needs bespoke sourcing.</small>}
          {loadError && <p className="audio-error" role="alert">{loadError}</p>}
        </div>

        <div className="audio-board">
          <section className="audio-case-plan">
            <header><strong>CASE AUDIO DIRECTION</strong><span>{casePlan?.cases.length ?? 0} CASES</span></header>
            <div className="audio-case-controls">
              <label>
                <span>Case</span>
                <select value={selectedCase?.caseId ?? selectedCaseId} onChange={(event) => setSelectedCaseId(event.target.value)}>
                  {casePlan?.cases.map((entry) => <option key={entry.caseId} value={entry.caseId}>{entry.title}</option>)}
                </select>
              </label>
              {selectedCase && (
                <div className="audio-case-detail">
                  <strong>{selectedCase.title}</strong>
                  <p>{selectedCase.direction}</p>
                  <div><span>Available now</span>{selectedCase.available.map((id) => {
                    const cue = cueById.get(id)
                    return cue ? <button key={id} onClick={() => playCue(cue)} type="button">{playingCueId === id ? 'Stop' : 'Play'} · {cue.title}</button> : <em key={id}>{id}</em>
                  })}</div>
                  <div className="is-planned"><span>Planned bespoke</span>{selectedCase.planned.map((id) => <em key={id}>{id.replaceAll('-', ' ')}</em>)}</div>
                </div>
              )}
            </div>
          </section>

          {AUDIO_GROUPS.map((group) => {
            const cues = group.cueIds.map((id) => cueById.get(id)).filter((cue): cue is PrototypeCue => Boolean(cue))
            return (
              <section key={group.label}>
                <header><strong>{group.label}</strong><span>{cues.length} / {group.cueIds.length}</span></header>
                {cues.map((cue) => (
                  <div className="audio-row" key={cue.id}>
                    <button aria-label={`${playingCueId === cue.id ? 'Stop' : 'Play'} ${cue.title}`} className="audio-play" onClick={() => playCue(cue)} type="button">
                      {playingCueId === cue.id ? '■' : '▶'}
                    </button>
                    <span><strong>{cue.title}</strong><small>{cue.role}</small></span>
                    <small>{cue.durationSeconds.toFixed(2)}s · {cue.loop ? 'LOOP' : 'ONE-SHOT'}</small>
                  </div>
                ))}
              </section>
            )
          })}
        </div>
      </section>
    </main>
  )
}
