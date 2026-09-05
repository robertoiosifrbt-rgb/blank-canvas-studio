-- Class 2, which is not a bill.
--
-- The other National Insurance a self-employed person meets, and the only
-- figure in here that is a choice rather than a debt. Above the small profits
-- threshold the year counts towards a State Pension on its own and nothing is
-- due. Below it, nothing is due either — but the year does not count unless
-- you volunteer the money.
--
-- That is why it sits apart from the Class 4 columns rather than beside them:
-- adding it to what is owed would put money on the bill that HMRC is not
-- asking for, and leaving it out entirely loses a state pension year without
-- ever mentioning it. It is shown, with its amount, and never added.
--
-- One figure for the year rather than a weekly rate and a count of weeks. HMRC
-- publishes both, the app only ever needs the product, and a second number to
-- keep in step is a second number to get wrong.

alter table public.tax_years
  add column class2_small_profits numeric(12, 2) not null default 0,
  add column class2_year          numeric(12, 2) not null default 0;

alter table public.tax_years
  add constraint tax_years_class2_positive check (
    class2_small_profits >= 0 and class2_year >= 0
  );

grant insert (class2_small_profits, class2_year) on table public.tax_years to authenticated;
grant update (class2_small_profits, class2_year) on table public.tax_years to authenticated;
