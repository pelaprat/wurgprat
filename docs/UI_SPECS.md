# UI Specifications

## Design System

### Color Palette

**Primary (Emerald)**
- `emerald-500`: #10b981 — Primary actions, links
- `emerald-600`: #059669 — Hover states, emphasis
- `emerald-700`: #047857 — Active states

**Semantic**
- Success: `green-500` #22c55e
- Warning: `amber-500` #f59e0b  
- Error: `red-500` #ef4444
- Info: `blue-500` #3b82f6

**Neutrals**
- `gray-50`: #f9fafb — Page background
- `gray-100`: #f3f4f6 — Card backgrounds, borders
- `gray-500`: #6b7280 — Secondary text
- `gray-700`: #374151 — Body text
- `gray-900`: #111827 — Headings

### Typography

**Font Stack**
```css
font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 
  "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

**Scale**
- `text-xs`: 12px — Captions, badges
- `text-sm`: 14px — Secondary text, labels
- `text-base`: 16px — Body text
- `text-lg`: 18px — Subheadings
- `text-xl`: 20px — Card titles
- `text-2xl`: 24px — Page titles
- `text-3xl`: 30px — Hero text

**Weights**
- `font-normal`: 400 — Body
- `font-medium`: 500 — Labels, buttons
- `font-semibold`: 600 — Subheadings
- `font-bold`: 700 — Headings

### Spacing

Use Tailwind's default scale (4px base):
- `p-2`: 8px
- `p-4`: 16px
- `p-6`: 24px
- `gap-4`: 16px (grid/flex gaps)
- `space-y-4`: 16px (vertical stacking)

### Border Radius

- `rounded`: 4px — Badges, small elements
- `rounded-lg`: 8px — Buttons, inputs
- `rounded-xl`: 12px — Cards

### Shadows

- `shadow-sm`: Subtle cards
- `shadow`: Standard elevation
- `shadow-lg`: Modals, dropdowns

---

## Components

### Buttons

**Primary**
```jsx
<button className="bg-emerald-600 text-white px-4 py-2 rounded-lg 
  hover:bg-emerald-700 transition-colors font-medium">
  Label
</button>
```

**Secondary**
```jsx
<button className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg 
  hover:bg-gray-50 transition-colors font-medium">
  Label
</button>
```

**Ghost/Text**
```jsx
<button className="text-emerald-600 hover:text-emerald-700 font-medium">
  Label
</button>
```

**Sizes**
- Small: `px-3 py-1.5 text-sm`
- Default: `px-4 py-2`
- Large: `px-6 py-3 text-lg`

### Cards

```jsx
<div className="bg-white rounded-xl shadow-sm p-6">
  {/* content */}
</div>
```

**Interactive Card** (hover state)
```jsx
<div className="bg-white rounded-xl shadow-sm p-6 border-2 border-transparent 
  hover:border-emerald-500 transition-colors cursor-pointer">
  {/* content */}
</div>
```

### Inputs

**Text Input**
```jsx
<input 
  type="text"
  className="w-full border border-gray-300 rounded-lg px-4 py-2 
    focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
  placeholder="Placeholder"
/>
```

**Select**
```jsx
<select className="border border-gray-300 rounded-lg px-4 py-2 
  focus:ring-2 focus:ring-emerald-500">
  <option>Option 1</option>
</select>
```

### Checkboxes

```jsx
<input 
  type="checkbox"
  className="h-5 w-5 text-emerald-600 rounded border-gray-300 
    focus:ring-emerald-500"
/>
```

### Badges

```jsx
<span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs
  font-medium bg-emerald-100 text-emerald-800">
  Badge
</span>
```

**Variants**
- Success: `bg-green-100 text-green-800`
- Warning: `bg-amber-100 text-amber-800`
- Error: `bg-red-100 text-red-800`
- Neutral: `bg-gray-100 text-gray-800`
- Staple: `bg-purple-100 text-purple-800`
- Manual Add: `bg-blue-100 text-blue-800`

### Loading States

**Spinner**
```jsx
<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
```

**Skeleton**
```jsx
<div className="h-4 bg-gray-200 rounded animate-pulse" />
```

### Toast Notifications

**Success Toast**
- Fixed position at top center of viewport (`fixed top-20 left-1/2 -translate-x-1/2`)
- Emerald background with white text
- Includes checkmark icon, message text, and dismiss button
- Auto-dismisses after 5 seconds
- Slides down on appear (`animate-slideDown`)
- z-index: 50 (above most content)

```jsx
<div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-slideDown">
  <div className="bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
    <span>Your weekly plan was created.</span>
    <button className="ml-2 hover:bg-emerald-700 rounded p-1">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</div>
