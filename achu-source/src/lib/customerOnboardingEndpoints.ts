/**
 * §4 „Customer onboarding" (Sesiunea 160) — o citire, atât.
 *
 * ⚠️ Fișier propriu, ca `customerContactEndpoints.ts`: `endpoints.ts` e deja lung, iar grupul ăsta
 * n-are nimic în comun cu restul.
 */
import { apiGet } from './apiClient';

export type OnboardingStep = {
  key: string;
  label: string;
  done: boolean;
  /** Ce NU poate face aplicația fără el. ⚠️ Un fapt, nu o mustrare. */
  matters: string;
};

export function getCustomerOnboarding(customerId: string) {
  return apiGet<{ steps: OnboardingStep[]; missing: number }>(`/customer-onboarding/${customerId}`, {});
}

