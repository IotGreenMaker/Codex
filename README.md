# G-Buddy

G-Buddy is a voice-first AI grow companion for cannabis cultivation. It's a Next.js web dashboard with real-time environmental monitoring, voice-based logging, and AI-powered cultivation guidance backed by Supabase and Groq AI.

## Tech Stack

- **Next.js 15** — React server components and API routes
- **TypeScript** — strict type safety for data models and grow calculations
- **Tailwind CSS** — responsive dark-mode UI
- **Supabase** — PostgreSQL database for grow logs, climate data, and conversation history
- **Groq AI** — fast LLM for real-time AI responses
- **ElevenLabs TTS** — natural voice synthesis for AI responses
- **Web Speech API** — browser-native voice input

## Architecture

### Data Storage

- **Plant profiles** → `g-data/plants-state.json` (reference, read-only)
- **Grow logs** → Supabase tables:
  - `conversations` — user/AI chat history per plant
  - `climate_logs` — temperature, humidity over time
  - `watering_logs` — nutrient/water input records

### Server

- All API secrets (`ELEVENLABS_API_KEY`, `GROQ_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are server-only
- `/api/tts` — server-side ElevenLabs proxy (never expose API key to client)
- `/api/chat` — Groq AI chat endpoint
- `/api/plants` — fetch plant profiles and state

## Suggested product architecture

### Web Dashboard

- **Plant overview** — multiple plants, stages, environment graphs
- **AI conversation** — voice + text input, ElevenLabs voice output
- **Climate monitoring** — real-time temperature, humidity, trend charts
- **Grow logs** — watering, feeding, stage transitions
- **Nutrient calculator** — EC, pH, additive recommendations
- **Plant switching** — AI context changes when you select a different plant

### Project Structure

```
src/
  app/
    page.tsx                     ← root redirect to /dashboard
    dashboard/page.tsx           ← main UI
    api/
      tts/route.ts              ← ElevenLabs proxy (server-only)
      chat/route.ts             ← Groq AI proxy
      plants/route.ts           ← plant state
  components/
    dashboard/                  ← main page UI
    charts/                      ← Recharts components
  lib/
    supabase.ts                 ← Supabase client
    elevenlabs-tts.ts           ← TTS helper (calls /api/tts)
    grow-math.ts                ← VPD, EC, pH calculations
    types.ts                    ← TypeScript types
g-data/
  plants-state.json             ← reference plant data
public/                         ← static assets
```

## Environment Variables

### Server only (never expose to client)

```
GROQ_API_KEY=                           # Groq LLM API key
ELEVENLABS_API_KEY=                     # ElevenLabs TTS key
ELEVENLABS_VOICE_ID=JBFqnCBsd6RMkjVDRZzb
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
SUPABASE_SERVICE_ROLE_KEY=              # Supabase server key
```

### Public (safe for client, use `NEXT_PUBLIC_` prefix)

```
NEXT_PUBLIC_SUPABASE_URL=               # Supabase project URL (public)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=  # Supabase anon key (public)
```

## Security

- **API keys** — only `NEXT_PUBLIC_` variables are exposed to the browser
- **TTS proxy** — `/api/tts` is server-only; client never touches ElevenLabs directly
- **Supabase anon key** — intentionally public for client-side queries
- **Service role key** — never exposed; only used server-side for admin tasks

## Quick Start

### Windows (recommended)

1. **Download and run:** Double-click `Run-GBuddy.bat`
   - Checks for Node.js
   - Installs dependencies
   - Builds the app
   - Waits for server to start
   - Opens browser at `http://localhost:3000/dashboard`

### Manual (all platforms)

1. Install [Node.js LTS](https://nodejs.org)
2. Clone repository: `git clone https://github.com/IotGreenMaker/Codex && cd Codex`
3. Copy `.env.local.example` → `.env.local` and fill in API keys:
   ```
   GROQ_API_KEY=your_groq_key
   ELEVENLABS_API_KEY=your_elevenlabs_key
   ELEVENLABS_VOICE_ID=JBFqnCBsd6RMkjVDRZzb
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_supabase_key
   ```
4. Install and run:
   ```bash
   npm install
   npm run build
   npm start
   ```
5. Open `http://localhost:3000/dashboard`

## Deployment

### Vercel

1. Push code to GitHub
2. Connect GitHub repo in [Vercel Dashboard](https://vercel.com)
3. Add environment variables (see `.env.local` reference above)
4. Deploy — Vercel handles the build automatically
5. Your app is live at `https://your-project.vercel.app`

### Production Checklist

- [ ] Supabase tables created (`conversations`, `climate_logs`, `watering_logs`)
- [ ] All environment variables set (no `NEXT_PUBLIC_` prefix for secrets)
- [ ] ElevenLabs TTS proxy tested at `/api/tts`
- [ ] Groq AI proxy tested at `/api/chat`
- [ ] Plant data persists in Supabase, not local files
