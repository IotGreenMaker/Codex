# G-Buddy Architecture

> Last updated: April 2026 — refactored from monolithic dashboard-shell to layered architecture.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v3 + custom `globals.css` glass-panel utilities |
| Primary Storage | IndexedDB (browser-side, via `src/lib/indexeddb-storage.ts`) |
| AI Context Cache | `g-data/plants-state.json` (server-side, written by `/api/plants`) |
| AI Provider | Groq (llama-3.3-70b-versatile) via `/api/groq` |
| TTS | Inworld (primary) / browser Web Speech API (fallback) |
| STT | Web Speech API (browser-native) |

---

## Directory Map

```
src/
  app/
    api/
      groq/         ← AI completion proxy (POST → Groq SDK)
      weather/      ← Open-Meteo weather fetcher (server-side)
      plants/       ← Sync endpoint: writes plants to g-data/plants-state.json
    dashboard/      ← Main app route (uses DashboardShell)
    page.tsx        ← Landing / onboarding page
    layout.tsx      ← Root layout (fonts, metadata)

  components/
    dashboard/
      dashboard-shell.tsx      ← Main UI shell (orchestrator)
      ai-assistant-panel.tsx   ← Voice + text AI chat panel
      ai-chat-modal.tsx        ← Mobile AI chat modal
      activity-feed.tsx        ← Timeline event feed
      climate-table.tsx        ← Climate log table
      nutrient-checker.tsx     ← Smart nutrient checker UI
      vpd-chart.tsx            ← VPD chart modal
      light-config-modal.tsx   ← Light profile editor
      calendar-config-modal.tsx← Timeline settings
      plant-timeline-calendar.tsx ← Calendar view
      ai-config-modal.tsx      ← AI settings
      confirmation-modal.tsx   ← Reusable dialog
      ai-assistant-tutorial-modal.tsx ← Help modal
    charts/
      grow-chart.tsx            ← Climate/watering charts
    onboarding/
      empty-state-onboarding.tsx ← First plant flow

  hooks/
    use-plants.ts              ← Plant state + persistence
    use-weather.ts             ← Weather polling
    use-settings.ts            ← Global settings (units, etc)

  lib/
    types.ts              ← All core TypeScript types (PlantProfile, WateringEntry…)
    indexeddb-storage.ts  ← ALL IndexedDB read/write/delete operations
    grow-math.ts          ← Pure calculation functions (VPD, DLI, stage days, …)
    buildGrowContext.ts   ← Assembles AI context string from PlantProfile
    groq-ai.ts            ← getAIResponseFromGroq() — Groq SDK wrapper
    tts.ts                ← speak() / stopSpeaking() — Inworld + browser TTS
    newplant-data.ts      ← createNewPlant() factory with safe defaults
    nutrient-logic.ts     ← Nutrient stage mapping + feeding analysis
    vpd-utils.ts          ← getVPDStatus() / getVPDRanges() — used by charts
    config.ts             ← App-wide constants (STAGE_TARGETS, VPD_TARGETS, …)
    i18n.ts               ← en / pt-BR translation strings
    uuid.ts               ← generateUUID() browser-safe helper
    excel-export.ts       ← XLSX export (write-only, no import)

g-data/
  plants-state.json       ← AI context snapshot (written by /api/plants, read by AI)
```

---

## Data Flow

```
Browser (IndexedDB)  ←──────────────────────────────────────┐
        │                                                    │
        │  on load: getAllPlants()                           │
        ▼                                                    │
 DashboardShell                                             │
   [plants state]  ──patch──▶  savePlant() (IndexedDB)     │
        │                            │                      │
        │  SAVE_DEBOUNCE_DELAY ms    │ debounced            │
        ▼                            ▼                      │
  /api/plants (PUT)  ──────▶  g-data/plants-state.json     │
        │                                                    │
        │  AI reads context from JSON                        │
        ▼                                                    │
  /api/groq (POST)  ──────▶  AiAssistantPanel              │
        │  response                  │                      │
        │  parse JSON commands       │                      │
        ▼                            │                      │
  patchActivePlant()  ──────────────┘                      │
  patchWateringData()  ─────────────────────────────────────┘
```

### Two-Store Design

| Store | Purpose | Writer | Reader |
|-------|---------|--------|--------|
| IndexedDB `plants` | Source of truth for all plant data | UI patch helpers | UI on load |
| `g-data/plants-state.json` | AI context snapshot | `/api/plants` debounced sync | AI system prompt |
| IndexedDB `chat_messages` | Conversation history (max 20/plant) | `saveAndTruncateChatMessage` | `getChatMessages` |
| IndexedDB `settings` | Key-value (activePlantId, aiConfig, calendarConfig) | `setSetting` | `getSetting` |

The JSON file exists solely so the AI can be given _current_ plant state as context without the server reading from the browser's IndexedDB. It is always a _copy_ — IndexedDB is authoritative.

---

