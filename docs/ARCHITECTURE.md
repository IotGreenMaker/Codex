# G-Buddy Architecture Notes

## Product goal

Build a local-first AI companion that helps growers log cultivation data quickly through voice and then review progress in a clean web dashboard.

## Recommended implementation path

Start with a Next.js application that handles:

- plant profiles
- grow log entries
- nutrient calculations
- charts and dashboard views
- browser microphone capture
- AI conversation UI
- local database access

This keeps the business logic and interaction model inside one maintainable web product.

## AI and citations

Add an LLM service layer with two modes:

- `log extraction`: turn transcript text into structured grow events
- `grow guidance`: answer questions and return citations

For citations, keep a separate retrieval pipeline so answers are grounded and inspectable.

## Storage recommendation

Use SQLite as the primary source of truth.

### Suggested tables

- `plants`
- `grow_logs`
- `voice_interactions`
- `nutrient_plans`
- `environment_snapshots`
- `light_schedules`

### Export strategy

Support:

- CSV export for logs
- XLSX export for people who want spreadsheet compatibility
- JSON backup for full-fidelity restore

This is much safer than storing raw app state directly in spreadsheets.

## Data flow

1. User records voice note in the dashboard
2. Speech-to-text produces transcript
3. Transcript is sent to the LLM extraction layer
4. Structured data is validated against schemas
5. Valid data is stored in SQLite
6. Dashboard queries local data and renders charts
7. Optional cloud sync can be added later

## Domain examples

### Environmental data

- outside temperature
- outside humidity
- grow temperature
- grow humidity
- VPD

### Irrigation data

- water input in milliliters
- input pH
- input EC
- runoff pH
- runoff EC

### Grow lifecycle data

- plant start date
- current stage
- stage duration
- total grow days
- light on/off times

## Maintainability rules

- keep calculations in pure TypeScript utility modules
- keep storage behind repository functions
- validate LLM outputs before saving
- treat citations as first-class response data
- export data freely, but keep SQLite as the authoritative store

## Suggested future packages

- `drizzle-orm` and `better-sqlite3` for local persistence
- `zod` for schema validation
- `xlsx` for spreadsheet export
