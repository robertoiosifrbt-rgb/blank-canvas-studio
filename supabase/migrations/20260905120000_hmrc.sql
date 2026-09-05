-- The year's bill, rather than a guess at it.
--
-- `reserves` already held two percentages, and the comment above them said
-- what they could not do: a flat rate does not know that the first slice of
-- profit is untaxed, or that Class 4 stops climbing above a threshold. It
-- reserves too much in April and too little in March, and it has nothing at
-- all to say about a wage or a dividend.
--
-- The row stays where it is, and grows. It was already the right shape — one
-- per person, because there is one HMRC, one allowance and one bill — and the
-- reason the percentages sat here rather than on a line of work is the same
-- reason the rest of the year's figures do.
--
-- Everything is nullable. A person who has not sat down with the HMRC page yet
-- has an unknown bill, not a bill of nothing, and the screen says so rather
-- than showing £0 owed.
--
-- The two percentages are not removed. They are what a shift pins at the
-- moment it is written, so that a report from October does not change when a
-- rate changes in January, and nothing here replaces that yet.
--
-- Law 5, the sync strategy: unchanged. One row per person, no cursor, fetched
-- whole, carrying the version it already had.

alter table public.reserves
  -- The year these figures are for, as HMRC writes it: '2026/27'.
  add column tax_year               text,

  -- What the person is allowed before any tax, and where it starts shrinking.
  add column personal_allowance     numeric(12, 2),
  add column taper_from             numeric(12, 2),

  -- The bands, on taxable income — what is left after the allowance.
  add column basic_band             numeric(12, 2),
  add column higher_band_to         numeric(12, 2),
  add column basic_pct              numeric(5, 2),
  add column higher_pct             numeric(5, 2),
  add column additional_pct         numeric(5, 2),

  -- Dividends: their own allowance, on top of the personal one, and their own
  -- rates. They pay no National Insurance, which is why they are apart.
  add column dividend_allowance     numeric(12, 2),
  add column dividend_basic_pct     numeric(5, 2),
  add column dividend_higher_pct    numeric(5, 2),
  add column dividend_additional_pct numeric(5, 2),

  -- Class 4, paid on trading profit and on nothing else.
  add column class4_from            numeric(12, 2),
  add column class4_to              numeric(12, 2),
  add column class4_main_pct        numeric(5, 2),
  add column class4_upper_pct       numeric(5, 2),

  -- Income the app does not hold a module for yet. Written by hand until it
  -- does, and read by the same calculation either way.
  add column employment             numeric(12, 2),
  add column employment_tax_paid    numeric(12, 2),
  add column dividends              numeric(12, 2);

-- Money is never below nothing, and a rate is a percentage.
alter table public.reserves
  add constraint reserves_year_shape check (
    tax_year is null or tax_year ~ '^\d{4}/\d{2}$'
  ),
  add constraint reserves_amounts_positive check (
    coalesce(personal_allowance, 0) >= 0
    and coalesce(taper_from, 0) >= 0
    and coalesce(basic_band, 0) >= 0
    and coalesce(higher_band_to, 0) >= 0
    and coalesce(dividend_allowance, 0) >= 0
    and coalesce(class4_from, 0) >= 0
    and coalesce(class4_to, 0) >= 0
    and coalesce(employment, 0) >= 0
    and coalesce(employment_tax_paid, 0) >= 0
    and coalesce(dividends, 0) >= 0
  ),
  add constraint reserves_rates_are_percentages check (
    coalesce(basic_pct, 0) between 0 and 100
    and coalesce(higher_pct, 0) between 0 and 100
    and coalesce(additional_pct, 0) between 0 and 100
    and coalesce(dividend_basic_pct, 0) between 0 and 100
    and coalesce(dividend_higher_pct, 0) between 0 and 100
    and coalesce(dividend_additional_pct, 0) between 0 and 100
    and coalesce(class4_main_pct, 0) between 0 and 100
    and coalesce(class4_upper_pct, 0) between 0 and 100
  ),
  -- A band that ends before it starts would tax a slice of income twice, or
  -- not at all, depending on which way round it was read.
  add constraint reserves_bands_climb check (
    basic_band is null or higher_band_to is null or higher_band_to >= basic_band
  ),
  add constraint reserves_class4_climbs check (
    class4_from is null or class4_to is null or class4_to >= class4_from
  );

-- Per column, both ways round, as everywhere else. The client writes figures
-- and income; it never writes id, owner, version or the stamps.
grant insert (
  tax_pct, ni_pct,
  tax_year, personal_allowance, taper_from,
  basic_band, higher_band_to, basic_pct, higher_pct, additional_pct,
  dividend_allowance, dividend_basic_pct, dividend_higher_pct,
  dividend_additional_pct,
  class4_from, class4_to, class4_main_pct, class4_upper_pct,
  employment, employment_tax_paid, dividends
) on table public.reserves to authenticated;

grant update (
  tax_pct, ni_pct, deleted_at,
  tax_year, personal_allowance, taper_from,
  basic_band, higher_band_to, basic_pct, higher_pct, additional_pct,
  dividend_allowance, dividend_basic_pct, dividend_higher_pct,
  dividend_additional_pct,
  class4_from, class4_to, class4_main_pct, class4_upper_pct,
  employment, employment_tax_paid, dividends
) on table public.reserves to authenticated;
