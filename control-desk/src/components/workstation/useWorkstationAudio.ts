import { useCallback, useEffect, useRef } from 'react'

export type WorkstationSound =
  | 'calculator'
  | 'calculator-print'
  | 'decision-correct'
  | 'decision-wrong'
  | 'freeze'
  | 'migration'
  | 'migration-complete'
  | 'navigate'
  | 'notification'
  | 'pin'

type CatalogAsset = {
  id: string
  path: string
}

type PrototypeCatalog = {
  assets: CatalogAsset[]
}

const SOUND_ASSET_IDS: Record<WorkstationSound, string> = {
  calculator: 'calculator-key',
  'calculator-print': 'calculator-print',
  'decision-correct': 'decision-correct',
  'decision-wrong': 'decision-wrong',
  freeze: 'freeze-button',
  migration: 'office-light-flicker',
  'migration-complete': 'migration-complete',
  navigate: 'calculator-key',
  notification: 'slack-ping',
  pin: 'evidence-link',
}

const SOUND_VOLUMES: Record<WorkstationSound, number> = {
  calculator: 0.34,
  'calculator-print': 0.42,
  'decision-correct': 0.48,
  'decision-wrong': 0.42,
  freeze: 0.55,
  migration: 0.36,
  'migration-complete': 0.52,
  navigate: 0.12,
  notification: 0.92,
  pin: 0.38,
}

export function useWorkstationAudio(enabled: boolean) {
  const activeAudio = useRef(new Set<HTMLAudioElement>())
  const enabledRef = useRef(enabled)
  const exclusiveAudio = useRef(new Map<WorkstationSound, HTMLAudioElement>())
  const templates = useRef(new Map<WorkstationSound, HTMLAudioElement>())

  useEffect(() => {
    enabledRef.current = enabled
    if (enabled) return
    for (const audio of activeAudio.current) {
      audio.pause()
      audio.currentTime = 0
    }
    activeAudio.current.clear()
    exclusiveAudio.current.clear()
  }, [enabled])

  useEffect(() => {
    const active = activeAudio.current
    const exclusive = exclusiveAudio.current
    const templateMap = templates.current
    const controller = new AbortController()
    let disposed = false

    void fetch('/audio/prototype-catalog.json', { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<PrototypeCatalog> : Promise.reject(new Error('Audio catalog unavailable')))
      .then((catalog) => {
        if (disposed) return
        const assetsById = new Map(catalog.assets.map((asset) => [asset.id, asset]))
        for (const [sound, assetId] of Object.entries(SOUND_ASSET_IDS) as [WorkstationSound, string][]) {
          const asset = assetsById.get(assetId)
          if (!asset) continue
          const audio = document.createElement('audio')
          audio.preload = 'none'
          audio.src = asset.path
          templateMap.set(sound, audio)
        }
      })
      .catch(() => undefined)

    return () => {
      disposed = true
      controller.abort()
      for (const audio of active) {
        audio.pause()
        audio.currentTime = 0
      }
      active.clear()
      exclusive.clear()
      templateMap.clear()
    }
  }, [])

  const stopSound = useCallback((sound: WorkstationSound) => {
    const audio = exclusiveAudio.current.get(sound)
    if (!audio) return
    audio.pause()
    audio.currentTime = 0
    exclusiveAudio.current.delete(sound)
    activeAudio.current.delete(audio)
  }, [])

  const playSound = useCallback((sound: WorkstationSound) => {
    if (!enabledRef.current) return

    const template = templates.current.get(sound)
    if (!template) return
    if (sound === 'notification') stopSound(sound)
    const audio = template.cloneNode(true) as HTMLAudioElement
    audio.volume = SOUND_VOLUMES[sound]
    activeAudio.current.add(audio)
    if (sound === 'notification') exclusiveAudio.current.set(sound, audio)

    const release = () => {
      activeAudio.current.delete(audio)
      if (exclusiveAudio.current.get(sound) === audio) exclusiveAudio.current.delete(sound)
    }
    audio.addEventListener('ended', release, { once: true })
    audio.addEventListener('error', release, { once: true })
    void audio.play().catch(release)
  }, [stopSound])

  return { playSound, stopSound }
}
