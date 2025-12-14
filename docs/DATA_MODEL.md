# Data Model

## Overview

All data is stored in Supabase (PostgreSQL). Data is scoped to households — users in the same household share all meals, recipes, and grocery lists.

## Entity Relationship

```
┌──────────┐       ┌──────────────┐
│  users   │──────▶│  households  │
└──────────┘   N:1 └──────────────┘
                          │
    ┌─────────────────────┼─────────────────────┬──────────────┬──────────┐
    │                     │                     │              │          │
    ▼                     ▼                     ▼              ▼          ▼
┌──────────┐       ┌─────────────┐       ┌─────────────┐   ┌────────┐ ┌────────┐
│ recipes  │       │ weekly_plan │       │ ingredients │   │ stores │ │ events │
└──────────┘       └─────────────┘       └─────────────┘   └────────┘ └────────┘
    │                     │                  │    │             │
    │              ┌──────┴──────┐           │    └─────────────┘
    │              │             │           │    ingredients.store_id
    │              ▼             ▼           │    references stores.id
    │        ┌──────────┐  ┌──────────────┐  │
    │        │  meals   │  │ grocery_list │  │
    │        └──────────┘  └──────────────┘  │
    │              │             │           │
    └──────────────┘             ▼           │
     meals.recipe_id      ┌───────────────┐  │
     references           │ grocery_items │◀─┘
     recipes.id           │  - grocery_list_id (FK)
                          │  - ingredient_id (FK)
    ┌─────────────────────┤  - quantity, unit
    │                     └───────────────┘
    ▼
┌────────────────────┐
│ recipe_ingredients │
│  - recipe_id (FK)  │
│  - ingredient_id   │
│  - quantity, unit  │
└────────────────────┘
```

## Tables

### households
The family unit. All data belongs to a household.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Family name (e.g., "The Smiths") |
| settings | jsonb | Preferences (default_meal_time, week_start_day, departments) |
| created_at | timestamptz | Creation timestamp |

### users
Individual users linked to Google accounts.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| email | text | Google email (unique) |
| name | text | Display name |
| picture | text | Avatar URL |
| household_id | uuid | FK → households.id |
| created_at | timestamptz | Creation timestamp |

### stores
Stores where the household shops.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| household_id | uuid | FK → households.id |
| name | text | Store name (e.g., "Whole Foods") |
| sort_order | integer | Display order for the household |
| created_at | timestamptz | Creation timestamp |

**Unique constraint:** (household_id, name)

### events
Household events imported from Google Calendar (e.g., kids activities). Used to inform meal planning decisions - on busy evenings, quick meals or leftovers are preferred.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| household_id | uuid | FK → households.id |
| google_calendar_id | text | Google Calendar ID this event came from |
| google_event_id | text | Google Calendar event ID (for deduplication) |
| title | text | Event title |
| description | text | Event description |
| start_time | timestamptz | Event start time |
| end_time | timestamptz | Event end time |
| all_day | boolean | Is this an all-day event? |
| location | text | Event location |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last updated timestamp |

**Unique constraint:** (household_id, google_event_id)

### ingredients
Master list of all ingredients for the household. Each ingredient has a preferred store.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| household_id | uuid | FK → households.id |
| name | text | Ingredient name (e.g., "chicken thighs", "salt") |
| store_id | uuid | FK → stores.id (preferred store) |
| department | text | Store section (e.g., "Meat & Seafood", "Pantry") |
| created_at | timestamptz | Creation timestamp |

**Unique constraint:** (household_id, name)

### recipes
Recipe definitions loaded from Google Sheets. Reusable across weekly plans.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| household_id | uuid | FK → households.id |
| google_sheet_id | text | Google Sheet ID where recipe is stored |
| name | text | Recipe name |
| description | text | Short description |
| source | text | Recipe source (e.g., "NYT Cooking", "Bon Appetit") |
| source_url | text | Original recipe URL |
| servings | integer | Number of servings |
| cost_rating | integer | 1-5 scale |
| time_rating | integer | 1-5 scale (how long it takes) |
| rating_emily | numeric(3,1) | Rating with 1 decimal place |
| rating_etienne | numeric(3,1) | Rating with 1 decimal place |
| yields_leftovers | boolean | Default false |
| category | text | "entree", "side", "dessert" |
| cuisine | text | E.g., "Italian", "Asian" |
| instructions | text | Cooking instructions |
| notes | text | Personal notes |
| tags | text[] | Array of tags |
| status | text | "made", "wishlist" |
| last_made | date | When last cooked |
| created_by | uuid | FK → users.id |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### recipe_ingredients
Links recipes to ingredients with quantity/unit specific to that recipe.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| recipe_id | uuid | FK → recipes.id |
| ingredient_id | uuid | FK → ingredients.id |
| quantity | numeric | Amount needed |
| unit | text | Unit of measure (e.g., "lbs", "cups", "tsp") |
| notes | text | Optional notes (e.g., "diced", "room temperature") |
| sort_order | integer | Display order in recipe |

**Unique constraint:** (recipe_id, ingredient_id)

### weekly_plan
A weekly plan container. Contains meals and grocery items as children.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| household_id | uuid | FK → households.id |
| week_of | date | Start date of the week (e.g., Saturday) |
| notes | text | Notes for the week |
| created_by | uuid | FK → users.id |
| created_at | timestamptz | |

**Unique constraint:** (household_id, week_of)

