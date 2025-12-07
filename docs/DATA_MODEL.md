# Data Model

## Overview

All data is stored in Supabase (PostgreSQL). Data is scoped to households — users in the same household share all meals, recipes, and grocery lists.

## Entity Relationship

```
┌──────────┐       ┌──────────────┐
│  users   │──────▶│  households  │
└──────────┘   N:1 └──────────────┘
                          │
    ┌─────────────────────┼─────────────────────┬──────────────┐
    │                     │                     │              │
    ▼                     ▼                     ▼              ▼
┌──────────┐       ┌─────────────┐       ┌─────────────┐   ┌────────┐
│ recipes  │       │ meal_plans  │       │ ingredients │   │ stores │
└──────────┘       └─────────────┘       └─────────────┘   └────────┘
    │                     │                  │    │             │
    │                     ▼                  │    └─────────────┘
    │               ┌──────────┐             │    ingredients.store_id
    │               │  meals   │             │    references stores.id
    │               └──────────┘             │
    │                     │                  │
    └─────────────────────┘                  │
     meals.recipe_id                         │
     references recipes.id                   │
                                             │
    ┌────────────────────────────────────────┤
    │                                        │
    ▼                                        ▼
┌────────────────────┐               ┌───────────────┐
│ recipe_ingredients │               │ grocery_items │
│  - recipe_id (FK)  │               │  - ingredient_id (FK)
│  - ingredient_id   │               │  - quantity
│  - quantity, unit  │               │  - unit
└────────────────────┘               └───────────────┘
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
Recipe definitions loaded from Google Sheets. Reusable across meal plans.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| household_id | uuid | FK → households.id |
| google_sheet_id | text | Google Sheet ID where recipe is stored |
| name | text | Recipe name |
| description | text | Short description |
| source_url | text | Original recipe URL |
| prep_time | integer | Minutes |
| cook_time | integer | Minutes |
| servings | integer | Number of servings |
| cost_rating | integer | 1-5 scale |
| user_rating | numeric | 1-5, allows 0.5 |
| yields_leftovers | boolean | Default false |
| category | text | "entree", "side", "dessert" |
| cuisine | text | E.g., "Italian", "Asian" |
| instructions | text | Cooking instructions |
| notes | text | Personal notes |
| tags | text[] | Array of tags |
| status | text | "active", "wishlist", "archived" |
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

### meal_plans
A weekly meal plan container. Contains meals as children.

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
Individual meal selections within a meal plan.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| meal_plan_id | uuid | FK → meal_plans.id |
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

**Unique constraint:** (meal_plan_id, day, meal_type)

### grocery_items
Shopping list items for the household, linked to a meal plan. References an ingredient.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| household_id | uuid | FK → households.id |
| meal_plan_id | uuid | FK → meal_plans.id |
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

### Get a week's meal plan with meals and recipes
```sql
SELECT
  mp.id as meal_plan_id,
  mp.week_of,
  m.day,
  m.meal_type,
  m.is_leftover,
  m.notes,
  r.name as recipe_name,
  r.prep_time,
  r.cook_time
FROM meal_plans mp
JOIN meals m ON m.meal_plan_id = mp.id
LEFT JOIN recipes r ON m.recipe_id = r.id
WHERE mp.household_id = $1
  AND mp.week_of = $2
ORDER BY m.day, m.meal_type;
```

### Get shopping list for a meal plan
```sql
SELECT
  gi.*,
  i.name as ingredient_name,
  i.department,
  s.name as store_name,
  s.sort_order as store_order
FROM grocery_items gi
JOIN ingredients i ON gi.ingredient_id = i.id
LEFT JOIN stores s ON i.store_id = s.id
WHERE gi.meal_plan_id = $1
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
CREATE INDEX idx_meal_plans_household_week ON meal_plans(household_id, week_of);
CREATE INDEX idx_meals_meal_plan ON meals(meal_plan_id);
CREATE INDEX idx_meals_recipe ON meals(recipe_id);
CREATE INDEX idx_grocery_items_meal_plan ON grocery_items(meal_plan_id);
CREATE INDEX idx_grocery_items_ingredient ON grocery_items(ingredient_id);
```

---

## Settings JSONB Structure

Stored in `households.settings`:

```json
{
  "default_meal_time": "19:00",
  "week_start_day": "saturday",
  "calendar_id": "primary",
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

Note: Stores are now managed in the `stores` table instead of settings.
