export const fmt = (amount?: number) =>
  `£${(amount ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtDate = (d?: string) => {
  if (!d) return '—';
  const [y, m, day] = d.split('T')[0].split('-');
  return `${day}/${m}/${y}`;
};

export const statusColor: Record<string, string> = {
  Lead: 'bg-yellow-100 text-yellow-800',
  Active: 'bg-green-100 text-green-800',
  Inactive: 'bg-muted text-muted-foreground',
  Blocked: 'bg-red-100 text-red-800',
  Enquiry: 'bg-yellow-100 text-yellow-800',
  Booked: 'bg-blue-100 text-blue-800',
  Confirmed: 'bg-sky-100 text-sky-800',
  'In Progress': 'bg-orange-100 text-orange-800',
  Completed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
  'No Access': 'bg-muted text-muted-foreground',
  Pending: 'bg-yellow-100 text-yellow-800',
  Received: 'bg-green-100 text-green-800',
  Failed: 'bg-red-100 text-red-800',
  Refunded: 'bg-orange-100 text-orange-800',
  Paid: 'bg-green-100 text-green-800',
  Partial: 'bg-yellow-100 text-yellow-800',
  Unpaid: 'bg-red-100 text-red-800',
};

export const StatusBadge = ({ status }: { status?: string }) => {
  if (!status) return null;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
};
