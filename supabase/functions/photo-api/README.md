# photo-api

Pozele de progres din modulul Gym, ținute în Supabase Storage.

## De ce există

Cheia `anon` ajunge în codul site-ului, deci o are oricine deschide aplicația.
Un bucket care acceptă `anon` ar fi practic public, iar astea sunt poze de
progres. Funcția asta ține cheia care are voie la Storage
(`SUPABASE_SERVICE_ROLE_KEY`) pe server, iar aplicația trimite doar codul de
device — `x-device-token`, același ca la `state-api`. Tokenul e și dosarul:
fără el nu se citește nimic, iar cu un token nu se ajunge la pozele altuia.

## Cum se pune

Panoul Supabase → Edge Functions → New function → nume `photo-api` → lipești
`index.ts` → Deploy.

`SUPABASE_URL` și `SUPABASE_SERVICE_ROLE_KEY` sunt puse automat de Supabase în
orice Edge Function; nu e nimic de configurat. Bucketul `progress-photos` se
creează singur, privat, la prima poză urcată.

Cât timp funcția nu e pusă, aplicația merge normal — în Setări scrie că pozele
au rămas pe aparat și de ce.
