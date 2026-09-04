-- Deleting the account takes its items with it.
--
-- The spine writes `owner ... references auth.users(id)` with no action on
-- delete, which is what the plan asked for. The consequence only shows up at
-- the one moment nobody rehearses: deleting the account. Postgres refuses
-- while a single row of yours is left, so the account gets stuck instead of
-- leaving, and the error names a foreign key rather than the reason.
--
-- Cascade is the honest reading of ownership. An item whose owner is gone is a
-- row nobody can ever reach again: RLS matches on owner = auth.uid(), and that
-- uid will never sign in. Keeping it would be a row without an exit.
--
-- The constraint is the one Postgres named itself when the column was declared
-- inline. It is dropped by that name on purpose: if the name is ever not that,
-- this migration has to fail out loud, not quietly change nothing.

alter table public.items
  drop constraint items_owner_fkey;

alter table public.items
  add constraint items_owner_fkey
  foreign key (owner) references auth.users(id) on delete cascade;
