// src/lib/tts.ts
// Client-side TTS helper — calls server proxy at /api/tts

export async function speak(text: string): Promise<void> {
  if (!text || text.trim().length === 0) return

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }))
      console.warn('[TTS] failed:', err)
      return
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)

    audio.onended = () => URL.revokeObjectURL(url)
    audio.onerror = () => URL.revokeObjectURL(url)

    await audio.play().catch((err) => {
      console.error('[TTS] playback error:', err)
      URL.revokeObjectURL(url)
    })
  } catch (error) {
    console.error('[TTS] error:', error)
  }
}