```

**Usage:**
- Weekly plan creation → "Weekly plan created" notification on home page
- Pass notification type via URL query param (e.g., `/?notification=weekly-plan-created`)
- Page reads query param, shows toast, then clears URL

---

## Page Layouts

### Navigation Bar
- Fixed at top
- White background with subtle border
- Logo left, nav links center (desktop), user right
- Mobile: hamburger menu

```
┌─────────────────────────────────────────────────────────────┐
│ 🍽️ Meal Planner    This Week | Recipes | Groceries    [User]│
└─────────────────────────────────────────────────────────────┘
```

### Dashboard (/)

```
┌─────────────────────────────────────────────────────────────┐
│ Welcome back, [Name]!                                       │
│ What would you like to do today?                            │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐                         │
│  │ 📅           │  │ 📖           │                         │
│  │ Plan This    │  │ Browse       │                         │
│  │ Week         │  │ Recipes      │                         │
│  └──────────────┘  └──────────────┘                         │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │ 🛒           │  │ ⚙️           │                         │
│  │ Grocery      │  │ Settings     │                         │
│  │ List         │  │              │                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

### Meal Planning (/meals)

```
┌─────────────────────────────────────────────────────────────┐
│ ◀ Week of November 16, 2024 ▶            [Sync to Calendar] │
├─────────────────────────────────────────────────────────────┤
│      │ Sat  │ Sun  │ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │
│      │ 11/16│ 11/17│ 11/18│ 11/19│ 11/20│ 11/21│ 11/22│
├──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│ 🌅   │      │      │      │      │      │      │      │
│ Bkfst│      │      │      │      │      │      │      │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│ ☀️   │      │      │      │ 🚗   │      │ 🚗   │      │
│ Lunch│      │      │      │ busy │      │ busy │      │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│ 🌙   │ Pad  │ Left │ Stir │ Tacos│Salmon│ Stir │Chicken│
│Dinner│ Thai │ over │ Fry  │      │      │ Fry  │      │
└──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
│                                                             │
│ Recipe Bank                           [Search...] [Filter ▼]│
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐               │
│ │Pad Thai│ │Tacos   │ │Salmon  │ │Chicken │               │
│ │ 45 min │ │ 20 min │ │ 30 min │ │ 40 min │               │
│ └────────┘ └────────┘ └────────┘ └────────┘               │
└─────────────────────────────────────────────────────────────┘
```

### Recipes (/recipes)

