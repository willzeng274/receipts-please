export type GameAudioRequest = {
  id: string
  volume?: number
}

export const GAME_AUDIO_EVENT = 'receipts-please:audio-cue'

export function requestGameAudioCue(id: string, volume?: number) {
  window.dispatchEvent(new CustomEvent<GameAudioRequest>(GAME_AUDIO_EVENT, { detail: { id, volume } }))
}
