import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { WorkstationAppIcon } from '../components/workstation/WorkstationAppIcon'
import { WORKSTATION_CASES_BY_ID, WORKSTATION_CASE_IDS_BY_PHASE } from '../components/workstation/caseFixtures'
import { useWorkstationStore } from '../components/workstation/useWorkstationStore'
import { RAMP_MIGRATION_STEPS, useLabStore } from '../store/useLabStore'
import { GAME_CASES, MANUAL_CASE_COUNT, formatMoney, formatReceiptDate, type GameCase } from './gameData'
import { requestGameAudioCue } from './gameAudio'
import { GAME_DURATION_SECONDS, useGameStore, type GameDesktopWindow } from './useGameStore'

import './game.css'
import './expense-os.css'

type DesktopApp = {
  id: string
  label: string
}

const DESKTOP_APPS: readonly DesktopApp[] = [
  { id: 'expenses', label: 'Expenses' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'people', label: 'Directory' },
  { id: 'slack', label: 'Slack' },
  { id: 'policy', label: 'Policy PDF' },
  { id: 'travel', label: 'Travel' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'vendor', label: 'Vendors' },
  { id: 'cards', label: 'Cards' },
  { id: 'ramp', label: 'Ramp' },
]

function formatTime(seconds: number) {
  const remaining = Math.max(0, GAME_DURATION_SECONDS - seconds)
  return `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
}

function employeeName(employee: string) {
  return employee.split(' · ')[0]
}

function sourceKind(source?: string) {
  const value = source?.toLowerCase() ?? ''
  if (value.includes('slack') || value.includes('message')) return 'slack'
  if (value.includes('people') || value.includes('employee')) return 'people'
  if (value.includes('policy')) return 'policy'
  if (value.includes('travel')) return 'travel'
  if (value.includes('vendor') || value.includes('w-9')) return 'vendor'
  if (value.includes('inventory') || value.includes('procurement') || value.includes('purchase')) return 'inventory'
  if (value.includes('calculator')) return 'calculator'
  if (value.includes('card')) return 'cards'
  if (value.includes('transaction') || value.includes('approval')) return 'transactions'
  return 'expenses'
}

function RampIcon() {
  return <span aria-hidden="true" className="exo-ramp-icon"><img alt="" src="/brand/ramp-lockup-white.svg" /></span>
}

function AppIcon({ appId }: { appId: string }) {
  return appId === 'ramp' ? <RampIcon /> : <WorkstationAppIcon app={appId} />
}

type DesktopWindowProps = {
  active: boolean
  appId: string
  children: ReactNode
  status?: string
  title: string
  windowState: GameDesktopWindow
}

function DesktopWindow({ active, appId, children, status, title, windowState }: DesktopWindowProps) {
  const closeDesktopApp = useGameStore((state) => state.closeDesktopApp)
  const focusDesktopApp = useGameStore((state) => state.focusDesktopApp)
  const minimizeDesktopApp = useGameStore((state) => state.minimizeDesktopApp)
  const moveDesktopApp = useGameStore((state) => state.moveDesktopApp)
  const resizeDesktopApp = useGameStore((state) => state.resizeDesktopApp)
  const toggleMaximizeDesktopApp = useGameStore((state) => state.toggleMaximizeDesktopApp)
  const dragState = useRef<{ pointerId: number; startClientX: number; startClientY: number; startX: number; startY: number } | null>(null)
  const resizeState = useRef<{ pointerId: number; startClientX: number; startClientY: number; startHeight: number; startWidth: number } | null>(null)

  if (windowState.minimized) return null

  const beginDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
    event.preventDefault()
    focusDesktopApp(appId)
    dragState.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: windowState.x,
      startY: windowState.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const dragWindow = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragState.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const desktop = event.currentTarget.closest<HTMLElement>('.exo-desktop')
    const windowElement = event.currentTarget.closest<HTMLElement>('.exo-window')
    if (!desktop || !windowElement) return
    const bounds = desktop.getBoundingClientRect()
    const scaleX = bounds.width / desktop.offsetWidth || 1
    const scaleY = bounds.height / desktop.offsetHeight || 1
    const x = Math.max(8, Math.min(desktop.offsetWidth - 44, drag.startX + (event.clientX - drag.startClientX) / scaleX))
    const y = Math.max(8, Math.min(desktop.offsetHeight - 44, drag.startY + (event.clientY - drag.startClientY) / scaleY))
    moveDesktopApp(appId, Math.round(x), Math.round(y))
  }

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragState.current?.pointerId !== event.pointerId) return
    dragState.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const beginResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    focusDesktopApp(appId)
    resizeState.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startHeight: windowState.height,
      startWidth: windowState.width,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const resizeWindow = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const resize = resizeState.current
    if (!resize || resize.pointerId !== event.pointerId) return
    const desktop = event.currentTarget.closest<HTMLElement>('.exo-desktop')
    if (!desktop) return
    const bounds = desktop.getBoundingClientRect()
    const scaleX = bounds.width / desktop.offsetWidth || 1
    const scaleY = bounds.height / desktop.offsetHeight || 1
    const width = Math.max(460, Math.min(desktop.offsetWidth - windowState.x - 8, resize.startWidth + (event.clientX - resize.startClientX) / scaleX))
    const height = Math.max(320, Math.min(desktop.offsetHeight - windowState.y - 8, resize.startHeight + (event.clientY - resize.startClientY) / scaleY))
    resizeDesktopApp(appId, Math.round(width), Math.round(height))
  }

  const endResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (resizeState.current?.pointerId !== event.pointerId) return
    resizeState.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <section
      aria-label={`${title} application window`}
      className={`exo-window exo-window--${appId} ${active ? 'is-active' : 'is-inactive'}`}
      onPointerDown={() => focusDesktopApp(appId)}
      role="dialog"
      style={{ height: windowState.height, transform: `translate3d(${windowState.x}px, ${windowState.y}px, 0)`, width: windowState.width, zIndex: windowState.z }}
    >
      <header
        onDoubleClick={() => toggleMaximizeDesktopApp(appId)}
        onPointerCancel={endDrag}
        onPointerDown={beginDrag}
        onPointerMove={dragWindow}
        onPointerUp={endDrag}
      >
        <div className="exo-window-controls">
          <button aria-label={`Close ${title}`} className="is-close" onClick={() => closeDesktopApp(appId)} type="button"><span>×</span></button>
          <button aria-label={`Minimize ${title}`} className="is-minimize" onClick={() => minimizeDesktopApp(appId)} type="button"><span>−</span></button>
          <button aria-label={`${windowState.maximized ? 'Restore' : 'Maximize'} ${title}`} className="is-center" onClick={() => toggleMaximizeDesktopApp(appId)} type="button"><span>+</span></button>
        </div>
        <strong>{title}</strong>
        <small>{status}</small>
      </header>
      {children}
      <button
        aria-label={`Resize ${title}`}
        className="exo-window-resize"
        onPointerCancel={endResize}
        onPointerDown={beginResize}
        onPointerMove={resizeWindow}
        onPointerUp={endResize}
        type="button"
      />
    </section>
  )
}

function ReceiptDocument({ gameCase }: { gameCase: GameCase }) {
  return (
    <article className={`exo-receipt exo-receipt--${gameCase.receipt.visualTreatmentId}`}>
      <b>{gameCase.receipt.merchant.name}</b>
      <small>{gameCase.receipt.merchant.addressLines[0]}</small>
      <small>{formatReceiptDate(gameCase.receipt.issuedAt)}</small>
      <hr />
      {gameCase.receipt.lineItems.map((line) => (
        <div key={`${line.description}-${line.quantity}`}><span>{line.quantity}× {line.description}</span><strong>{formatMoney(line.lineTotalCents)}</strong></div>
      ))}
      <hr />
      <div><span>Subtotal</span><strong>{formatMoney(gameCase.receipt.amounts.subtotalCents)}</strong></div>
      {gameCase.receipt.amounts.taxCents > 0 && <div><span>Tax</span><strong>{formatMoney(gameCase.receipt.amounts.taxCents)}</strong></div>}
      {gameCase.receipt.amounts.tipCents > 0 && <div><span>Tip</span><strong>{formatMoney(gameCase.receipt.amounts.tipCents)}</strong></div>}
      <div className="is-total"><span>Total</span><strong>{formatMoney(gameCase.receipt.amounts.printedTotalCents)}</strong></div>
      <hr />
      <small>{gameCase.receipt.payment.method} •••• {gameCase.receipt.payment.cardLast4}</small>
    </article>
  )
}

function ExpensesApp({ caseIndex, currentCase }: { caseIndex: number; currentCase: GameCase }) {
  const decisions = useGameStore((state) => state.decisions)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'all' | 'inbox' | 'reviewed'>('all')
  const eraCases = GAME_CASES.filter((entry) => entry.era === currentCase.era)
  const queueCases = eraCases
    .filter((entry) => {
      const absoluteIndex = GAME_CASES.indexOf(entry)
      const matchesTab = tab === 'all' || (tab === 'reviewed' ? absoluteIndex < caseIndex : absoluteIndex >= caseIndex)
      const searchText = `${entry.receipt.merchant.name} ${employeeName(entry.employee)}`.toLowerCase()
      return matchesTab && searchText.includes(query.trim().toLowerCase())
    })
  return (
    <div className="exo-inbox-app">
      <aside>
        <label><span aria-hidden="true">⌕</span><input aria-label="Search expenses" onChange={(event) => setQuery(event.target.value)} placeholder="Search" value={query} /></label>
        <div className="exo-inbox-tabs"><button className={tab === 'all' ? 'is-active' : ''} onClick={() => setTab('all')} type="button">All <b>{eraCases.length}</b></button><button className={tab === 'inbox' ? 'is-active' : ''} onClick={() => setTab('inbox')} type="button">Inbox</button><button className={tab === 'reviewed' ? 'is-active' : ''} onClick={() => setTab('reviewed')} type="button">Reviewed <b>{Math.min(decisions.length, 10)}</b></button></div>
        <div className="exo-case-list">
          {queueCases.map((entry) => {
            const absoluteIndex = GAME_CASES.indexOf(entry)
            return (
              <button className={absoluteIndex === caseIndex ? 'is-current' : ''} key={entry.caseId} type="button">
                <i aria-hidden="true" />
                <span><strong>{entry.receipt.merchant.name}</strong><small>{employeeName(entry.employee)}</small></span>
                <span><b>{formatMoney(entry.receipt.amounts.printedTotalCents)}</b><small>{absoluteIndex < caseIndex ? 'Reviewed' : absoluteIndex === caseIndex ? 'Now' : 'Waiting'}</small></span>
              </button>
            )
          })}
        </div>
      </aside>
      <main>
        <header><div><small>CASE {String(currentCase.sequence).padStart(2, '0')}</small><h2>{currentCase.title}</h2><p>{employeeName(currentCase.employee)}</p></div><span>Receipt in hand</span></header>
        <div className="exo-receipt-stage"><ReceiptDocument gameCase={currentCase} /></div>
        <footer><span>Open source apps from the Dock to compare this receipt.</span><kbd>Esc</kbd><small>Return to desk and stamp</small></footer>
      </main>
    </div>
  )
}

function TransactionsApp({ currentCase }: { currentCase: GameCase }) {
  const records = currentCase.evidence.filter((item) => sourceKind(item.source) === 'transactions')
  const rows = GAME_CASES.filter((entry) => entry.era === currentCase.era).slice(0, 10)
  return (
    <div className="exo-transactions-app">
      <div className="exo-app-toolbar"><div><strong>Card transactions</strong><small>Company activity</small></div><input aria-label="Search transactions" placeholder="Search merchant, cardholder, amount" /><button type="button">Filter</button></div>
      <main><div className="exo-table"><header><span>Merchant</span><span>Employee</span><span>Amount</span><span>Status</span></header>{rows.map((entry) => <div className={entry.caseId === currentCase.caseId ? 'is-selected' : ''} key={entry.caseId}><span>{entry.receipt.merchant.name}</span><span>{entry.employee.split(' · ')[0]}</span><b>{formatMoney(entry.receipt.amounts.printedTotalCents)}</b><em>{entry.caseId === 'manual-02-client-dinner-clean' ? 'VP Sales approved' : entry.caseId === currentCase.caseId ? 'Selected' : 'Cleared'}</em></div>)}</div>{records.map((record) => <section className="exo-detail-strip" key={record.label}><span>{record.label}</span><strong>{record.value}</strong><p>{record.detail}</p></section>)}</main>
    </div>
  )
}

function DirectoryApp({ currentCase }: { currentCase: GameCase }) {
  const [name, role = 'Employee'] = currentCase.employee.split(' · ')
  const [selectedPerson, setSelectedPerson] = useState(name)
  const record = currentCase.evidence.find((item) => sourceKind(item.source) === 'people')
  const selectedRole = selectedPerson === name ? role : 'Employee'
  const startDate = selectedPerson === name && record?.value.startsWith('Started ') ? record.value.replace('Started ', '') : 'On file'
  return <div className="exo-split-app exo-directory-app"><aside><strong>People</strong>{[name, 'Maya Chen', 'Rowan Kim', 'Devon Lee', 'Alex Morgan', 'Sam Patel'].filter((person, index, list) => list.indexOf(person) === index).map((person) => <button className={person === selectedPerson ? 'is-active' : ''} key={person} onClick={() => setSelectedPerson(person)} type="button"><span>{person.split(' ').map((part) => part[0]).join('')}</span>{person}</button>)}</aside><main><div className="exo-profile"><span>{selectedPerson.split(' ').map((part) => part[0]).join('')}</span><div><h2>{selectedPerson}</h2><p>{selectedRole} · Finance cardholder</p></div><button onClick={() => requestGameAudioCue('slack-ping', 0.25)} type="button">Message</button></div><dl><div><dt>Department</dt><dd>{selectedRole}</dd></div><div><dt>Status</dt><dd>Active</dd></div><div><dt>Start date</dt><dd>{startDate}</dd></div><div><dt>Card limit</dt><dd>$5,000 monthly</dd></div></dl><section><small>{selectedPerson === name ? record?.label ?? 'Employee record' : 'Employee record'}</small><strong>{selectedPerson === name ? record?.value ?? 'Directory record available' : 'No case-linked records'}</strong><p>{selectedPerson === name ? record?.detail ?? 'Open the employee record associated with this expense.' : 'This profile is not attached to the receipt under review.'}</p></section></main></div>
}

function SlackApp({ currentCase }: { currentCase: GameCase }) {
  const record = currentCase.evidence.find((item) => sourceKind(item.source) === 'slack')
  const phase = useGameStore((state) => state.phase)
  const requestEndingContinue = useGameStore((state) => state.requestEndingContinue)
  const setSlackView = useGameStore((state) => state.setSlackView)
  const slackView = useGameStore((state) => state.slackView)
  const installRamp = useGameStore((state) => state.installRamp)
  const beginRampTransition = useLabStore((state) => state.beginRampTransition)
  const isCeo = slackView === 'ceo'
  const channelName = slackView === 'travel' ? '# travel-help' : slackView === 'finance' ? '# finance-ops' : 'CEO'
  const startRampMigration = () => {
    installRamp()
    beginRampTransition()
    requestGameAudioCue('monitor-power-off', 0.62)
  }

  return <div className="exo-slack-app"><aside><header><b>Receipts, Please</b><button type="button">⌄</button></header><span>Channels</span><button className={slackView === 'finance' ? 'is-active' : ''} onClick={() => setSlackView('finance')} type="button"># finance-ops</button><button className={slackView === 'travel' ? 'is-active' : ''} onClick={() => setSlackView('travel')} type="button"># travel-help</button><span>Direct messages</span><button className={isCeo ? 'is-active' : ''} onClick={() => setSlackView('ceo')} type="button"><i className="is-online" /> CEO</button><button type="button"><i /> {employeeName(currentCase.employee)}</button></aside><main><header><div><strong>{channelName}</strong><small>{isCeo ? 'Direct message' : slackView === 'finance' ? '12 members' : '8 members'}</small></div><button type="button">Search</button></header><div className="exo-message-thread">{isCeo ? <>
    <article><span>CEO</span><div><header><strong>CEO</strong><time>11:54 AM</time></header><p>Need these cleared before lunch.</p></div></article>
    {['migration-prompt', 'migrating'].includes(phase) && <article className="is-ceo-action"><span>CEO</span><div><header><strong>CEO</strong><time>2:10 PM</time></header><p>The queue is at 47. I approved Ramp—install it and clear the backlog.</p>{phase === 'migration-prompt' ? <button onClick={startRampMigration} type="button">Install Ramp</button> : <small>Ramp installation is running on your desktop.</small>}</div></article>}
    {phase === 'ramp' && <article><span>CEO</span><div><header><strong>CEO</strong><time>4:32 PM</time></header><p>watching ramp clear the queue</p><p>the board is already asking about finance headcount</p></div></article>}
    {['ending', 'complete'].includes(phase) && <article><span>CEO</span><div><header><strong>CEO</strong><time>4:40 PM</time></header><p>ramp cleared the backlog</p><p>so the board eliminated your CFO role</p><p>we reallocated your budget to growth</p><p>also why did the new hire's card decline</p><div className="exo-slack-decline"><small>EXOTIC LIVESTOCK INTERNATIONAL</small><strong>$280,000.00</strong><span>Declined automatically · Recruiting</span>{phase === 'ending' && <button onClick={requestEndingContinue} type="button">Meet your replacement</button>}</div></div></article>}
  </> : <>
    <article><span>CEO</span><div><header><strong>CEO</strong><time>11:54 AM</time></header><p>{slackView === 'finance' ? 'Need these cleared before lunch. Check the source systems before deciding.' : 'Travel evidence lives in the travel portal — itinerary first, receipt second.'}</p></div></article>
    <article><span>{employeeName(currentCase.employee).split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div><header><strong>{employeeName(currentCase.employee)}</strong><time>11:56 AM</time></header><p>{record?.detail ?? 'Let me know if you need anything else from me.'}</p></div></article>
  </>}</div><footer><span>Message {isCeo ? 'CEO' : channelName}</span><button onClick={() => requestGameAudioCue('slack-ping', 0.22)} type="button">Send</button></footer></main></div>
}

function PolicyApp({ currentCase }: { currentCase: GameCase }) {
  const record = currentCase.evidence.find((item) => sourceKind(item.source) === 'policy')
  const [zoom, setZoom] = useState(100)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [page, setPage] = useState(4)
  const pageStyle = { '--exo-pdf-zoom': zoom / 100 } as CSSProperties
  return <div className="exo-policy-app"><div className="exo-pdf-toolbar"><button aria-pressed={sidebarVisible} onClick={() => setSidebarVisible((value) => !value)} type="button">Thumbnails</button><span>Expense Policy.pdf</span><div><button aria-label="Previous page" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">‹</button><b>{page} / 18</b><button aria-label="Next page" disabled={page === 18} onClick={() => setPage((value) => Math.min(18, value + 1))} type="button">›</button><i /><button aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(75, value - 25))} type="button">−</button><b>{zoom}%</b><button aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(150, value + 25))} type="button">+</button></div></div><div className={`exo-pdf-workspace ${sidebarVisible ? 'has-sidebar' : ''}`}>{sidebarVisible && <aside aria-label="Document thumbnails">{[1, 2, 3, 4, 5, 6].map((pageNumber) => <button className={pageNumber === page ? 'is-active' : ''} key={pageNumber} onClick={() => setPage(pageNumber)} type="button"><span><i /><i /><i /></span><b>{pageNumber}</b></button>)}</aside>}<main><div className="exo-pdf-page-wrap" style={pageStyle}><article><header><small>FINANCE OPERATIONS</small><b>EXPENSE POLICY · REV 2026.2</b></header><h2>{page === 4 ? 'Expense documentation and review' : `Company expense policy · ${page}`}</h2>{page === 4 ? <><p>Every card transaction must be supported by a valid receipt that matches the merchant, date, and charged amount.</p><h3>4.2 Business meals</h3><p>Meals are limited to approved business purposes and documented attendees. Expenses outside the stated threshold require review.</p><h3>4.3 Gratuity</h3><p>Tips above 25% require additional explanation and approval.</p>{record && <mark><b>{record.value}</b><span>{record.detail}</span></mark>}</> : <><p>This section defines company card use, documentation standards, approval routing, and the records Finance must retain.</p><h3>{page}.1 General requirements</h3><p>Expenses must have a clear business purpose, an accountable owner, and supporting documentation.</p><h3>{page}.2 Review controls</h3><p>Finance may request additional evidence before closing an exception.</p></>}<footer><span>Receipts, Please · Internal</span><b>{page}</b></footer></article></div></main></div></div>
}

function TravelApp({ currentCase }: { currentCase: GameCase }) {
  const record = currentCase.evidence.find((item) => sourceKind(item.source) === 'travel')
  const trips = ['New York → Chicago', 'SFO → New York', 'Austin offsite']
  const [selectedTrip, setSelectedTrip] = useState(0)
  return <div className="exo-travel-app"><header><div><strong>Travel portal</strong><small>Upcoming and past trips</small></div><button onClick={() => requestGameAudioCue('evidence-link', 0.24)} type="button">Compare receipt</button></header><aside>{trips.map((trip, index) => <button className={index === selectedTrip ? 'is-active' : ''} key={trip} onClick={() => setSelectedTrip(index)} type="button"><span>{index === 0 ? 'JUN 18–20' : 'ARCHIVED'}</span><strong>{trip}</strong><small>{index === 0 ? 'Approved' : 'Completed'}</small></button>)}</aside><main><div className="exo-trip-route"><span>{selectedTrip === 1 ? 'SFO' : selectedTrip === 2 ? 'AUS' : 'NYC'}<small>Jun 18 · 8:05 AM</small></span><i /><span>{selectedTrip === 1 ? 'NYC' : selectedTrip === 2 ? 'SEA' : 'CHI'}<small>Jun 18 · 9:42 AM</small></span></div><section><span>Flight</span><strong>{selectedTrip === 0 ? 'UA 214' : selectedTrip === 1 ? 'DL 581' : 'AS 330'} · Confirmed</strong><small>Company booking · Economy</small></section><section><span>Hotel</span><strong>{selectedTrip === 0 ? 'River North Hotel' : selectedTrip === 1 ? 'No hotel booked' : 'Downtown Seattle'}</strong><small>Approved itinerary record</small></section><article><small>{selectedTrip === 0 ? record?.label ?? 'Current receipt check' : 'Archived itinerary'}</small><strong>{selectedTrip === 0 ? record?.value ?? 'No matching itinerary record' : 'Not attached to this receipt'}</strong><p>{selectedTrip === 0 ? record?.detail ?? 'Compare the receipt location and date with approved travel.' : 'Select the active itinerary to compare evidence.'}</p></article></main></div>
}

function InventoryApp({ currentCase, vendor = false }: { currentCase: GameCase; vendor?: boolean }) {
  const kind = vendor ? 'vendor' : 'inventory'
  const record = currentCase.evidence.find((item) => sourceKind(item.source) === kind)
  if (vendor) return <div className="exo-vendor-app"><aside><strong>Vendors</strong>{['Approved', 'In review', 'Blocked'].map((item, index) => <button className={index === 1 ? 'is-active' : ''} key={item} type="button">{item}<b>{[42, 3, 1][index]}</b></button>)}</aside><main><header><div><small>VENDOR PROFILE</small><h2>{currentCase.receipt.merchant.name}</h2><p>Created 14 days ago · owner pending verification</p></div><span>Review</span></header><dl><div><dt>Address</dt><dd>{currentCase.receipt.merchant.addressLines[0]}</dd></div><div><dt>Bank details</dt><dd>Possible duplicate</dd></div><div><dt>Contract</dt><dd>Not attached</dd></div></dl><section><small>{record?.label ?? 'Vendor record'}</small><strong>{record?.value ?? 'No approved vendor match'}</strong><p>{record?.detail ?? 'Review ownership and payment details before approval.'}</p></section></main></div>
  return <div className="exo-inventory-app"><div className="exo-sheet-toolbar"><strong>IT Inventory.xlsx</strong><button type="button">Share</button></div><div className="exo-sheet"><header><span>#</span><span>Asset</span><span>Serial</span><span>Assigned to</span><span>Status</span></header>{['MacBook Pro', 'Studio Display', 'ThinkPad X1', 'iPhone 16', 'MacBook Air', 'Dell U2723'].map((asset, index) => <div key={asset}><b>{index + 41}</b><span>{asset}</span><code>RP-{7410 + index}</code><span>{index === 5 ? 'Unassigned' : ['Sam Patel', 'Maya Chen', 'Rowan Kim'][index % 3]}</span><em>{index === 5 ? 'Missing' : 'In service'}</em></div>)}</div><footer><span>{record?.label ?? 'Inventory record'}</span><strong>{record?.value ?? 'Search by serial or assignee'}</strong><small>{record?.detail}</small></footer></div>
}

function CardsApp({ currentCase }: { currentCase: GameCase }) {
  const activeCaseId = useWorkstationStore((state) => state.activeCaseId)
  const cardFrozen = useWorkstationStore((state) => Object.values(state.cardStates).some((card) => card.frozen))
  const completeCaseAction = useWorkstationStore((state) => state.completeCaseAction)
  const setCardFrozen = useWorkstationStore((state) => state.setCardFrozen)
  const triggerEffect = useLabStore((state) => state.triggerEffect)
  const toggleFrozen = () => {
    const nextFrozen = !cardFrozen
    setCardFrozen(nextFrozen, activeCaseId)
    completeCaseAction('freeze-card', nextFrozen, activeCaseId)
    triggerEffect(nextFrozen ? 'fraud' : 'migration')
    requestGameAudioCue(nextFrozen ? 'freeze-button' : 'evidence-link', 0.55)
  }
  return <div className="exo-cards-app"><aside><strong>Cards</strong><button className="is-active" type="button">All cards</button><button type="button">Frozen</button></aside><main><header><div><small>CARDHOLDER</small><h2>{employeeName(currentCase.employee)}</h2></div><span className={cardFrozen ? 'is-frozen' : ''}>{cardFrozen ? 'Frozen' : 'Active'}</span></header><div className={`exo-card-visual ${cardFrozen ? 'is-frozen' : ''}`}><small>RECEIPTS, PLEASE</small><strong>•••• {currentCase.receipt.payment.cardLast4}</strong><span>Corporate</span></div><dl><div><dt>Monthly limit</dt><dd>$5,000</dd></div><div><dt>Available</dt><dd>$3,418</dd></div><div><dt>Status</dt><dd>{cardFrozen ? 'Frozen' : 'Active'}</dd></div></dl><button onClick={toggleFrozen} type="button">{cardFrozen ? 'Unfreeze card' : 'Freeze card'}</button></main></div>
}

function RampApp({ currentCase }: { currentCase: GameCase }) {
  const phase = useGameStore((state) => state.phase)
  const rampMigrationStep = useLabStore((state) => state.rampMigrationStep)
  const activeCaseId = useWorkstationStore((state) => state.activeCaseId)
  const closedCaseIds = useWorkstationStore((state) => state.closedCaseIds)
  const completedActionsByCase = useWorkstationStore((state) => state.completedActionsByCase)
  const pinnedEvidenceIds = useWorkstationStore((state) => state.pinnedEvidenceIds)
  const completedExceptions = WORKSTATION_CASE_IDS_BY_PHASE.ramp.filter((caseId) => closedCaseIds.includes(caseId)).length
  const totalExceptions = WORKSTATION_CASE_IDS_BY_PHASE.ramp.length

  if (phase === 'migrating') {
    const currentStep = Math.min(rampMigrationStep, RAMP_MIGRATION_STEPS.length)
    return <div className="exo-ramp-installer"><header><div className="exo-ramp-wordmark"><img alt="Ramp" src="/brand/ramp-lockup-white.svg" /></div><span>Migration in progress</span></header><main><small>FINANCE WORKSPACE SETUP</small><h2>Connecting the systems behind this queue.</h2><p>Keep this window open. Ramp is matching the backlog and will surface only the six expenses that need judgment.</p><progress max={RAMP_MIGRATION_STEPS.length} value={currentStep} /><div className="exo-ramp-install-count"><strong>{currentStep}</strong><span>of {RAMP_MIGRATION_STEPS.length} systems connected</span></div><ol>{RAMP_MIGRATION_STEPS.map((step, index) => <li className={index < currentStep ? 'is-complete' : index === currentStep ? 'is-current' : ''} key={step}><i>{index < currentStep ? '✓' : String(index + 1).padStart(2, '0')}</i><span>{step}</span></li>)}</ol><footer><span>47 expenses scanned</span><strong>6 exceptions will remain</strong></footer></main></div>
  }

  const automationCase = WORKSTATION_CASES_BY_ID[activeCaseId]
  const requiredEvidenceIds = automationCase.validation.requiredEvidenceIds
  const linkedEvidenceIds = pinnedEvidenceIds[activeCaseId] ?? []
  const linkedEvidenceCount = requiredEvidenceIds.filter((id) => linkedEvidenceIds.includes(id)).length
  const requiredActions = automationCase.validation.requiredActions ?? []
  const completedActions = completedActionsByCase[activeCaseId] ?? []
  const completedActionCount = requiredActions.filter((action) => completedActions.includes(action)).length
  const evidenceComplete = linkedEvidenceCount === requiredEvidenceIds.length
  const actionsComplete = completedActionCount === requiredActions.length
  const decisionComplete = closedCaseIds.includes(activeCaseId)
  const nextEvidenceId = requiredEvidenceIds.find((id) => !linkedEvidenceIds.includes(id))
  const nextEvidence = automationCase.evidence.find((item) => item.id === nextEvidenceId)
  const nextAction = requiredActions.find((action) => !completedActions.includes(action))
  const liveStatus = nextEvidence
    ? `Connecting ${nextEvidence.label}`
    : nextAction
      ? `Applying ${nextAction.replaceAll('-', ' ')}`
      : decisionComplete
        ? 'Exception resolved'
        : `Recording ${automationCase.validation.expectedDecision}`
  const evidenceProgress = requiredEvidenceIds.length > 0 ? linkedEvidenceCount / requiredEvidenceIds.length : 1
  const actionProgress = requiredActions.length > 0 ? completedActionCount / requiredActions.length : 1
  const currentCaseProgress = evidenceProgress * 0.55 + actionProgress * 0.25 + Number(decisionComplete) * 0.2
  const reconciliation = [
    { complete: linkedEvidenceCount > 0, current: linkedEvidenceCount === 0, label: 'Receipt', status: linkedEvidenceCount > 0 ? 'Matched' : 'Scanning' },
    { complete: evidenceComplete, current: linkedEvidenceCount > 0 && !evidenceComplete, label: 'Evidence', status: `${linkedEvidenceCount}/${requiredEvidenceIds.length} linked` },
    { complete: evidenceComplete && actionsComplete, current: evidenceComplete && !actionsComplete, label: 'Controls', status: requiredActions.length > 0 ? `${completedActionCount}/${requiredActions.length} applied` : 'No action' },
    { complete: decisionComplete, current: evidenceComplete && actionsComplete && !decisionComplete, label: 'Decision', status: decisionComplete ? 'Recorded' : 'Waiting' },
  ]
  const displayedEvidence = automationCase.evidence.filter((item) => requiredEvidenceIds.includes(item.id)).slice(0, 4)

  return <div className="exo-ramp-app"><aside><div className="exo-ramp-wordmark"><img alt="Ramp" src="/brand/ramp-lockup-white.svg" /></div><button className="is-active" type="button">Exceptions <b>{Math.max(0, totalExceptions - completedExceptions)}</b></button><button type="button">Overview</button><button type="button">Cards</button><button type="button">Travel</button><footer>38 expenses cleared automatically</footer></aside><main><div className="exo-ramp-automation"><span><i />{liveStatus}</span><progress max={totalExceptions} value={completedExceptions + currentCaseProgress} /><b>{completedExceptions}/{totalExceptions}</b></div><header key={activeCaseId}><div><small>EXCEPTION · {String(currentCase.sequence).padStart(2, '0')}</small><h2>{currentCase.title}</h2><p>{employeeName(currentCase.employee)}</p></div><span>Needs judgment</span></header><div className="exo-reconciliation-rail">{reconciliation.map((step, index) => <article className={step.complete ? 'is-complete' : step.current ? 'is-current' : 'is-pending'} key={step.label}><i>{step.complete ? '✓' : index + 1}</i><span>{step.label}<strong>{step.status}</strong></span></article>)}</div><section className="exo-ramp-summary"><div><small>RECOMMENDED ACTION</small><strong>{currentCase.truth.expectedDecision.replaceAll('-', ' ')}</strong><p>{currentCase.workflow.exceptionReason}</p></div><aside><small>POLICY</small><strong>{currentCase.workflow.policyCitation}</strong></aside></section><div className="exo-connected-records">{displayedEvidence.map((item) => { const linked = linkedEvidenceIds.includes(item.id); return <article className={linked ? 'is-linked' : 'is-pending'} key={item.id}><span>{linked ? 'CONNECTED' : 'SEARCHING'} · {item.label}</span><strong>{linked ? item.value : 'Connecting source…'}</strong><p>{linked ? item.detail : `Checking ${item.sourceApp} for the supporting record.`}</p></article> })}</div></main></div>
}

function AppContent({ appId, caseIndex, currentCase }: { appId: string; caseIndex: number; currentCase: GameCase }) {
  if (appId === 'expenses') return <ExpensesApp caseIndex={caseIndex} currentCase={currentCase} />
  if (appId === 'transactions') return <TransactionsApp currentCase={currentCase} />
  if (appId === 'people') return <DirectoryApp currentCase={currentCase} />
  if (appId === 'slack') return <SlackApp currentCase={currentCase} />
  if (appId === 'policy') return <PolicyApp currentCase={currentCase} />
  if (appId === 'travel') return <TravelApp currentCase={currentCase} />
  if (appId === 'inventory') return <InventoryApp currentCase={currentCase} />
  if (appId === 'vendor') return <InventoryApp currentCase={currentCase} vendor />
  if (appId === 'cards') return <CardsApp currentCase={currentCase} />
  return <RampApp currentCase={currentCase} />
}

export function GameWorkstation() {
  const automationActive = useGameStore((state) => state.automationActive)
  const caseIndex = useGameStore((state) => state.caseIndex)
  const desktopWindows = useGameStore((state) => state.desktopWindows)
  const decisions = useGameStore((state) => state.decisions)
  const dismissNotification = useGameStore((state) => state.dismissNotification)
  const elapsedSeconds = useGameStore((state) => state.elapsedSeconds)
  const notificationVisible = useGameStore((state) => state.notificationVisible)
  const installRamp = useGameStore((state) => state.installRamp)
  const openDesktopApp = useGameStore((state) => state.openDesktopApp)
  const paused = useGameStore((state) => state.paused)
  const phase = useGameStore((state) => state.phase)
  const reviewedEvidence = useGameStore((state) => state.reviewedEvidence)
  const soundEnabled = useGameStore((state) => state.soundEnabled)
  const setSlackView = useGameStore((state) => state.setSlackView)
  const togglePause = useGameStore((state) => state.togglePause)
  const toggleSound = useGameStore((state) => state.toggleSound)
  const workstationActiveCaseId = useWorkstationStore((state) => state.activeCaseId)
  const workstationFocused = useLabStore((state) => state.workstationFocused)
  const beginRampTransition = useLabStore((state) => state.beginRampTransition)
  const setWorkstationFocused = useLabStore((state) => state.setWorkstationFocused)
  const automatedCaseIndex = GAME_CASES.findIndex((entry) => entry.caseId === workstationActiveCaseId)
  const effectiveCaseIndex = automationActive && automatedCaseIndex >= MANUAL_CASE_COUNT ? automatedCaseIndex : caseIndex
  const currentCase = GAME_CASES[Math.min(effectiveCaseIndex, GAME_CASES.length - 1)]
  const rampActive = phase === 'ramp' || phase === 'ending'
  const rampVisible = rampActive || phase === 'migrating'
  const rampInstallReady = phase === 'migration-prompt' || phase === 'overload'
  const inboxCount = rampActive ? Math.max(0, GAME_CASES.length - effectiveCaseIndex) : Math.max(12, 12 + Math.floor(elapsedSeconds / 18))
  const cortisol = rampActive ? Math.max(0, 22 - (effectiveCaseIndex - MANUAL_CASE_COUNT) * 4) : Math.min(99, 68 + reviewedEvidence.length * 3 + Math.floor(elapsedSeconds / 30))
  const visibleWindows = desktopWindows.filter((window) => !window.minimized)
  const activeWindow = visibleWindows.reduce<GameDesktopWindow | null>((top, window) => !top || window.z > top.z ? window : top, null)
  const activeApp = DESKTOP_APPS.find((app) => app.id === activeWindow?.appId)
  const relevantSources = new Set<string>(currentCase.evidence.map((evidence) => sourceKind(evidence.source)))
  const desktopApps = DESKTOP_APPS.filter((app) => {
    if (['expenses', 'transactions', 'people', 'slack', 'policy', 'ramp'].includes(app.id)) return true
    if (app.id === 'cards' && rampActive) return true
    return relevantSources.has(app.id)
  })

  const openApp = (appId: string) => {
    if (appId === 'ramp' && !rampVisible) return
    openDesktopApp(appId)
    currentCase.evidence.forEach((evidence, index) => {
      if (appId === 'ramp' || sourceKind(evidence.source) === appId) useGameStore.getState().inspectEvidence(index)
    })
    requestGameAudioCue('evidence-link', 0.24)
  }

  const startRampMigration = () => {
    installRamp()
    beginRampTransition()
    requestGameAudioCue('monitor-power-off', 0.62)
  }

  useEffect(() => {
    if (!workstationFocused) return
    const returnToDesk = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setWorkstationFocused(false)
      requestGameAudioCue('paper-slide', 0.32)
    }
    window.addEventListener('keydown', returnToDesk)
    return () => window.removeEventListener('keydown', returnToDesk)
  }, [setWorkstationFocused, workstationFocused])

  return (
    <div
      aria-label={workstationFocused ? 'Expense OS. Press Escape to return to the desk.' : 'Click to focus Expense OS.'}
      className={`game-workstation expense-os ${rampActive ? 'expense-os--ramp' : 'expense-os--manual'} ${workstationFocused ? 'is-focused' : 'is-preview'}`}
      onClickCapture={(event) => {
        if (workstationFocused) return
        event.preventDefault()
        event.stopPropagation()
        setWorkstationFocused(true)
      }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      role="application"
    >
      <header className="exo-menu-bar">
        <div><button aria-label="Expense OS menu" className="exo-system-menu" type="button">RP</button><strong>{activeApp?.label ?? 'Expense OS'}</strong><span>File</span><span>Edit</span><span>View</span><span>Window</span><span>Help</span></div>
        <div><button className="exo-status-button" onClick={() => openApp('expenses')} type="button">Inbox <b>{inboxCount}</b></button><label title={`Cortisol level ${cortisol}%`}><span>Cortisol level</span><i><b style={{ width: `${cortisol}%` }} /></i><em>{cortisol}%</em></label><button aria-label={soundEnabled ? 'Mute game audio' : 'Enable game audio'} onClick={toggleSound} type="button">{soundEnabled ? 'Sound' : 'Muted'}</button><button onClick={togglePause} type="button">{paused ? 'Resume' : 'Pause'}</button><time>{formatTime(elapsedSeconds)}</time>{workstationFocused && <button className="exo-exit-focus" onClick={() => setWorkstationFocused(false)} type="button">Desk <kbd>Esc</kbd></button>}</div>
      </header>

      <main className="exo-desktop">
        <button className="exo-desktop-file" onClick={() => openApp('expenses')} type="button"><AppIcon appId="expenses" /><span>{currentCase.receipt.merchant.name}</span><small>{formatMoney(currentCase.receipt.amounts.printedTotalCents)}</small></button>

        {rampInstallReady ? (
          <aside aria-label="Ramp installation request from CEO" className="exo-notification-wrap exo-notification-wrap--ramp">
            <div className="exo-notification"><AppIcon appId="slack" /><span><header><b>Slack</b><time>now</time></header><strong>CEO</strong><small>The queue hit 47. I approved Ramp—install it and clear the backlog.</small><button onClick={startRampMigration} type="button">Install Ramp</button></span></div>
          </aside>
        ) : notificationVisible && !rampActive ? (
          <aside aria-label="Slack notification from CEO" className="exo-notification-wrap">
            <div className="exo-notification"><button aria-label="Open Slack message from CEO" className="exo-notification-open" onClick={() => { setSlackView('ceo'); openApp('slack'); dismissNotification() }} type="button"><AppIcon appId="slack" /><span><header><b>Slack</b><time>now</time></header><strong>CEO</strong><small>Need these cleared before lunch.</small></span></button><button aria-label="Dismiss notification" className="exo-notification-close" onClick={dismissNotification} type="button">×</button></div>
          </aside>
        ) : null}

        {desktopWindows.map((windowState) => {
          const app = desktopApps.find((definition) => definition.id === windowState.appId)
          if (!app || (app.id === 'ramp' && !rampVisible)) return null
          return <DesktopWindow active={activeWindow?.appId === app.id} appId={app.id} key={app.id} status={app.id === 'expenses' ? `${MANUAL_CASE_COUNT} before Ramp · ${Math.min(decisions.length, MANUAL_CASE_COUNT)} reviewed` : app.id === 'ramp' && phase === 'migrating' ? 'Installer pinned' : undefined} title={app.label} windowState={windowState}><AppContent appId={app.id} caseIndex={effectiveCaseIndex} currentCase={currentCase} /></DesktopWindow>
        })}

        <nav aria-label="Expense OS applications" className="exo-dock">
          {desktopApps.map((app) => {
            const running = desktopWindows.some((window) => window.appId === app.id)
            const disabled = app.id === 'ramp' && !rampVisible && !rampInstallReady
            const installFromDock = app.id === 'ramp' && rampInstallReady
            return <button aria-label={installFromDock ? 'Install Ramp' : `Open ${app.label}`} className={`${running ? 'is-running' : ''} ${activeWindow?.appId === app.id ? 'is-active' : ''}`} data-label={disabled ? 'Ramp · complete the queue to unlock' : installFromDock ? 'Install Ramp' : app.label} disabled={disabled} key={app.id} onClick={() => installFromDock ? startRampMigration() : openApp(app.id)} type="button"><AppIcon appId={app.id} /></button>
          })}
        </nav>
      </main>

      {paused && <div className="exo-pause"><strong>Shift paused</strong><button onClick={togglePause} type="button">Resume reviewing</button></div>}
    </div>
  )
}
