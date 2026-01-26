-- Supabase Schema for Wurgprat
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
  department_order text[] default null,
  created_at timestamptz default now() not null,

  unique(household_id, name)
);

comment on column stores.department_order is 'Custom department display order for this store. NULL uses default order.';

-- MIGRATION: If you have an existing database, run:
-- ALTER TABLE stores ADD COLUMN department_order text[] DEFAULT NULL;

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
  assigned_user_id uuid references users(id),
  created_by uuid references users(id),
  created_at timestamptz default now() not null,
  sort_order integer default 0
);

-- MIGRATION: If you have an existing database with the old unique constraint, run:
-- ALTER TABLE meals DROP CONSTRAINT IF EXISTS meals_weekly_plan_id_day_meal_type_key;

comment on column meals.day is 'Day of week (1-7, where 1 = first day of week)';
comment on column meals.leftover_source_id is 'Which meal is this leftover from?';
comment on column meals.is_ai_suggested is 'Whether this meal was suggested by AI vs manually selected';
comment on column meals.assigned_user_id is 'User responsible for cooking this meal';

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
  is_staple boolean default false not null,
  added_by uuid references users(id),
  created_at timestamptz default now() not null
);

comment on table grocery_items is 'Store and department are inherited from the ingredient';
comment on column grocery_items.is_staple is 'Whether this item is a recurring staple (not from recipes)';

-- Kids table (children in the household)
create table kids (
  id uuid default uuid_generate_v4() primary key,
  household_id uuid references households(id) not null,
  first_name text not null,
  last_name text,
  email text,
  birth_date date,
  allowance_balance numeric(10, 2) default 0,
  prat_points integer default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

comment on table kids is 'Children belonging to a household';
comment on column kids.allowance_balance is 'Current allowance balance in dollars';
comment on column kids.prat_points is 'Prat points balance for rewards/tracking';

-- Weekly Plan Event Assignments table (which users are assigned to events in a weekly plan)
-- NOTE: Multiple users can be assigned to the same event (e.g., both parents attend school play)
create table weekly_plan_event_assignments (
  id uuid default uuid_generate_v4() primary key,
  weekly_plan_id uuid references weekly_plan(id) on delete cascade not null,
  event_id uuid references events(id) on delete cascade not null,
  user_id uuid references users(id) on delete cascade not null,
  created_at timestamptz default now() not null,

  unique(weekly_plan_id, event_id, user_id)
);

comment on table weekly_plan_event_assignments is 'Tracks which household members are assigned to events during a weekly plan';

-- Allowance Splits table (stores balance for each split category per kid)
create table allowance_splits (
  id uuid default uuid_generate_v4() primary key,
  kid_id uuid references kids(id) on delete cascade not null,
  split_key text not null,  -- 'charity', 'saving', 'spending' (matches household config)
  balance numeric(10, 2) default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  unique(kid_id, split_key)
);

comment on table allowance_splits is 'Per-kid balances for each allowance split category';
comment on column allowance_splits.split_key is 'Category key matching household settings (e.g., charity, saving, spending)';
comment on column allowance_splits.balance is 'Current balance for this split category';

-- Allowance Transactions table (logs all deposits and withdrawals)
create table allowance_transactions (
  id uuid default uuid_generate_v4() primary key,
  kid_id uuid references kids(id) on delete cascade not null,
  split_key text not null,  -- Which split this transaction affects
  amount numeric(10, 2) not null,  -- Positive for deposits, negative for withdrawals
  transaction_type text not null check (transaction_type in ('deposit', 'withdrawal')),
  description text,  -- Purpose/reason for the transaction
  created_by uuid references users(id),
  created_at timestamptz default now() not null
);

comment on table allowance_transactions is 'Transaction log for all allowance deposits and withdrawals';
comment on column allowance_transactions.split_key is 'Which split category this transaction affects';
comment on column allowance_transactions.amount is 'Transaction amount (positive for deposits, negative for withdrawals)';
comment on column allowance_transactions.transaction_type is 'Type: deposit or withdrawal';
comment on column allowance_transactions.description is 'Purpose or reason for the transaction';

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
alter table kids enable row level security;
alter table weekly_plan_event_assignments enable row level security;
alter table allowance_splits enable row level security;
alter table allowance_transactions enable row level security;

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

-- Kids: users can manage kids in their household
create policy "Users can manage household kids" on kids
  for all using (household_id = get_user_household_id());

-- Allowance Splits: users can manage splits for kids in their household
create policy "Users can manage allowance splits" on allowance_splits
  for all using (
    kid_id in (select id from kids where household_id = get_user_household_id())
  );

-- Allowance Transactions: users can manage transactions for kids in their household
create policy "Users can manage allowance transactions" on allowance_transactions
  for all using (
    kid_id in (select id from kids where household_id = get_user_household_id())
  );

-- Weekly Plan Event Assignments: users can manage event assignments in their weekly plans
create policy "Users can manage event assignments" on weekly_plan_event_assignments
  for all using (
    weekly_plan_id in (select id from weekly_plan where household_id = get_user_household_id())
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
create index idx_grocery_items_staple on grocery_items(grocery_list_id, is_staple);
create index idx_events_household on events(household_id);
create index idx_events_start_time on events(household_id, start_time);
create index idx_meals_assigned_user on meals(assigned_user_id);
create index idx_kids_household on kids(household_id);
create index idx_event_assignments_weekly_plan on weekly_plan_event_assignments(weekly_plan_id);
create index idx_event_assignments_event on weekly_plan_event_assignments(event_id);
create index idx_event_assignments_user on weekly_plan_event_assignments(user_id);
create index idx_allowance_splits_kid on allowance_splits(kid_id);
create index idx_allowance_transactions_kid on allowance_transactions(kid_id);
create index idx_allowance_transactions_created on allowance_transactions(kid_id, created_at desc);

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

create trigger kids_updated_at
  before update on kids
  for each row execute function update_updated_at();

create trigger allowance_splits_updated_at
  before update on allowance_splits
  for each row execute function update_updated_at();
