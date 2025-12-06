-- Supabase Schema for Meal Planner
-- Run this in the Supabase SQL Editor to set up your database

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Households table (for shared access between you and your wife)
create table households (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Users table (links Google accounts to households)
create table users (
  id uuid default uuid_generate_v4() primary key,
  email text unique not null,
  name text,
  household_id uuid references households(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Meals/Recipes table
create table meals (
  id uuid default uuid_generate_v4() primary key,
  household_id uuid references households(id) not null,
  name text not null,
  description text,
  recipe_url text,
  ingredients text[] default '{}',
  instructions text,
  prep_time_minutes integer,
  cook_time_minutes integer,
  servings integer,
  tags text[] default '{}',
  created_by uuid references users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Meal Plans table (assigns meals to dates)
create table meal_plans (
  id uuid default uuid_generate_v4() primary key,
  household_id uuid references households(id) not null,
  date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  meal_id uuid references meals(id),
  custom_meal_name text, -- For quick entries without creating a full recipe
  notes text,
  calendar_event_id text, -- Google Calendar event ID for syncing
  created_by uuid references users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  unique(household_id, date, meal_type)
);

-- Grocery Items table
create table grocery_items (
  id uuid default uuid_generate_v4() primary key,
  household_id uuid references households(id) not null,
  name text not null,
  quantity text,
  category text default 'Other',
  checked boolean default false,
  added_by uuid references users(id),
  meal_plan_id uuid references meal_plans(id), -- Optional: track which meal this item is for
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Row Level Security (RLS) Policies
-- These ensure users can only access data from their own household

alter table households enable row level security;
alter table users enable row level security;
alter table meals enable row level security;
alter table meal_plans enable row level security;
alter table grocery_items enable row level security;

-- Users can read their own household
create policy "Users can view own household" on households
  for select using (
    id in (select household_id from users where email = auth.jwt()->>'email')
  );

-- Users can view other users in their household
create policy "Users can view household members" on users
  for select using (
    household_id in (select household_id from users where email = auth.jwt()->>'email')
  );

-- Users can CRUD meals in their household
create policy "Users can manage household meals" on meals
  for all using (
    household_id in (select household_id from users where email = auth.jwt()->>'email')
  );

-- Users can CRUD meal plans in their household
create policy "Users can manage household meal plans" on meal_plans
  for all using (
    household_id in (select household_id from users where email = auth.jwt()->>'email')
  );

-- Users can CRUD grocery items in their household
create policy "Users can manage household groceries" on grocery_items
  for all using (
    household_id in (select household_id from users where email = auth.jwt()->>'email')
  );

-- Indexes for performance
create index idx_meals_household on meals(household_id);
create index idx_meal_plans_household_date on meal_plans(household_id, date);
create index idx_grocery_items_household on grocery_items(household_id);
create index idx_users_email on users(email);
create index idx_users_household on users(household_id);
