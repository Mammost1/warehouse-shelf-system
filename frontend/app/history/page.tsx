'use client';

import { useEffect, useState } from 'react';
import { getReservationHistory, type HistoryItem } from '@/lib/api';
import { downloadCsv } from '@/lib/csv';
import Link from 'next/link';
import styles from './history.module.css';

function formatDate(s: string): string {
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString('th-TH', {
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: false,
  });
}

const PAGE_SIZE = 50;
const CATEGORIES = ['all', 'Shoes', 'Apparel', 'Bags', 'Collectibles'];

export default function HistoryPage() {
  const [list, setList] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'reserve' | 'unreserve'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  useEffect(() => {
    setPage(1);
  }, [filter, categoryFilter, dateFrom, dateTo]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getReservationHistory({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      action: filter === 'all' ? undefined : filter,
      category: categoryFilter === 'all' ? undefined : categoryFilter,
      dateFrom: dateFrom.trim() || undefined,
      dateTo: dateTo.trim() || undefined,
    })
      .then((data) => {
        if (!cancelled) {
          setList(data.list);
          setTotal(data.total);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [filter, categoryFilter, dateFrom, dateTo, page]);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <Link href="/" className={styles.back}>← กลับหน้าแรก</Link>
          <h1 className={styles.title}>ประวัติการเคลื่อนไหว</h1>
        </div>
        <p className={styles.subtitle}>รายการบันทึกการจองและปล่อยช่องเก็บสินค้า</p>
        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>แสดง:</span>
          <button
            type="button"
            className={filter === 'all' ? styles.filterBtnActive : styles.filterBtn}
            onClick={() => setFilter('all')}
          >
            ทั้งหมด
          </button>
          <button
            type="button"
            className={filter === 'reserve' ? styles.filterBtnActive : styles.filterBtn}
            onClick={() => setFilter('reserve')}
          >
            เพิ่มเข้าคลัง
          </button>
          <button
            type="button"
            className={filter === 'unreserve' ? styles.filterBtnActive : styles.filterBtn}
            onClick={() => setFilter('unreserve')}
          >
            เอาออกจากช่อง
          </button>
          <span className={styles.filterLabel} style={{ marginLeft: '0.75rem' }}>หมวด:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">ทั้งหมด</option>
            {CATEGORIES.filter((c) => c !== 'all').map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <span className={styles.filterLabel} style={{ marginLeft: '0.75rem' }}>จากวันที่</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={styles.filterSelect}
          />
          <span className={styles.filterLabel}>ถึงวันที่</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={styles.filterSelect}
          />
          {list.length > 0 && (
            <button
              type="button"
              className={styles.exportBtn}
              onClick={() => {
                const headers = ['วันที่ · เวลา', 'การกระทำ', 'รหัส/ออเดอร์', 'ชื่อสินค้า', 'หมวด', 'ตำแหน่ง'];
                const rows = list.map((row) => [
                  formatDate(row.createdAt),
                  row.action === 'reserve' ? 'เพิ่มเข้าคลัง' : 'เอาออกจากช่อง',
                  row.orderId,
                  (row.productName && String(row.productName).trim()) ? String(row.productName).trim() : '—',
                  row.category ?? '—',
                  row.locationLabel ?? '—',
                ]);
                downloadCsv(headers, rows, `reservation-history-${new Date().toISOString().slice(0, 10)}.csv`);
              }}
            >
              Export CSV
            </button>
          )}
        </div>
      </header>

      <section className={styles.section}>
        {loading && <p className={styles.muted}>กำลังโหลด…</p>}
        {error && <p className={styles.error}>{error}</p>}
        {!loading && !error && list.length === 0 && (
          <p className={styles.empty}>ยังไม่มีประวัติ</p>
        )}
        {!loading && !error && list.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>วันที่ · เวลา</th>
                  <th>การกระทำ</th>
                  <th>รหัส/ออเดอร์</th>
                  <th>ชื่อสินค้า</th>
                  <th>หมวด</th>
                  <th>ตำแหน่ง</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.cellTime}>{formatDate(row.createdAt)}</td>
                    <td>
                      <span className={row.action === 'reserve' ? styles.badgeAdd : styles.badgeRemove}>
                        {row.action === 'reserve' ? 'เพิ่มเข้าคลัง' : 'เอาออกจากช่อง'}
                      </span>
                    </td>
                    <td className={styles.cellOrder}>{row.orderId}</td>
                    <td className={styles.cellLocation}>{(row.productName && String(row.productName).trim()) ? String(row.productName).trim() : '—'}</td>
                    <td className={styles.cellLocation}>{row.category ?? '—'}</td>
                    <td className={styles.cellLocation}>{row.locationLabel ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && total > 0 && (
          <div className={styles.pagination}>
            <span className={styles.paginationInfo}>
              แสดง {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} จาก {total}
            </span>
            <div className={styles.paginationBtns}>
              <button
                type="button"
                className={styles.paginationBtn}
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ก่อนหน้า
              </button>
              <span className={styles.paginationPage}>หน้า {page} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span>
              <button
                type="button"
                className={styles.paginationBtn}
                disabled={page >= Math.ceil(total / PAGE_SIZE)}
                onClick={() => setPage((p) => p + 1)}
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
