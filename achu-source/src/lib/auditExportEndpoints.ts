/**
 * 🔴 §39 „Export audit log" (Sesiunea 148) — SCOATEREA JURNALULUI.
 *
 * ⛔ **Fișier propriu, nu în `endpoints.ts`**: catalogul e la clichetul lui de mărime (`AGENT_RULES`
 * §7), iar exportul e o funcție cu explicația ei.
 *
 * ⚠️ **Aceleași filtre pe care le are lista** — ce vezi pe ecran e ce iese în fișier. 🔴 Serverul
 * REFUZĂ peste plafon, în loc să taie: un fișier scurtat în silence, dus la ICO, ar arăta complet.
 */
import { apiDownload } from './apiClient';

export function exportAuditLog(params: {
  entityType?: string; entityId?: string; action?: string; performedBy?: string;
  startDate?: string; endDate?: string;
}) {
  return apiDownload('/audit-history/export', params, 'ACHU-audit-log.csv');
}

