import { useCallback, useEffect, useRef, useState } from 'react'
import { LabViewport } from '../components/lab/LabViewport'
import { useLabStore } from '../store/useLabStore'
import { ENDING_CASE, GAME_CASES } from './gameData'
import { GameDeskHud } from './GameDeskHud'
import { GiraffeEndingStage } from './GiraffeEndingStage'
import { GAME_AUDIO_EVENT, type GameAudioRequest } from './gameAudio'
import { useGameStore } from './useGameStore'

type AudioCue = { id: string; loop: boolean; path: string }
type AudioCatalog = { assets: AudioCue[] }

function formatElapsed(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function GameShell() {
  const caseIndex = useGameStore((state) => state.caseIndex)
  const completeGame = useGameStore((state) => state.completeGame)
  const decisions = useGameStore((state) => state.decisions)
  const elapsedSeconds = useGameStore((state) => state.elapsedSeconds)
  const feedback = useGameStore((state) => state.feedback)
  const finishMigration = useGameStore((state) => state.finishMigration)
  const paused = useGameStore((state) => state.paused)
  const phase = useGameStore((state) => state.phase)
  const resetGame = useGameStore((state) => state.resetGame)
  const score = useGameStore((state) => state.score)
  const soundEnabled = useGameStore((state) => state.soundEnabled)
  const startGame = useGameStore((state) => state.startGame)
  const tick = useGameStore((state) => state.tick)
  const experiencePhase = useLabStore((state) => state.experiencePhase)
  const resetExperience = useLabStore((state) => state.resetExperience)
  const rampMigrationStep = useLabStore((state) => state.rampMigrationStep)
  const setCameraPreset = useLabStore((state) => state.setCameraPreset)
  const setGridVisible = useLabStore((state) => state.setGridVisible)
  const setMode = useLabStore((state) => state.setMode)
  const setPerformanceVisible = useLabStore((state) => state.setPerformanceVisible)
  const setRenderQuality = useLabStore((state) => state.setRenderQuality)
  const setWorkstationFocused = useLabStore((state) => state.setWorkstationFocused)
  const [audioReady, setAudioReady] = useState(false)
  const [calmBeat, setCalmBeat] = useState(false)
  const [endingStep, setEndingStep] = useState(0)
  const catalog = useRef(new Map<string, AudioCue>())
  const ambience = useRef<HTMLAudioElement | null>(null)
  const ambienceId = useRef<string | null>(null)
  const oneShots = useRef(new Set<HTMLAudioElement>())
  const preloadedAudio = useRef<HTMLAudioElement[]>([])
  const previousCase = useRef(-1)
  const previousFeedback = useRef<typeof feedback>(null)
  const previousMigrationStep = useRef(0)

  const playCue = useCallback((id: string, volume = 0.68) => {
    if (!useGameStore.getState().soundEnabled) return
    const cue = catalog.current.get(id)
    if (!cue) return
    const audio = new Audio(cue.path)
    audio.volume = volume
    oneShots.current.add(audio)
    audio.addEventListener('ended', () => oneShots.current.delete(audio), { once: true })
    void audio.play().catch(() => oneShots.current.delete(audio))
  }, [])

  const switchAmbience = useCallback((id: string) => {
    if (ambience.current && ambienceId.current === id) {
      if (useGameStore.getState().soundEnabled) void ambience.current.play().catch(() => {})
      return
    }
    ambience.current?.pause()
    ambience.current = null
    ambienceId.current = null
    if (!useGameStore.getState().soundEnabled) return
    const cue = catalog.current.get(id)
    if (!cue) return
    const audio = new Audio(cue.path)
    audio.loop = true
    audio.volume = 0.24
    ambience.current = audio
    ambienceId.current = id
    void audio.play().catch(() => {
      if (ambience.current !== audio) return
      ambience.current = null
      ambienceId.current = null
    })
  }, [])

  const stopAllAudio = useCallback(() => {
    ambience.current?.pause()
    ambience.current = null
    ambienceId.current = null
    oneShots.current.forEach((audio) => audio.pause())
    oneShots.current.clear()
  }, [])

  useEffect(() => {
    const onAudioCue = (event: Event) => {
      const request = (event as CustomEvent<GameAudioRequest>).detail
      if (request) playCue(request.id, request.volume)
    }
    window.addEventListener(GAME_AUDIO_EVENT, onAudioCue)
    return () => window.removeEventListener(GAME_AUDIO_EVENT, onAudioCue)
  }, [playCue])

  useEffect(() => {
    let active = true
    fetch('/audio/prototype-catalog.json')
      .then((response) => response.ok ? response.json() as Promise<AudioCatalog> : Promise.reject(new Error(`Audio ${response.status}`)))
      .then((nextCatalog) => {
        if (!active) return
        catalog.current = new Map(nextCatalog.assets.map((cue) => [cue.id, cue]))
        preloadedAudio.current = nextCatalog.assets.map((cue) => {
          const audio = new Audio(cue.path)
          audio.preload = 'auto'
          return audio
        })
        setAudioReady(true)
      })
      .catch(() => { /* The game remains playable when prototype audio is absent. */ })
    return () => {
      active = false
      stopAllAudio()
      preloadedAudio.current.forEach((audio) => {
        audio.removeAttribute('src')
        audio.load()
      })
      preloadedAudio.current = []
    }
  }, [stopAllAudio])

  useEffect(() => {
    resetGame()
    resetExperience()
    setMode('scene')
    setCameraPreset('player')
    setGridVisible(false)
    setPerformanceVisible(false)
    setRenderQuality('low')
    setWorkstationFocused(false)
  }, [resetExperience, resetGame, setCameraPreset, setGridVisible, setMode, setPerformanceVisible, setRenderQuality, setWorkstationFocused])

  useEffect(() => {
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [tick])

  useEffect(() => {
    if (phase === 'migrating' && experiencePhase === 'ramp') {
      finishMigration()
      setWorkstationFocused(true)
      playCue('monitor-power-on', 0.58)
      playCue('migration-complete', 0.72)
      setCalmBeat(true)
      switchAmbience('low-cortisol-music-loop')
    }
  }, [experiencePhase, finishMigration, phase, playCue, setWorkstationFocused, switchAmbience])

  useEffect(() => {
    if (!feedback || feedback === previousFeedback.current) return
    previousFeedback.current = feedback
    playCue(feedback.correct ? 'decision-correct' : 'decision-wrong', 0.62)
    if (!feedback.correct) playCue('paper-crumple', 0.34)
    playCue(feedback.decision === 'approve' ? 'approve-stamp' : feedback.decision === 'reject' ? 'reject-stamp' : 'fraud-stamp', 0.55)
  }, [feedback, playCue])

  useEffect(() => {
    if (!['manual', 'ramp'].includes(phase) || previousCase.current === caseIndex) return
    previousCase.current = caseIndex
    playCue('paper-pickup', 0.5)
  }, [caseIndex, phase, playCue])

  useEffect(() => {
    if (soundEnabled && !paused) {
      if (phase === 'manual') switchAmbience('manual-adaptive-music-loop')
      else if (phase === 'ramp' && !calmBeat) switchAmbience('ramp-adaptive-music-loop')
      return
    }
    ambience.current?.pause()
    oneShots.current.forEach((audio) => audio.pause())
  }, [audioReady, calmBeat, paused, phase, soundEnabled, switchAmbience])

  useEffect(() => {
    if (!calmBeat) return
    const calmTimer = window.setTimeout(() => setCalmBeat(false), 2400)
    return () => window.clearTimeout(calmTimer)
  }, [calmBeat])

  useEffect(() => {
    if (phase === 'overload') {
      playCue('printer-jam', 0.68)
      playCue('slack-ping', 0.55)
      const phoneTimer = window.setTimeout(() => playCue('phone-ring', 0.5), 520)
      return () => window.clearTimeout(phoneTimer)
    }
    if (phase === 'migrating') {
      ambience.current?.pause()
      playCue('monitor-power-off', 0.62)
      playCue('office-light-flicker', 0.54)
    }
  }, [phase, playCue])

  useEffect(() => {
    if (phase !== 'migrating') {
      previousMigrationStep.current = 0
      return
    }
    if (rampMigrationStep === previousMigrationStep.current) return
    previousMigrationStep.current = rampMigrationStep
    playCue('evidence-link', 0.4)
  }, [phase, playCue, rampMigrationStep])

  useEffect(() => {
    if (phase !== 'ending') return
    setWorkstationFocused(false)
    ambience.current?.pause()
  }, [phase, setWorkstationFocused])

  useEffect(() => {
    if (phase !== 'ending' || endingStep !== 1) return
    const chewTimer = window.setTimeout(() => playCue('giraffe-chew', 0.54), 2500)
    const badgeTimer = window.setTimeout(() => playCue('badge-jingle', 0.62), 3200)
    const titleTimer = window.setTimeout(completeGame, 5100)
    return () => {
      window.clearTimeout(chewTimer)
      window.clearTimeout(badgeTimer)
      window.clearTimeout(titleTimer)
    }
  }, [completeGame, endingStep, phase, playCue])

  const handleStart = () => {
    startGame()
    setWorkstationFocused(false)
    switchAmbience('manual-adaptive-music-loop')
    playCue('paper-pickup', 0.52)
  }

  const handleReveal = () => {
    setEndingStep(1)
    playCue('slack-ping', 0.6)
    playCue('card-decline', 0.62)
  }

  const handleRestart = () => {
    stopAllAudio()
    setCalmBeat(false)
    setEndingStep(0)
    previousCase.current = -1
    previousFeedback.current = null
    resetGame()
    resetExperience()
    setMode('scene')
    setCameraPreset('player')
  }

  const correct = decisions.filter((decision) => decision.correct).length
  const rating = score >= 1400 ? 'Audit legend' : score >= 1100 ? 'Controller material' : score >= 700 ? 'Still employed' : 'Please see HR'
  const endingTransaction = ENDING_CASE.comparisonRecords.transaction as { amountCents: number; category: string; memo: string; merchant: string; result: string }

  return (
    <main className="game-shell">
      <LabViewport />
      <GameDeskHud />

      {phase === 'briefing' && (
        <section className="game-cold-open">
          <span>0:00–0:20 · FINANCE OPS · 11:54 AM</span>
          <h2>Need these cleared before lunch.</h2>
          <p>The first receipt is waiting on the desk and its transaction is already open. Pick it up to begin the shift.</p>
          <button onClick={handleStart} type="button">Pick up receipt</button>
          <small>Shift clock {formatElapsed(elapsedSeconds)} · mouse only</small>
        </section>
      )}

      {phase === 'ending' && endingStep === 0 && (
        <section className="game-ending-panel">
          <span>4:40–5:00 · INBOX ZERO · LOW CORTISOL 100%</span>
          <h2>CEO: urgent</h2>
          <p>CEO: why did my card decline{`\n`}CEO: can you make a one time exception{`\n`}CEO: he already started monday</p>
          <article><span>{endingTransaction.merchant}</span><strong>{new Intl.NumberFormat('en-US', { currency: 'USD', style: 'currency' }).format(endingTransaction.amountCents / 100)}</strong><small>{endingTransaction.category} · {endingTransaction.memo} · {endingTransaction.result}</small></article>
          <button onClick={handleReveal} type="button">Preserve automatic decline</button>
        </section>
      )}

      {phase === 'ending' && endingStep === 1 && <GiraffeEndingStage onSkip={completeGame} />}

      {phase === 'complete' && (
        <section className="game-title-card">
          <span>THE NEW CHIEF GROWTH OFFICER HAS ARRIVED</span>
          <h1>Receipts,<br />Please</h1>
          <dl><div><dt>Cases reviewed</dt><dd>{decisions.length}/{GAME_CASES.length}</dd></div><div><dt>Correct judgments</dt><dd>{correct}</dd></div><div><dt>Score</dt><dd>{score}</dd></div><div><dt>Rating</dt><dd>{rating}</dd></div><div><dt>Shift time</dt><dd>{formatElapsed(elapsedSeconds)}</dd></div></dl>
          <button onClick={handleRestart} type="button">Review another shift</button>
        </section>
      )}
    </main>
  )
}
