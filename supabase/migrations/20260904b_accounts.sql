-- Conturile: platformele de livrări, băncile și cash-ul.
--
-- O tură nu aduce bani în mână, ci un sold pe Uber, altul pe Deliveroo,
-- fiecare plătit în ziua lui. Finanțele văd banii abia când ajung în bancă.
-- De aia platformele au conturile lor, iar mișcările știu prin ce cont au
-- trecut și de pe ce platformă au venit.

create table if not exists public.accounts (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name text not null,
  -- 'platform' — Uber, Deliveroo. 'bank' — Monzo. 'cash' — buzunarul.
  kind text not null default 'platform',
  -- cât costă scoaterea banilor pe loc, la platforme
  cash_out_fee numeric,
  -- ziua din săptămână în care plătește singură: 0 duminică … 6 sâmbătă
  payout_day integer,
  payout_at text,
  -- contul bancar în care intră banii
  pay_to text,
  notes text,
  created_at text,
  primary key (owner, id),
  constraint accounts_kind check (kind in ('platform', 'bank', 'cash'))
);

-- Cât a câștigat fiecare platformă într-o tură. Un rând pe platformă, ca o
-- platformă nouă să nu ceară o coloană nouă.
create table if not exists public.workday_earnings (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  workday_id text not null,
  account_id text not null,
  amount numeric not null default 0,
  primary key (owner, id),
  foreign key (owner, workday_id) references public.workdays (owner, id) on delete cascade
);

-- Contul prin care a trecut mișcarea, platforma de pe care a venit, și cât a
-- plecat de pe ea când nu e același lucru cu ce a ajuns în bancă.
alter table public.movements add column if not exists account_id text;
alter table public.movements add column if not exists from_account text;
alter table public.movements add column if not exists gross numeric;

do $$
declare t text;
begin
  foreach t in array array['accounts', 'workday_earnings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format(
      'create policy own_rows on public.%I for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid())',
      t);
  end loop;
end $$;
