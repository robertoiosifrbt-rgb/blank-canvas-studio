import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const CATEGORY_COLORS = [
  'hsl(215, 50%, 55%)',
  'hsl(160, 40%, 48%)',
  'hsl(30, 55%, 55%)',
  'hsl(280, 35%, 55%)',
  'hsl(190, 45%, 48%)',
  'hsl(350, 40%, 55%)',
  'hsl(45, 50%, 50%)',
  'hsl(140, 35%, 50%)',
];

export default function ExpenseChart({ data }: { data: { category: string; total: number }[] }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">No expenses recorded yet.</p>;

  const items = data.slice(0, 8);
  const barSize = 14;
  const rowHeight = 38;
  const chartHeight = Math.max(80, items.length * rowHeight + 40);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={items} layout="vertical" margin={{ left: 100, right: 12, top: 4, bottom: 4 }} barSize={barSize} barCategoryGap="30%">
        <XAxis type="number" tickFormatter={v => `£${v}`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="category" width={95} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v: number) => [`£${v.toFixed(2)}`, 'Total']} cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} />
        <Bar dataKey="total" radius={[3, 6, 6, 3]} maxBarSize={16}>
          {items.map((_, i) => (
            <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

