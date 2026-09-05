-- Step 6, the first module: delivery shifts.
--
-- What a shift holds is what the owner said it holds, in his words: the
-- odometer at the start and at the end, what each of the three platforms
-- paid, the hours — broken into more than one session in a day — and tips.
-- Nothing else. Nothing from the schema the repository threw away.
--
-- The laws of the column decide the shape:
--
--   Law 1 — a shift is an object with a life, so it gets an anchor row in
--   items. It is not a world of its own.
--   Law 3 — the numbers of a shift are extensions of that anchor, reaching it
--   by item_id.
--   Law 6 — a shift is found where everything with a date is found: the
--   Calendar, on its day, through the anchor's due.
--
-- Law 5 wants the sync strategy declared now, and this one is not the one
-- areas got:
--
--   These three tables have no cursor of their own. They ride the anchor:
--   a write to any of them stamps the anchor item, so its version grows and
--   the delta built in step 4 carries it. A client pulling a changed shift
--   replaces that shift's children wholesale.
--
--   That is also why the children may be deleted physically while items may
--   not. A child is never looked for on its own — only ever as "the children
--   of this anchor" — so a removed child cannot become a row that is nowhere
--   to be found. The anchor still cannot disappear.


-- A third kind. task and letter come to you; a shift is work you did, and it
-- is the first kind with numbers behind it.
alter table public.items drop constraint items_kind_check;
alter table public.items add constraint items_kind_check
  check (kind in ('task', 'letter', 'shift'));

-- Capture is no longer the only insert. A shift is made already processed —
-- it is not something you found in your pocket, it is a day you worked — so
-- the client has to name the kind, the state, the day and the area at insert.
-- id, owner, version, created_at and updated_at stay unwritable, which was
-- the whole point of granting INSERT per column.
grant insert (title, kind, state, due, area_id) on table public.items to authenticated;


-- The shift: what there is exactly one of.
create table public.shifts (
  item_id uuid primary key,
  owner   uuid not null default auth.uid(),

  -- The odometer as read. Kilometres driven are the difference, worked out
  -- where they are shown — never stored beside the two numbers they come
  -- from, because then the three can disagree.
  odo_start numeric(10, 1),
  odo_end   numeric(10, 1),

  -- Apart from the platform money on purpose: it does not come from the same
  -- place and it is not taxed the same way.
  tips numeric(10, 2),

  constraint shifts_item_owner
    foreign key (item_id, owner) references public.items (id, owner)
    on delete cascade,

  -- A reading can be missing — you forgot to look — but if both are there,
  -- the second cannot be behind the first.
  constraint shifts_odo_forward check (
    odo_start is null or odo_end is null or odo_end >= odo_start
  ),
  constraint shifts_odo_start_positive check (odo_start is null or odo_start >= 0),
  constraint shifts_odo_end_positive   check (odo_end   is null or odo_end   >= 0),
  constraint shifts_tips_positive      check (tips      is null or tips      >= 0)
);


-- The sessions of a working day. Lunch and evening, with dead hours between —
-- asked for in those words.
create table public.shift_sessions (
  id      uuid primary key default gen_random_uuid(),
  item_id uuid not null,
  owner   uuid not null default auth.uid(),

  -- Moments, not clock times. A session from 21:00 to 01:00 is four hours of
  -- work; a `time` column would either lose the day or need a constraint that
  -- pushes you into writing down something untrue.
  started_at timestamptz not null,
  -- Empty while you are still out.
  ended_at   timestamptz,

  constraint shift_sessions_item_owner
    foreign key (item_id, owner) references public.items (id, owner)
    on delete cascade,

  constraint shift_sessions_forward check (
    ended_at is null or ended_at > started_at
  )
);

create index shift_sessions_by_item on public.shift_sessions (item_id);


-- What each platform paid. One row per platform, so a fourth is a row and not
-- a migration, and the primary key makes counting the same one twice
-- impossible.
create table public.shift_earnings (
  item_id  uuid not null,
  owner    uuid not null default auth.uid(),
  platform text not null,
  amount   numeric(10, 2) not null,

  primary key (item_id, platform),

  constraint shift_earnings_item_owner
    foreign key (item_id, owner) references public.items (id, owner)
    on delete cascade,

  -- The three he drives for, named by him. Written from the real values, as
  -- the plan asks — not a list left open for platforms nobody works.
  constraint shift_earnings_platform check (
    platform in ('uber_eats', 'deliveroo', 'just_eat')
  ),
  constraint shift_earnings_positive check (amount >= 0)
);


-- The anchor is stamped whenever a child changes. That is the whole sync
-- strategy declared above: without it, a shift whose money changed carries an
-- untouched updated_at, no delta ever mentions it, and the laptop keeps
-- yesterday's numbers for good.
--
-- It writes state onto itself — the one granted column that cannot be wrong —
-- and the items trigger turns that into a new version and a new updated_at.
-- No SECURITY DEFINER: this runs as whoever wrote the child, under the same
-- policy that let them write it.
create function public.touch_anchor() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  update public.items
     set state = state
   where id = coalesce(new.item_id, old.item_id)
     and owner = coalesce(new.owner, old.owner);
  return null;
end $$;

create trigger shifts_touch_anchor
  after insert or update or delete on public.shifts
  for each row execute function public.touch_anchor();

create trigger shift_sessions_touch_anchor
  after insert or update or delete on public.shift_sessions
  for each row execute function public.touch_anchor();

create trigger shift_earnings_touch_anchor
  after insert or update or delete on public.shift_earnings
  for each row execute function public.touch_anchor();


-- Grants per column, and no DELETE on items' terms — but the children do get
-- DELETE, for the reason written at the top: they are only ever read as the
-- children of an anchor, so a removed one cannot go missing anywhere.
revoke all on table public.shifts, public.shift_sessions, public.shift_earnings
  from anon, authenticated;

grant select, delete on table public.shifts to authenticated;
grant insert (item_id, odo_start, odo_end, tips) on table public.shifts to authenticated;
grant update (odo_start, odo_end, tips) on table public.shifts to authenticated;

grant select, delete on table public.shift_sessions to authenticated;
grant insert (item_id, started_at, ended_at) on table public.shift_sessions to authenticated;
grant update (started_at, ended_at) on table public.shift_sessions to authenticated;

grant select, delete on table public.shift_earnings to authenticated;
grant insert (item_id, platform, amount) on table public.shift_earnings to authenticated;
grant update (amount) on table public.shift_earnings to authenticated;

alter table public.shifts           enable row level security;
alter table public.shift_sessions   enable row level security;
alter table public.shift_earnings   enable row level security;

create policy shifts_select on public.shifts for select to authenticated
  using (owner = auth.uid());
create policy shifts_insert on public.shifts for insert to authenticated
  with check (owner = auth.uid());
create policy shifts_update on public.shifts for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy shifts_delete on public.shifts for delete to authenticated
  using (owner = auth.uid());

create policy shift_sessions_select on public.shift_sessions for select to authenticated
  using (owner = auth.uid());
create policy shift_sessions_insert on public.shift_sessions for insert to authenticated
  with check (owner = auth.uid());
create policy shift_sessions_update on public.shift_sessions for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy shift_sessions_delete on public.shift_sessions for delete to authenticated
  using (owner = auth.uid());

create policy shift_earnings_select on public.shift_earnings for select to authenticated
  using (owner = auth.uid());
create policy shift_earnings_insert on public.shift_earnings for insert to authenticated
  with check (owner = auth.uid());
create policy shift_earnings_update on public.shift_earnings for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy shift_earnings_delete on public.shift_earnings for delete to authenticated
  using (owner = auth.uid());
