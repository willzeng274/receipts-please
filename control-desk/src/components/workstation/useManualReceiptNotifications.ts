import { useEffect } from 'react'

function seededUnit(ordinal: number) {
  let value = (ordinal + 1) * 0x6d2b79f5
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296
}
export function getReceiptSubmissionDelay(ordinal: number) {
  return Math.round(3_200 + seededUnit(ordinal) * 6_000)
}

export function useManualReceiptNotifications({
  enabled,
  onSubmit,
  ordinal,
}: {
  enabled: boolean
  onSubmit: () => void
  ordinal: number
}) {
  useEffect(() => {
    if (!enabled) return
    const timeout = window.setTimeout(onSubmit, getReceiptSubmissionDelay(ordinal))
    return () => window.clearTimeout(timeout)
  }, [enabled, onSubmit, ordinal])
}
