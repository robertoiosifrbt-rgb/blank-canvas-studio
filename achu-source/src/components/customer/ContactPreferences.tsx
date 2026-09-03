/**
 * ACHU-558 (Sesiunea 122, `Backlog_Client_Prioritar` Nivel 2) — CUM VREA CLIENTUL SĂ FIE
 * CONTACTAT.
 *
 * 🔴 **Propoziția de sub alegere e funcționalitatea, nu decorul — și vine de la SERVER.**
 * Aplicația nu trimite azi niciun email și niciun SMS. Un ecran care ar lăsa impresia că
 * bifând „Email" clientul va primi mesaje pe email ar fi o promisiune pe care software-ul
 * nu o ține, iar el ar aștepta o confirmare care nu vine și ar crede că rezervarea lui nu
 * s-a înregistrat.
 *
 * ⚠️ Textul NU e scris aici: `backend/src/lib/contactPreferencePolicy.ts` îl produce, ca în
 * ziua în care firma chiar adaugă emailul să se schimbe **într-un singur loc** — altfel un
 * text hardcodat ar rămâne fals exact atunci când devine posibil să fie adevărat.
 *
 * ⛔ **Nu are nimic de-a face cu consimțământul de marketing** (`ConsentSettings.tsx`).
 * Acela răspunde la *aveți voie să-mi trimiteți reclame*; acesta la *cum să vă adresați
 * când aveți ceva de spus*. Amestecate, evidența cu valoare legală s-ar strica.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { updateContactPreferences } from '@/lib/endpoints';
import { errMsg } from '@/lib/errorMessage';

export type ContactPreference = {
  preferredContactMethod: string | null;
  preferredContactWindow: string | null;
  contactPreferenceNote: string | null;
  /** Propoziția despre ce poate onora aplicația — **calculată pe server**, vezi antetul. */
  expectation: string;
  methods: { value: string; label: string }[];
  windows: { value: string; label: string }[];
  noteMax: number;
};

export default function ContactPreferences({ preference, onSaved }: {
  preference: ContactPreference;
  onSaved: (next: Pick<ContactPreference, 'preferredContactMethod' | 'preferredContactWindow' | 'contactPreferenceNote' | 'expectation'>) => void;
}) {
  const [method, setMethod] = useState(preference.preferredContactMethod ?? '');
  const [window, setWindow] = useState(preference.preferredContactWindow ?? '');
  const [note, setNote] = useState(preference.contactPreferenceNote ?? '');
  const [saving, setSaving] = useState(false);

  const dirty =
    method !== (preference.preferredContactMethod ?? '') ||
    window !== (preference.preferredContactWindow ?? '') ||
    note !== (preference.contactPreferenceNote ?? '');

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const next = await updateContactPreferences({
        preferredContactMethod: method || null,
        preferredContactWindow: window || null,
        contactPreferenceNote: note.trim() || null,
      });
      onSaved(next);
      toast.success('Saved — thank you, we will keep to it.');
    } catch (e) {
      toast.error(errMsg(e) || 'Could not save that.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-muted/30">
      <CardContent className="p-4 space-y-3">
        <p className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />How we get in touch
        </p>

        {/* 🔴 De la server. Vezi antetul — un text scris aici s-ar despărți tăcut de adevăr. */}
        <p className="text-xs text-muted-foreground">{preference.expectation}</p>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="contactpref-method" className="text-xs">Preferred way</Label>
            <select
              id="contactpref-method"
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={method}
              onChange={e => setMethod(e.target.value)}
            >
              <option value="">No preference</option>
              {preference.methods.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="contactpref-window" className="text-xs">Best time</Label>
            <select
              id="contactpref-window"
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={window}
              onChange={e => setWindow(e.target.value)}
            >
              <option value="">No preference</option>
              {preference.windows.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="contactpref-note" className="text-xs">Anything else we should know</Label>
          <Textarea
            id="contactpref-note"
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            maxLength={preference.noteMax}
            placeholder="e.g. please do not ring between 8 and 9, school run"
          />
        </div>

        {/*
          ⚠️ Butonul apare doar când s-a schimbat ceva. Un „Save" permanent lângă un formular
          nemodificat îl învață pe om să-l apese din reflex, iar aici nu e nimic de salvat.
        */}
        {dirty && (
          <Button size="sm" className="h-8 text-xs" disabled={saving} onClick={() => void handleSave()}>
            {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}Save preference
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