### meals
Individual meal selections within a weekly plan.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| weekly_plan_id | uuid | FK → weekly_plan.id |
| recipe_id | uuid | FK → recipes.id (nullable) |
| day | integer | Day of week (1-7, where 1 = first day of week) |
| meal_type | text | "breakfast", "lunch", "dinner", "snack" (default: "dinner") |
| custom_meal_name | text | Quick entry without full recipe |
| is_leftover | boolean | Is this a leftover? Default false |
| leftover_source_id | uuid | FK → meals.id (which meal is this leftover from?) |
| notes | text | Meal-specific notes |
| calendar_event_id | text | Google Calendar event ID |
| created_by | uuid | FK → users.id |
| created_at | timestamptz | |

**Unique constraint:** (weekly_plan_id, day, meal_type)

### grocery_list
A shopping list for a weekly plan.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| weekly_plan_id | uuid | FK → weekly_plan.id |
| notes | text | Notes for the grocery list |
| created_by | uuid | FK → users.id |
| created_at | timestamptz | |

**Unique constraint:** (weekly_plan_id) — one grocery list per weekly plan

### grocery_items
Individual items on a grocery list. References an ingredient.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| grocery_list_id | uuid | FK → grocery_list.id |
| ingredient_id | uuid | FK → ingredients.id |
| quantity | numeric | Amount to buy |
| unit | text | Unit of measure |
| checked | boolean | Bought? Default false |
| added_by | uuid | FK → users.id |
| created_at | timestamptz | |

Note: Store and department are inherited from the ingredient. Source recipes can be derived by joining through recipe_ingredients.

---

## Row Level Security (RLS)

All tables have RLS enabled. Policies ensure users can only access data from their own household.

**Policy Pattern:**
```sql
CREATE POLICY "Users can manage household data" ON table_name
  FOR ALL USING (
    household_id IN (
      SELECT household_id FROM users 
      WHERE email = auth.jwt()->>'email'
    )
  );
```

---

## Common Queries

### Get a weekly plan with meals and recipes
```sql
SELECT
  wp.id as weekly_plan_id,
  wp.week_of,
  m.day,
  m.meal_type,
  m.is_leftover,
  m.notes,
  r.name as recipe_name,
  r.prep_time,
  r.cook_time
FROM weekly_plan wp
JOIN meals m ON m.weekly_plan_id = wp.id
LEFT JOIN recipes r ON m.recipe_id = r.id
WHERE wp.household_id = $1
  AND wp.week_of = $2
ORDER BY m.day, m.meal_type;
```

### Get grocery list for a weekly plan
```sql
SELECT
  gi.*,
  i.name as ingredient_name,
  i.department,
  s.name as store_name,
  s.sort_order as store_order
FROM grocery_list gl
JOIN grocery_items gi ON gi.grocery_list_id = gl.id
JOIN ingredients i ON gi.ingredient_id = i.id
LEFT JOIN stores s ON i.store_id = s.id
WHERE gl.weekly_plan_id = $1
ORDER BY s.sort_order, i.department, i.name;
```

### Get recipe with ingredients
```sql
SELECT
  r.*,
  ri.quantity,
  ri.unit,
  ri.notes as ingredient_notes,
  ri.sort_order,
  i.name as ingredient_name,
  i.department,
  s.name as store_name
FROM recipes r
JOIN recipe_ingredients ri ON ri.recipe_id = r.id
JOIN ingredients i ON ri.ingredient_id = i.id
LEFT JOIN stores s ON i.store_id = s.id
WHERE r.id = $1
ORDER BY ri.sort_order;
```

### Get all active recipes
```sql
SELECT * FROM recipes
WHERE household_id = $1
  AND status = 'active'
ORDER BY name;
```

---

## Indexes

```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_household ON users(household_id);
CREATE INDEX idx_stores_household ON stores(household_id);
CREATE INDEX idx_ingredients_household ON ingredients(household_id);
CREATE INDEX idx_ingredients_store ON ingredients(store_id);
CREATE INDEX idx_recipes_household ON recipes(household_id);
CREATE INDEX idx_recipes_status ON recipes(household_id, status);
CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_ingredient ON recipe_ingredients(ingredient_id);
CREATE INDEX idx_weekly_plan_household_week ON weekly_plan(household_id, week_of);
CREATE INDEX idx_meals_weekly_plan ON meals(weekly_plan_id);
CREATE INDEX idx_meals_recipe ON meals(recipe_id);
CREATE INDEX idx_grocery_list_weekly_plan ON grocery_list(weekly_plan_id);
CREATE INDEX idx_grocery_items_grocery_list ON grocery_items(grocery_list_id);
CREATE INDEX idx_grocery_items_ingredient ON grocery_items(ingredient_id);
CREATE INDEX idx_events_household ON events(household_id);
CREATE INDEX idx_events_start_time ON events(household_id, start_time);
```

---

## Settings JSONB Structure

Stored in `households.settings`:

```json
{
  "default_meal_time": "19:00",
  "week_start_day": "saturday",
  "cooked_recipes_sheet_url": "https://docs.google.com/spreadsheets/d/.../edit#gid=123",
  "wishlist_recipes_sheet_url": "https://docs.google.com/spreadsheets/d/.../edit#gid=456",
  "events_calendar_url": "https://calendar.google.com/calendar/ical/.../basic.ics",
  "departments": [
    "Produce",
    "Meat & Seafood",
    "Dairy",
    "Pantry",
    "Frozen",
    "Bakery",
    "Other"
  ]
}
```

| Setting | Description |
|---------|-------------|
| default_meal_time | Default time for dinner (HH:MM format) |
| week_start_day | First day of the meal planning week |
| cooked_recipes_sheet_url | Google Sheets URL for recipes already made (status: active) |
| wishlist_recipes_sheet_url | Google Sheets URL for recipes to try (status: wishlist) |
| events_calendar_url | ICS calendar URL for household events (e.g., kids activities) |
| departments | Store sections for organizing grocery lists |

Note: Stores are now managed in the `stores` table instead of settings.
