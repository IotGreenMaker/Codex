# G-Buddy

G-Buddy is a local-first AI grow companion for cannabis cultivation built as a web dashboard with integrated voice-aware AI assistance.

## Recommended stack

- `Next.js` for the web dashboard and integrated AI conversation UI
- `TypeScript` for safety across data models and grow calculations
- `Tailwind CSS` for fast iteration on the dark + lime brand system
- `SQLite` as the primary local database
- `CSV/XLSX export` for spreadsheet compatibility instead of using spreadsheets as the source of truth
## Why not spreadsheets as the main storage?

Spreadsheets are good for export, sharing, and manual review, but weak as the primary log store:

- They are easy to corrupt with manual edits
- Time-series queries become painful as the app grows
- Multi-table relationships are awkward
- Graph generation and filtering are slower and harder to maintain

Better approach:

1. Store data in `SQLite`
2. Generate charts directly from SQL-backed queries
3. Offer one-click export to `CSV` or `XLSX`
4. Keep a simple import flow so existing spreadsheet logs can be brought in later

That gives you reliability now and spreadsheet portability when users want it.

## Suggested product architecture

### Web dashboard

- Plant overview
- AI conversation interface
- Browser microphone spectralizer feedback
- Environmental graphs over time
- Feeding and runoff logs
- Cycle calendar and stage duration
- Light schedule
- Nutrient calculator
- Citation-backed knowledge answers

## Project structure

```text
src/
  app/
  components/
  lib/
docs/
```

## Core domain ideas

- `PlantProfile`
- `GrowLogEntry`
- `VoiceInteraction`
- `NutrientMix`

## Next steps

1. Add real persistence with SQLite and an ORM like Drizzle
2. Add ingestion APIs for voice logs and structured grow events
3. Connect the browser microphone flow to live transcription
4. Add citation-aware LLM orchestration and a grow knowledge source layer
5. Add SQLite persistence with export to CSV/XLSX

## Run without IDE

If you do not want to open an IDE:

1. Double-click `Run-GBuddy.bat`
2. Wait for build + server startup
3. Your browser opens automatically at `http://localhost:3000/dashboard`

Requirements:

- Windows
- Node.js LTS installed once
