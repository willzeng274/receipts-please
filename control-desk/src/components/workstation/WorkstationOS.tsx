import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { enterCalculatorSequence, type CalculatorTape } from '../../calculator'
import {
  type EffectPreset,
  type ExperiencePhase,
} from '../../store/useLabStore'
import { WORKSTATION_CASES_BY_ID, WORKSTATION_CASE_IDS_BY_PHASE } from './caseFixtures'
import { EvidencePinButton, EvidenceScratchpad } from './EvidenceScratchpad'
import { MigrationExperience } from './MigrationExperience'
import type { WorkstationCase, WorkstationDecision, WorkstationReceiptNotification, WorkstationRequiredAction } from './types'
import { useManualReceiptNotifications } from './useManualReceiptNotifications'
import { useWorkstationAudio } from './useWorkstationAudio'
import {
  getWorkstationQueueCounts,
  selectActiveCardFrozen,
  selectHasPendingManualSubmissions,
  selectManualQueueComplete,
  selectRampQueueComplete,
  useWorkstationStore,
} from './useWorkstationStore'
import { ExpenseWorkspace, RecordsApp } from './WorkstationCaseViews'
import {
  INITIAL_CALCULATOR,
  MANUAL_APPS,
  RAMP_APPS,
  getCaseNotices,
  updateCalculator,
  type AppId,
  type CalculatorState,
} from './workstationData'

import './workstation-os.css'

export type WorkstationOSProps = {
  effect?: EffectPreset
  effectRun?: number
  focused: boolean
  migrationLocked?: boolean
  onExit: () => void
  onFocus: () => void
  onAdvanceMigration: () => void
  onTryRamp: () => void
  onGameComplete?: () => void
  onManualQueueComplete?: () => void
  phase?: ExperiencePhase
  migrationStep?: number
  rampPromptVisible?: boolean
}

const EMPTY_EVIDENCE_IDS: readonly string[] = []
const EMPTY_REQUIRED_ACTIONS: readonly WorkstationRequiredAction[] = []

function CalculatorApp({
  activeCase,
  calculator,
  onInput,
  onToggleEvidence,
  pinnedEvidenceIds,
}: {
  activeCase: WorkstationCase
  calculator: CalculatorState
  onInput: (input: string) => void
  onToggleEvidence: (evidenceId: string) => void
  pinnedEvidenceIds: readonly string[]
}) {
  const keys = ['C', 'Backspace', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '±', '0', '.', '=']
  const calculatorEvidence = activeCase.calculator
  const tape = calculator.tape

  return (
    <div className="wsos-calculator-app">
      <section className="wsos-calculator">
        <div className="wsos-calculator-display">
          <span>{calculator.history}</span>
          <strong>{calculator.display}</strong>
        </div>
        <div className="wsos-calculator-keys">
          {keys.map((key) => (
            <button
              className={key === '=' ? 'is-equals' : ['÷', '×', '−', '+'].includes(key) ? 'is-operator' : ''}
              key={key}
              onClick={() => onInput(key)}
              type="button"
            >
              {key === 'Backspace' ? '⌫' : key}
            </button>
          ))}
        </div>
      </section>
      <aside aria-live="polite" className="wsos-calculator-tape">
        <span>Evidence tape</span>
        <h3>{tape ? 'Printed calculation' : calculatorEvidence?.title ?? 'Case calculation'}</h3>
        <p>{tape?.expression ?? 'Enter the case values, then press ='}</p>
        <strong>{tape?.result ?? '--'}</strong>
        <small>{tape?.note ?? 'No tape printed.'}</small>
        <button disabled={!calculatorEvidence} onClick={() => onInput('example')} type="button">
          Enter case values
        </button>
        {calculatorEvidence && <EvidencePinButton disabled={!tape} evidenceId={calculatorEvidence.evidenceId} label="Pin printed tape" onToggle={onToggleEvidence} pinned={pinnedEvidenceIds.includes(calculatorEvidence.evidenceId)} />}
      </aside>
    </div>
  )
}

