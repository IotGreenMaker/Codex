/**
 * Legacy TTS wrapper — superseded by /lib/tts.ts speak() function
 * Kept for backwards compatibility only.
 * Use: import { speak } from '@/lib/tts' instead.
 */

import { speak } from '@/lib/tts'

export async function speakWithElevenLabs(
  text: string,
  onPlayingChange?: (isPlaying: boolean) => void
): Promise<void> {
  try {
    if (!text.trim()) return
    onPlayingChange?.(true)
    await speak(text)
    onPlayingChange?.(false)
  } catch (error) {
    console.error('[TTS] error:', error)
    onPlayingChange?.(false)
  }
}
