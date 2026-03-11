# Lazy Loading Historical Tasks & Time Entries — Design Options

## Problem Statement

Today the app only renders **today's** tasks and time entries. Users have no way to browse historical data (previous days' work) from within the Tasks or Timeline pages. Adding this capability must:

1. **Stay out of the way** — today's tasks/entries remain the primary focus with zero added clutter
2. **Section by day** — historical data is visually grouped by the date it was worked
3. **Load lazily** — fetch older data on demand, not at startup, so performance stays fast

## Current Architecture Summary

| Concern | How it works today |
|---|---|
| **Storage** | IndexedDB with `tasks` and `entries` object stores, indexed by `lastModified` and `start` |
| **Startup load** | Only today's tasks (`getTasksModifiedToday`) and today's entries (`getEntriesModifiedToday`) |
| **Rendering** | Full DOM rebuild on every signal change — no virtualization, no pagination |
| **Components** | Vanilla Web Components (`<task-list>`, `<time-sheet>`) with Signal-based reactivity |
| **Styling** | Dark theme, Fibonacci spacing, timeline uses left-border with diamond markers per entry |

## Shared Constraints (All Options)

- Historical sections appear **below** today's content (today stays at the top, undisturbed)
- Each historical day is a collapsible/expandable group with a clear date header
- Data is fetched from IndexedDB only when the user explicitly requests it (lazy)
- No impact on initial load time — zero additional queries at startup
- Works offline (IndexedDB is local)
- Must integrate with the existing Signal/Context reactive system

---

## Option A: "Load More" Button (Progressive Disclosure)

### Concept

A single button sits below today's content: **"Load previous day"**. Each press fetches one more day of history from IndexedDB and appends it as a dated section. The button updates to always offer the next available day.

### Visual Sketch — Timeline Page

```
┌──────────────────────────────────┐
│  Timeline                        │
│                                  │
│  ┌─ New Entry ─────────────────┐ │
│  │  [task] [start] [end]       │ │
│  └─────────────────────────────┘ │
│                                  │
│  ── Today, Mon 10 Mar ────────── │
│  ┃ ◆ Entry 3  10:00–12:00       │
│  ┃   gap 0.5h                    │
│  ┃ ◆ Entry 2  08:30–09:30       │
│  ┃ ◆ Entry 1  08:00–08:30       │
│  ┃                               │
│  ├── Gaps: 0.5h  Total: 3.5h ──┤ │
│                                  │
│  ┌─────────────────────────────┐ │
│  │  ▼ Load previous day        │ │
│  └─────────────────────────────┘ │
│  ↓ (after clicking)              │
│                                  │
│  ── Fri 7 Mar ────────────────── │
│  ┃ ◆ Entry 2  14:00–17:00  [ro] │
│  ┃ ◆ Entry 1  09:00–12:00  [ro] │
│  ┃                               │
│  ├── Total: 6.0h ──────────────┤ │
│                                  │
│  ┌─────────────────────────────┐ │
│  │  ▼ Load previous day        │ │
│  └─────────────────────────────┘ │
└──────────────────────────────────┘
```

### Visual Sketch — Tasks Page

```
┌──────────────────────────────────┐
│  Tasks                           │
│                                  │
│  [Add task input]          [Add] │
│                                  │
│  ☐ #api  Build REST endpoints    │
│  ◉ #docs Write user guide  1.2h │
│  ── Total: 1.2h ──────────────── │
│                                  │
│  ┌─────────────────────────────┐ │
│  │  ▼ Load previous day        │ │
│  └─────────────────────────────┘ │
│  ↓ (after clicking)              │
│                                  │
│  ── Fri 7 Mar ────────────────── │
│  ✓ #deploy  Ship v1.6     3.0h  │
│  ✓ #test    Integration   2.5h  │
│  ── Total: 5.5h ──────────────── │
│                                  │
│  ┌─────────────────────────────┐ │
│  │  ▼ Load previous day        │ │
│  └─────────────────────────────┘ │
└──────────────────────────────────┘
```

### How It Works

