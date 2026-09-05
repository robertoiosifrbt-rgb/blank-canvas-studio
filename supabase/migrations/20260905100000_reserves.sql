-- What a day's work actually leaves you.
--
-- Two settings, deliberately in two places, because they are two different
-- kinds of thing:
--
--   reserves       tax and National Insurance, per person. You have one HMRC,
--                  one allowance and one bill; percentages written once per
--                  line of work would add up to a number that means nothing.
--   running_costs  fuel and vehicle wear per kilometre, per area. A different
--                  line of work is a different vehicle and a different way of
--                  driving, so these genuinely differ.
--
-- Both are estimates for putting money aside, not a tax calculation, and the
-- shape says so: a flat percentage cannot know that the first £12,570 of
-- profit is not taxed at all, or that National Insurance drops to 2% above
-- £50,270. It reserves too much early in the year and too little late. The
-- numbers are the owner's to set, with his accountant.
--
-- Law 5, the sync strategy: neither table has a cursor. There is one reserves
-- row per person and one running_costs row per area — a handful, fetched
-- whole on every sync, the same as the shift parts. What they do have is a
-- version, because two devices editing the same setting is a real thing and
-- the answer to it is the one already written for every other table.

create table public.reserves (
  owner uuid primary key default auth.uid() references auth.users(id) on delete cascade,

  -- Percentages of profit, not of takings. Tax is paid on what is left after
  -- the costs of earning it.
  tax_pct numeric(5, 2) not null,
  ni_pct  numeric(5, 2) not null,

  version    integer     not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint reserves_tax_range check (tax_pct >= 0 and tax_pct <= 100),
  constraint reserves_ni_range  check (ni_pct  >= 0 and ni_pct  <= 100),
  -- Together they cannot take more than there is. A hundred and ten percent
  -- reserved is not a strict setting, it is a typo.
  constraint reserves_total_range check (tax_pct + ni_pct <= 100)
);

create table public.running_costs (
  area_id uuid primary key,
  owner   uuid not null default auth.uid(),

  fuel_per_km    numeric(8, 4) not null,
  vehicle_per_km numeric(8, 4) not null,

  version    integer     not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint running_costs_area
    foreign key (area_id, owner) references public.areas (id, owner)
    on delete cascade,

  constraint running_costs_fuel_positive    check (fuel_per_km >= 0),
  constraint running_costs_vehicle_positive check (vehicle_per_km >= 0)
);

-- A stamp of its own, because these two are not keyed by id: a setting is
-- one per person, or one per area, and the key says so. public.stamp() pins
-- new.id from old.id, which on a table without an id column fails every
-- UPDATE outright — caught by writing the test before believing the reuse.
create function public.stamp_setting() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') then
    new.version    := 1;
    new.created_at := now();
    new.updated_at := now();
  else
    new.owner      := old.owner;
    new.version    := old.version + 1;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end $$;

create trigger reserves_stamp
  before insert or update on public.reserves
  for each row execute function public.stamp_setting();

create trigger running_costs_stamp
  before insert or update on public.running_costs
  for each row execute function public.stamp_setting();


-- The four numbers, pinned onto the shift.
--
-- A shift keeps the rates it was worked under. Change a percentage in January
-- and October must not quietly become a different month — what you set aside
-- back then is what you set aside, and a report that rewrites itself is a
-- report you cannot check against your bank.
alter table public.shifts
  add column rate_tax_pct        numeric(5, 2),
  add column rate_ni_pct         numeric(5, 2),
  add column rate_fuel_per_km    numeric(8, 4),
  add column rate_vehicle_per_km numeric(8, 4);

-- Pinned by the database, not by the client: the client could forget, and
-- then a shift would silently follow whatever the settings say today.
--
-- Null means not pinned yet — the settings did not exist when the shift was
-- written down. The next write to the shift pins them, so setting your rates
-- tomorrow still catches the shift you started today.
create function public.pin_shift_rates() returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  area uuid;
begin
  if new.rate_tax_pct is null or new.rate_ni_pct is null then
    select tax_pct, ni_pct into new.rate_tax_pct, new.rate_ni_pct
      from public.reserves where owner = new.owner;
  end if;

  if new.rate_fuel_per_km is null or new.rate_vehicle_per_km is null then
    select area_id into area from public.items where id = new.item_id;
    if area is not null then
      select fuel_per_km, vehicle_per_km
        into new.rate_fuel_per_km, new.rate_vehicle_per_km
        from public.running_costs where area_id = area;
    end if;
  end if;

  return new;
end $$;

create trigger shifts_pin_rates
  before insert or update on public.shifts
  for each row execute function public.pin_shift_rates();


revoke all on table public.reserves, public.running_costs from anon, authenticated;

grant select on table public.reserves to authenticated;
grant insert (tax_pct, ni_pct) on table public.reserves to authenticated;
grant update (tax_pct, ni_pct, deleted_at) on table public.reserves to authenticated;

grant select on table public.running_costs to authenticated;
grant insert (area_id, fuel_per_km, vehicle_per_km) on table public.running_costs to authenticated;
grant update (fuel_per_km, vehicle_per_km, deleted_at) on table public.running_costs to authenticated;

-- The rates on a shift are the database's to write, never the client's. That
-- is what makes "pinned" mean pinned.

alter table public.reserves      enable row level security;
alter table public.running_costs enable row level security;

create policy reserves_select on public.reserves for select to authenticated
  using (owner = auth.uid());
create policy reserves_insert on public.reserves for insert to authenticated
  with check (owner = auth.uid());
create policy reserves_update on public.reserves for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

create policy running_costs_select on public.running_costs for select to authenticated
  using (owner = auth.uid());
create policy running_costs_insert on public.running_costs for insert to authenticated
  with check (owner = auth.uid());
create policy running_costs_update on public.running_costs for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
