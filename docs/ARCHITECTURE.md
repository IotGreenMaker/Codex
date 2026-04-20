# G-Buddy Architecture Notes

## Product goal

Build a AI companion that helps growers log cultivation data quickly through voice and then review progress in a clean web dashboard.

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

## Storage Architecture

### Primary Storage: IndexedDB
All data is stored client-side in IndexedDB for complete privacy and offline functionality.

### Data Structure
- **plants** - Plant profiles with complete grow data
- **watering_logs** - Watering events with plantId reference
- **climate_logs** - Climate data with plantId reference
- **chat_messages** - User/AI conversation history per plant
- **settings** - App settings and active plant

### Export Strategy
- CSV export for logs
- XLSX export for spreadsheet compatibility
- JSON backup for full-fidelity restore

This architecture ensures 100% local data storage with no cloud dependencies.

## Data Flow

1. User records voice note in the dashboard
2. Speech-to-text produces transcript
3. Transcript is sent to the LLM extraction layer
4. Structured data is validated against schemas
5. Valid data is stored in IndexedDB
6. Dashboard queries local data and renders charts
7. Optional cloud sync can be added later

## Domain Examples

### Environmental Data
- Outside temperature
- Outside humidity
- Grow temperature
- Grow humidity
- VPD (Vapor Pressure Deficit)

### Irrigation Data
- Water input in milliliters
- Input pH
- Input EC (Electrical Conductivity)
- Runoff pH
- Runoff EC

### Grow Lifecycle Data
- Plant start date
- Current stage
- Stage duration
- Total grow days
- Light on/off times

### AI Chat Functionalities
- Voice input (Web Speech API)
- Text input
- AI responses with citations
- Plant-specific context switching
- Grow log extraction from conversations
- Real-time environmental data integration

## Maintainability rules

- keep calculations in pure TypeScript utility modules
- keep storage behind repository functions
- validate LLM outputs before saving
- treat citations as first-class response data
- export data freely, but keep SQLite as the authoritative store

## Suggested Future Packages

- `zod` for schema validation
- `xlsx` for spreadsheet export
- `localForage` for enhanced IndexedDB operations
