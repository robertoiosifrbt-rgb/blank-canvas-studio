-- Coloana. Un singur tabel, și legile care îl apără.
--
-- Ce poate garanta baza nu se verifică în JavaScript: identitatea, versiunea,
-- ceasul, proprietarul și coerența dintre stare și fel sunt toate impuse aici.

create table public.items (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users(id),

  -- Nullable, intenționat. Un lucru capturat nu e „de tip captură" — e ceva
  -- despre care încă nu știi ce e. Marcajul lucrului neprocesat e o singură
  -- coloană: state='inbox'.
  kind       text check (kind in ('task','letter')),

  state      text not null default 'inbox'
             check (state in ('inbox','active','done')),

  title      text not null,

  -- Dată, nu dată-și-oră. Ora se adaugă la prima nevoie reală.
  due        date,

  -- Ziua în care ai făcut lucrul. due e ce ai planificat, done_at e ce s-a
  -- întâmplat. Un task due luni, terminat miercuri, apare la ambele.
  done_at    date,

  version    integer     not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Ștergerea e soft. Rândurile șterse rămân, ca sincronizarea să le poată
  -- duce mai departe.
  deleted_at timestamptz,

  -- În ambele sensuri: nu ieși din inbox fără kind, și în inbox nu există
  -- kind. Altfel starea și felul se pot contrazice.
  constraint items_stare_și_fel check (
    (state =  'inbox' and kind is null)
    or
    (state <> 'inbox' and kind is not null)
  ),

  -- Planul scria `btrim(title) <> ''`. btrim implicit taie doar spații, deci
  -- un titlu făcut din taburi sau din linii noi trecea, și ar fi apărut în Azi
  -- ca un rând care nu arată nimic. `~ '\S'` cere măcar un caracter care nu e
  -- spațiu — aceeași lege, scrisă complet.
  constraint items_titlu_nu_e_gol check (title ~ '\S')
);

-- Nu există constrângerea „un task activ trebuie să aibă dată". Multe
-- task-uri reale n-au dată, iar o astfel de regulă te împinge să pui „mâine"
-- ca să treci validarea — și atunci Azi se umple de amânări.


-- Granturi și RLS, tratate împreună. Privilegiile implicite nu se presupun.

revoke all on table public.items from anon, authenticated;

grant select, insert on table public.items to authenticated;

-- UPDATE se dă pe coloane, nu pe tabel. Așa id, owner, version, created_at și
-- updated_at devin imposibil de scris de client — nu doar suprascrise de
-- trigger. Identitatea e imuabilă în bază, iar id e ancora tuturor modulelor
-- de mai târziu.
grant update (kind, state, title, due, done_at, deleted_at)
  on table public.items to authenticated;

-- Nici anon, nici authenticated nu primesc DELETE, și nu există politică de
-- DELETE. Ștergerea din interfață e un UPDATE pe deleted_at. Altfel granturile
-- ar anula tot rostul soft-delete-ului.

alter table public.items enable row level security;

create policy items_select on public.items for select to authenticated
  using (owner = auth.uid());

create policy items_insert on public.items for insert to authenticated
  with check (owner = auth.uid());

-- USING stabilește ce rând existent ai voie să atingi; WITH CHECK validează
-- cum are voie să arate rândul după UPDATE, deci el împiedică mutarea către
-- alt owner.
create policy items_update on public.items for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());


-- Triggerul. Ceasul unui telefon poate minți, și un client poate trimite orice
-- versiune. Niciuna nu ajunge în tabel.

create function public.stamp() returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    new.version    := 1;
    new.created_at := now();
    new.updated_at := now();
  else
    new.id         := old.id;
    new.owner      := old.owner;
    new.version    := old.version + 1;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end $$ language plpgsql;

create trigger items_stamp
  before insert or update on public.items
  for each row execute function public.stamp();
