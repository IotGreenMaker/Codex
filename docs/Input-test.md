# G-Buddy Manual Input Test Plan

> Tests for manual data entry, table interactions, plant management, and UI state.
> These tests ensure the core dashboard functions correctly without AI intervention.

---

## Test Environment Setup

1. Clear browser storage (DevTools -> Application -> Clear Site Data) to start from an empty state.
2. Open G-Buddy in Chrome or Edge.
3. Verify the "No Plants" or "Empty State" view is visible.

---

## Group A: Onboarding & Plant Management

| # | Action | Expected Behaviour |
|---|--------|---------------------|
| A1 | Click "Add Your First Plant" (empty state) | Opens the "Add Plant" modal or automatically creates a default plant. |
| A2 | Click "Add Plant" in the sidebar/header | Opens modal. Entering a name and clicking "Save" creates a new plant. |
| A3 | Delete a plant | Confirmation modal appears. Clicking "Delete" removes the plant and switches to another or empty state. |
| A4 | Switch between plants | Dashboard updates instantly with the selected plant's data. |

---

## Group B: Dashboard Manual Inputs

| # | Action | Expected Behaviour |
|---|--------|---------------------|
| B1 | Update Temperature/Humidity sliders | Values update in real-time. Data is persisted to IndexedDB. |
| B2 | Toggle Light status | Icon/status changes. Persistence verified after reload. |
| B3 | Change Light Schedule | Start/End times update. |
| B4 | Adjust Container/Media volume | Numeric inputs update correctly and persist. |

---

## Group C: Timeline & Activity Feed (Manual)

| # | Action | Expected Behaviour |
|---|--------|---------------------|
| C1 | Click "+" in Activity Feed (Add Note) | Opens note input area. |
| C2 | Type a note and click "Save Note" | Note appears in the feed with correct timestamp. |
| C3 | Delete a note in the feed | Note is removed from the list and DB. |
| C4 | Click "Today" in Calendar | Calendar scrolls/focuses on today's date. |

---

## Group D: Nutrient Tables & Math

| # | Action | Expected Behaviour |
|---|--------|---------------------|
| D1 | Add a new additive to the recipe | New row appears in the table. |
| D2 | Update additive dosage (ml/L) | Recipe math (total ml) updates automatically. |
| D3 | Toggle "Show in Feed" for recipe | Verifies if recipe visibility toggles correctly. |
| D4 | Switch measurement unit (EC/PPM) | Values in tables and feed convert correctly based on the selected scale. |

---

## Group E: Settings & Configuration

| # | Action | Expected Behaviour |
|---|--------|---------------------|
| E1 | Open Timeline Settings | Modal opens with stage duration settings. |
| E2 | Update Veg/Bloom duration | Calendar stage shading (colors) updates to reflect new ranges. |
| E3 | Save AI Configuration | Keys are saved to IndexedDB (visible in DevTools). |
