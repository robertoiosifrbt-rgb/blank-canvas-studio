-- When the money is wanted, not only how much.
--
-- A bill for a tax year is not paid at the end of it. The year closes on 5
-- April, the balance falls due the following 31 January, and in between HMRC
-- asks for payments on account: two instalments towards the year that has only
-- just started, each half of what the last one came to, due 31 January and 31
-- July.
--
-- That is what turns a first good year into a bad January. The bill arrives
-- with half of next year's attached to it, and somebody who put aside exactly
-- what they owed is short by fifty per cent of it.
--
-- Two figures the app cannot work out for itself:
--
--   poa_threshold   below this, HMRC does not ask for payments on account
--   paid_on_account what has already been handed over towards this year, from
--                   the instalments set by the year before it
--
-- The second one is history the app does not hold: those payments were made
-- against a year it may never have seen. Typed in, like the wage.

alter table public.tax_years
  add column poa_threshold   numeric(12, 2) not null default 0,
  add column paid_on_account numeric(12, 2) not null default 0;

alter table public.tax_years
  add constraint tax_years_poa_positive check (
    poa_threshold >= 0 and paid_on_account >= 0
  );

grant insert (poa_threshold, paid_on_account) on table public.tax_years to authenticated;
grant update (poa_threshold, paid_on_account) on table public.tax_years to authenticated;
