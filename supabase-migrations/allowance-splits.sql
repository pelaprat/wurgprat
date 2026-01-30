-- Migration: Allowance Splits System
-- This migration adds support for split allowances (charity, spending, saving)
-- with transaction logging for kids

-- ============================================================================
-- TABLES
-- ============================================================================

-- Allowance Splits table (stores balance for each split category per kid)
create table if not exists allowance_splits (
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
create table if not exists allowance_transactions (
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

alter table allowance_splits enable row level security;
alter table allowance_transactions enable row level security;

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

-- ============================================================================
-- INDEXES
-- ============================================================================

create index if not exists idx_allowance_splits_kid on allowance_splits(kid_id);
create index if not exists idx_allowance_transactions_kid on allowance_transactions(kid_id);
create index if not exists idx_allowance_transactions_created on allowance_transactions(kid_id, created_at desc);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at on allowance_splits
create trigger allowance_splits_updated_at
  before update on allowance_splits
  for each row execute function update_updated_at();

-- ============================================================================
-- HOUSEHOLD SETTINGS UPDATE
-- ============================================================================
-- Add default allowance_splits configuration to households that don't have it
-- Run this manually or as part of app initialization:
--
-- UPDATE households
-- SET settings = jsonb_set(
--   COALESCE(settings, '{}'::jsonb),
--   '{allowance_splits}',
--   '[
--     {"key": "charity", "name": "Charity", "percentage": 10},
--     {"key": "saving", "name": "Saving", "percentage": 20},
--     {"key": "spending", "name": "Spending", "percentage": 70}
--   ]'::jsonb
-- )
-- WHERE settings->'allowance_splits' IS NULL;
