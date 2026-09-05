-- The first real area, so the table arrives — as the plan says it should:
-- areas appear when there is an area, not before.
--
-- The owner's own tree is what asked for it:
--
--     Business → Self-employed → MultiApp Delivery
--
-- which is three levels deep, so an area has a parent and the table is a
-- tree. Nothing is seeded here: the rows are his data, and data does not
-- belong in a migration. He makes them on the screen, once.
--
-- Law 5 asks for the sync strategy at creation, and this one does not ride
-- anything: an area outlives every item in it and is edited on its own, so it
-- carries version, updated_at and deleted_at exactly as items do, and step 7
-- pulls it with a cursor of its own. That is a second cursor, deliberately —
-- the alternative is a table whose changes only travel when something else
-- happens to change, which is not a strategy, it is a hope.

create table public.areas (
  id        uuid primary key default gen_random_uuid(),
  owner     uuid not null default auth.uid() references auth.users(id) on delete cascade,

  -- Null is the root. Business has no parent; MultiApp Delivery has one.
  parent_id uuid,

  name      text not null,

  version    integer     not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Soft, like items. An area that held a year of work does not vanish
  -- because you tidied up.
  deleted_at timestamptz,

  -- The mechanism the plan names. Composite keys to (id, owner) make a tree
  -- spanning two users structurally impossible, rather than merely refused by
  -- a policy someone could forget to write.
  constraint areas_id_owner unique (id, owner),
  constraint areas_parent
    foreign key (parent_id, owner) references public.areas (id, owner),

  constraint areas_name_not_blank check (name ~ '\S'),

  -- The one-hop case, caught by the cheapest thing that can catch it. The
  -- longer loops need to walk the chain, and that is the trigger below.
  constraint areas_not_own_parent check (parent_id is null or parent_id <> id)
);

create index areas_by_parent on public.areas (parent_id);


-- A cycle would be a tree with no root: the screen that draws it would never
-- finish, and the area would be its own ancestor. The database can see this,
-- so JavaScript does not get to.
create function public.areas_no_cycle() returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  ancestor uuid := new.parent_id;
  hops     integer := 0;
begin
  while ancestor is not null loop
    if ancestor = new.id then
      raise exception 'An area cannot be its own ancestor'
        using errcode = 'check_violation';
    end if;
    -- A tree this deep is a loop the walk cannot see because the rows were
    -- written between two of its steps. Refusing is the safe answer.
    hops := hops + 1;
    if hops > 64 then
      raise exception 'The area tree is deeper than 64 levels'
        using errcode = 'check_violation';
    end if;
    select parent_id into ancestor from public.areas where id = ancestor;
  end loop;
  return new;
end $$;

create trigger areas_no_cycle
  before insert or update of parent_id on public.areas
  for each row execute function public.areas_no_cycle();

-- The same stamp as items: the phone's clock and the client's version reach
-- neither table.
create trigger areas_stamp
  before insert or update on public.areas
  for each row execute function public.stamp();


-- Grants per column, both ways round — the lesson of the INSERT grant that
-- was written per table and promised per column.
revoke all on table public.areas from anon, authenticated;

grant select on table public.areas to authenticated;
grant insert (name, parent_id) on table public.areas to authenticated;
grant update (name, parent_id, deleted_at) on table public.areas to authenticated;

alter table public.areas enable row level security;

create policy areas_select on public.areas for select to authenticated
  using (owner = auth.uid());

create policy areas_insert on public.areas for insert to authenticated
  with check (owner = auth.uid());

create policy areas_update on public.areas for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());


-- And the door from an item to its area.
--
-- Null on purpose, and for good: what you capture on the phone does not know
-- where it belongs yet — that is the whole point of the inbox. Processing is
-- where an area can be chosen, never before.
alter table public.items add constraint items_id_owner unique (id, owner);

alter table public.items add column area_id uuid;

alter table public.items add constraint items_area
  foreign key (area_id, owner) references public.areas (id, owner);

create index items_by_area on public.items (area_id);

grant update (area_id) on table public.items to authenticated;
