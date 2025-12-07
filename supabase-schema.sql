-- Supabase Schema for Meal Planner
-- Run this in the Supabase SQL Editor to set up your database

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Households table (the family unit, all data belongs to a household)
create table households (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now() not null
);

comment on column households.settings is 'Preferences: default_meal_time, week_start_day, calendar_id, departments[]';

-- Users table (links Google accounts to households)
create table users (
  id uuid default uuid_generate_v4() primary key,
  email text unique not null,
  name text,
  picture text,
  household_id uuid references households(id),
  created_at timestamptz default now() not null
);

-- Stores table (stores where the household shops)
create table stores (
  id uuid default uuid_generate_v4() primary key,
  household_id uuid references households(id) not null,
  name text not null,
  sort_order integer default 0,
  created_at timestamptz default now() not null,

  unique(household_id, name)
);

-- Ingredients table (master list of all ingredients for the household)
create table ingredients (
  id uuid default uuid_generate_v4() primary key,
  household_id uuid references households(id) not null,
  name text not null,
  store_id uuid references stores(id),
  department text,
  created_at timestamptz default now() not null,

  unique(household_id, name)
);

comment on column ingredients.store_id is 'Preferred store for this ingredient';
comment on column ingredients.department is 'Store section (e.g., Meat & Seafood, Pantry)';

-- Recipes table (recipe definitions loaded from Google Sheets)
create table recipes (
  id uuid default uuid_generate_v4() primary key,
  household_id uuid references households(id) not null,
  google_sheet_id text,
  name text not null,
  description text,
  source_url text,
  prep_time integer,
  cook_time integer,
  servings integer,
  cost_rating integer check (cost_rating between 1 and 5),
  user_rating numeric(2,1) check (user_rating between 1 and 5),
  yields_leftovers boolean default false,
  category text check (category in ('entree', 'side', 'dessert')),
  cuisine text,
  instructions text,
  notes text,
  tags text[] default '{}',
  status text default 'active' check (status in ('active', 'wishlist', 'archived')),
  last_made date,
  created_by uuid references users(id),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

comment on column recipes.prep_time is 'Prep time in minutes';
comment on column recipes.cook_time is 'Cook time in minutes';
comment on column recipes.user_rating is 'Rating 1-5, allows 0.5 increments';

-- Recipe Ingredients junction table (links recipes to ingredients)
create table recipe_ingredients (
  id uuid default uuid_generate_v4() primary key,
  recipe_id uuid references recipes(id) on delete cascade not null,
  ingredient_id uuid references ingredients(id) not null,
  quantity numeric,
  unit text,
  notes text,
  sort_order integer default 0,

  unique(recipe_id, ingredient_id)
);

comment on column recipe_ingredients.notes is 'Optional notes (e.g., diced, room temperature)';

-- Meal Plans table (weekly container for meals)
create table meal_plans (
  id uuid default uuid_generate_v4() primary key,
  household_id uuid references households(id) not null,
  week_of date not null,
  notes text,
  created_by uuid references users(id),
  created_at timestamptz default now() not null,

  unique(household_id, week_of)
);

comment on column meal_plans.week_of is 'Start date of the week (e.g., Saturday)';

-- Meals table (individual meal selections within a meal plan)
create table meals (
  id uuid default uuid_generate_v4() primary key,
  meal_plan_id uuid references meal_plans(id) on delete cascade not null,
  recipe_id uuid references recipes(id),
  day integer not null check (day between 1 and 7),
  meal_type text default 'dinner' check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  custom_meal_name text,
  is_leftover boolean default false,
  leftover_source_id uuid references meals(id),
  notes text,
  calendar_event_id text,
  created_by uuid references users(id),
  created_at timestamptz default now() not null,

  unique(meal_plan_id, day, meal_type)
);

comment on column meals.day is 'Day of week (1-7, where 1 = first day of week)';
comment on column meals.leftover_source_id is 'Which meal is this leftover from?';

-- Grocery Items table (shopping list items linked to a meal plan)
create table grocery_items (
  id uuid default uuid_generate_v4() primary key,
  household_id uuid references households(id) not null,
  meal_plan_id uuid references meal_plans(id) on delete cascade,
  ingredient_id uuid references ingredients(id) not null,
  quantity numeric,
  unit text,
  checked boolean default false,
  added_by uuid references users(id),
  created_at timestamptz default now() not null
);

comment on table grocery_items is 'Store and department are inherited from the ingredient';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

alter table households enable row level security;
alter table users enable row level security;
alter table stores enable row level security;
alter table ingredients enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table meal_plans enable row level security;
alter table meals enable row level security;
alter table grocery_items enable row level security;

-- Helper function to get current user's household_id
create or replace function get_user_household_id()
returns uuid as $$
  select household_id from users where email = auth.jwt()->>'email'
$$ language sql security definer;

-- Households: users can view their own household
create policy "Users can view own household" on households
  for select using (id = get_user_household_id());

-- Users: can view other users in their household
create policy "Users can view household members" on users
  for select using (household_id = get_user_household_id());

-- Stores: users can manage stores in their household
create policy "Users can manage household stores" on stores
  for all using (household_id = get_user_household_id());

-- Ingredients: users can manage ingredients in their household
create policy "Users can manage household ingredients" on ingredients
  for all using (household_id = get_user_household_id());

-- Recipes: users can manage recipes in their household
create policy "Users can manage household recipes" on recipes
  for all using (household_id = get_user_household_id());

-- Recipe Ingredients: users can manage recipe ingredients for their recipes
create policy "Users can manage recipe ingredients" on recipe_ingredients
  for all using (
    recipe_id in (select id from recipes where household_id = get_user_household_id())
  );

-- Meal Plans: users can manage meal plans in their household
create policy "Users can manage household meal plans" on meal_plans
  for all using (household_id = get_user_household_id());

-- Meals: users can manage meals in their meal plans
create policy "Users can manage meals" on meals
  for all using (
    meal_plan_id in (select id from meal_plans where household_id = get_user_household_id())
  );

-- Grocery Items: users can manage grocery items in their household
create policy "Users can manage household groceries" on grocery_items
  for all using (household_id = get_user_household_id());

-- ============================================================================
-- INDEXES
-- ============================================================================

create index idx_users_email on users(email);
create index idx_users_household on users(household_id);
create index idx_stores_household on stores(household_id);
create index idx_ingredients_household on ingredients(household_id);
create index idx_ingredients_store on ingredients(store_id);
create index idx_recipes_household on recipes(household_id);
create index idx_recipes_status on recipes(household_id, status);
create index idx_recipe_ingredients_recipe on recipe_ingredients(recipe_id);
create index idx_recipe_ingredients_ingredient on recipe_ingredients(ingredient_id);
create index idx_meal_plans_household_week on meal_plans(household_id, week_of);
create index idx_meals_meal_plan on meals(meal_plan_id);
create index idx_meals_recipe on meals(recipe_id);
create index idx_grocery_items_meal_plan on grocery_items(meal_plan_id);
create index idx_grocery_items_ingredient on grocery_items(ingredient_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at on recipes
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger recipes_updated_at
  before update on recipes
  for each row execute function update_updated_at();
