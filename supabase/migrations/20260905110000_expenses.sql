-- Money going out, on the day it went out.
--
-- The correction this table exists for: a shift does not spend anything. It
-- uses up something already paid for. £70 at the pump on the third is the
-- expense; 167 kilometres on the fifth is consumption of it. Counting the
-- per-kilometre figure as a cost and then recording the fill-up as well
-- counts the same money twice, and the second count is the one that looks
-- like a saving.
--
-- So: expenses are dated and real, and a shift reports what it consumed.
--
-- An expense is an anchor item like a shift, for the same reason: it happened
-- on a day, it belongs to a line of work, and it is found in the Calendar
-- where everything dated is found. A second kind of dated list, findable only
-- from one screen, is the thing law 6 is written against.
--
-- Law 5, the strategy: the numbers ride the anchor, exactly as a shift's do.

alter table public.items drop constraint items_kind_check;
alter table public.items add constraint items_kind_check
  check (kind in ('task', 'letter', 'shift', 'expense'));

create table public.expenses (
  item_id uuid primary key,
  owner   uuid not null default auth.uid(),

  amount numeric(10, 2) not null,

  -- What kind of money it was. Fuel is apart from the rest because it is the
  -- only one that says anything about a kilometre.
  category text not null,

  -- Only a fuel purchase carries these. The odometer at the pump, and whether
  -- the tank was filled — a rate can only be worked out between two full
  -- tanks, because only then is the amount burnt known exactly.
  odo       numeric(10, 1),
  full_tank boolean,

  constraint expenses_item_owner
    foreign key (item_id, owner) references public.items (id, owner)
    on delete cascade,

  constraint expenses_category check (
    category in ('fuel', 'repair', 'insurance', 'other')
  ),
  constraint expenses_amount_positive check (amount >= 0),
  constraint expenses_odo_positive check (odo is null or odo >= 0),

  -- The pump details belong to a fuel purchase and to nothing else. An
  -- insurance premium with an odometer reading is a row nobody can explain.
  constraint expenses_pump_is_fuel check (
    category = 'fuel' or (odo is null and full_tank is null)
  )
);

create index expenses_by_owner_odo on public.expenses (owner, odo);

create trigger expenses_touch_anchor
  after insert or update or delete on public.expenses
  for each row execute function public.touch_anchor();

revoke all on table public.expenses from anon, authenticated;

grant select, delete on table public.expenses to authenticated;
grant insert (item_id, amount, category, odo, full_tank)
  on table public.expenses to authenticated;
grant update (amount, category, odo, full_tank)
  on table public.expenses to authenticated;

alter table public.expenses enable row level security;

create policy expenses_select on public.expenses for select to authenticated
  using (owner = auth.uid());
create policy expenses_insert on public.expenses for insert to authenticated
  with check (owner = auth.uid());
create policy expenses_update on public.expenses for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy expenses_delete on public.expenses for delete to authenticated
  using (owner = auth.uid());
