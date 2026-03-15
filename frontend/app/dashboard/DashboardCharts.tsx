'use client';

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

/* โทนสีดอนัท — ไม่ใช้เขียว-แดงเบสิก ใช้เทียล/เอมเบอร์/คอรัล/โรส */
const STATUS_COLORS: Record<string, string> = {
  ว่าง: '#14b8a6',
  บางส่วน: '#eab308',
  เกือบเต็ม: '#fb923c',
  เต็ม: '#f43f5e',
};

/* สีแท่งต่อหมวด — ละสีไม่ซ้ำ ดูมีมิติ */
const BAR_COLORS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

type PieItem = { name: string; value: number; color: string };
type BarItem = { name: string; count: number };

const tooltipStyle = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
};
const tickStyle = { fill: 'var(--muted)', fontSize: 12 };

export function StatusPieChart({ data }: { data: PieItem[] }) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart isAnimationActive={false}>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={64}
          outerRadius={96}
          paddingAngle={3}
          stroke="var(--surface)"
          strokeWidth={2}
          isAnimationActive={false}
          label={({ name, value }) => `${name} ${value}`}
          labelLine={{ stroke: 'var(--muted)' }}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => [value, 'shelf']}
          contentStyle={tooltipStyle}
          itemStyle={{ color: 'var(--text)' }}
          isAnimationActive={false}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => <span style={{ color: 'var(--text)' }}>{value}</span>} isAnimationActive={false} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CategoryBarChart({ data }: { data: BarItem[] }) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, left: 8, bottom: 8 }} isAnimationActive={false}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
        <XAxis type="number" tick={tickStyle} />
        <YAxis type="category" dataKey="name" width={88} tick={tickStyle} />
        <Tooltip
          formatter={(value: number) => [value, 'shelf']}
          contentStyle={tooltipStyle}
          itemStyle={{ color: 'var(--text)' }}
          cursor={{ fill: 'var(--border)', opacity: 0.3 }}
          isAnimationActive={false}
        />
        <Bar dataKey="count" name="จำนวน shelf" radius={[0, 6, 6, 0]} barSize={28} maxBarSize={36} isAnimationActive={false}>
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={BAR_COLORS[index % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function getStatusPieData(byStatus: { vacant: number; partial: number; almostFull: number; full: number }): PieItem[] {
  const labels = [
    { key: 'vacant' as const, name: 'ว่าง', color: STATUS_COLORS['ว่าง'] },
    { key: 'partial' as const, name: 'บางส่วน', color: STATUS_COLORS['บางส่วน'] },
    { key: 'almostFull' as const, name: 'เกือบเต็ม', color: STATUS_COLORS['เกือบเต็ม'] },
    { key: 'full' as const, name: 'เต็ม', color: STATUS_COLORS['เต็ม'] },
  ];
  return labels
    .map(({ key, name, color }) => ({ name, value: byStatus[key], color }))
    .filter((d) => d.value > 0);
}

/* ดอนัท: สัดส่วนช่อง ใช้แล้ว vs ว่าง */
const SLOT_PIE_COLORS = { ใช้แล้ว: '#0ea5e9', ว่าง: '#334155' };

export function SlotsPieChart({ occupied, total }: { occupied: number; total: number }) {
  const vacant = Math.max(0, total - occupied);
  if (total <= 0) return null;
  const data: PieItem[] = [
    { name: 'ใช้แล้ว', value: occupied, color: SLOT_PIE_COLORS['ใช้แล้ว'] },
    { name: 'ว่าง', value: vacant, color: SLOT_PIE_COLORS['ว่าง'] },
  ].filter((d) => d.value > 0);
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart isAnimationActive={false}>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={58}
          outerRadius={90}
          paddingAngle={2}
          stroke="var(--surface)"
          strokeWidth={2}
          isAnimationActive={false}
          label={({ name, value }) => `${name} ${value.toLocaleString('th-TH')}`}
          labelLine={{ stroke: 'var(--muted)' }}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => [value.toLocaleString('th-TH'), 'ช่อง']}
          contentStyle={tooltipStyle}
          itemStyle={{ color: 'var(--text)' }}
          isAnimationActive={false}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: 'var(--text)' }}>{v}</span>} isAnimationActive={false} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* แท่งแนวนอน: อัตราการใช้ (%) ต่อหมวด */
type UtilizationItem = { name: string; utilization: number; occupied: number; total: number };

export function UtilizationBarChart({ data }: { data: UtilizationItem[] }) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, left: 8, bottom: 8 }} isAnimationActive={false}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
        <XAxis type="number" domain={[0, 100]} tick={{ ...tickStyle }} tickFormatter={(v) => `${v}%`} />
        <YAxis type="category" dataKey="name" width={88} tick={tickStyle} />
        <Tooltip
          formatter={(value: number, _n, props: { payload: UtilizationItem }) => [
            `${value.toFixed(1)}% (${props.payload.occupied.toLocaleString('th-TH')} / ${props.payload.total.toLocaleString('th-TH')} ช่อง)`,
            'การใช้',
          ]}
          contentStyle={tooltipStyle}
          itemStyle={{ color: 'var(--text)' }}
          cursor={{ fill: 'var(--border)', opacity: 0.3 }}
          isAnimationActive={false}
        />
        <Bar dataKey="utilization" name="อัตราการใช้" radius={[0, 6, 6, 0]} barSize={28} maxBarSize={36} fill="#14b8a6" isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

