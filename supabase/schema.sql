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


-- Build 003: prosecution, qualification, and forward outcome records
create table if not exists prosecution (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id),
  created_at timestamptz not null default now(),
  strongest_counter_thesis text not null,
  contradictory_evidence jsonb not null default '[]'::jsonb,
  hidden_risks jsonb not null default '[]'::jsonb,
  alternative_explanation text,
  prosecutor_recommendation text not null check (prosecutor_recommendation in ('PROCEED','CAUTION','REJECT')),
  hunter_rebuttal text,
  version text not null default 'V1.0'
);

create table if not exists qualification (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id),
  created_at timestamptz not null default now(),
  evidence_quality int not null check (evidence_quality between 0 and 20),
  risk_reward int not null check (risk_reward between 0 and 20),
  catalyst_timing int not null check (catalyst_timing between 0 and 20),
  executability int not null check (executability between 0 and 20),
  thesis_resilience int not null check (thesis_resilience between 0 and 20),
  total_score int generated always as (evidence_quality+risk_reward+catalyst_timing+executability+thesis_resilience) stored,
  classification text not null check (classification in ('REJECT','WATCH','QUALIFIED','HIGH_CONVICTION')),
  qualification_version text not null default 'V1.0'
);

create table if not exists candidate_outcomes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id),
  measured_at timestamptz not null default now(),
  horizon text not null,
  reference_price_usd numeric(24,8) not null,
  measured_price_usd numeric(24,8) not null,
  return_pct numeric(18,8) not null
);

-- Server worker may write research records, but still has no transaction write grant.
grant select, insert on public.market_observations to service_role;
grant select, insert on public.candidates to service_role;
grant select, insert on public.prosecution to service_role;
grant select, insert on public.qualification to service_role;
grant select, insert on public.candidate_outcomes to service_role;
grant select on public.shadow_accounts to service_role;
grant select on public.transactions to service_role;


-- Build 004: reliable hourly heartbeat inside Supabase
-- Requires pg_cron + pg_net. Calls Coinbase public spot API directly from Postgres,
-- stores the observation, and removes GitHub scheduler jitter from market-data capture.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.capture_btc_hourly()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  request_id bigint;
begin
  select net.http_get(
    url := 'https://api.coinbase.com/v2/prices/BTC-USD/spot',
    headers := jsonb_build_object('User-Agent','5k-machine/0.1')
  ) into request_id;
end;
$$;

-- Poll completed pg_net responses and persist valid Coinbase BTC spot observations.
create or replace function public.persist_btc_http_responses()
returns void
language plpgsql
security definer
set search_path = public, net
as $$
begin
  insert into public.market_observations
    (observed_at, agent, asset, market, observation_type, price_usd, payload, source)
  select
    now(),
    'btc_sensor_v1',
    'BTC',
    'BTC-USD',
    'SPOT_PRICE',
    ((r.content::jsonb)->'data'->>'amount')::numeric,
    jsonb_build_object('build','004','transport','supabase_pg_cron_pg_net'),
    'https://api.coinbase.com/v2/prices/BTC-USD/spot'
  from net._http_response r
  where r.status_code = 200
    and r.created > now() - interval '10 minutes'
    and (r.content::jsonb)->'data'->>'base' = 'BTC'
    and (r.content::jsonb)->'data'->>'currency' = 'USD'
    and not exists (
      select 1 from public.market_observations m
      where m.agent='btc_sensor_v1'
        and m.observed_at >= date_trunc('hour', now())
    );
end;
$$;

-- Idempotent cron setup.
do $$
declare j record;
begin
  for j in select jobid from cron.job where jobname in ('btc-hourly-request','btc-hourly-persist')
  loop perform cron.unschedule(j.jobid); end loop;
end $$;

select cron.schedule('btc-hourly-request','2 * * * *',$$select public.capture_btc_hourly();$$);
select cron.schedule('btc-hourly-persist','4 * * * *',$$select public.persist_btc_http_responses();$$);
