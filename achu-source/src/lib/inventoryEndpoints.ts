/**
 * §34 „Equipment și inventory" (Sesiunea 160) — catalogul de stoc.
 *
 * ⚠️ **Faptele vin gata calculate de la server** (`stockLabel`, `expiryLabel`, `missingCoshh`):
 * catalogul se citește în listă și în Action Centre, iar două socoteli scrise separat ar spune două
 * lucruri despre aceeași sticlă.
 */
import { apiGet, apiPost } from './apiClient';

export type InventoryItem = {
  id: string;
  inventoryItemId: number;
  name: string;
  kind: string;
  code: string | null;
  supplier: string | null;
  storageLocation: string | null;
  quantity: number;
  unit: string | null;
  minimumStock: number | null;
  reorderLevel: number | null;
  batchNumber: string | null;
  expiresOn: string | null;
  coshhUrl: string | null;
  notes: string | null;
  active: boolean;
  /** ⚠️ Calculate pe server. `null` = nu e nimic de spus. */
  stockState: 'out' | 'below-minimum' | 'reorder' | null;
  stockLabel: string | null;
  expiryState: 'expired' | 'soon' | null;
  expiryLabel: string | null;
  /** 🔴 O substanță fără fișă de siguranță — o hârtie care lipsește la un control. */
  missingCoshh: boolean;
  // §34 — cine îl ține, în ce stare e, când are service.
  assignedCleanerId: string | null;
  assignedCleanerName: string | null;
  assignedVehicle: string | null;
  assignedOn: string | null;
  /** ⚠️ Un om ȘI o mașină se pot scrie amândouă. `null` = e pe raft. */
  holderLabel: string | null;
  condition: string;
  conditionNote: string | null;
  nextServiceOn: string | null;
  serviceState: 'overdue' | 'soon' | null;
  serviceLabel: string | null;
};

export type InventoryRepair = {
  id: string;
  happenedOn: string;
  description: string;
  cost: number | null;
  repairedBy: string | null;
  resolvedOn: string | null;
};

export function getInventory(params: { kind?: string; includeInactive?: 'true' } = {}) {
  return apiGet<{ records: InventoryItem[] }>('/inventory', params);
}

export function saveInventoryItem(body: Record<string, unknown>) {
  return apiPost<{ success: true; id: string; auditWarning?: string }>('/inventory/save', body);
}

export function getItemRepairs(id: string) {
  return apiGet<{ repairs: InventoryRepair[]; totalCost: number }>(`/inventory/${id}/repairs`, {});
}

export function addItemRepair(id: string, body: {
  happenedOn: string; description: string; cost?: number | null; repairedBy?: string | null; resolvedOn?: string | null;
}) {
  return apiPost<{ success: true; id: string }>(`/inventory/${id}/repairs`, body);
}

