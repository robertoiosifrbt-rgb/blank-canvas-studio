/** §35 „Vehicles" (Sesiunea 160) — mașinile firmei. Faptele vin gata calculate de la server. */
import { apiGet, apiPost } from './apiClient';

export type VehicleWarning = { field: string; label: string; on: string; state: 'expired' | 'soon' };

export type Vehicle = {
  id: string;
  vehicleId: number;
  registration: string;
  label: string | null;
  make: string | null;
  model: string | null;
  ownedBy: string | null;
  insuranceExpiresOn: string | null;
  motExpiresOn: string | null;
  taxExpiresOn: string | null;
  serviceDueOn: string | null;
  mileage: number | null;
  mileageReadOn: string | null;
  driverCleanerId: string | null;
  driverName: string | null;
  status: string;
  statusNote: string | null;
  notes: string | null;
  /** ⚠️ Un rând per HÂRTIE: cine rezolvă asigurarea nu a rezolvat și ITP-ul. */
  warnings: VehicleWarning[];
  worstWarning: 'expired' | 'soon' | null;
};

export function getVehicles() {
  return apiGet<{ records: Vehicle[] }>('/vehicles', {});
}

export function saveVehicle(body: Record<string, unknown>) {
  return apiPost<{ success: true; id: string }>('/vehicles/save', body);
}

