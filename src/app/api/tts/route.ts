import { NextRequest, NextResponse } from 'next/server'

const VOICE_ID = 'Leo' // xAI Leo voice
const LANGUAGE = 'en'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { text?: string }
    const text = body.text?.trim()

    if (!text || text.length === 0) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const apiKey = process.env.XAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'TTS not configured' }, { status: 503 })
    }

    const upstream = await fetch(
      'https://api.x.ai/v1/tts',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.slice(0, 800), // Cap to avoid runaway costs
          voice_id: VOICE_ID,
          language: LANGUAGE,
          output_format: {
            codec: 'mp3',
            sample_rate: 44100,
            bit_rate: 128000,
          },
        }),
      }
    )

    if (!upstream.ok) {
      const err = await upstream.text()
      console.error('[TTS] xAI error:', err)
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
