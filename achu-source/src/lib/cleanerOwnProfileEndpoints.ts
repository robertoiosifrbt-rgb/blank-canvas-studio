/**
 * §15 „Update profile" (Sesiunea 160) — o citire și o scriere.
 *
 * ⛔ **Lista de câmpuri e închisă pe SERVER** (`lib/cleanerOwnProfile.ts`). Ce se trimite de aici e
 * doar ce se poate schimba; restul e ignorat oricum.
 */
import { apiGet, apiPost } from './apiClient';

export type OwnProfile = {
  /** ⚠️ Arătate, dar NEschimbabile de aici — ecranul spune cine le schimbă. */
  cleanerName: string;
  email: string | null;
  phone: string | null;
  homeAddress: string | null;
  homePostcode: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
};

export function getMyProfile() {
  return apiGet<{ profile: OwnProfile }>('/my-profile', {});
}

export function saveMyProfile(body: {
  phone?: string | null; homeAddress?: string | null; homePostcode?: string | null;
  emergencyContactName?: string | null; emergencyContactPhone?: string | null;
}) {
  return apiPost<{ success: true; changed: boolean }>('/my-profile', body);
}

