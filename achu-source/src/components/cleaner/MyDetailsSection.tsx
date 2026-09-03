/**
 * §15 „Update profile" (Sesiunea 160) — DATELE LUI, SCHIMBATE DE EL.
 *
 * 🔴 **Hotărârea lui Roberto, 29/08/2026:** telefonul · adresa de domiciliu · contactul de urgență.
 * ⛔ Restul rămâne prin birou, iar ecranul o **spune** — fără propoziția aia, cine vrea alt nume ar
 * căuta un buton care nu există și ar crede că aplicația e stricată.
 *
 * ⚠️ **Adresa e a LUI**, cerută pe acte: n-are nicio legătură cu adresa unei vizite.
 *
 * ⛔ **Contactul de urgență spune la ce folosește.** O rubrică fără explicație s-ar completa cu
 * numărul cuiva care nu știe că a fost trecut acolo.
 */
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { getMyProfile, saveMyProfile, type OwnProfile } from '@/lib/cleanerOwnProfileEndpoints';
import { errMsg } from '@/lib/errorMessage';

const EDITABILE = ['phone', 'homeAddress', 'homePostcode', 'emergencyContactName', 'emergencyContactPhone'] as const;
type Editabil = typeof EDITABILE[number];

const ETICHETE: Record<Editabil, string> = {
  phone: 'Your phone number',
  homeAddress: 'Where you live',
  homePostcode: 'Postcode',
  emergencyContactName: 'Emergency contact — who',
  emergencyContactPhone: 'Emergency contact — number',
};

export default function MyDetailsSection() {
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [form, setForm] = useState<Record<Editabil, string>>(
    { phone: '', homeAddress: '', homePostcode: '', emergencyContactName: '', emergencyContactPhone: '' },
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMyProfile()
      .then(d => {
        setProfile(d.profile);
        setForm(Object.fromEntries(EDITABILE.map(f => [f, d.profile[f] ?? ''])) as Record<Editabil, string>);
      })
      .catch(() => setProfile(null));
  }, []);

  if (!profile) return null;

  /** ⚠️ Se trimite doar ce s-a schimbat: serverul nu are ce compara dacă primește tot de fiecare dată. */
  const schimbat = EDITABILE.filter(f => (profile[f] ?? '') !== form[f]);

  const save = async () => {
    setSaving(true);
    try {
      // ⛔ Caseta golită trimite `null`, nu șirul gol: „nu am" și „am un gol" nu sunt același lucru.
      await saveMyProfile(Object.fromEntries(schimbat.map(f => [f, form[f].trim() || null])));
      setProfile({ ...profile, ...Object.fromEntries(schimbat.map(f => [f, form[f].trim() || null])) });
      toast.success('Saved.');
    } catch (e) {
      toast.error(errMsg(e) || 'Could not save that. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><UserRound className="h-4 w-4" /> Your details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/*
          🔴 Ce NU se schimbă de aici, spus înainte de casete. ⛔ Altfel cine vrea alt nume caută un
          buton care nu există.
        */}
        {/* ⚠️ `break-all`: un e-mail n-are spații, deci nu se rupe la marginea cutiei — o împinge (§48). */}
        <p className="text-xs text-muted-foreground">
          <strong>{profile.cleanerName}</strong>
          {profile.email ? <span className="break-all"> · {profile.email}</span> : null} — the office
          changes your name and email; ask them if either is wrong.
        </p>

        {EDITABILE.map(f => (
          <div key={f}>
            <Label htmlFor={`mydetails-${f}`} className="text-xs">{ETICHETE[f]}</Label>
            <Input
              id={`mydetails-${f}`}
              value={form[f]}
              onChange={e => setForm(v => ({ ...v, [f]: e.target.value }))}
              disabled={saving}
            />
          </div>
        ))}

        <p className="text-xs text-muted-foreground">
          The emergency contact is who we ring if something happens to you at work. Tell them you
          have put their number here.
        </p>

        <Button className="w-full min-h-[44px]" disabled={saving || schimbat.length === 0} onClick={save}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
        </Button>
      </CardContent>
    </Card>
  );
}

