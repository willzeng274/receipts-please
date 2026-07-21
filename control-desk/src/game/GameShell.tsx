import { useCallback, useEffect, useRef, useState } from 'react'
import { LabViewport } from '../components/lab/LabViewport'
import { WORKSTATION_CASES_BY_ID, WORKSTATION_CASE_IDS_BY_PHASE } from '../components/workstation/caseFixtures'
import { useWorkstationStore } from '../components/workstation/useWorkstationStore'
import { useLabStore } from '../store/useLabStore'
import { GameDeskHud } from './GameDeskHud'
import { GiraffeEndingStage } from './GiraffeEndingStage'
import { GAME_AUDIO_EVENT, type GameAudioRequest } from './gameAudio'
import { useGameStore } from './useGameStore'

import './game.css'

type AudioCue = { id: string; loop: boolean; path: string }
type AudioCatalog = { assets: AudioCue[] }

// Keep the cold-open interaction seamless without downloading the entire
// prototype catalog. Later cues are fetched by the browser when first played.
const INITIAL_AUDIO_PRELOAD_IDS = new Set([
  'manual-adaptive-music-loop',
  'paper-pickup',
])

const POST_RAMP_SPEED_MULTIPLIER = 0.75
const postRampDelay = (baseDelayMs: number) => Math.round(baseDelayMs / POST_RAMP_SPEED_MULTIPLIER)
const POST_RAMP_SPEED = {
  decision: postRampDelay(760),
  ending: postRampDelay(1050),
  evidence: postRampDelay(520),
  migration: postRampDelay(700),
  selectCase: postRampDelay(400),
  action: postRampDelay(620),
} as const

