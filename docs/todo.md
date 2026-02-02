## User Problem

At any time, users might fancy a dinner for an upcoming weekly plan because they fancy the dinner, but they aren't ready to create a future weekly plan yet.

## Solution Analysis

**Option A: "Eat Soon" Recipe Queue** — Users mark recipes they want to eat soon. The queue surfaces during weekly plan creation.

**Option B: Future Weekly Plans** — Users create weekly plans for future weeks and edit them later.

**Recommendation: Option A.** The core tension is that the user has *intent* ("I want this") but not *commitment* ("this specific week"). A queue captures intent with zero friction. Option B forces premature commitment to a specific week and requires going through the full multi-step wizard — too heavy for "I just saw a recipe I fancy."

---

# PRD: Recipe Queue ("Eat Soon")

## Overview

A lightweight per-user queue where users mark recipes they want to cook soon. The queue integrates into the weekly plan creation flow, surfacing forgotten desires at the moment they matter most — when the user is actively deciding what to eat.

## Core Concepts

- **Queue item**: A recipe a user wants to eat soon, with optional notes (e.g. "for date night", "when kids are away")
- **Per-user, household-visible**: Each user manages their own queue, but during weekly planning both household members can see each other's queued recipes
- **Recipes only**: Queue items must link to an existing recipe in the system. This keeps things simple and ensures the recipe has ingredients (needed for grocery list generation). Users who think of a meal that isn't in the system yet should add the recipe first.

## User Journeys

### Journey 1: Queueing a recipe while browsing

**Trigger:** User is browsing recipes (on `/recipes` or `/recipes/[id]`) and thinks "I want to eat this soon."

1. User sees a "Eat Soon" button (or icon) on the recipe card / detail page
2. User taps it
3. Visual confirmation — the button toggles to a filled state (similar to a heart/bookmark)
4. A toast confirms: "Added to your queue"
5. Recipe is added to their queue. Notes can be added later from the queue page.

**Key decisions:**
- The button should be visible on both the recipe list cards and the detail page
- If the recipe is already in the queue, the button shows as "active" and tapping it removes it (toggle behavior)
- Notes are optional and can be added/edited later


### Journey 2: Viewing and managing the queue

**Trigger:** User wants to see what's in their queue outside of the planning flow.

1. User navigates to their queue (accessible from the main nav or a tab on the recipes page)
2. Queue shows a list of recipes ordered by date added (oldest first)
3. Each item shows: recipe name, when it was queued, who queued it (if viewing household-wide), and any notes
4. User can:
   - **Remove** an item (swipe or tap X)
   - **Edit the note** on an item
   - **Tap a recipe** to go to its detail page

### Journey 3: Using the queue during weekly plan creation

**Trigger:** User is in the weekly plan creation wizard (review step).

1. The review step no longer shows AI-generated meal suggestions. Instead, it shows a 7-day grid (Sat–Fri) with empty dinner slots.
2. Above or beside the grid, a **"Your queue"** panel lists all queued recipes from both household members (user's own items first).
3. For each queued recipe, the user can:
   - **Add to a day**: Tap/drag the recipe onto a specific day's slot. The item is removed from the queue upon plan finalization.
   - **Ignore**: Items not picked simply stay in the queue for next week.
4. For days without a queued recipe, the user can browse and pick from the full recipe library (existing "Pick Recipe" flow).
5. If the queue is empty, the review step shows the empty 7-day grid with a prompt to pick recipes from the library or go queue some first.

**Why no AI suggestions:** Users found AI-generated meal suggestions unhelpful. The queue replaces this — users curate their own intent over time, and the review step becomes a place to assign those choices to specific days.

**Why no snooze timer:** Snooze with specific durations (1 week, 2 weeks, 1 month) adds complexity without clear value. The queue already persists across weeks. "Skip this week" is implicit — if you don't pick it, it's still there next week. Keeping it simple avoids decision fatigue and snooze-management overhead.

### Journey 4: Queue item fulfilled automatically

**Trigger:** A recipe that's in the user's queue gets added to a weekly plan (by any household member, through any method — queue or manual selection).

1. When a weekly plan is finalized and contains a recipe that's in someone's queue, that queue item is automatically removed
2. A subtle notification: "3 recipes from your queue were planned this week" (or similar)

This prevents stale items from lingering after the recipe has already been planned.

## Staleness Policy

- Items stay in the queue indefinitely until used or manually removed
- If an item has been in the queue for 30+ days, it gets a subtle visual indicator ("queued 5 weeks ago") to nudge the user to either plan it or drop it
- No automatic removal or archiving — users are in control

## UI Touchpoints

| Location | What appears |
|----------|-------------|
| Recipe list (`/recipes`) | "Eat Soon" button icon on each recipe card |
| Recipe detail (`/recipes/[id]`) | "Eat Soon" button in the action area |
| Home page | "Eat again soon" action on today's meal card |
| Main nav | Own page in main navigation |
| Queue page | Full list with remove/edit actions |
| Weekly plan wizard (review step) | Queue replaces AI suggestions as the primary meal source |

## Data Model

New table: `recipe_queue`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| household_id | uuid | FK to households |
| user_id | uuid | FK to users (who queued it) |
| recipe_id | uuid | FK to recipes |
| notes | text | Optional user note |
| created_at | timestamptz | When it was queued |

- Unique constraint: `(user_id, recipe_id)` — a user can only queue a recipe once
- RLS: scoped to household (all members can read, users can only write their own)

## Edge Cases

- **Recipe deleted while in queue**: Queue item is cascade-deleted
- **Same recipe queued by both household members**: Both items exist independently. During planning, it shows once with both users' names ("You and Sarah both want this")
- **Recipe already in current week's plan**: "Eat Soon" button is disabled or shows "Planned this week"
- **User queues a recipe that's already in their queue**: Toggle off (remove from queue)

## Out of Scope (for now)

- Ordering/prioritizing queue items (drag to reorder)
- Sharing queue items with specific household members
- Queue suggestions ("You haven't had X in 3 months, queue it?")
- Re-introducing AI suggestions as a fallback for empty days (if needed in future)
- Free-text queue items without a linked recipe

## AI Suggestion Removal

The AI meal suggestion feature is being removed entirely as part of this work. This includes:

- **API endpoint** for generating AI meal suggestions
- **AI generation logic** in the meal plan wizard context (`isGenerating`, `aiReasoning`, suggestion/replace flows)
- **UI elements**: "Replace" buttons, AI reasoning tooltips, loading states for generation
- **`is_ai_suggested` field** on meals — remove from schema and all references
- **Any Gemini/Anthropic SDK usage** related to meal suggestions (recipe URL import is separate and stays)

The review step of the wizard becomes a manual flow: queue panel + empty 7-day grid + "Pick Recipe" from library.

## Resolved Decisions

1. **Queue lives in the main nav** as its own page (`/queue`)
2. **Queue replaces AI suggestions entirely** in the weekly plan wizard review step. The review step becomes: queue panel + empty 7-day grid + "Pick Recipe" fallback for unfilled days.
3. **Toast only** when queueing a recipe. Notes are added/edited from the queue page.
4. **Remove all AI meal suggestion code** — dead code cleanup, not just disabling.
