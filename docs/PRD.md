# Product Requirements Document
# Family Meal Planning Application

## Overview

A web app for families to plan weekly meals, manage recipes, and generate grocery lists. Integrates with Google Calendar (to see busy nights and add meal events).

### Target Users
- Parents managing meals for families (optimized for 4-8 people)
- High tech comfort
- Pain points: meal planning fatigue, grocery list chaos, busy schedules, grocery item management is crazy

### Success Metrics
- Weekly planning time: <15 minutes (down from 60+)
- 100% of planned meals reflected in shopping list
- Zero duplicate grocery trips per week
- >80% meal plan completion rate

---

## Core Features

### 1. Authentication & Households

**Google OAuth Sign-In**
- Primary (only) auth method via NextAuth.js
- Scopes: email, profile, calendar, drive.file
- On first sign-in: create user record, create or join household

**Household System**
- Multiple users can belong to one household
- All data (plans, meals, recipes, groceries) scoped to household

**User Profile**
- Fields: id, email, name, picture (from Google)
- Linked to exactly one household

---

### 2. Weekly Meal Planning

**Planning Cycle**
- Week runs Saturday to Friday (Saturday = planning day)
- Visual 7-day grid showing all days
- Current week auto-selected on load
- Navigate to past/future weeks

**Calendar Integration (Read)**
- Fetch events from user's Google Calendars plural; there can be more than one
- Identify "busy" evenings (events after 4 PM)
- Display busy indicator on each day
- Busy nights suggest quick meals or leftovers

**Meal Assignment**
- Drag-and-drop recipes from recipe bank to days
- Click to assign (mobile-friendly alternative)
- Multiple recipes per day are allowed
- Quick actions: "Mark as Leftover", "Clear Day", "Copy from Last Week"

**Meal Editing (Post-Creation)**
- Move meals between days within an existing weekly plan
- Desktop: Drag-and-drop meals to different days
- Mobile: Day dropdown selector on each meal
- Calendar events automatically updated when meals are moved
- Changes sync to Google Calendar (date/time updated)