1. **New IndexedDB query**: `getEntriesByDay(date)` — uses the `start` index with a `IDBKeyRange.bound()` for a single calendar day. Same pattern for `getTasksByDay(date)`.
2. **Day cursor**: Track the "oldest loaded day" in component state. On button press, decrement by 1 day, skip weekends/empty days by querying until data is found.
3. **Rendering**: Append a new `<section>` with a date header (`<h3>`) and the day's entries/tasks inside. Historical entries are **read-only** (no inline editing) to keep the UI clean.
4. **Button state**: Shows "No more entries" and disables when the DB returns empty results for 30+ consecutive days.

### Pros
- Dead simple UX — one button, obvious behavior
- Minimal code change — no scroll listeners, no intersection observers
- User controls pacing — loads exactly what they want to see
- Works perfectly with existing DOM rendering (no virtualization needed)

### Cons
- Loading one day at a time could feel slow if users want to jump back weeks
- No way to jump to a specific date (must click through sequentially)
- Button becomes tedious for heavy historical browsing

---

## Option B: Infinite Scroll with Day Sections

### Concept

When the user scrolls past today's content, the app automatically loads the previous day's data and renders it below. Each day is visually sectioned with a sticky date header. Loading triggers via `IntersectionObserver` on a sentinel element at the bottom.

### Visual Sketch — Timeline Page

```
┌──────────────────────────────────┐
│  Timeline                        │
│                                  │
│  ┌─ New Entry ─────────────────┐ │
│  │  [task] [start] [end]       │ │
│  └─────────────────────────────┘ │
│                                  │
│  ┏━ Today, Mon 10 Mar ━━━━━━━━┓ │  ← sticky header
│  ┃ ◆ Entry 3  10:00–12:00      │ │
│  ┃   gap 0.5h                   │ │
│  ┃ ◆ Entry 2  08:30–09:30      │ │
│  ┃ ◆ Entry 1  08:00–08:30      │ │
│  ┃ Gaps: 0.5h  Total: 3.5h     │ │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                  │
│  ┏━ Fri 7 Mar ━━━━━━━━━━━━━━━━┓ │  ← auto-loaded
│  ┃ ◆ Entry 2  14:00–17:00      │ │
│  ┃ ◆ Entry 1  09:00–12:00      │ │
│  ┃ Total: 6.0h                  │ │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                  │
│  ┏━ Thu 6 Mar ━━━━━━━━━━━━━━━━┓ │  ← auto-loaded
│  ┃ ◆ Entry 1  09:00–16:00      │ │
│  ┃ Total: 7.0h                  │ │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                  │
│        ◌ Loading...              │  ← sentinel
└──────────────────────────────────┘
```

### How It Works

1. **IntersectionObserver** watches a sentinel `<div>` at the bottom of the entries list.
2. When the sentinel enters the viewport, fetch the next day's entries from IndexedDB.
3. Render them in a new dated `<section>` and append it below the last section.
4. **Sticky date headers** via `position: sticky; top: 0` on each day's `<h3>` — as the user scrolls, they always know what day they're looking at.
5. **Batch loading**: Fetch 3–5 days at a time to reduce jitter on fast scrolling.
6. **Stop condition**: Disconnect observer when no data found for 30+ consecutive days.

### Pros
- Feels native and modern — seamless browsing experience
- Sticky headers provide constant date context
- No manual interaction needed — just keep scrolling
- Batch fetching prevents loading gaps during fast scrolls

### Cons
- IntersectionObserver requires careful threshold tuning
- Risk of loading too aggressively if user scrolls fast (mitigate with debounce)
- Harder to jump to a specific date without scrolling through everything
- DOM grows unbounded — could impact performance over weeks of data (mitigate by unloading old sections or capping at ~14 days loaded)

---

## Option C: Date Picker + Day View (Random Access)

### Concept

A compact date navigator sits between today's content and the footer. Users pick any date to load that day's data in a single section. Only one historical day is shown at a time, keeping the DOM small and the interface focused.

### Visual Sketch — Timeline Page

