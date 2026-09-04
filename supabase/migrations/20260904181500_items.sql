-- The spine. A single table, and the laws that protect it.
--
-- What the database can guarantee is not checked in JavaScript: identity, the
-- version, the clock, the owner, and the coherence between state and kind are
-- all enforced here.

create table public.items (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users(id),

  -- Nullable on purpose. A captured thing is not "of kind capture" — it is
  -- something you do not yet know the shape of. The mark of an unprocessed
  -- thing is a single column: state='inbox'.
  kind       text check (kind in ('task','letter')),

  state      text not null default 'inbox'
             check (state in ('inbox','active','done')),

  title      text not null,

  -- A date, not a date and time. The time gets added at the first real need.
  due        date,

  -- The day you did the thing. `due` is what you planned, `done_at` is what
  -- happened. A task due Monday, finished Wednesday, shows up in both.
  done_at    date,

  version    integer     not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Deleting is soft. Deleted rows stay, so the sync can carry them onward.
  deleted_at timestamptz,

  -- Both ways round: you do not leave the inbox without a kind, and in the
  -- inbox there is no kind. Otherwise the state and the kind can contradict
  -- each other.
  constraint items_state_matches_kind check (
    (state =  'inbox' and kind is null)
    or
    (state <> 'inbox' and kind is not null)
  ),

  -- The plan wrote `btrim(title) <> ''`. btrim with no argument only strips
  -- spaces, so a title made of tabs or newlines went through, and would have
  -- shown up in Today as a row that displays nothing. `~ '\S'` requires at
  -- least one character that is not whitespace — the same law, written whole.
  constraint items_title_not_blank check (title ~ '\S')
);

-- There is no constraint saying "an active task must have a date". Plenty of
-- real tasks have none, and such a rule pushes you into putting "tomorrow"
-- just to pass validation — and then Today fills up with postponements.


-- Grants and RLS, handled together. Default privileges are not assumed.

revoke all on table public.items from anon, authenticated;

grant select, insert on table public.items to authenticated;

-- UPDATE is granted per column, not per table. That is what makes id, owner,
-- version, created_at and updated_at impossible for a client to write — not
-- merely overwritten by the trigger. Identity is immutable in the database,
-- and id is the anchor of every module that comes later.
grant update (kind, state, title, due, done_at, deleted_at)
  on table public.items to authenticated;

-- Neither anon nor authenticated gets DELETE, and there is no DELETE policy.
-- Deleting from the interface is an UPDATE on deleted_at. Otherwise the grants
-- would cancel the whole point of the soft delete.

alter table public.items enable row level security;

create policy items_select on public.items for select to authenticated
  using (owner = auth.uid());

create policy items_insert on public.items for insert to authenticated
  with check (owner = auth.uid());

-- USING decides which existing row you are allowed to touch; WITH CHECK
-- validates what the row is allowed to look like after the UPDATE, so it is
-- what prevents moving a row to another owner.
create policy items_update on public.items for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());


-- The trigger. A phone's clock can lie, and a client can send any version.
-- Neither one reaches the table.

create function public.stamp() returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    new.version    := 1;
    new.created_at := now();
    new.updated_at := now();
  else
    new.id         := old.id;
    new.owner      := old.owner;
    new.version    := old.version + 1;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end $$ language plpgsql;

create trigger items_stamp
  before insert or update on public.items
  for each row execute function public.stamp();
