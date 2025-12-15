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
  timezone text default 'America/New_York',
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now() not null
);

comment on column households.timezone is 'IANA timezone identifier (e.g., America/Los_Angeles, Europe/London)';
comment on column households.settings is 'Preferences: default_meal_time, week_start_day, calendar_id, departments[]';

-- MIGRATION: If you have an existing database, run:
-- ALTER TABLE households ADD COLUMN timezone text DEFAULT 'America/New_York';

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

-- Events table (household events from Google Calendar, e.g., kids activities)
create table events (
  id uuid default uuid_generate_v4() primary key,
  household_id uuid references households(id) not null,
  google_calendar_id text,
  google_event_id text,
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz,
  all_day boolean default false,
  location text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  unique(household_id, google_event_id)
);

comment on table events is 'Household events imported from Google Calendar for meal planning';
comment on column events.google_calendar_id is 'The Google Calendar ID this event was imported from';
comment on column events.google_event_id is 'Google Calendar event ID for deduplication/updates';

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
  source text,
  source_url text,
  servings integer,
  cost_rating integer check (cost_rating between 1 and 5),
  time_rating integer check (time_rating between 1 and 5),
  yields_leftovers boolean default false,
  category text check (category in ('entree', 'side', 'dessert')),
  cuisine text,
  instructions text,
  notes text,
  tags text[] default '{}',
  status text default 'active' check (status in ('made', 'wishlist')),
  last_made date,
  created_by uuid references users(id),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

comment on column recipes.source is 'Recipe source (e.g., NYT Cooking, Bon Appetit)';
comment on column recipes.time_rating is 'Time rating 1-5 scale';

-- Recipe Ratings table (user ratings for recipes)
create table recipe_ratings (
  id uuid default uuid_generate_v4() primary key,
  recipe_id uuid references recipes(id) on delete cascade not null,
  user_id uuid references users(id) on delete cascade not null,
  rating integer not null check (rating between 1 and 5),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  unique(recipe_id, user_id)
);

comment on table recipe_ratings is 'User ratings for recipes, one rating per user per recipe';
comment on column recipe_ratings.rating is 'Rating 1-5 scale';

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

-- Weekly Plan table (weekly container for meals and grocery list)
create table weekly_plan (
  id uuid default uuid_generate_v4() primary key,
  household_id uuid references households(id) not null,
  week_of date not null,
  notes text,
  created_by uuid references users(id),
  created_at timestamptz default now() not null,

  unique(household_id, week_of)
);

comment on column weekly_plan.week_of is 'Start date of the week (e.g., Saturday)';

-- Meals table (individual meal selections within a weekly plan)
-- NOTE: Multiple recipes per day are now supported (no unique constraint on day/meal_type)
create table meals (
  id uuid default uuid_generate_v4() primary key,
  weekly_plan_id uuid references weekly_plan(id) on delete cascade not null,
  recipe_id uuid references recipes(id),
  day integer not null check (day between 1 and 7),
  meal_type text default 'dinner' check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  custom_meal_name text,
  is_leftover boolean default false,
  leftover_source_id uuid references meals(id),
  is_ai_suggested boolean default false,
  notes text,
  calendar_event_id text,
  created_by uuid references users(id),
  created_at timestamptz default now() not null,
  sort_order integer default 0
);

-- MIGRATION: If you have an existing database with the old unique constraint, run:
-- ALTER TABLE meals DROP CONSTRAINT IF EXISTS meals_weekly_plan_id_day_meal_type_key;

comment on column meals.day is 'Day of week (1-7, where 1 = first day of week)';
comment on column meals.leftover_source_id is 'Which meal is this leftover from?';
comment on column meals.is_ai_suggested is 'Whether this meal was suggested by AI vs manually selected';

-- Grocery List table (shopping list for a weekly plan)
create table grocery_list (
  id uuid default uuid_generate_v4() primary key,
  weekly_plan_id uuid references weekly_plan(id) on delete cascade not null,
  notes text,
  created_by uuid references users(id),
  created_at timestamptz default now() not null,

  unique(weekly_plan_id)
);

comment on table grocery_list is 'One grocery list per weekly plan';

-- Grocery Items table (individual items on a grocery list)
create table grocery_items (
  id uuid default uuid_generate_v4() primary key,
  grocery_list_id uuid references grocery_list(id) on delete cascade not null,
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
alter table events enable row level security;
alter table ingredients enable row level security;
alter table recipes enable row level security;
alter table recipe_ratings enable row level security;
alter table recipe_ingredients enable row level security;
alter table weekly_plan enable row level security;
alter table meals enable row level security;
alter table grocery_list enable row level security;
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

-- Events: users can manage events in their household
create policy "Users can manage household events" on events
  for all using (household_id = get_user_household_id());

-- Ingredients: users can manage ingredients in their household
create policy "Users can manage household ingredients" on ingredients
  for all using (household_id = get_user_household_id());

-- Recipes: users can manage recipes in their household
create policy "Users can manage household recipes" on recipes
  for all using (household_id = get_user_household_id());

-- Recipe Ratings: users can manage ratings for recipes in their household
create policy "Users can manage recipe ratings" on recipe_ratings
  for all using (
    recipe_id in (select id from recipes where household_id = get_user_household_id())
  );

-- Recipe Ingredients: users can manage recipe ingredients for their recipes
create policy "Users can manage recipe ingredients" on recipe_ingredients
  for all using (
    recipe_id in (select id from recipes where household_id = get_user_household_id())
  );

-- Weekly Plan: users can manage weekly plans in their household
create policy "Users can manage household weekly plans" on weekly_plan
  for all using (household_id = get_user_household_id());

-- Meals: users can manage meals in their weekly plans
create policy "Users can manage meals" on meals
  for all using (
    weekly_plan_id in (select id from weekly_plan where household_id = get_user_household_id())
  );

-- Grocery List: users can manage grocery lists in their weekly plans
create policy "Users can manage grocery lists" on grocery_list
  for all using (
    weekly_plan_id in (select id from weekly_plan where household_id = get_user_household_id())
  );

-- Grocery Items: users can manage grocery items in their grocery lists
create policy "Users can manage grocery items" on grocery_items
  for all using (
    grocery_list_id in (
      select gl.id from grocery_list gl
      join weekly_plan wp on gl.weekly_plan_id = wp.id
      where wp.household_id = get_user_household_id()
    )
  );

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
create index idx_recipe_ratings_recipe on recipe_ratings(recipe_id);
create index idx_recipe_ratings_user on recipe_ratings(user_id);
create index idx_recipe_ingredients_recipe on recipe_ingredients(recipe_id);
create index idx_recipe_ingredients_ingredient on recipe_ingredients(ingredient_id);
create index idx_weekly_plan_household_week on weekly_plan(household_id, week_of);
create index idx_meals_weekly_plan on meals(weekly_plan_id);
create index idx_meals_recipe on meals(recipe_id);
create index idx_grocery_list_weekly_plan on grocery_list(weekly_plan_id);
create index idx_grocery_items_grocery_list on grocery_items(grocery_list_id);
create index idx_grocery_items_ingredient on grocery_items(ingredient_id);
create index idx_events_household on events(household_id);
create index idx_events_start_time on events(household_id, start_time);

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

create trigger recipe_ratings_updated_at
  before update on recipe_ratings
  for each row execute function update_updated_at();

create trigger events_updated_at
  before update on events
  for each row execute function update_updated_at();