**Leftover Tracking**
- Explicit leftover flag per day
- Links to source meal (e.g., Tuesday leftover → Monday's chicken)
- Visual distinction (badge/color)
- Recipes can be marked "yields leftovers"

**Calendar Integration (Write)**
- "Sync to Calendar" button
- Creates events: "[🍽️] Recipe Name" at 6 PM (configurable)
- Updates propagate to family devices
- When a weekly plan is deleted, all associated calendar events are automatically removed from Google Calendar

---

### 3. Recipe Management

**Recipe Fields**
```
- id: string
- name: string
- sourceUrl: string (optional)
- prepTime: number (minutes)
- cookTime: number (minutes)
- servings: number
- costRating: 1-5
- userRating: 1-5 (0.5 increments)
- yieldsLeftovers: boolean
- category: "entree" | "side" | "dessert"
- cuisine: string
- ingredients: array of { name, quantity, unit, store, department }
- instructions: string
- notes: string
- tags: string[]
- lastMade: date
- householdId: string
- createdBy: string (user id)
```

**Recipe Import**
- **URL Import**: Paste URL, parse schema.org data, review, save
- **Manual Entry**: Form with ingredient parser ("2 lbs chicken" → structured)
- **Bulk paste**: One ingredient per line

**Recipe Organization**
- Categories: Active, Wishlist, Archived
- Filters: cook time, cost, rating, cuisine, yields leftovers, ingredients
- Search: name, ingredients, tags

---

### 4. AI Meal Planning Assistant (Future)

**Natural Language Input**
- "We want to use up chicken and broccoli"
- "Need quick meals Tuesday and Thursday"
- "Budget-conscious week"

**Constraint Checkboxes**
- Quick meals only (≤30 min)
- Include leftover nights
- Highly-rated only (4+ stars)
- Budget-friendly (cost ≤2)
- Haven't made recently

**Calendar-Aware**
- Busy nights → suggest quick meals or leftovers
- Free nights → normal complexity
- Sunday → meal prep friendly

**Plan Review**
- Shows reasoning per day
- Accept/reject individual days
- Modify before accepting

---

### 5. Shopping List

**Automatic Generation**
- Scan all meals in weekly plan
- Aggregate ingredients across recipes
- Combine same ingredients (unit conversion)
- Exclude pantry staples (configurable)

**Staple Items**
- Recurring grocery items added weekly (milk, eggs, bread, etc.)
- Tied to ingredients in the household's ingredient database
- Pre-populated from previous week's staples when creating a new plan
- Can add/remove/modify quantities during plan creation
- Merge with recipe ingredients: if same ingredient exists, quantities combine
- Displayed with "Staple" badge in grocery list for visual distinction
- Stored with `is_staple` flag in database for retrieval in subsequent weeks

**Two-Level Grouping (Store → Department)**
- Top level: grouped by store (Whole Foods, Trader Joe's, Costco, etc.)
- Second level: grouped by department within each store
- Department order: Produce, Meat & Seafood, Dairy, Bakery, Frozen, Pantry, Canned Goods, Condiments, Spices, Beverages, Snacks, Other
- Items sorted alphabetically within each department
- "No Store Assigned" group appears last
- Per-ingredient preferred store (configurable in settings)
- Sticky headers: store and department labels pin to top when scrolling for context

**Recipe Attribution**
- Each item shows source recipes
- "Chicken - 3 lbs (Honey Garlic Chicken, Pad Thai)"

**Shopping Experience**
- Checkbox to mark items bought
- Strike-through on check
- Add manual items
- "Weekly staples" section
- Export to Google Drive as Doc
- Print-friendly view

---

### 6. Settings

**Google Calendar**
- Select which calendar to read/write
- Default meal time (e.g., 6 PM)

**Household**
- Family name
- Manage members (future: invite system)

**Store Preferences**
- Add/remove/reorder stores
- Set default store per department

**Pantry Staples**
- Items to exclude from shopping list (salt, oil, etc.)

---

## User Flows

### First-Time User
1. Land on home page → "Sign in with Google"
2. Grant permissions (email, calendar, drive)
3. App creates user + new household
4. Redirect to dashboard
5. Prompt to add first recipe or start planning

### Weekly Planning (5-Step Wizard)
1. **Input**: Select week, describe preferences, select recipes
2. **Review Meals**: See AI-suggested meal plan, swap/remove meals, pick recipes manually
3. **Staples**: Add recurring grocery items (pre-loaded from previous week)
4. **Events**: Review calendar events, assign household members
5. **Groceries**: Review merged grocery list (recipes + staples), finalize plan

**Post-Creation**
- Redirect to home page with success notification ("Weekly plan created")
- Notification auto-dismisses after 5 seconds (or user can dismiss manually)
- View weekly plan with Grocery List, Dinner Plans, and Events tabs
- Sync meals to Google Calendar
- Check off items while shopping

### Adding a Recipe
1. Navigate to Recipes
2. Click "Add Recipe"
3. Paste URL or enter manually
4. Review parsed data, adjust if needed
5. Save → appears in recipe bank

---

## Page Layouts

### Dashboard (/)
- Welcome message with name
- Stats: meals planned this week, total recipes, shopping items
- Current week mini-preview
- Quick actions: "Plan This Week", "View Recipes", "Shopping List"

### Meal Planning (/meals)
- Week navigation (prev/next, date display)
- 7-day grid with day names and dates
- Each cell: assigned recipes, leftover badge, busy indicator
- Recipe bank below (searchable, draggable)
- Buttons: "Sync to Calendar", "Generate Shopping List"

### Recipes (/recipes)
- Search bar + filter dropdowns
- Grid of recipe cards (image, name, time, rating)
- "Add Recipe" button (prominent)
- Click card → detail view / edit

### Shopping List (/groceries)
- Store sections (collapsible)
- Department groups within stores
- Checkboxes per item
- "Export to Drive" and "Print" buttons
- "Add Item" input

### Settings (/settings)
- Sections for Calendar, Household, Stores, Staples
- Save button per section

---

## Design System

**Colors**
- Primary: Emerald (#10b981, #059669)
- Success: Green (#22c55e)
- Warning: Amber (#f59e0b)
- Error: Red (#ef4444)
- Neutrals: Gray scale

**Typography**
- Font: System stack (Inter if available)
- Headings: Bold, clear hierarchy
- Body: 16px minimum

**Components**
- Cards: White bg, rounded-xl, shadow-sm
- Buttons: Rounded-lg, clear hover states
- Inputs: Border, rounded-lg, focus ring
- Checkboxes: Custom styled, large tap targets (44px min)

**Interactions**
- Smooth transitions (200ms)
- Drag feedback: scale, shadow
- Loading states: Skeleton or spinner
- Toast notifications for actions

---

## Technical Notes

**Real-Time Sync**
- Supabase subscriptions for shared grocery list
- Both users see updates instantly

**Offline Handling**
- Graceful degradation if network fails
- Retry with exponential backoff
- Toast notification for sync issues

**Performance Targets**
- Initial load: <3 seconds
- Page transitions: <500ms
- Drag operations: 60fps

---

## Future Enhancements (Post-MVP)

**Phase 2**
- AI meal planning assistant
- Nutrition tracking
- Recipe scaling (adjust servings)
- Meal history and favorites

**Phase 3**
- Household invite system
- Grocery delivery integration (Instacart)
- Barcode scanning for pantry
- Mobile native app
