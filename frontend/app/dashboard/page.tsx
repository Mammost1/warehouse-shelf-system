'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { getShelvesSummary, type ShelfSummary } from '@/lib/api';
import { getStatusPieData } from './DashboardCharts';
import styles from './dashboard.module.css';

/* รอ mount ก่อนค่อยแสดงกราฟ ลดโอกาส Recharts removeChild หลังเปลี่ยนหน้า */
const useChartsMounted = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
};

const CATEGORIES = ['all', 'Shoes', 'Apparel', 'Bags', 'Collectibles'];

type StatusKey = 'vacant' | 'partial' | 'almostFull' | 'full';

const StatusPieChart = dynamic(
  () => import('./DashboardCharts').then((m) => m.StatusPieChart),
  { ssr: false }
);

const CategoryBarChart = dynamic(
  () => import('./DashboardCharts').then((m) => m.CategoryBarChart),
  { ssr: false }
);

const SlotsPieChart = dynamic(
  () => import('./DashboardCharts').then((m) => m.SlotsPieChart),
  { ssr: false }
);

const UtilizationBarChart = dynamic(
  () => import('./DashboardCharts').then((m) => m.UtilizationBarChart),
  { ssr: false }
);

export default function DashboardPage() {
  const chartsMounted = useChartsMounted();
  const [shelfList, setShelfList] = useState<ShelfSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [shelfStatusFilter, setShelfStatusFilter] = useState<'all' | 'vacant' | 'hasSpace' | 'full'>('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getShelvesSummary()
      .then((list) => {
        if (!cancelled) setShelfList(list);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filteredShelfList = shelfList.filter((s) => {
    if (categoryFilter !== 'all' && (s.category || '').trim() !== categoryFilter) return false;
    const total = s.totalSlots || 1;
    const ratio = s.occupiedSlots / total;
    if (shelfStatusFilter === 'vacant') return s.occupiedSlots === 0;
    if (shelfStatusFilter === 'hasSpace') return ratio < 1;
    if (shelfStatusFilter === 'full') return ratio >= 1;
    return true;
  });

  const totalSlots = filteredShelfList.reduce((sum, s) => sum + (s.totalSlots || 0), 0);
  const occupiedSlots = filteredShelfList.reduce((sum, s) => sum + s.occupiedSlots, 0);

  const byStatus: Record<StatusKey, number> = {
    vacant: 0,
    partial: 0,
    almostFull: 0,
    full: 0,
  };
  filteredShelfList.forEach((s) => {
    const total = s.totalSlots || 1;
    const ratio = s.occupiedSlots / total;
    if (s.occupiedSlots === 0) byStatus.vacant++;
    else if (ratio >= 1) byStatus.full++;
    else if (ratio >= 0.8) byStatus.almostFull++;
    else byStatus.partial++;
  });

  const totalShelves = filteredShelfList.length;
  const pieData = getStatusPieData(byStatus);

  const byCategory = filteredShelfList.reduce<Record<string, number>>((acc, s) => {
    const cat = (s.category || '—').trim() || '—';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});
  const categoryChartData = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  const utilizationByCategory = filteredShelfList.reduce<
    Record<string, { total: number; occupied: number }>
  >((acc, s) => {
    const cat = (s.category || '—').trim() || '—';
    if (!acc[cat]) acc[cat] = { total: 0, occupied: 0 };
    acc[cat].total += s.totalSlots || 0;
    acc[cat].occupied += s.occupiedSlots;
    return acc;
  }, {});
  const utilizationChartData = Object.entries(utilizationByCategory)
    .filter(([, v]) => v.total > 0)
    .map(([name, v]) => ({
      name,
      utilization: (v.occupied / v.total) * 100,
      occupied: v.occupied,
      total: v.total,
    }))
    .sort((a, b) => b.utilization - a.utilization);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.title}>Dashboard คลัง</h1>
        <nav className={styles.headerNav}>
          <Link href="/">← หน้าแรก</Link>
          <Link href="/monitor">Shelf Monitor</Link>
          <Link href="/add">เพิ่มสินค้า</Link>
          <Link href="/history">ประวัติ</Link>
        </nav>
      </header>

      <div className={styles.filterCard}>
        <div className={styles.filterRow}>
          <label>หมวด:</label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">ทั้งหมด</option>
            {CATEGORIES.filter((c) => c !== 'all').map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <label>สถานะ Shelf:</label>
          <select value={shelfStatusFilter} onChange={(e) => setShelfStatusFilter(e.target.value as typeof shelfStatusFilter)}>
            <option value="all">ทั้งหมด</option>
            <option value="vacant">ว่าง</option>
            <option value="hasSpace">มีที่ว่าง</option>
            <option value="full">เต็ม</option>
          </select>
          {(categoryFilter !== 'all' || shelfStatusFilter !== 'all') && (
            <span className={styles.muted}>แสดง {filteredShelfList.length} จาก {shelfList.length} shelf</span>
          )}
        </div>
      </div>

      {loading && <p className={styles.muted}>กำลังโหลด…</p>}
      {error && <p className={styles.error}>{error}</p>}

      {!loading && !error && (
        <>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>จำนวน Shelf</div>
              <div className={styles.statValue}>{filteredShelfList.length}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>ช่องทั้งหมด</div>
              <div className={styles.statValue}>{totalSlots.toLocaleString('th-TH')}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>ช่องที่บรรจุสินค้า</div>
              <div className={styles.statValue}>{occupiedSlots.toLocaleString('th-TH')}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>สัดส่วนที่ใช้</div>
              <div className={styles.statValue}>
                {totalSlots ? ((occupiedSlots / totalSlots) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>

          {!chartsMounted ? (
            <div className={styles.chartEmpty} style={{ minHeight: 280, marginBottom: '1.5rem' }}>กำลังโหลดกราฟ…</div>
          ) : (
            <>
              <div className={styles.chartsRow}>
                <section className={styles.chartCard}>
                  <h2 className={styles.chartTitle}>สัดส่วน Shelf ตามสถานะ</h2>
                  {pieData.length > 0 ? (
                    <StatusPieChart data={pieData} />
                  ) : (
                    <div className={styles.chartEmpty}>ไม่มีข้อมูลตาม filter ปัจจุบัน</div>
                  )}
                </section>
                <section className={styles.chartCard}>
                  <h2 className={styles.chartTitle}>จำนวน Shelf ต่อหมวด</h2>
                  {categoryChartData.length > 0 ? (
                    <CategoryBarChart data={categoryChartData} />
                  ) : (
                    <div className={styles.chartEmpty}>ไม่มีข้อมูลตาม filter ปัจจุบัน</div>
                  )}
                </section>
              </div>
              <div className={styles.chartsRow}>
                <section className={styles.chartCard}>
                  <h2 className={styles.chartTitle}>สัดส่วนช่อง (ใช้แล้ว vs ว่าง)</h2>
                  {totalSlots > 0 ? (
                    <SlotsPieChart occupied={occupiedSlots} total={totalSlots} />
                  ) : (
                    <div className={styles.chartEmpty}>ไม่มีข้อมูลตาม filter ปัจจุบัน</div>
                  )}
                </section>
                <section className={styles.chartCard}>
                  <h2 className={styles.chartTitle}>อัตราการใช้ (%) ต่อหมวด</h2>
                  {utilizationChartData.length > 0 ? (
                    <UtilizationBarChart data={utilizationChartData} />
                  ) : (
                    <div className={styles.chartEmpty}>ไม่มีข้อมูลตาม filter ปัจจุบัน</div>
                  )}
                </section>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
