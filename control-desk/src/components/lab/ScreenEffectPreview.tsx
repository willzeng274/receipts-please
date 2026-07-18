import gsap from 'gsap'
import { useEffect, useRef } from 'react'
import { useLabStore } from '../../store/useLabStore'

export function ScreenEffectPreview() {
  const effectPreset = useLabStore((state) => state.effectPreset)
  const effectRun = useLabStore((state) => state.effectRun)
  const reducedMotion = useLabStore((state) => state.reducedMotion)
  const rootRef = useRef<HTMLDivElement>(null)
  const oldUiRef = useRef<HTMLDivElement>(null)
  const rampUiRef = useRef<HTMLDivElement>(null)
  const blackoutRef = useRef<HTMLDivElement>(null)
  const migrationRef = useRef<HTMLDivElement>(null)
  const decisionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (effectRun === 0 || !rootRef.current) return

    const context = gsap.context(() => {
      gsap.killTweensOf([rootRef.current, oldUiRef.current, rampUiRef.current, blackoutRef.current, migrationRef.current, decisionRef.current])
      gsap.set(rootRef.current, { clearProps: 'transform,filter' })
      gsap.set(oldUiRef.current, { autoAlpha: 1, x: 0, scale: 1 })
      gsap.set(rampUiRef.current, { autoAlpha: 0, x: 16, scale: 0.985 })
      gsap.set(blackoutRef.current, { autoAlpha: 0 })
      gsap.set(migrationRef.current, { autoAlpha: 0 })
      gsap.set(decisionRef.current, { autoAlpha: 0, scale: 0.9 })

      if (effectPreset === 'migration') {
        const travel = reducedMotion ? 0 : 16
        const timeline = gsap.timeline({ defaults: { ease: 'power3.inOut' } })
        timeline
          .to(rootRef.current, { duration: 0.12, filter: 'brightness(1.7)' })
          .to(rootRef.current, { duration: 0.08, filter: 'brightness(0.08)' })
          .set(blackoutRef.current, { autoAlpha: 1 })
          .set(rootRef.current, { filter: 'brightness(1)' })
          .set(migrationRef.current, { autoAlpha: 1 })
          .fromTo('.migration-line', { autoAlpha: 0, x: travel }, { autoAlpha: 1, duration: 0.18, stagger: 0.11, x: 0 })
          .to(oldUiRef.current, { autoAlpha: 0, duration: 0.12, scale: 0.98 }, '<')
          .to(migrationRef.current, { autoAlpha: 0, duration: 0.18 }, '+=0.08')
          .to(blackoutRef.current, { autoAlpha: 0, duration: 0.22 })
          .to(rootRef.current, { duration: 0.12, filter: 'brightness(1.45)' }, '<')
          .to(rootRef.current, { duration: 0.32, filter: 'brightness(1)' })
          .to(rampUiRef.current, { autoAlpha: 1, duration: 0.48, scale: 1, x: 0, ease: 'expo.out' }, '<0.05')
          .fromTo('.ramp-card', { autoAlpha: 0, y: reducedMotion ? 0 : 12 }, { autoAlpha: 1, duration: 0.32, stagger: 0.06, y: 0 }, '<0.08')
        return
      }

      const accent = effectPreset === 'approve' ? '#7dd5af' : effectPreset === 'reject' ? '#f2b84b' : '#e96a3c'
      gsap.set(decisionRef.current, { borderColor: accent, color: accent })
      const force = effectPreset === 'fraud' || effectPreset === 'printer-jam' ? 5 : 2
      gsap.timeline()
        .to(rootRef.current, { duration: 0.04, x: reducedMotion ? 0 : force })
        .to(rootRef.current, { duration: 0.05, x: reducedMotion ? 0 : -force * 0.65 })
        .to(rootRef.current, { duration: 0.08, x: 0 })
        .to(decisionRef.current, { autoAlpha: 1, duration: 0.12, scale: 1, ease: 'back.out(2)' }, 0)
        .to(decisionRef.current, { autoAlpha: 0, duration: 0.28, delay: 0.38 })
    }, rootRef)

    return () => context.revert()
  }, [effectPreset, effectRun, reducedMotion])

  return (
    <aside className="screen-fixture" data-testid="screen-effect-fixture" ref={rootRef}>
      <header><span>SCREEN FIXTURE / 01</span><small>REPLAYABLE</small></header>
      <div className="screen-fixture__body">
        <div className="manual-screen" ref={oldUiRef}>
          <div className="manual-screen__bar"><span>EXPENSE DESKTOP</span><b>INBOX 47</b></div>
          <div className="manual-screen__tabs"><span>TRANSACTION</span><span>POLICY.PDF</span><span>TRAVEL</span></div>
          <div className="manual-screen__receipt">
            <small>NEEDS MANUAL REVIEW</small><strong>EXOTIC LIVESTOCK INTL.</strong><b>$280,000.00</b>
          </div>
        </div>

        <div className="ramp-screen" ref={rampUiRef}>
          <div className="ramp-screen__bar"><img src="/brand/ramp-lockup-white.svg" alt="Ramp" /><span>6 NEED ATTENTION</span></div>
          <div className="ramp-card ramp-card--hero"><small>RECOMMENDED ACTION</small><strong>Decline &amp; freeze card</strong><span>Policy + vendor risk matched</span></div>
          <div className="ramp-screen__grid">
            <div className="ramp-card"><small>RECEIPT</small><b>Matched</b></div>
            <div className="ramp-card"><small>POLICY</small><b>Livestock</b></div>
            <div className="ramp-card"><small>RISK</small><b>Critical</b></div>
          </div>
        </div>

        <div className="screen-blackout" ref={blackoutRef} />
        <div className="migration-status" ref={migrationRef}>
          <span className="migration-line">MATCHING RECEIPTS</span>
          <span className="migration-line">APPLYING POLICY</span>
          <span className="migration-line">SYNCING TRAVEL</span>
          <strong className="migration-line">47 CHECKED / 6 NEED ATTENTION</strong>
        </div>
        <div className="decision-flash" ref={decisionRef}>{effectPreset.replace('-', ' ')}</div>
      </div>
    </aside>
  )
}
