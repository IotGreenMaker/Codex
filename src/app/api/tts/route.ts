import { NextRequest, NextResponse } from 'next/server'

const VOICE_ID = 'nPczCjzI2devNBz1zQrb' // Brian - stable male voice
const MODEL = 'eleven_turbo_v2_5' // Lowest latency for real-time

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { text?: string }
    const text = body.text?.trim()

    if (!text || text.length === 0) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'TTS not configured' }, { status: 503 })
    }

    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: text.slice(0, 800), // Cap to avoid runaway costs
          model_id: MODEL,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      }
    )

    if (!upstream.ok) {
      const err = await upstream.text()
      console.error('[TTS] ElevenLabs error:', err)
      return NextResponse.json({ error: 'TTS upstream failed' }, { status: 502 })
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    console.error('[TTS] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'TTS error' },
      { status: 500 }
    )
  }
}