## Calculation Layer (`src/lib/grow-math.ts`)

All business logic calculations live here as **pure exported functions** — no React, no side effects:

| Function | Purpose |
|----------|---------|
| `calculateVpd(tempC, humidity)` | Magnus formula VPD in kPa |
| `getVpdBand(stage, vpd)` | OK / Low / High label + tone |
| `getDaysSinceStart(startedAt)` | Total days since germination |
| `getCycleSummary(plant)` | totalDays + daysInStage |
| `getDetailedCycleSummary(plant)` | Per-stage elapsed days (seedling/veg/bloom) |
| `calculateNutrientPlan(stage, liters)` | Base A/B/CalMag mix amounts |
| `CANNA_AQUA_PERIODS[]` | Feed schedule periods + EC targets |
| `getNutrientPeriodKey(…)` | Auto-select period key from stage progress |
| `getRecipeSnapshotData(…)` | Scaled nutrients list for a given period |
| `formatNutrientValue(value, unit, scale)` | EC ↔ PPM display formatting |
| `getWateringCountdown(lastWateredAt, interval)` | Countdown string to next watering |
| `getDrybackPercent(lastWateredAt, interval)` | Soil-dryback 0-100% |
| `parseTimeToMinutes(value)` | "HH:MM" → minutes |
| `isLightsOnNow(on, off, nowMs)` | Lights schedule check (handles overnight) |
| `toDatetimeLocal(iso)` | ISO → `<input type="datetime-local">` format |
| `estimatePpfd(lightType, dimmer)` | Legacy PPFD fallback estimate |
| `formatAvgPh(watering[])` | Average in/runoff pH string |
| `formatAvgPpm(watering[], unit, scale)` | Average in/runoff EC/PPM string |

---

## Component Responsibility Map

### `DashboardShell`
- **Role**: Hook-based orchestrator.
- **Orchestrates**: uses `usePlants`, `useWeather`, and `useSettings` to manage global state.
- **Isolates**: heavy components and the live clock to prevent unnecessary re-renders.
- **Delegates calculations** to `grow-math.ts` — no business logic inline.
- **Delegates rendering** to memoized child components.

### `AiAssistantPanel`
- **Owns**: chat messages, STT recognition, TTS playback, AI config
- **Uses refs** to avoid stale closures when `plant` changes between voice commands
- **Parses** AI response JSON → calls `onUpdateWateringData` / `onPatchPlant` callbacks
- **Shared conversation**: uses `SHARED_CONVERSATION_ID` so context persists across plant switches

### `buildGrowContext` (`src/lib/buildGrowContext.ts`)
- Assembles a plain-text block injected as the AI system prompt
- Includes: active plant, stage days, VPD, last watering, light metrics, recent notes, other plants list

---

## AI Response Protocol

The AI (Groq `llama-3.3-70b-versatile`) must use exactly one of two output formats:

**Format A — Plain text** (for questions, status, advice):
```
Your last watering was 2 days ago at pH 5.8, 620 PPM.
```

**Format B — JSON block** (for logging new data):
````
```json
{
  "message": "Logged! 1.2L at pH 5.8, 620 PPM.",
  "watering": { "amountMl": 1200, "ph": 5.8, "ec": 0.886 }
}
```
````

Supported JSON action keys: `watering`, `climate`, `plant` (patch), `selectPlant`, `createPlant`, `note`.

The parser in `ai-assistant-panel.tsx` extracts the JSON block, applies the data command, and displays only `parsedData.message` in the chat — raw JSON is never shown to the user.

---

## Removed in April 2026 Refactor

| What | Why |
|------|-----|
| `src/lib/excel-storage.ts` | Dead code — File System Access API approach replaced by IndexedDB |
| `src/components/dashboard/file-picker.tsx` | Dead code — never rendered in the app |
| `src/lib/validation.ts` | Dead code — validation ranges are used via `src/lib/config.ts` directly |
| `seedTestPlants()` in `indexeddb-storage.ts` | Dead function — test-plant button was removed |
| Duplicate utility functions in `dashboard-shell.tsx` | Moved to `grow-math.ts` as proper exports |
| `calculateElapsedDays` useCallback in shell | Replaced by `getDetailedCycleSummary` from `grow-math.ts` |

---

## Rules for Future Changes

1. **Business logic belongs in `src/lib/`**, not components. Pure functions → `grow-math.ts`. Storage → `indexeddb-storage.ts`.
2. **Never write stage-day counts back to `PlantProfile`** — always derive from timestamps via `getDetailedCycleSummary`.
3. **Always save through IndexedDB first** — the JSON file is a cache, not the source of truth.
4. **AI context** must be rebuilt fresh for every request via `buildGrowContext()`.
5. **No new CSS files** — use existing Tailwind utilities and `globals.css` glass-panel/orb classes.
6. **Measurement units** — always store EC (0.0-5.0) in the DB; convert to PPM only for display.
