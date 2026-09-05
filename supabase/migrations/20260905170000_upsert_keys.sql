-- Nothing the app writes ever reached the database.
--
-- supabase-js `.upsert()` becomes, at PostgREST:
--
--   insert into t (a, b, c) values (...)
--   on conflict (key) do update set a = excluded.a, b = excluded.b, c = excluded.c
--
-- Every column of the payload lands in the SET list — the key columns
-- included. The key columns are deliberately absent from `grant update`, so
-- that a client cannot move a row onto somebody else's anchor. PostgreSQL
-- checks UPDATE privilege on the SET list when the statement is executed,
-- whether or not a conflict actually happens, so the very first write of a
-- shift, an earning, an expense or a cost per kilometre was refused with
-- 42501 — "permission denied for table". Every one of them, from the day the
-- module shipped.
--
-- The fix is the one `items` already uses for id, owner and version: grant the
-- column and pin it in a trigger. The privilege exists so the upsert can name
-- the column; the trigger makes naming it worthless, because the value cannot
-- change. Taking the other road — dropping `.upsert()` from the client —
-- would trade one round trip for two and a race between them.
--
-- This migration ADDS, so it runs before the code that needs it. There is no
-- code that needs it: the client already sends these statements and is being
-- refused. Running this makes the writes that exist start working.


-- Restores the columns named in the trigger's arguments to what they were.
--
-- Refuses rather than silently rewrites: a client that tries to move a row has
-- a bug or worse, and swallowing it would leave the caller believing the move
-- happened. 42501 is the code the client already knows how to show, and the
-- same one the missing privilege used to raise.
create function public.pin() returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  pinned text;
begin
  foreach pinned in array tg_argv loop
    if to_jsonb(new) ->> pinned is distinct from to_jsonb(old) ->> pinned then
      raise exception 'The % of a % cannot be changed', pinned, tg_table_name
        using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;


-- The shift: keyed by its anchor.
grant update (item_id) on table public.shifts to authenticated;
create trigger shifts_pin
  before update on public.shifts
  for each row execute function public.pin('item_id');

-- What a platform paid: keyed by the anchor and the platform together, so
-- both have to be nameable and neither may move.
grant update (item_id, platform) on table public.shift_earnings to authenticated;
create trigger shift_earnings_pin
  before update on public.shift_earnings
  for each row execute function public.pin('item_id', 'platform');

-- The expense: keyed by its anchor.
grant update (item_id) on table public.expenses to authenticated;
create trigger expenses_pin
  before update on public.expenses
  for each row execute function public.pin('item_id');

-- What a kilometre costs: one row per area.
grant update (area_id) on table public.running_costs to authenticated;
create trigger running_costs_pin
  before update on public.running_costs
  for each row execute function public.pin('area_id');

-- The tax year. Its own migration says the year "can be written once and never
-- edited: a row that changed which year it described would take a filed bill
-- with it." That stays true — the grant lets the upsert name the column, the
-- trigger refuses any value but the one already there.
grant update (tax_year) on table public.tax_years to authenticated;
create trigger tax_years_pin
  before update on public.tax_years
  for each row execute function public.pin('tax_year');
