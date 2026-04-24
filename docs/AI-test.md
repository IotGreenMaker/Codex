# G-Buddy AI End-to-End Test Plan

> Tests for voice input, text input, AI data logging, and context switching.
> Run manually in Chrome/Edge (Web Speech API required for voice tests).

---

## Test Environment Setup

1. Open G-Buddy in Chrome or Edge (Firefox lacks Web Speech API)
2. Ensure at least **two plants** exist (e.g. "Green Machine" in Veg + "Purple Haze" in Bloom)
3. Open the AI assistant panel (desktop sidebar or mobile FAB)
4. Open the browser DevTools console to monitor `[IndexedDB]` logs

---

## Group A: Read-Only Queries (must NOT trigger data writes)

These tests verify that asking questions does not create watering events, climate entries, or plant patches (TODO #19 regression).

| # | Input (text or voice) | Expected AI response | Expected DB change |
|---|-----------------------|----------------------|--------------------|
| A1 | "What was my last watering?" | Plain text with date, amount, pH/PPM. No JSON block. | None |
| A2 | "When should I water next?" | Plain text with estimated date. No JSON. | None |
| A3 | "How is my VPD right now?" | Plain text VPD value + status. No JSON. | None |
| A4 | "What stage is this plant in?" | Plain text with stage name + days. No JSON. | None |
| A5 | "How many days in bloom?" | Plain text. No JSON. | None |
| A6 | "Show me my recent notes" | Plain text list of last 3-5 notes. No JSON. | None |
| A7 | "Is the light on now?" | Plain text yes/no + schedule. No JSON. | None |
| A8 | "What is my target EC?" | Plain text with EC value (or PPM if unit=PPM). No JSON. | None |
| A9 | "Tell me about my watering interval" | Plain text description. No JSON. | None |
| A10 | "How many plants do I have?" | Plain text count + names. No JSON. | None |

**Verification**: After each test, check the **Activity Feed** — no new watering or climate entries should appear. Check IndexedDB in DevTools → Application → IndexedDB → g-buddy → plants.

---

## Group B: New Data Logging (must trigger DB writes)

These tests verify that explicit new events are logged correctly.

| # | Input | Expected AI response | Expected DB change |
|---|----|---|---|
| B1 | "I just watered 1.2 litres at pH 5.8 and 620 PPM" | Confirmation message. JSON block with watering. | New watering entry in `wateringData[]` |
| B2 | "Logging: temperature 25 degrees and humidity 62%" | Confirmation. JSON climate block. | New climate entry in `climateData[]` |
| B3 | "I fed today with 1.5L pH 6.0 EC 1.4 and runoff pH 5.9 EC 1.8" | Confirmation with feed details. | Watering entry with all 4 values + isFeed:true |
| B4 | "Record a note: leaves are looking healthy today" | Note added confirmation. | New note in `notes[]` |
| B5 | "Switch this plant to Bloom stage" | Confirmation of stage switch. | `stage: "Bloom"` in plant |
| B6 | "Move to Veg" | Confirmation of stage switch. | `stage: "Veg"` in plant |
| B7 | "Add a new plant called Lemon Zkittlez" | New plant confirmation. | New PlantProfile in IndexedDB |

**Verification**: Check Activity Feed immediately after each test — the event should appear. Check IndexedDB for the new/updated record.

---

## Group C: Plant Context Switching

These tests verify that the AI correctly tracks the active plant when the user switches between them (known previous issue with stale closures).

| # | Steps | Expected behaviour |
|---|-------|---------------------|
| C1 | 1. Select "Green Machine" in dashboard. 2. Ask AI "What stage is this plant in?" | Responds with Green Machine's stage (Veg). |
| C2 | 1. Ask AI "Switch to Purple Haze" | Response confirms switch. Dashboard plant selector updates to Purple Haze. |
| C3 | 1. After C2, ask AI "What was my last watering?" | Responds with Purple Haze's watering data, NOT Green Machine's. |
| C4 | 1. After C2, say "I just watered 2L pH 6.1" | Watering entry appears on Purple Haze, not Green Machine. |
| C5 | 1. Manually click "Green Machine" in dashboard selector. 2. Ask AI "How many days in bloom?" | Responds with Green Machine's data (AI context updates via plantRef). |
| C6 | 1. Ask AI "Which plants do I have?" | Lists all plants by name and stage from the OTHER PLANTS section. |

---

## Group D: Voice Input (STT)

These tests require a microphone. Speak at normal conversational pace.

| # | Say | Expected behaviour |
|---|-----|---------------------|
| D1 | "What was my last watering?" | Transcription appears in input. Sent after ~2.6s silence. AI responds with plain text. |
| D2 | "I just watered one litre at pH six point zero" | Logged correctly. Amount = 1000ml, pH = 6.0. |
| D3 | Speak slowly with 3s pause mid-sentence | Voice should NOT send partial message — waits for VOICE_IDLE_TIMEOUT_MS (2.6s) of silence before sending. |
| D4 | Start speaking, then continue within 2s | Timer resets, full message is captured. |
| D5 | "Switch to [other plant name]" | AI switches plant context and dashboard updates. |

---

## Group E: AI Response Format Integrity

These tests verify raw JSON never appears in the chat UI (TODO #20 regression).

| # | Trigger | Verify |
|---|---------|--------|
| E1 | Log a watering via text | Chat bubble shows ONLY the `message` field, no `{ "watering": ... }` visible |
| E2 | Log climate via voice | Chat bubble shows plain confirmation text only |
| E3 | Ask a question | Chat bubble shows plain text with no backticks or code fence markers |
| E4 | Disconnect API key, ask question | Chat bubble shows error message in plain text — no raw error JSON |

---

## Group F: Measurement Unit Consistency

These tests verify PPM/EC settings flow correctly end-to-end.

| # | Setup | Action | Verify |
|---|-------|--------|--------|
| F1 | Settings → PPM / 500 scale | Ask "What is my last EC?" | AI responds in PPM (e.g. "620 PPM") |
| F2 | Settings → EC | Ask "What is my last feed?" | AI responds in EC (e.g. "1.35 EC") |
| F3 | Settings → PPM / 700 scale | Say "I just fed 1200ml at 800 PPM pH 5.9" | Entry stored as EC = 800/700 = 1.143; display shows 800 PPM |
| F4 | n/a | Open Timeline Settings modal for first time | Default unit should be PPM at 500 scale |

---

## Group G: Edge Cases

| # | Scenario | Expected |
|----|----------|----------|
| G1 | Ask AI something completely unrelated (e.g. "What's the weather in Tokyo?") | Politely redirects to grow topics. No data logged. |
| G2 | Say "yes" or "no" alone | AI asks for clarification. No data logged. |
| G3 | Provide partial data: "I watered today" (no amount/pH) | AI asks for missing values OR logs with defaults and explains. No silent failure. |
| G4 | Rapid fire: send 3 messages before AI responds | All 3 are processed in order. No crash. No data duplication. |
| G5 | Delete a plant while AI is responding | No unhandled error. UI recovers gracefully. |
| G6 | Duplicate plant name: ask AI to "switch to Green" with two plants containing "Green" | AI asks to clarify which one. |

---

## Known Bugs (Fixed in April 2026 Refactor)

| Bug | Fix |
|-----|-----|
| AI creates watering entry on read queries | Strengthened system prompt with question-detection rules (groq-ai.ts) |
| Raw JSON leaks into chat bubble | Added fallback parser + code-fence cleanup (ai-assistant-panel.tsx) |
| Stale plant context after switch | plantRef.current used in all async callbacks |
| Default unit was EC instead of PPM | DEFAULT_CONFIG changed to `PPM / 500` in calendar-config-modal.tsx |