```
┌─────────────────────────────────────────────────────────────┐
│ Recipes                                      [+ Add Recipe] │
├─────────────────────────────────────────────────────────────┤
│ [Search recipes...]   [Category ▼] [Cuisine ▼] [Time ▼]    │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │ [image]     │ │ [image]     │ │ [image]     │            │
│ │ Pad Thai    │ │ Beef Tacos  │ │ Salmon      │            │
│ │ ⏱ 45 min   │ │ ⏱ 20 min   │ │ ⏱ 30 min   │            │
│ │ ⭐ 4.5     │ │ ⭐ 5.0     │ │ ⭐ 4.0     │            │
│ └─────────────┘ └─────────────┘ └─────────────┘            │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │ ...         │ │ ...         │ │ ...         │            │
│ └─────────────┘ └─────────────┘ └─────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

### Staples (/weekly-plans/create/staples) - Step 3 of 5

```
┌─────────────────────────────────────────────────────────────┐
│ Weekly Plans / Create / Staples                             │
│ Add Staples                                                 │
│ Step 3 of 5: Add recurring grocery items                    │
├─────────────────────────────────────────────────────────────┤
│ [○]──[○]──[●]──[○]──[○]  (Progress: Start-Meals-Staples-...)│
├─────────────────────────────────────────────────────────────┤
│ ℹ️ These items will be added to your grocery list every week │
│    Pre-loaded from your previous week's staples             │
├─────────────────────────────────────────────────────────────┤
│ Your Staples (3 items)                                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Milk              [2    ] [gallon  ]              [✕]  │ │
│ │ Dairy                                                   │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Eggs              [1    ] [dozen   ]              [✕]  │ │
│ │ Dairy                                                   │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Bread             [1    ] [loaf    ]              [✕]  │ │
│ │ Bakery                                                  │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ [+ Add ingredient]                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [Search ingredients...                              ]   │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ Butter (Dairy)                                  [+] │ │ │
│ │ │ Bananas (Produce)                               [+] │ │ │
│ │ │ Yogurt (Dairy)                                  [+] │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ [← Back]                                      [Continue →]  │
└─────────────────────────────────────────────────────────────┘
```

### Grocery List (/weekly-plans/[id] and /weekly-plans/create/groceries)

**Two-Level Grouping Structure:**
- Level 1: Store (card with header)
- Level 2: Department (sub-header within store card)
- Level 3: Items (sorted alphabetically within department)

```
┌─────────────────────────────────────────────────────────────┐
│ 🏪 Whole Foods                                    8 items   │
├─────────────────────────────────────────────────────────────┤
│ Produce                                                  3  │
│   ☐ Broccoli                              2 heads           │
│      Stir Fry                                               │
│   ☐ Carrots                               1 lb              │
│      Pad Thai                                               │
│   ☐ Onions                                3                 │
│      Pad Thai, Tacos                                        │
├─────────────────────────────────────────────────────────────┤
│ Meat & Seafood                                           2  │
│   ☑ Chicken breast                        2 lbs             │
│      Honey Garlic Chicken                                   │
│   ☐ Salmon                                4 fillets         │
│      Roasted Salmon                                         │
├─────────────────────────────────────────────────────────────┤
│ Dairy                                                    2  │
│   ☐ Milk [STAPLE]                         2 gallon          │
│   ☐ Eggs [STAPLE]                         1 dozen           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 🏪 Trader Joe's                                   4 items   │
├─────────────────────────────────────────────────────────────┤
│ Pantry                                                   2  │
│   ☐ Rice noodles                          1 pkg             │
│      Pad Thai                                               │
│   ☐ Soy sauce                             1 bottle          │
│      Stir Fry, Pad Thai                                     │
├─────────────────────────────────────────────────────────────┤
│ ...                                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 🏪 No Store Assigned                              2 items   │
├─────────────────────────────────────────────────────────────┤
│ Other                                                    2  │
│   ☐ Special ingredient                    1                 │
└─────────────────────────────────────────────────────────────┘
```

**Visual States:**
- Store header: sky blue background with left accent border (`bg-sky-100`, `border-l-4 border-l-sky-500`)
- Department header: amber background with left accent border (`bg-amber-50`, `border-l-4 border-l-amber-400`)
- Checked items: strike-through text, gray color
- All department items checked: department header turns green (`bg-emerald-50`, `border-l-emerald-400`)
- All store items checked: store header turns green (`bg-emerald-100`, `border-l-emerald-500`)

**Sticky Headers:**
- Store headers stick to top of viewport when scrolling (`sticky top-0 z-20`)
- Department headers stick below store header (`sticky top-[48px] z-10`)
- Provides context for which store/department user is viewing while scrolling through long lists

**Badges:**
- `[STAPLE]` - purple badge for staple items
- `[ADDED]` - blue badge for manually added items

---

## Interactions

### Drag and Drop (Recipes)
- Cursor changes to `grab` on drag handle
- On drag: element scales to 1.05, shadow increases
- Drop zone highlights on hover
- Smooth animation on drop (200ms)

### Meal Movement (Weekly Plan Detail)

**Desktop - Drag and Drop:**
- Grip handle icon displayed left of meal name (hidden on mobile)
- Uses dnd-kit library for drag behavior
- Drag overlay shows meal name in floating card
- Drop zones are day rows - highlight with emerald ring on hover
- Activation distance: 8px (prevents accidental drags)

```
┌─────────────────────────────────────────────────────────────┐
│ ⋮⋮ [Meal Name]                                              │ ← Drag handle
└─────────────────────────────────────────────────────────────┘
```

**Mobile - Day Selector:**
- Compact dropdown shown right of meal name (hidden on desktop: `md:hidden`)
- Shows abbreviated day names (Sat, Sun, Mon, etc.)
- Immediate change on selection, optimistic update

```
┌─────────────────────────────────────────────────────────────┐
│ [Meal Name]                              [Sat ▼]            │
└─────────────────────────────────────────────────────────────┘
```

### Transitions
- All color transitions: 200ms ease
- Modal open/close: 300ms
- Page transitions: instant (Next.js handles)

### Touch Targets
- Minimum 44x44px for all interactive elements
- Checkboxes: 20x20px visual, 44x44px tap area

### Empty States
- Friendly illustration or emoji
- Clear call-to-action
- Example: "No recipes yet! Add your first recipe to get started."

### Error States
- Red border on invalid inputs
- Error message below input
- Toast notification for API errors

---

## Responsive Breakpoints

- Mobile: <768px
- Tablet: 768px - 1024px  
- Desktop: >1024px

**Mobile Adaptations**
- Navigation collapses to hamburger
- Weekly grid scrolls horizontally or stacks
- Recipe cards go single-column
- Full-width buttons
