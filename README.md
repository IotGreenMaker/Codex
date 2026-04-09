# G-Buddy

G-Buddy is a voice-first AI grow companion for cannabis cultivation. It's a Next.js web dashboard with real-time environmental monitoring, voice-based logging, and AI-powered cultivation guidance.

## Tech Stack

- **Next.js 15** — React server components and API routes
- **TypeScript** — strict type safety for data models and grow calculations
- **Tailwind CSS** — responsive dark-mode UI
- **Inworld TTS** — natural voice synthesis for AI responses
- **Groq AI** — fast LLM for real-time AI responses
- **Web Speech API** — browser-native voice input
- **Service Worker** — offline support and app shell caching

## Architecture

### Data Storage

- **Plant profiles** → IndexedDB (client-side storage)
- **Grow logs** → IndexedDB:
  - `plants` — plant profiles with complete grow data
  - `watering_logs` — watering events with plantId reference
  - `climate_logs` — climate data with plantId reference
  - `chat_messages` — user/AI conversation history per plant
  - `settings` — app settings and active plant

### Client-side API

- All API endpoints interact with IndexedDB
- `/api/conversations` — fetch and save chat messages
- `/api/plants` — fetch and save plant profiles
- `/api/watering` — fetch and save watering logs
- `/api/climate` — fetch and save climate data

## Web Dashboard

- **Plant overview** — multiple plants, stages, environment graphs
- **AI conversation** — voice + text input, Inworld TTS voice output
- **Climate monitoring** — real-time temperature, humidity, trend charts
- **Grow logs** — watering, feeding, stage transitions
- **Nutrient calculator** — EC, pH, additive recommendations
- **Plant switching** — AI context changes when you select a different plant
- **Offline-first** — works completely offline after initial load
- **Privacy-first** — no accounts, no cloud storage, no tracking

### Project Structure

```
src/
  app/
    page.tsx                     ← root redirect to /dashboard
    dashboard/page.tsx           ← main UI
    api/
      conversations/route.ts     ← chat message operations
      plants/route.ts            ← plant profile operations
      watering/route.ts          ← watering log operations
      climate/route.ts           ← climate data operations
  components/
    dashboard/                  ← main page UI
    charts/                      ← Recharts components
  lib/
    indexeddb-storage.ts         ← IndexedDB client
    grow-math.ts                ← VPD, EC, pH calculations
    types.ts                    ← TypeScript types
  newplant-data.ts              ← plant creation templates
public/
  sw.js                         ← service worker for offline support
```

## Environment Variables

### Public (safe for client, use `NEXT_PUBLIC_` prefix)

```
NEXT_PUBLIC_INWORLD_API_KEY=             # Inworld TTS API key
NEXT_PUBLIC_GROQ_API_KEY=                # Groq LLM API key
```

## Security

- **API keys** — only `NEXT_PUBLIC_` variables are exposed to the browser
- **No server-side storage** — all data stays on user's device
- **No accounts required** — complete privacy, no tracking
- **Service worker** — caches app shell for offline access

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
2. Clone repository: `git clone https://github.com/IotGreenMaker/Release-v2 && cd Release-v2`
3. Copy `.env.local.example` → `.env.local` and fill in API keys:
   ```
   NEXT_PUBLIC_GROQ_API_KEY=your_groq_key
   NEXT_PUBLIC_GOOGLE_AI_API_KEY=your_google_tts_key
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

- [ ] All environment variables set (no server-side secrets needed)
- [ ] Service worker registered for offline support
- [ ] IndexedDB storage working correctly
- [ ] API endpoints interacting with IndexedDB
- [ ] Privacy features verified (no cloud storage)

## Privacy & Security

- **100% client-side** — all data stored locally in IndexedDB
- **No accounts required** — complete privacy
- **No cloud storage** — data never leaves user's device
- **Offline-first** — works without internet connection
- **Open source** — transparent and auditable