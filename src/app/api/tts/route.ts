import { NextRequest, NextResponse } from 'next/server'

const VOICE_NAME = 'en-US-Neural2-C' // Google male voice (natural)
const LANGUAGE_CODE = 'en-US'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { text?: string }
    const text = body.text?.trim()

    if (!text || text.length === 0) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'TTS not configured' }, { status: 503 })
    }

    const upstream = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            text: text.slice(0, 800), // Cap to avoid runaway costs
          },
          voice: {
            languageCode: LANGUAGE_CODE,
            name: VOICE_NAME,
          },
          audioConfig: {
            audioEncoding: 'MP3',
            pitch: 0,
            speakingRate: 1,
          },
        }),
      }
    )

    if (!upstream.ok) {
      const err = await upstream.text()
      console.error('[TTS] Google error:', err)
      return NextResponse.json({ error: 'TTS upstream failed' }, { status: 502 })
    }

    const data = (await upstream.json()) as { audioContent?: string }
    
    if (!data.audioContent) {
      console.error('[TTS] No audio content in response')
      return NextResponse.json({ error: 'No audio generated' }, { status: 502 })
    }

    // Convert base64 to buffer
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