```
┌──────────────────────────────────┐
│  Timeline                        │
│                                  │
│  ┌─ New Entry ─────────────────┐ │
│  │  [task] [start] [end]       │ │
│  └─────────────────────────────┘ │
│                                  │
│  ── Today, Mon 10 Mar ────────── │
│  ┃ ◆ Entry 3  10:00–12:00       │
│  ┃ ◆ Entry 2  08:30–09:30       │
│  ┃ ◆ Entry 1  08:00–08:30       │
│  ├── Gaps: 0.5h  Total: 3.5h ──┤ │
│                                  │
│  ┌─────────────────────────────┐ │
│  │  Browse history:             │ │
│  │  [◀] [  2026-03-07  ] [▶]  │ │
│  └─────────────────────────────┘ │
│                                  │
│  ── Fri 7 Mar ────────────────── │
│  ┃ ◆ Entry 2  14:00–17:00       │
│  ┃ ◆ Entry 1  09:00–12:00       │
│  ├── Total: 6.0h ──────────────┤ │
│                                  │
└──────────────────────────────────┘
```

### How It Works

1. **Native `<input type="date">`** with prev/next arrow buttons for quick day stepping.
2. Selecting a date triggers `getEntriesByDay(date)` and replaces the historical section content.
3. Only one historical day rendered at a time — keeps the DOM minimal.
4. **Empty state**: "No entries for this day" message when the selected date has no data.
5. Prev/Next buttons auto-skip empty days (query DB for nearest day with data).

### Pros
- Random access — jump directly to any date without scrolling
- Lightest DOM footprint — only two day-sections visible at most (today + selected)
- Native date input provides calendar picker on mobile
- Simple mental model — "today" + "that day"

### Cons
- Can only view one historical day at a time (no multi-day view)
- Prev/Next skipping logic adds complexity
- Date picker might feel disconnected from the data (less exploratory)
- Less useful for "what did I work on this week?" scanning

---

## Option D: Expandable Week Bands (Hybrid)

### Concept

Below today's content, the app shows a compact band for each recent week (e.g., "3–7 Mar: 32.5h across 5 days"). Clicking a week band expands it to show day-by-day sections within. Weeks load lazily — only the most recent week band is shown initially, with a "Show earlier weeks" link to load more.

### Visual Sketch — Timeline Page

```
┌──────────────────────────────────┐
│  Timeline                        │
│                                  │
│  ┌─ New Entry ─────────────────┐ │
│  │  [task] [start] [end]       │ │
│  └─────────────────────────────┘ │
│                                  │
│  ── Today, Mon 10 Mar ────────── │
│  ┃ ◆ Entry 3  10:00–12:00       │
│  ┃ ◆ Entry 2  08:30–09:30       │
│  ├── Gaps: 0.5h  Total: 3.5h ──┤ │
│                                  │
│  ┌─────────────────────────────┐ │
│  │ ▶ Week 3–7 Mar     32.5h   │ │  ← collapsed band
│  └─────────────────────────────┘ │
│  ↓ (after clicking)              │
│  ┌─────────────────────────────┐ │
│  │ ▼ Week 3–7 Mar     32.5h   │ │  ← expanded
│  │                             │ │
│  │  ── Fri 7 Mar ───────────── │ │
│  │  ┃ ◆ Deploy  14:00–17:00   │ │
│  │  ┃ ◆ Testing 09:00–12:00   │ │
│  │  ├── Total: 6.0h ────────  │ │
│  │                             │ │
│  │  ── Thu 6 Mar ───────────── │ │
│  │  ┃ ◆ Coding  09:00–17:00   │ │
│  │  ├── Total: 8.0h ────────  │ │
│  │                             │ │
│  │  (Wed, Tue, Mon...)         │ │
│  └─────────────────────────────┘ │
│                                  │
│  ┌─────────────────────────────┐ │
│  │ ▶ Week 24–28 Feb   28.0h   │ │  ← collapsed
│  └─────────────────────────────┘ │
│                                  │
│  ┌─────────────────────────────┐ │
│  │  ▼ Show earlier weeks       │ │
│  └─────────────────────────────┘ │
└──────────────────────────────────┘
```

### How It Works

1. **New IndexedDB query**: `getEntriesByWeek(weekStartDate)` — fetches all entries for a Monday–Sunday range.
2. **Week band metadata**: A lightweight query first fetches just the total hours and entry count per week (summary row) without loading full entry data.
3. **Expand/collapse**: Clicking a week band fetches full entry data for that week, groups by day, and renders day sections inside the band.
4. **Progressive loading**: Initially show only 1 collapsed week band. "Show earlier weeks" loads 4 more bands at a time.
5. **Collapse to reclaim DOM**: Collapsing a week removes its day entries from the DOM (keeps the summary).