function calculatorInputs(expression: string) {
  const tokens = expression
    .replaceAll(',', '')
    .replaceAll('-', '−')
    .replaceAll('*', '×')
    .replaceAll('/', '÷')
    .match(/\d+(?:\.\d+)?|[+−×÷]/g) ?? []

  return [...tokens.flatMap((token) => /^[+−×÷]$/.test(token) ? [token] : [...token]), '=']
}

function formatSessionTime(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function WorkstationOS({
  effect,
  effectRun = 0,
  focused,
  migrationLocked = false,
  migrationStep = 0,
  onAdvanceMigration,
  onExit,
  onFocus,
  onGameComplete,
  onManualQueueComplete,
  onTryRamp,
  phase = 'manual',
  rampPromptVisible = false,
}: WorkstationOSProps) {
  const settledPhase = phase === 'ramp' ? 'ramp' : 'manual'
  const apps = settledPhase === 'ramp' ? RAMP_APPS : MANUAL_APPS
  const activeApp = useWorkstationStore((state) => state.activeApp)
  const activeCaseId = useWorkstationStore((state) => state.activeCaseId)
  const advanceToNextCase = useWorkstationStore((state) => state.advanceToNextCase)
  const auditTrail = useWorkstationStore((state) => state.auditTrail)
  const cardFrozen = useWorkstationStore(selectActiveCardFrozen)
  const clearPinnedEvidence = useWorkstationStore((state) => state.clearPinnedEvidence)
  const completeCaseAction = useWorkstationStore((state) => state.completeCaseAction)
  const completedActionsByCase = useWorkstationStore((state) => state.completedActionsByCase)
  const decisions = useWorkstationStore((state) => state.decisions)
  const hasPendingManualSubmissions = useWorkstationStore(selectHasPendingManualSubmissions)
  const manualQueueComplete = useWorkstationStore(selectManualQueueComplete)
  const markReceiptNotificationsRead = useWorkstationStore((state) => state.markReceiptNotificationsRead)
  const pauseSession = useWorkstationStore((state) => state.pauseSession)
  const pinnedEvidenceByCase = useWorkstationStore((state) => state.pinnedEvidenceIds)
  const receiptNotifications = useWorkstationStore((state) => state.receiptNotifications)
  const receiptNotificationRun = useWorkstationStore((state) => state.receiptNotificationRun)
  const rampQueueComplete = useWorkstationStore(selectRampQueueComplete)
  const recordDecision = useWorkstationStore((state) => state.recordDecision)
  const resumeSession = useWorkstationStore((state) => state.resumeSession)
  const session = useWorkstationStore((state) => state.session)
  const startSession = useWorkstationStore((state) => state.startSession)
  const stampedDecisionRequest = useWorkstationStore((state) => state.stampedDecisionRequest)
  const submitNextManualReceipt = useWorkstationStore((state) => state.submitNextManualReceipt)
  const submittedCaseIds = useWorkstationStore((state) => state.submittedCaseIds)
  const setActiveApp = useWorkstationStore((state) => state.setActiveApp)
  const setActiveCase = useWorkstationStore((state) => state.setActiveCase)
  const setCardFrozen = useWorkstationStore((state) => state.setCardFrozen)
  const syncSessionClock = useWorkstationStore((state) => state.syncSessionClock)
  const togglePinnedEvidence = useWorkstationStore((state) => state.togglePinnedEvidence)
  const unreadReceiptNotifications = useWorkstationStore((state) => state.unreadReceiptNotifications)
  const manualCounts = useWorkstationStore(useShallow((state) => getWorkstationQueueCounts(state, 'manual')))
  const rampCounts = useWorkstationStore(useShallow((state) => getWorkstationQueueCounts(state, 'ramp')))
  const [calculator, setCalculator] = useState(INITIAL_CALCULATOR)
  const [pinnedCalculatorTapes, setPinnedCalculatorTapes] = useState<Partial<Record<keyof typeof WORKSTATION_CASES_BY_ID, CalculatorTape>>>({})
  const [dismissedNotices, setDismissedNotices] = useState<string[]>([])
  const [evidenceRailOpen, setEvidenceRailOpen] = useState(true)
  const [noticeRailOpen, setNoticeRailOpen] = useState(false)
  const [receiptAlert, setReceiptAlert] = useState<WorkstationReceiptNotification | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [validationMessage, setValidationMessage] = useState<string | null>(null)
  const { playSound, stopSound } = useWorkstationAudio(soundEnabled)
  const gameCompletionSent = useRef(false)
  const manualCompletionSent = useRef(false)
  const handledStampedDecisionRun = useRef(stampedDecisionRequest?.run ?? 0)
  const rampCompletionAnnounced = useRef(false)
  const previousPhase = useRef<ExperiencePhase>(phase)
  const rampAction = useRef<HTMLButtonElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const rampPromptActive = phase === 'manual' && rampPromptVisible
  const activeCase = WORKSTATION_CASES_BY_ID[activeCaseId]
  const decision = decisions[activeCaseId] ?? 'review'
  const pinnedEvidenceIds = pinnedEvidenceByCase[activeCaseId] ?? EMPTY_EVIDENCE_IDS
  const phaseCounts = settledPhase === 'ramp' ? rampCounts : manualCounts
  const phaseCaseNumber = WORKSTATION_CASE_IDS_BY_PHASE[settledPhase].indexOf(activeCaseId) + 1
  const gameCompletionAvailable = rampQueueComplete && Boolean(onGameComplete)
  const completedActions = completedActionsByCase[activeCaseId] ?? EMPTY_REQUIRED_ACTIONS

  const notices = useMemo(
    () => getCaseNotices(activeCase, settledPhase).filter((notice) => !dismissedNotices.includes(notice.id)),
    [activeCase, dismissedNotices, settledPhase],
  )

  const handleReceiptSubmission = useCallback(() => {
    const notification = submitNextManualReceipt(Date.now())
    if (!notification) return
    setReceiptAlert(notification)
    playSound('notification')
  }, [playSound, submitNextManualReceipt])

  useManualReceiptNotifications({
    enabled: focused
      && phase === 'manual'
      && !rampPromptActive
      && (session.status === 'running' || session.status === 'complete')
      && hasPendingManualSubmissions,
    onSubmit: handleReceiptSubmission,
    ordinal: receiptNotificationRun,
  })

  useEffect(() => {
    if (!receiptAlert) return
    const timeout = window.setTimeout(() => setReceiptAlert(null), 4_200)
    return () => window.clearTimeout(timeout)
  }, [receiptAlert])

  useEffect(() => {
    if (phase === 'manual' && focused && !rampPromptActive) return
    stopSound('notification')
    setReceiptAlert(null)
  }, [focused, phase, rampPromptActive, stopSound])

  useEffect(() => {
    if (!apps.some((app) => app.id === activeApp)) setActiveApp('expenses')
  }, [activeApp, apps, setActiveApp])

  useEffect(() => setCalculator(INITIAL_CALCULATOR), [activeCaseId])

  useEffect(() => setValidationMessage(null), [activeCaseId])

  useEffect(() => {
    if (!focused || phase !== 'manual' || rampPromptActive || session.status !== 'idle') return
    startSession(Date.now())
  }, [focused, phase, rampPromptActive, session.status, startSession])

  useEffect(() => {
    if (session.status !== 'running') return
    const interval = window.setInterval(() => syncSessionClock(Date.now()), 250)
    return () => window.clearInterval(interval)
  }, [session.status, syncSessionClock])

  useEffect(() => {
    if (activeCase.phase !== settledPhase && phase !== 'migrating' && phaseCounts.open > 0) {
      advanceToNextCase(settledPhase)
    }
  }, [activeCase.phase, advanceToNextCase, phase, phaseCounts.open, settledPhase])

  useEffect(() => {
    if (!manualQueueComplete) {
      manualCompletionSent.current = false
      return
    }
    if (manualCompletionSent.current || !onManualQueueComplete) return
    manualCompletionSent.current = true
    onManualQueueComplete()
  }, [manualQueueComplete, onManualQueueComplete])

  useEffect(() => {
    if (!gameCompletionAvailable) {
      rampCompletionAnnounced.current = false
      gameCompletionSent.current = false
      return
    }
    if (rampCompletionAnnounced.current) return
    rampCompletionAnnounced.current = true
    setEvidenceRailOpen(false)
    setNoticeRailOpen(true)
    setActiveApp('expenses')
    playSound('notification')
  }, [gameCompletionAvailable, playSound, setActiveApp])

  useEffect(() => {
    if (!effect || effectRun < 1) return
    const copy = effect === 'paper-drop'
      ? `Receipt received - inbox ${phaseCounts.open}`
      : effect === 'approve'
        ? `Case ${activeCase.caseNumber} approved - audit trail saved`
        : effect === 'reject'
          ? `Case ${activeCase.caseNumber} returned - employee notified`
          : effect === 'fraud'
            ? 'High-risk pattern connected - card controls ready'
            : effect === 'printer-jam'
              ? 'Printer queue stopped - jobs waiting'
              : 'Migration handshake received - unifying workspace'
    setToast(copy)
    const timeout = window.setTimeout(() => setToast(null), effect === 'migration' ? 2100 : 1500)
    return () => window.clearTimeout(timeout)
  }, [activeCase.caseNumber, effect, effectRun, phaseCounts.open])

  const openApp = useCallback((app: AppId) => {
    playSound('navigate')
    setActiveApp(app)
    if (app === 'slack') markReceiptNotificationsRead()
    setToast(null)
  }, [markReceiptNotificationsRead, playSound, setActiveApp])

  const sendCalculatorInput = useCallback((input: string) => {
    if (input === 'example') {
      if (!activeCase.calculator) return
      const inputs = calculatorInputs(activeCase.calculator.expression)
      setCalculator((state) => enterCalculatorSequence({ ...INITIAL_CALCULATOR, tape: state.tape }, inputs))
      playSound('calculator-print')
      return
    }
    playSound(input === '=' ? 'calculator-print' : 'calculator')
    setCalculator((state) => updateCalculator(state, input))
  }, [activeCase.calculator, playSound])

  const handleDecision = useCallback((nextDecision: WorkstationDecision) => {
    const result = recordDecision(nextDecision)

    if (!result?.evidenceComplete || !result.requiredActionsComplete) {
      const missingEvidence = result?.missingEvidenceIds
        .map((id) => activeCase.evidence.find((evidence) => evidence.id === id)?.label ?? id)
        .join(', ')
      const missingActions = result?.missingRequiredActions
        .map((action) => action.replaceAll('-', ' '))
        .join(', ')
      const message = [
        missingEvidence ? `Pin ${missingEvidence}.` : '',
        missingActions ? `Complete ${missingActions}.` : '',
      ].filter(Boolean).join(' ')

      playSound('decision-wrong')
      setValidationMessage(message || 'Connect the required evidence before deciding.')
      setEvidenceRailOpen(true)
      setNoticeRailOpen(false)
      setToast('Decision not saved - evidence is still missing')
      return
    }

    setValidationMessage(null)
    playSound(result.isCorrect ? 'decision-correct' : 'decision-wrong')
    setToast(result.isCorrect
      ? `Decision saved - ${result.scoreDelta} points added`
      : 'Decision saved - audit trail marked for review')
  }, [activeCase.evidence, playSound, recordDecision])

  useEffect(() => {
    if (!stampedDecisionRequest || stampedDecisionRequest.run <= handledStampedDecisionRun.current) return
    handledStampedDecisionRun.current = stampedDecisionRequest.run
    handleDecision(stampedDecisionRequest.decision)
  }, [handleDecision, stampedDecisionRequest])

  const handleToggleEvidence = useCallback((evidenceId: string) => {
    playSound('pin')
    const calculatorEvidence = activeCase.evidence.some((evidence) => evidence.id === evidenceId && evidence.sourceApp === 'calculator')
    if (calculatorEvidence) {
      setPinnedCalculatorTapes((current) => {
        const next = { ...current }
        if (pinnedEvidenceIds.includes(evidenceId)) delete next[activeCaseId]
        else if (calculator.tape) next[activeCaseId] = calculator.tape
        return next
      })
    }
    togglePinnedEvidence(evidenceId)
  }, [activeCase.evidence, activeCaseId, calculator.tape, pinnedEvidenceIds, playSound, togglePinnedEvidence])

  const handleClearEvidence = useCallback(() => {
    clearPinnedEvidence()
    setPinnedCalculatorTapes((current) => {
      const next = { ...current }
      delete next[activeCaseId]
      return next
    })
  }, [activeCaseId, clearPinnedEvidence])

  const handleCardToggle = useCallback(() => {
    if (!cardFrozen) playSound('freeze')
    setCardFrozen(!cardFrozen, activeCaseId)
  }, [activeCaseId, cardFrozen, playSound, setCardFrozen])

  const handleCaseAction = useCallback((action: WorkstationRequiredAction) => {
    if (action === 'freeze-card') {
      if (!cardFrozen) playSound('freeze')
      setCardFrozen(true, activeCaseId)
      return
    }
    playSound('pin')
    completeCaseAction(action, true, activeCaseId)
  }, [activeCaseId, cardFrozen, completeCaseAction, playSound, setCardFrozen])

  const handleGameComplete = useCallback(() => {
    if (gameCompletionSent.current || !onGameComplete) return
    gameCompletionSent.current = true
    onGameComplete()
  }, [onGameComplete])

  const handleTryRamp = useCallback(() => {
    playSound('migration')
    onTryRamp()
  }, [onTryRamp, playSound])

  const handleAdvanceMigration = useCallback(() => {
    playSound('migration')
    onAdvanceMigration()
  }, [onAdvanceMigration, playSound])

  const toggleEvidenceRail = useCallback(() => {
    setEvidenceRailOpen((open) => !open)
    setNoticeRailOpen(false)
  }, [])

  const toggleNoticeRail = useCallback(() => {
    setNoticeRailOpen((open) => {
      if (!open) markReceiptNotificationsRead()
      return !open
    })
    setEvidenceRailOpen(false)
  }, [markReceiptNotificationsRead])

  useEffect(() => {
    if (!focused) return
    root.current?.focus({ preventScroll: true })
  }, [focused])

  useEffect(() => {
    if (previousPhase.current === 'migrating' && phase === 'ramp') {
      playSound('migration-complete')
      if (!focused) onFocus()
    }
    previousPhase.current = phase
  }, [focused, onFocus, phase, playSound])

  useEffect(() => {
    if (!rampPromptActive) return
    rampAction.current?.focus({ preventScroll: true })
  }, [rampPromptActive])

  const containInput = useCallback((event: React.SyntheticEvent) => {
    event.stopPropagation()
  }, [])

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!focused) return
    event.stopPropagation()

    if (rampPromptActive) {
      if (event.key === 'Escape' || event.key === 'Tab') event.preventDefault()
      if (event.key === 'Tab') rampAction.current?.focus({ preventScroll: true })
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      onExit()
      return
    }

    const shortcutIndex = event.key === '0' ? 9 : Number(event.key) - 1
    if ((event.metaKey || event.ctrlKey) && shortcutIndex >= 0 && shortcutIndex < apps.length) {
      event.preventDefault()
      openApp(apps[shortcutIndex].id)
      return
    }

    if ((event.metaKey || event.ctrlKey) && event.key === 'Tab') {
      event.preventDefault()
      const currentIndex = apps.findIndex((app) => app.id === activeApp)
      openApp(apps[(currentIndex + 1) % apps.length].id)
      return
    }

    if (activeApp !== 'calculator' || event.metaKey || event.ctrlKey || event.altKey) return

    if (event.key === 'Enter' && event.target instanceof HTMLElement && event.target.closest('button, a, input, select, textarea')) {
      return
    }

    const keyMap: Record<string, string> = {
      '*': '×',
      '/': '÷',
      '-': '−',
      Enter: '=',
      '=': '=',
      Backspace: 'Backspace',
      Delete: 'C',
      c: 'C',
      C: 'C',
    }
    const input = /^\d$/.test(event.key) || ['.', '+', '%'].includes(event.key) ? event.key : keyMap[event.key]
    if (input) {
      event.preventDefault()
      sendCalculatorInput(input)
    }
  }, [activeApp, apps, focused, onExit, openApp, rampPromptActive, sendCalculatorInput])

  const activeDefinition = apps.find((app) => app.id === activeApp) ?? apps[0]

  return (
    <div
      aria-label="Expense OS finance workstation"
      className={`wsos-root wsos-root--${settledPhase}${focused ? ' is-focused' : ''}`}
      data-phase={phase}
      onClick={containInput}
      onContextMenu={containInput}
      onDoubleClick={containInput}
      onKeyDown={handleKeyDown}
      onPointerCancel={containInput}
      onPointerDown={containInput}
      onPointerMove={containInput}
      onPointerUp={containInput}
      onWheel={containInput}
      ref={root}
      role="application"
      tabIndex={focused && !rampPromptActive ? 0 : -1}
    >
      <div
        aria-hidden={rampPromptActive ? true : undefined}
        className="wsos-interactive-surface"
        inert={rampPromptActive || !focused ? true : undefined}
      >
        <header className="wsos-menu-bar">
          <div className="wsos-menu-left">
            <button aria-label="Open expense workspace" className="wsos-os-mark" onClick={() => openApp('expenses')} type="button">R/P</button>
            <strong>Expense OS</strong>
            <span>Case</span><span>Evidence</span><span>Window</span>
          </div>
          <div className="wsos-menu-right">
            <span className="wsos-case-number">CASE {phaseCaseNumber} / {phaseCounts.total} · INBOX {phaseCounts.open}</span>
            <label className="wsos-cortisol"><span>Cortisol</span><i><b /></i><em>{settledPhase === 'ramp' ? '22%' : '88%'}</em></label>
            <button aria-label={soundEnabled ? 'Mute workstation sounds' : 'Enable workstation sounds'} onClick={() => setSoundEnabled((value) => !value)} type="button">{soundEnabled ? 'VOL' : 'MUTE'}</button>
            <button
              aria-label={session.status === 'paused' ? 'Resume session timer' : 'Pause session timer'}
              disabled={session.status === 'idle' || session.status === 'complete'}
              onClick={() => session.status === 'paused' ? resumeSession(Date.now()) : pauseSession(Date.now())}
              type="button"
            >
              {session.status === 'paused' ? 'RESUME' : session.status === 'complete' ? 'DONE' : 'PAUSE'}
            </button>
            <button aria-label="Toggle evidence scratchpad" className={pinnedEvidenceIds.length ? 'has-notices' : ''} onClick={toggleEvidenceRail} type="button">EVD {pinnedEvidenceIds.length}</button>
            <button aria-label="Toggle notifications" className={notices.length || unreadReceiptNotifications || gameCompletionAvailable ? 'has-notices' : ''} onClick={toggleNoticeRail} type="button">NTF {notices.length + unreadReceiptNotifications + (gameCompletionAvailable ? 1 : 0)}</button>
            <span aria-label={`${session.score} points`}>{session.score} PTS</span>
            <time dateTime={`PT${Math.ceil(session.remainingMs / 1000)}S`}>{formatSessionTime(session.remainingMs)}</time>
            {!rampPromptVisible && <button aria-label="Exit workstation focus" className="wsos-exit" onClick={onExit} type="button">×</button>}
          </div>
        </header>

        <main className="wsos-desktop">
        <div className="wsos-wallpaper-copy" aria-hidden="true"><span>FINANCE OPERATIONS</span><strong>{settledPhase === 'ramp' ? 'Connected judgment' : 'Quarter close / day 19'}</strong></div>

        <section className={`wsos-window${noticeRailOpen || evidenceRailOpen ? ' has-side-rail' : ''}`}>
          <header className="wsos-window-bar">
            <div aria-hidden="true"><i /><i /><i /></div>
            <strong>{activeDefinition.label}</strong>
            <span>{settledPhase === 'ramp' ? `SYNCED · ${phaseCounts.open} NEED ATTENTION` : `LOCAL · ${phaseCounts.open} IN QUEUE`}</span>
          </header>

          <div className="wsos-window-body">
            {activeApp === 'expenses' ? (
              <ExpenseWorkspace
                activeCase={activeCase}
                decision={decision}
                onDecision={handleDecision}
                onOpenApp={openApp}
                onSelectCase={setActiveCase}
                onAction={handleCaseAction}
                onToggleEvidence={handleToggleEvidence}
                phase={settledPhase}
                pinnedEvidenceIds={pinnedEvidenceIds}
                completedActions={completedActions}
                submittedCaseIds={submittedCaseIds}
              />
            ) : activeApp === 'calculator' ? (
              <CalculatorApp
                activeCase={activeCase}
                calculator={calculator}
                onInput={sendCalculatorInput}
                onToggleEvidence={handleToggleEvidence}
                pinnedEvidenceIds={pinnedEvidenceIds}
              />
            ) : (
              <RecordsApp
                activeCase={activeCase}
                app={activeApp}
                cardFrozen={cardFrozen}
                onCardToggle={handleCardToggle}
                onSelectCase={setActiveCase}
                onToggleEvidence={handleToggleEvidence}
                phase={settledPhase}
                pinnedEvidenceIds={pinnedEvidenceIds}
                receiptNotifications={receiptNotifications}
              />
            )}
          </div>

          {evidenceRailOpen && (
            <EvidenceScratchpad
              activeCase={activeCase}
              auditTrail={auditTrail}
              calculatorTape={pinnedCalculatorTapes[activeCaseId]}
              decision={decision}
              onClear={handleClearEvidence}
              onOpenApp={openApp}
              onToggle={handleToggleEvidence}
              pinnedEvidenceIds={pinnedEvidenceIds}
              validationMessage={validationMessage}
            />
          )}

          {noticeRailOpen && (
            <aside className="wsos-notice-rail" aria-label="Workstation notifications">
              <header><span>Notifications</span>{notices.length > 0 && <button onClick={() => setDismissedNotices((current) => [...current, ...notices.map((notice) => notice.id)])} type="button">Clear</button>}</header>
              {notices.length === 0 && receiptNotifications.length === 0 && !gameCompletionAvailable ? <p className="wsos-notice-empty">Nothing waiting. Enjoy the suspicious silence.</p> : notices.map((notice) => (
                <article className={notice.urgent ? 'is-urgent' : ''} key={notice.id}>
                  <div><span>{notice.title}</span><button aria-label={`Dismiss ${notice.title}`} onClick={() => setDismissedNotices((current) => [...current, notice.id])} type="button">×</button></div>
                  <p>{notice.detail}</p>
                  <button onClick={() => openApp(notice.app)} type="button">Open</button>
                </article>
              ))}
              {[...receiptNotifications].reverse().map((notification) => (
                <article className="is-urgent wsos-receipt-notice" key={notification.id}>
                  <div><span>New receipt submitted</span></div>
                  <p>{notification.employeeName} submitted {notification.merchant} for {notification.amount}.</p>
                  <button onClick={() => { setActiveCase(notification.caseId); openApp('expenses') }} type="button">Review receipt</button>
                </article>
              ))}
              {gameCompletionAvailable && (
                <article className="is-urgent">
                  <div><span>CEO / urgent</span></div>
                  <p>Why did my card decline? Exotic Livestock International, $280,000. He already started Monday.</p>
                  <button onClick={handleGameComplete} type="button">Review final hire</button>
                </article>
              )}
            </aside>
          )}
        </section>

        <nav className="wsos-dock" aria-label="Workstation applications">
          {apps.map((app, index) => (
            <button
              aria-label={`Open ${app.label}. Shortcut ${index === 9 ? 0 : index + 1}`}
              className={activeApp === app.id ? 'is-active' : ''}
              key={app.id}
              onClick={() => openApp(app.id)}
              title={`${app.label} · ${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+${index === 9 ? 0 : index + 1}`}
              type="button"
            >
              <span>{app.shortLabel}</span>
              <small>{app.label}</small>
            </button>
          ))}
        </nav>

        <div className="wsos-focus-hint"><kbd>Esc</kbd> exit screen <span>·</span> <kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} {apps.length > 9 ? '1–9, 0' : `1–${apps.length}`}</kbd> switch apps</div>
        </main>
      </div>

      {rampPromptActive && (
        <section aria-labelledby="ramp-intro-title" aria-modal="true" className="wsos-ramp-prompt" role="dialog">
          <div className="wsos-ramp-prompt__eyebrow">
            <img alt="Ramp" src="/brand/ramp-lockup-white.svg" />
            <span>Finance Ops · migration ready</span>
          </div>
          <strong id="ramp-intro-title">Your Ramp workspace is ready.</strong>
          <p>Receipts, policy, travel, vendors, and card controls can now meet in one workspace. Your judgment stays in the loop.</p>
          <dl>
            <div><dt>Expenses checked</dt><dd>{manualCounts.completed}</dd></div>
            <div><dt>Need attention</dt><dd>{rampCounts.open}</dd></div>
          </dl>
          <button onClick={handleTryRamp} ref={rampAction} type="button">Try Ramp</button>
          <small>This is the only way forward.</small>
        </section>
      )}

      {phase === 'migrating' && <MigrationExperience locked={migrationLocked} migrationStep={migrationStep} onAdvance={handleAdvanceMigration} pendingCount={rampCounts.open} />}

      {receiptAlert && phase === 'manual' && (
        <section aria-live="assertive" className="wsos-receipt-alert" role="alert">
          <span>SLACK / FINANCE INBOX</span>
          <strong>NEW RECEIPT SUBMITTED</strong>
          <p>{receiptAlert.employeeName} · {receiptAlert.merchant} · {receiptAlert.amount}</p>
          <button onClick={() => { setActiveCase(receiptAlert.caseId); openApp('expenses'); setReceiptAlert(null) }} type="button">Review now</button>
        </section>
      )}

      {toast && <div aria-live="polite" className="wsos-toast">{toast}</div>}

      {!focused && phase !== 'migrating' && !rampPromptActive && (
        <button className="wsos-focus-gate" onClick={onFocus} type="button">
          <span>{phase === 'ramp' ? 'Ramp workspace ready' : 'Interactive workstation'}</span>
          <strong>Click to focus screen</strong>
          <small>Keyboard input and app controls become active</small>
        </button>
      )}
    </div>
  )
}
