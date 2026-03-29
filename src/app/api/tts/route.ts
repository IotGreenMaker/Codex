import { NextRequest, NextResponse } from 'next/server'

const INWORLD_MODEL = 'inworld-tts-1.5-max'
const INWORLD_VOICE = 'Mark'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { text?: string }
    const text = body.text?.trim()

    if (!text || text.length === 0) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const apiKey = process.env.INWORLD_API_KEY
    if (!apiKey) {
      console.error('[TTS] INWORLD_API_KEY not configured')
      return NextResponse.json({ error: 'TTS not configured' }, { status: 503 })
    }

    // Call Inworld TTS API with Basic auth
    const response = await fetch('https://api.inworld.ai/tts/v1/voice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        text: text.slice(0, 1000), // Cap text to avoid excessive processing
        voiceId: INWORLD_VOICE,
        modelId: INWORLD_MODEL,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[TTS] Inworld error:', {
        status: response.status,
        statusText: response.statusText,
        message: errorData.message || 'Unknown error',
      })
      return NextResponse.json(
        { error: errorData.message || 'TTS service error' },
        { status: response.status }
      )
    }

    const data = (await response.json()) as { audioContent?: string }

    if (!data.audioContent) {
      console.error('[TTS] No audio content in response')
      return NextResponse.json({ error: 'No audio generated' }, { status: 502 })
    }

    // Decode base64 MP3 from Inworld
    const audioBuffer = Buffer.from(data.audioContent, 'base64')

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        'Content-Length': audioBuffer.length.toString(),
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