### Pros
- Best information density — week summaries give a quick overview without loading details
- Two-level hierarchy (week → day) matches how people think about work history
- Collapsing keeps the DOM small even after browsing many weeks
- Total hours per week visible at a glance — great for timesheets/invoicing

### Cons
- Most complex to implement (two levels of lazy loading)
- Week summaries require an aggregation query or pre-computation
- UI has more moving parts (expand/collapse/load more)
- Partial week at boundaries (current week) needs special handling

---

## Comparison Matrix

| Criteria | A: Load More | B: Infinite Scroll | C: Date Picker | D: Week Bands |
|---|---|---|---|---|
| **Simplicity** | Best | Good | Good | Complex |
| **Random access** | None | None | Best | By week |
| **Scanning multi-day** | Manual | Best | None | Good |
| **DOM weight** | Grows | Grows (needs cap) | Minimal | Controlled |
| **Implementation effort** | ~Small | ~Medium | ~Small | ~Large |
| **Mobile UX** | Good | Great | Great | Good |
| **"Stays out of the way"** | Great | Great | Great | Great |
| **Day sectioning** | Yes | Yes (sticky) | Yes (1 day) | Yes (nested) |

## Recommendation

**Option A (Load More Button)** is the strongest starting point. It's the simplest to implement, completely stays out of the way, naturally sections by day, and gives users explicit control over when historical data loads. It can later be upgraded to Option B (infinite scroll) by swapping the button trigger for an IntersectionObserver — the data fetching and day-section rendering code would be identical.

If random-access date jumping is important to you, **Option C** could be added alongside Option A as a complementary feature (date picker + load-more are not mutually exclusive).

**Option D** is the richest but should only be pursued if weekly summaries and invoicing-style views are a priority — it's a significant build for a v1.

## Implementation Notes (Applicable to All Options)

### New IndexedDB Queries Needed

```javascript
// Fetch entries for a specific calendar day
async function getEntriesByDay(date) {
  const start = new Date(date); start.setHours(0,0,0,0);
  const end = new Date(date); end.setHours(23,59,59,999);
  const range = IDBKeyRange.bound(start, end);
  // Use 'start' index on entries store
}

// Fetch tasks that had entries on a specific day
async function getTasksActiveOnDay(date) {
  const dayEntries = await getEntriesByDay(date);
  const taskExids = [...new Set(dayEntries.map(e => e.task))];
  // Batch-fetch tasks by exid
}

// Find the previous day with data (for skip-empty navigation)
async function getPreviousDayWithEntries(beforeDate) {
  // Open cursor on 'start' index, direction 'prev', starting from beforeDate
  // Return the date of the first entry found
}
```

### Day Section Component (Shared)

A reusable `<day-section>` component that:
- Accepts a date and renders a header like "Fri 7 Mar — 6.0h"
- Contains a list of entries or tasks for that day
- Historical entries are **read-only** (no edit forms, just display)
- Uses a muted/dimmed visual treatment to distinguish from today's active content

### Read-Only vs Editable

Historical entries should render in a **read-only** format (no inline inputs) to:
- Visually distinguish past from present
- Prevent accidental edits to closed-out days
- Reduce DOM complexity (no form elements, event listeners)

### Styling Approach

```css
/* Day section header */
.day-header {
  position: sticky;           /* Option B only */
  top: 0;
  background: var(--color-background);
  border-bottom: 1px solid var(--color-text-muted);
  padding: var(--space-3) 0;
  font-size: 0.9rem;
  color: var(--color-text-muted);
  display: flex;
  justify-content: space-between;
}

/* Historical entries: slightly dimmed to visually recede */
.day-section--historical {
  opacity: 0.85;
}

/* Load more button: unobtrusive */
.load-more-btn {
  width: 100%;
  text-align: center;
  padding: var(--space-4);
  background: var(--color-button-subtle-bg);
  border: 1px dashed var(--color-text-muted);
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 0.6em;
  margin-top: var(--space-5);
}
```
