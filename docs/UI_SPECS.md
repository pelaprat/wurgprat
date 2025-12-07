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

### Loading States

**Spinner**
```jsx
<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
```

**Skeleton**
```jsx
<div className="h-4 bg-gray-200 rounded animate-pulse" />
```

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

### Grocery List (/groceries)

```
┌─────────────────────────────────────────────────────────────┐
│ Grocery List                         [Save to Drive] [Print]│
│ 12 items remaining                        [Clear checked]   │
├─────────────────────────────────────────────────────────────┤
│ [+ Add item...]                     [Category ▼]  [Add]     │
├─────────────────────────────────────────────────────────────┤
│ ▼ Whole Foods                                               │
│   ├─ Produce ─────────────────────────────────────────────  │
│   │  ☐ Broccoli - 2 heads (Stir Fry)                       │
│   │  ☐ Onions - 3 (Pad Thai, Tacos)                        │
│   ├─ Meat & Seafood ──────────────────────────────────────  │
│   │  ☑ Chicken breast - 2 lbs (Honey Garlic Chicken)       │
│   │  ☐ Salmon - 4 fillets (Roasted Salmon)                 │
├─────────────────────────────────────────────────────────────┤
│ ▼ Trader Joe's                                              │
│   ├─ Pantry ──────────────────────────────────────────────  │
│   │  ☐ Rice noodles (Pad Thai)                             │
│   │  ☐ Soy sauce (Stir Fry, Pad Thai)                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Interactions

### Drag and Drop
- Cursor changes to `grab` on drag handle
- On drag: element scales to 1.05, shadow increases
- Drop zone highlights on hover
- Smooth animation on drop (200ms)

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
