/**
 * §32 „Complaint evidence" (Sesiunea 148) — POZELE RECLAMAȚIILOR UNUI CLIENT, citite o dată.
 *
 * ⛔ **Fișier propriu, nu în `ComplaintPhotos.tsx`**, și motivul e o verificare, nu o preferință:
 * un fișier care exportă și o componentă și un hook rupe `react-refresh/only-export-components`,
 * iar clichetul de lint e EXACT (`AGENT_RULES` §7) — un avertisment nou oprește push-ul. ⚠️ Același
 * loc ca `useServiceCatalogue.ts`, care e tot un hook de citire.
 *
 * 🔴 **O SINGURĂ CHEMARE PENTRU TOATĂ LISTA.** Ecranul arată cererile clientului, deci un
 * `useEffect` pe rând ar fi însemnat opt cereri HTTP și opt drumuri la depozit pentru o pagină pe
 * care omul o deschide o dată. Semnarea se face oricum în lot, pe server.
 */
import { useCallback, useEffect, useState } from 'react';
import { getMyComplaintPhotos, type ComplaintPhoto } from './customerRequestEndpoints';

export type ComplaintPhotoState = {
  photos: ComplaintPhoto[];
  maxPhotos: number;
  uploadsAvailable: boolean;
  reload: () => void;
};

/**
 * Pozele reclamațiilor acestui client. ⚠️ `enabled` — nu se cheamă nimic dacă omul n-a raportat
 * nicio problemă: majoritatea clienților n-au niciuna, iar o cerere sigur goală la fiecare
 * deschidere de filă e trafic pe care nimeni nu-l citește.
 */
export function useMyComplaintPhotos(enabled: boolean): ComplaintPhotoState {
  const [photos, setPhotos] = useState<ComplaintPhoto[]>([]);
  const [maxPhotos, setMaxPhotos] = useState(0);
  const [uploadsAvailable, setUploadsAvailable] = useState(false);

  const load = useCallback(() => {
    if (!enabled) return;
    getMyComplaintPhotos()
      .then(res => {
        setPhotos(res.photos ?? []);
        setMaxPhotos(res.maxPhotos);
        setUploadsAvailable(res.uploadsAvailable);
      })
      /**
       * ⚠️ **Eșecul e TĂCUT, deliberat**, și e singurul loc din felie unde e: dacă lista de poze nu
       * se poate citi, restul filei (cererile, răspunsurile biroului) e chiar partea care contează.
       * ⛔ Un toast roșu la deschiderea filei ar alarma pentru o galerie, nu pentru o problemă.
       * Fără poze și fără plafon, `canAdd` iese `false`, deci ecranul nu promite nimic.
       */
      .catch(() => undefined);
  }, [enabled]);

  useEffect(load, [load]);

  return { photos, maxPhotos, uploadsAvailable, reload: load };
}


