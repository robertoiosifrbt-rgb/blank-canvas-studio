-- One answer to "how much of this is mine", instead of two.
--
-- `reserves` held two percentages a person typed in, and every screen used
-- them to work out what to put aside. The HMRC year does the same job with the
-- allowance, the bands and the thresholds — properly — so the two disagreed by
-- construction, and the one that was wrong was the one on every screen.
--
-- A day is now worth what it adds: the year's bill with it, less the bill
-- without it. Nothing early in the year while the allowance is unused, a fifth
-- once it is gone, more above the higher threshold. A single percentage cannot
-- be any two of those, which is why it was always going to be wrong twice.
--
-- The pinned rates go with it. Freezing a percentage onto a shift made sense
-- when the percentage was a setting somebody might change; a marginal rate is
-- not a setting, it is a consequence of the year, and freezing a consequence
-- is how a report starts disagreeing with the thing it reports on.
--
-- The fuel and vehicle rates stay pinned, and that is not an inconsistency:
-- what a kilometre cost in October is history, and the pump does not re-price
-- last month.

-- The trigger first: it reads the table that is about to go.
create or replace function public.pin_shift_rates() returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  area uuid;
begin
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

alter table public.shifts
  drop column rate_tax_pct,
  drop column rate_ni_pct;

drop table public.reserves;
