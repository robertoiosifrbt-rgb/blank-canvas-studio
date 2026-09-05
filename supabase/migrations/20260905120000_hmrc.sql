-- The year's bill, and a row for every year of it.
--
-- `reserves` holds two percentages and says, in the comment above them, what
-- they cannot do: a flat rate does not know that the first slice of profit is
-- untaxed, that Class 4 stops climbing above a threshold, or that a dividend
-- is taxed at its own rates and pays no National Insurance at all. It reserves
-- too much in April and too little in March, and it has never had anything to
-- say about a wage.
--
-- A table rather than more columns on `reserves`, and the reason is the whole
-- point of the thing: **the figures change every April**. One row per person
-- would mean that setting this year's allowance overwrites last year's, and a
-- bill from 2026/27 would quietly recalculate itself using 2027/28's numbers
-- the moment you updated them. A filed return does not change. The key is the
-- person and the year, so a new April is a new row and the old one stands.
--
-- This is not the "history" the plan refuses to build. It is not versions of
-- one thing: 2026/27 and 2027/28 are two different years, each with its own
-- answer, both of them current for as long as HMRC can ask about them.
--
-- Law 5, the sync strategy: no cursor. A handful of rows — one per tax year a
-- person has worked — fetched whole on every sync, the same as the reserves
-- and the running costs. They carry a version because two devices editing one
-- year is as real here as anywhere else.

create table public.tax_years (
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,

  -- The year as HMRC writes it: '2026/27'.
  tax_year text not null,

  -- What is allowed before any tax, and where it starts shrinking.
  personal_allowance numeric(12, 2) not null,
  taper_from         numeric(12, 2) not null,

  -- The bands, on taxable income — what is left after the allowance.
  basic_band     numeric(12, 2) not null,
  higher_band_to numeric(12, 2) not null,
  basic_pct      numeric(5, 2)  not null,
  higher_pct     numeric(5, 2)  not null,
  additional_pct numeric(5, 2)  not null,

  -- Dividends: their own allowance on top of the personal one, their own
  -- rates, and no National Insurance. That is why they are apart.
  dividend_allowance      numeric(12, 2) not null,
  dividend_basic_pct      numeric(5, 2)  not null,
  dividend_higher_pct     numeric(5, 2)  not null,
  dividend_additional_pct numeric(5, 2)  not null,

  -- Class 4, paid on trading profit and on nothing else. Class 1 belongs to an
  -- employer and is taken before the money is seen, so it never appears here.
  class4_from      numeric(12, 2) not null,
  class4_to        numeric(12, 2) not null,
  class4_main_pct  numeric(5, 2)  not null,
  class4_upper_pct numeric(5, 2)  not null,

  -- Income the app holds no module for yet. Typed by hand until it does, and
  -- read by the same calculation either way.
  employment          numeric(12, 2) not null default 0,
  employment_tax_paid numeric(12, 2) not null default 0,
  dividends           numeric(12, 2) not null default 0,

  version    integer     not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  primary key (owner, tax_year),

  constraint tax_years_year_shape check (tax_year ~ '^\d{4}/\d{2}$'),

  constraint tax_years_amounts_positive check (
    personal_allowance >= 0 and taper_from >= 0
    and basic_band >= 0 and higher_band_to >= 0
    and dividend_allowance >= 0
    and class4_from >= 0 and class4_to >= 0
    and employment >= 0 and employment_tax_paid >= 0 and dividends >= 0
  ),
  constraint tax_years_rates_are_percentages check (
    basic_pct between 0 and 100
    and higher_pct between 0 and 100
    and additional_pct between 0 and 100
    and dividend_basic_pct between 0 and 100
    and dividend_higher_pct between 0 and 100
    and dividend_additional_pct between 0 and 100
    and class4_main_pct between 0 and 100
    and class4_upper_pct between 0 and 100
  ),
  -- A band ending before it starts would tax a slice twice, or not at all,
  -- depending on which way round it happened to be read.
  constraint tax_years_bands_climb check (higher_band_to >= basic_band),
  constraint tax_years_class4_climbs check (class4_to >= class4_from)
);

-- The same stamp the other settings use: the phone's clock and the client's
-- version reach neither. It pins `owner` on update, and this table's key is
-- (owner, tax_year), so there is no `id` for public.stamp() to pin.
create trigger tax_years_stamp
  before insert or update on public.tax_years
  for each row execute function public.stamp_setting();

revoke all on table public.tax_years from anon, authenticated;

grant select on table public.tax_years to authenticated;

-- Per column, both ways round. The year itself can be written once and never
-- edited: a row that changed which year it described would take a filed bill
-- with it.
grant insert (
  tax_year,
  personal_allowance, taper_from,
  basic_band, higher_band_to, basic_pct, higher_pct, additional_pct,
  dividend_allowance, dividend_basic_pct, dividend_higher_pct,
  dividend_additional_pct,
  class4_from, class4_to, class4_main_pct, class4_upper_pct,
  employment, employment_tax_paid, dividends
) on table public.tax_years to authenticated;

grant update (
  personal_allowance, taper_from,
  basic_band, higher_band_to, basic_pct, higher_pct, additional_pct,
  dividend_allowance, dividend_basic_pct, dividend_higher_pct,
  dividend_additional_pct,
  class4_from, class4_to, class4_main_pct, class4_upper_pct,
  employment, employment_tax_paid, dividends,
  deleted_at
) on table public.tax_years to authenticated;

alter table public.tax_years enable row level security;

create policy tax_years_select on public.tax_years for select to authenticated
  using (owner = auth.uid());
create policy tax_years_insert on public.tax_years for insert to authenticated
  with check (owner = auth.uid());
create policy tax_years_update on public.tax_years for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
