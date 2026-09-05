-- The part of a cost that was actually earning money.
--
-- Every expense counted whole, and every kilometre on the odometer counted as
-- work. Neither is true of a car you also drive to the shops: the insurance
-- covers both, the service covers both, and the tank empties on both. Counting
-- them whole makes the profit smaller than it is, the reserve smaller than it
-- should be, and the difference lands in January with interest on it.
--
-- Two columns, because there are two shapes of the same problem:
--
--   expenses.business_pct   what share of this bill was for work
--   shifts.personal_km      the part of a day's driving that was not
--
-- The defaults are the honest reading of what is already written down. An
-- expense recorded against a line of work was meant as a cost of it, so 100.
-- A shift is a day you went out to earn, so no personal kilometres unless you
-- say otherwise. Neither invents anything: they restate what the rows already
-- claimed, and now the claim can be corrected.
--
-- Law 5, the sync strategy: unchanged. Both ride the anchor item, as every
-- other number of a shift or an expense already does.

alter table public.expenses
  add column business_pct numeric(5, 2) not null default 100;

alter table public.expenses
  add constraint expenses_business_pct_share check (
    business_pct >= 0 and business_pct <= 100
  );

grant insert (business_pct) on table public.expenses to authenticated;
grant update (business_pct) on table public.expenses to authenticated;

alter table public.shifts
  add column personal_km numeric(10, 1);

alter table public.shifts
  add constraint shifts_personal_km_positive check (
    personal_km is null or personal_km >= 0
  ),
  -- You cannot have driven more privately than you drove. When both odometer
  -- readings are there the day's distance is known, and this refuses a figure
  -- larger than it. With a reading missing there is nothing to check against,
  -- and refusing on a guess would block a shift halfway through being written.
  add constraint shifts_personal_km_within_day check (
    personal_km is null
    or odo_start is null
    or odo_end is null
    or personal_km <= odo_end - odo_start
  );

grant insert (personal_km) on table public.shifts to authenticated;
grant update (personal_km) on table public.shifts to authenticated;
