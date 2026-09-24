create extension if not exists pgcrypto;

create table if not exists shadow_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  starting_cash_usd numeric(18,2) not null check (starting_cash_usd >= 0),
  created_at timestamptz not null default now()
);

create table if not exists market_observations (
  id uuid primary key default gen_random_uuid(),
  observed_at timestamptz not null default now(),
  agent text not null,
  asset text not null,
  market text not null,
  observation_type text not null,
  price_usd numeric(24,8),
  payload jsonb not null default '{}'::jsonb,
  source text not null,
  immutable boolean not null default true
);

create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  observation_id uuid references market_observations(id),
  asset text not null,
  market text not null,
  direction text not null check (direction in ('LONG','SHORT','NEUTRAL')),
  discovery_price_usd numeric(24,8),
  trigger text not null,
  supporting_signal text,
  mispricing_thesis text,
  catalyst text,
  horizon text,
  bull_case jsonb,
  base_case jsonb,
  bear_case jsonb,
  invalidation text,
  liquidity_notes text,
  estimated_costs_bps numeric(10,4),
  hunter text not null,
  hunter_confidence text check (hunter_confidence in ('LOW','MEDIUM','HIGH')),
  known_unknowns jsonb not null default '[]'::jsonb,
  status text not null default 'DISCOVERED' check (status in ('DISCOVERED','DEEP_HUNT','PROSECUTION','QUALIFICATION','REJECT','WATCH','QUALIFIED'))
);

create table if not exists portfolio_decisions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_id uuid not null references shadow_accounts(id),
  candidate_id uuid references candidates(id),
  decision text not null check (decision in ('BUY','SELL','PASS','HOLD_CASH')),
  reason text not null,
  requested_allocation_usd numeric(18,2),
  approved_allocation_usd numeric(18,2),
  constitution_version text not null default 'V1.0'
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_id uuid not null references shadow_accounts(id),
  decision_id uuid references portfolio_decisions(id),
  asset text not null,
  side text not null check (side in ('BUY','SELL','DEPOSIT','WITHDRAWAL')),
  quantity numeric(30,12) not null default 0,
  price_usd numeric(24,8) not null default 0,
  gross_value_usd numeric(18,2) not null,
  fees_usd numeric(18,2) not null default 0,
  slippage_usd numeric(18,2) not null default 0,
  net_value_usd numeric(18,2) not null,
  execution_mode text not null default 'SHADOW' check (execution_mode in ('SHADOW','PAPER','LIVE')),
  immutable boolean not null default true
);

create or replace function block_transaction_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'transactions are immutable';
end;
$$;

drop trigger if exists transactions_no_update on transactions;
create trigger transactions_no_update
before update or delete on transactions
for each row execute function block_transaction_mutation();

insert into shadow_accounts (name, starting_cash_usd)
values ('5K MACHINE - SHADOW', 5000.00)
on conflict (name) do nothing;

insert into transactions (
  account_id, asset, side, quantity, price_usd,
  gross_value_usd, fees_usd, slippage_usd, net_value_usd,
  execution_mode
)
select id, 'USD', 'DEPOSIT', 0, 1, 5000, 0, 0, 5000, 'SHADOW'
from shadow_accounts
where name = '5K MACHINE - SHADOW'
and not exists (
  select 1 from transactions t
  where t.account_id = shadow_accounts.id
  and t.side = 'DEPOSIT'
);
