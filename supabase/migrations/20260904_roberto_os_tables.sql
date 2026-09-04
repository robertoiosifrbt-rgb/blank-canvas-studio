-- Roberto OS: tabele adevărate.
--
-- Până acum totul stătea ca text într-un rând din `app_state`. Fiecare tură,
-- fiecare plată și fiecare scrisoare erau în aceeași coloană, iar la orice
-- modificare se rescria tot. Aici fiecare lucru are rândul lui.
--
-- Ce e rând și ce rămâne jsonb: lucrurile care cresc la nesfârșit — ture,
-- plăți, alimentări, bife — au tabelul lor. Listele mici care nu au viață
-- fără părintele lor și se scriu odată cu el nu au: n-ar aduce nimic în plus
-- și ar face din fiecare salvare zece scrieri.
--
-- Fiecare rând știe al cui e. Politicile de mai jos fac ca nimeni să nu poată
-- citi rândurile altcuiva, nici dacă ar avea cheia publică a proiectului.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- setările
create table if not exists public.settings (
  owner uuid primary key references auth.users on delete cascade,
  currency text not null default '£',
  seeded boolean not null default false,
  -- cu câte zile înainte și la ce oră sună notificările
  alert_lead integer,
  alert_hour integer,
  -- procentele curente de la livrări, ca fracții
  delivery_tax_pct numeric,
  delivery_ni_pct numeric,
  delivery_fuel_per_km numeric,
  delivery_veh_per_km numeric,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- modulele
create table if not exists public.modules (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name text not null,
  kind text not null,
  parent text,
  created_at text,
  primary key (owner, id)
);

-- ------------------------------------------------------------- obiectivele
create table if not exists public.goals (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name text not null,
  kind text not null,
  target numeric,
  unit text,
  start_value numeric,
  -- de unde vin citirile singure: `gym:waistCm`
  source text,
  due date,
  is_main boolean not null default false,
  habits text[],
  created_at text,
  primary key (owner, id)
);

-- Banii puși deoparte, unul câte unul. Cresc la nesfârșit, deci au rândul lor.
create table if not exists public.goal_contributions (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  goal_id text not null,
  date date not null,
  amount numeric not null,
  note text,
  primary key (owner, id),
  foreign key (owner, goal_id) references public.goals (owner, id) on delete cascade
);

-- Măsurătorile unui obiectiv de tip metric.
create table if not exists public.goal_readings (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  goal_id text not null,
  date date not null,
  value numeric not null,
  note text,
  primary key (owner, id),
  foreign key (owner, goal_id) references public.goals (owner, id) on delete cascade
);

-- --------------------------------------------------------------- task-uri
create table if not exists public.tasks (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  mod text not null,
  title text not null,
  due date,
  proj text,
  done boolean not null default false,
  created_at text,
  primary key (owner, id)
);

-- -------------------------------------------------------------- obiceiuri
create table if not exists public.habits (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  mod text not null,
  name text not null,
  created_at text,
  primary key (owner, id)
);

-- O bifă pe zi, la nesfârșit. Ținute în obicei, ar crește rândul lui la
-- infinit și l-ar rescrie întreg la fiecare bifă.
create table if not exists public.habit_ticks (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  -- `<obicei>:<zi>`, ca bifa să se scrie și să se șteargă la fel ca orice
  -- altceva, dintr-un singur câmp
  id text not null,
  habit_id text not null,
  date date not null,
  value integer not null default 1,
  primary key (owner, id),
  unique (owner, habit_id, date),
  foreign key (owner, habit_id) references public.habits (owner, id) on delete cascade
);

-- --------------------------------------------------------------- notițele
create table if not exists public.notes (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  mod text not null,
  title text,
  body text,
  created_at text,
  updated_at text,
  primary key (owner, id)
);

-- --------------------------------------------------------------- firmele
create table if not exists public.orgs (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name text not null,
  kind text,
  phone text,
  email text,
  web text,
  address text,
  notes text,
  created_at text,
  primary key (owner, id)
);

-- -------------------------------------------------------------- datoriile
create table if not exists public.debts (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  mod text not null,
  name text not null,
  -- 'owe' — datorezi tu. 'owed' — ți se datorează.
  direction text not null default 'owe',
  category text,
  total numeric not null default 0,
  status text not null default 'Activă',
  stage text,
  since date,
  defaulted date,
  due date,
  notes text,
  created_at text,
  primary key (owner, id),
  constraint debts_direction check (direction in ('owe', 'owed'))
);

-- Cine a ținut-o și în ce rol. Datoriile se vând; ăsta e istoricul.
create table if not exists public.debt_holders (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  debt_id text not null,
  org_id text,
  role text not null,
  from_date date,
  to_date date,
  ref text,
  notes text,
  primary key (owner, id),
  foreign key (owner, debt_id) references public.debts (owner, id) on delete cascade
);

-- Aceeași datorie poartă mai multe numere, câte unul de la fiecare firmă.
create table if not exists public.debt_refs (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  debt_id text not null,
  value text not null,
  label text,
  org_id text,
  primary key (owner, id),
  foreign key (owner, debt_id) references public.debts (owner, id) on delete cascade
);

create table if not exists public.debt_plans (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  debt_id text not null,
  kind text,
  amount numeric not null default 0,
  every text not null,
  next_due date,
  from_date date,
  to_date date,
  status text not null,
  notes text,
  primary key (owner, id),
  foreign key (owner, debt_id) references public.debts (owner, id) on delete cascade
);

-- Fiecare telefon și fiecare scrisoare. Asta te apără când firma spune
-- altceva peste șase luni.
create table if not exists public.debt_actions (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  debt_id text not null,
  date date not null,
  kind text not null,
  summary text not null,
  outcome text,
  follow_up date,
  org_id text,
  primary key (owner, id),
  foreign key (owner, debt_id) references public.debts (owner, id) on delete cascade
);

-- Scrisorile scanate. Fișierul e în Storage; aici stă doar numele lui.
create table if not exists public.debt_files (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  debt_id text not null,
  name text not null,
  type text,
  size bigint,
  primary key (owner, id),
  foreign key (owner, debt_id) references public.debts (owner, id) on delete cascade
);

-- ---------------------------------------------------------------- banii
-- O mișcare e scrisă o dată, aici. Datoria și tura se uită la ea; nu-și țin
-- copia lor, ca să nu existe două adevăruri despre aceiași bani.
create table if not exists public.movements (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  date date not null,
  kind text not null,
  amount numeric not null,
  cat text,
  note text,
  debt_id text,
  primary key (owner, id),
  constraint movements_kind check (kind in ('in', 'out'))
);

create index if not exists movements_by_date on public.movements (owner, date);
create index if not exists movements_by_debt on public.movements (owner, debt_id);

-- ----------------------------------------------------------- documentele
create table if not exists public.docs (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  mod text not null,
  title text not null,
  sender text,
  date date,
  ref text,
  amount numeric,
  due date,
  note text,
  debt_id text,
  done boolean not null default false,
  created_at text,
  primary key (owner, id)
);

create table if not exists public.doc_files (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  doc_id text not null,
  name text not null,
  type text,
  size bigint,
  primary key (owner, id),
  foreign key (owner, doc_id) references public.docs (owner, id) on delete cascade
);

-- -------------------------------------------------------------- livrările
create table if not exists public.vehicles (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name text not null,
  plate text,
  fuel_per_km numeric,
  notes text,
  created_at text,
  primary key (owner, id)
);

create table if not exists public.workdays (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  mod text not null,
  date date not null,
  from_time text,
  to_time text,
  break_minutes integer,
  vehicle_id text,
  odo_start numeric,
  odo_end numeric,
  personal_km numeric,
  uber numeric,
  deliveroo numeric,
  just_eat numeric,
  other_platform numeric,
  tips numeric,
  bonuses numeric,
  parking numeric,
  tolls numeric,
  other_cost numeric,
  expenses numeric,
  recurring numeric,
  to_debt numeric,
  debt_id text,
  notes text,
  done boolean not null default false,
  -- intrare veche, adusă din istoric: se socotește, dar nu atinge Finanțele
  archived boolean not null default false,
  -- procentele înghețate la închiderea turei, ca o setare de azi să nu
  -- rescrie luna trecută
  rate_tax_pct numeric,
  rate_ni_pct numeric,
  rate_fuel_per_km numeric,
  rate_veh_per_km numeric,
  created_at text,
  primary key (owner, id)
);

create index if not exists workdays_by_date on public.workdays (owner, date);

-- Ziua de livrări rar e dintr-o bucată: prânz, pauză, seară.
create table if not exists public.work_periods (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  workday_id text not null,
  from_time text not null,
  to_time text not null,
  break_minutes integer,
  primary key (owner, id),
  foreign key (owner, workday_id) references public.workdays (owner, id) on delete cascade
);

create table if not exists public.fuel (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  mod text not null,
  date date not null,
  vehicle_id text,
  odometer numeric,
  litres numeric,
  cost numeric,
  -- consumul se poate socoti numai între două plinuri
  is_full boolean not null default false,
  notes text,
  created_at text,
  primary key (owner, id)
);

create index if not exists fuel_by_vehicle on public.fuel (owner, vehicle_id, date);

create table if not exists public.car_costs (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  mod text not null,
  date date not null,
  vehicle_id text,
  category text,
  what text,
  amount numeric not null default 0,
  -- cât din ea e de business, ca fracție
  business_pct numeric,
  -- prima și ultima zi acoperită, la cele care se întind
  from_date date,
  to_date date,
  notes text,
  created_at text,
  primary key (owner, id)
);

-- ------------------------------------------------------------ paza rândurilor
-- Fără astea, cheia publică din codul site-ului ar lăsa pe oricine să citească
-- tot. Cu ele, baza însăși refuză rândurile care nu sunt ale tale.
do $$
declare t text;
begin
  foreach t in array array[
    'settings', 'modules', 'goals', 'goal_contributions', 'goal_readings',
    'tasks', 'habits', 'habit_ticks', 'notes', 'orgs', 'debts', 'debt_holders',
    'debt_refs', 'debt_plans', 'debt_actions', 'debt_files', 'movements',
    'docs', 'doc_files', 'vehicles', 'workdays', 'work_periods', 'fuel', 'car_costs'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format(
      'create policy own_rows on public.%I for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid())',
      t);
  end loop;
end $$;