function formatElapsed(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function GameShell() {
  const automationActive = useGameStore((state) => state.automationActive)
  const completeAutomatedQueue = useGameStore((state) => state.completeAutomatedQueue)
  const completeGame = useGameStore((state) => state.completeGame)
  const elapsedSeconds = useGameStore((state) => state.elapsedSeconds)
  const endingContinueRun = useGameStore((state) => state.endingContinueRun)
  const feedback = useGameStore((state) => state.feedback)
  const finishMigration = useGameStore((state) => state.finishMigration)
  const paused = useGameStore((state) => state.paused)
  const phase = useGameStore((state) => state.phase)
  const openDesktopApp = useGameStore((state) => state.openDesktopApp)
  const resetGame = useGameStore((state) => state.resetGame)
  const soundEnabled = useGameStore((state) => state.soundEnabled)
  const setSlackView = useGameStore((state) => state.setSlackView)
  const tick = useGameStore((state) => state.tick)
  const timedOut = useGameStore((state) => state.timedOut)
  const workstationActiveCaseId = useWorkstationStore((state) => state.activeCaseId)
  const workstationClosedCaseIds = useWorkstationStore((state) => state.closedCaseIds)
  const workstationCompletedActions = useWorkstationStore((state) => state.completedActionsByCase)
  const workstationPinnedEvidence = useWorkstationStore((state) => state.pinnedEvidenceIds)
  const workstationSession = useWorkstationStore((state) => state.session)
  const advanceWorkstationCase = useWorkstationStore((state) => state.advanceToNextCase)
  const completeWorkstationAction = useWorkstationStore((state) => state.completeCaseAction)
  const markRampUnlocked = useWorkstationStore((state) => state.markRampUnlocked)
  const recordWorkstationDecision = useWorkstationStore((state) => state.recordDecision)
  const resetWorkstation = useWorkstationStore((state) => state.resetWorkstation)
  const setWorkstationCardFrozen = useWorkstationStore((state) => state.setCardFrozen)
  const toggleWorkstationEvidence = useWorkstationStore((state) => state.togglePinnedEvidence)
  const advanceRampMigration = useLabStore((state) => state.advanceRampMigration)
  const experiencePhase = useLabStore((state) => state.experiencePhase)
  const exitGiraffeFocus = useLabStore((state) => state.exitGiraffeFocus)
  const resetExperience = useLabStore((state) => state.resetExperience)
  const rampMigrationStep = useLabStore((state) => state.rampMigrationStep)
  const rampMigrationLocked = useLabStore((state) => state.rampMigrationLocked)
  const runGiraffeReveal = useLabStore((state) => state.runGiraffeReveal)
  const setCameraPreset = useLabStore((state) => state.setCameraPreset)
  const setGridVisible = useLabStore((state) => state.setGridVisible)
  const setMode = useLabStore((state) => state.setMode)
  const setPerformanceVisible = useLabStore((state) => state.setPerformanceVisible)
  const setRenderQuality = useLabStore((state) => state.setRenderQuality)
  const setWorkstationFocused = useLabStore((state) => state.setWorkstationFocused)
  const triggerEffect = useLabStore((state) => state.triggerEffect)
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
  const giraffeRevealRequested = useRef(false)

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
        preloadedAudio.current = nextCatalog.assets
          .filter((cue) => INITIAL_AUDIO_PRELOAD_IDS.has(cue.id))
          .map((cue) => {
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
    setRenderQuality('capture')
    setWorkstationFocused(false)
  }, [resetExperience, resetGame, setCameraPreset, setGridVisible, setMode, setPerformanceVisible, setRenderQuality, setWorkstationFocused])

  useEffect(() => {
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [tick])

  useEffect(() => {
    if (phase === 'migrating' && experiencePhase === 'ramp') {
      markRampUnlocked()
      advanceWorkstationCase('ramp')
      finishMigration()
      setWorkstationFocused(true)
      playCue('monitor-power-on', 0.58)
      playCue('migration-complete', 0.72)
      setCalmBeat(true)
      switchAmbience('low-cortisol-music-loop')
    }
  }, [advanceWorkstationCase, experiencePhase, finishMigration, markRampUnlocked, phase, playCue, setWorkstationFocused, switchAmbience])

  useEffect(() => {
    if (!feedback || feedback === previousFeedback.current) return
    previousFeedback.current = feedback
    playCue(feedback.correct ? 'decision-correct' : 'decision-wrong', 0.62)
    if (!feedback.correct) playCue('paper-crumple', 0.34)
    playCue(feedback.decision === 'approve' ? 'approve-stamp' : feedback.decision === 'reject' ? 'reject-stamp' : 'fraud-stamp', 0.55)
    if (feedback.decision === 'fire') {
      const honkTimer = window.setTimeout(() => playCue('termination-honk', 0.78), 110)
      const airhornTimer = window.setTimeout(() => playCue('termination-airhorn', 0.88), 330)
      const awkwardSilenceTimer = window.setTimeout(() => playCue('employee-cough', 0.5), 2760)
      return () => {
        window.clearTimeout(honkTimer)
        window.clearTimeout(airhornTimer)
        window.clearTimeout(awkwardSilenceTimer)
      }
    }
  }, [feedback, playCue])

  useEffect(() => {
    if (!automationActive || phase !== 'migrating' || experiencePhase !== 'migrating' || rampMigrationLocked) return
    const migrationTimer = window.setTimeout(advanceRampMigration, POST_RAMP_SPEED.migration)
    return () => window.clearTimeout(migrationTimer)
  }, [advanceRampMigration, automationActive, experiencePhase, phase, rampMigrationLocked, rampMigrationStep])

  useEffect(() => {
    if (!automationActive || phase !== 'ramp') return
    const rampCaseIds = WORKSTATION_CASE_IDS_BY_PHASE.ramp
    const rampComplete = rampCaseIds.every((caseId) => workstationClosedCaseIds.includes(caseId))
    if (rampComplete) {
      const endingTimer = window.setTimeout(completeAutomatedQueue, POST_RAMP_SPEED.ending)
      return () => window.clearTimeout(endingTimer)
    }

    const currentCase = WORKSTATION_CASES_BY_ID[workstationActiveCaseId]
    if (currentCase.phase !== 'ramp') {
      const selectTimer = window.setTimeout(() => advanceWorkstationCase('ramp'), POST_RAMP_SPEED.selectCase)
      return () => window.clearTimeout(selectTimer)
    }

    const pinnedEvidence = workstationPinnedEvidence[currentCase.id] ?? []
    const nextEvidence = currentCase.validation.requiredEvidenceIds.find((evidenceId) => !pinnedEvidence.includes(evidenceId))
    if (nextEvidence) {
      const evidenceTimer = window.setTimeout(() => {
        toggleWorkstationEvidence(nextEvidence)
        playCue('evidence-link', 0.38)
        triggerEffect('paper-drop')
      }, POST_RAMP_SPEED.evidence)
      return () => window.clearTimeout(evidenceTimer)
    }

    const completedActions = workstationCompletedActions[currentCase.id] ?? []
    const nextAction = (currentCase.validation.requiredActions ?? []).find((action) => !completedActions.includes(action))
    if (nextAction) {
      const actionTimer = window.setTimeout(() => {
        if (nextAction === 'freeze-card') {
          setWorkstationCardFrozen(true, currentCase.id)
          completeWorkstationAction('freeze-card', true, currentCase.id)
          playCue('freeze-cover', 0.5)
          playCue('freeze-button', 0.64)
          triggerEffect('fraud')
          return
        }
        completeWorkstationAction(nextAction, true, currentCase.id)
        playCue('evidence-link', 0.38)
        triggerEffect('paper-drop')
      }, POST_RAMP_SPEED.action)
      return () => window.clearTimeout(actionTimer)
    }

    const decisionTimer = window.setTimeout(() => {
      recordWorkstationDecision(currentCase.validation.expectedDecision)
    }, POST_RAMP_SPEED.decision)
    return () => window.clearTimeout(decisionTimer)
  }, [advanceWorkstationCase, automationActive, completeAutomatedQueue, completeWorkstationAction, phase, playCue, recordWorkstationDecision, setWorkstationCardFrozen, toggleWorkstationEvidence, triggerEffect, workstationActiveCaseId, workstationClosedCaseIds, workstationCompletedActions, workstationPinnedEvidence])

  useEffect(() => {
    const currentIndex = WORKSTATION_CASE_IDS_BY_PHASE.ramp.indexOf(workstationActiveCaseId)
    if (!['manual', 'ramp'].includes(phase) || previousCase.current === currentIndex) return
    previousCase.current = currentIndex
    playCue('paper-pickup', 0.5)
  }, [phase, playCue, workstationActiveCaseId])

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
    if (phase === 'migration-prompt') {
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
    if (phase === 'migration-prompt') {
      setSlackView('ceo')
      openDesktopApp('slack')
      setWorkstationFocused(true)
      playCue('slack-ping', 0.6)
    }
    if (phase === 'ending') {
      setSlackView('ceo')
      openDesktopApp('slack')
      setWorkstationFocused(true)
      ambience.current?.pause()
      playCue('slack-ping', 0.6)
      playCue('card-decline', 0.62)
    }
    if (phase === 'complete') {
      exitGiraffeFocus()
      setWorkstationFocused(false)
      stopAllAudio()
    }
  }, [exitGiraffeFocus, openDesktopApp, phase, playCue, setSlackView, setWorkstationFocused, stopAllAudio])

  useEffect(() => {
    if (phase !== 'ending' || endingStep !== 0 || endingContinueRun < 1) return
    setEndingStep(1)
  }, [endingContinueRun, endingStep, phase])

  useEffect(() => {
    if (phase !== 'ending' || endingStep !== 1) return
    if (!giraffeRevealRequested.current) {
      giraffeRevealRequested.current = true
      runGiraffeReveal()
    }
    const chewTimer = window.setTimeout(() => playCue('giraffe-chew', 0.54), 2500)
    const badgeTimer = window.setTimeout(() => playCue('badge-jingle', 0.62), 3200)
    const titleTimer = window.setTimeout(completeGame, 5100)
    return () => {
      window.clearTimeout(chewTimer)
      window.clearTimeout(badgeTimer)
      window.clearTimeout(titleTimer)
    }
  }, [completeGame, endingStep, phase, playCue, runGiraffeReveal])

  useEffect(() => {
    if (phase === 'ending') return
    giraffeRevealRequested.current = false
  }, [phase])

  const handleRestart = () => {
    stopAllAudio()
    setCalmBeat(false)
    setEndingStep(0)
    exitGiraffeFocus()
    previousCase.current = -1
    previousFeedback.current = null
    resetGame()
    resetExperience()
    resetWorkstation()
    setMode('scene')
    setCameraPreset('player')
    setRenderQuality('capture')
  }

  const correct = workstationSession.correctCount
  const score = workstationSession.score
  const rating = score >= 1800 ? 'Audit legend' : score >= 1300 ? 'Controller material' : score >= 800 ? 'Still employed' : 'Please see HR'
  const rampCaseCount = WORKSTATION_CASE_IDS_BY_PHASE.ramp.length

  return (
    <main className="game-shell">
      <LabViewport />
      <GameDeskHud />

      {phase === 'ending' && endingStep === 1 && <GiraffeEndingStage onSkip={completeGame} />}

      {phase === 'complete' && (
        <section className="game-title-card">
          <span>{timedOut ? 'SHIFT CLOSED · FIVE-MINUTE LIMIT REACHED' : 'CFO ROLE ELIMINATED · GROWTH BUDGET REALLOCATED'}</span>
          <h1>{timedOut ? <>Time's<br />Up</> : <>Receipts,<br />Please</>}</h1>
          <dl><div><dt>Cases reviewed</dt><dd>{workstationClosedCaseIds.length}/{WORKSTATION_CASE_IDS_BY_PHASE.manual.length + rampCaseCount}</dd></div><div><dt>Correct judgments</dt><dd>{correct}</dd></div><div><dt>Score</dt><dd>{score}</dd></div><div><dt>Rating</dt><dd>{rating}</dd></div><div><dt>Shift time</dt><dd>{formatElapsed(elapsedSeconds)}</dd></div></dl>
          <button onClick={handleRestart} type="button">Review another shift</button>
        </section>
      )}
    </main>
  )
}
