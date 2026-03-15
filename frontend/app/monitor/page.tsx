'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getSlotByLocation,
  getSlotDetails,
  getSlotStatus,
  getShelvesSummary,
  searchReservations,
  unreserveOrder,
  type SlotContents,
  type SlotDetails,
  type SlotStatusItem,
  type ShelfSummary,
} from '@/lib/api';
import { downloadCsv } from '@/lib/csv';
import styles from './monitor.module.css';

const CATEGORIES = ['all', 'Shoes', 'Apparel', 'Bags', 'Collectibles'];

export default function MonitorPage() {
  const [view, setView] = useState<'shelf-list' | 'shelf-detail'>('shelf-list');
  const [shelfList, setShelfList] = useState<ShelfSummary[]>([]);
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(null);
  const [slotStatus, setSlotStatus] = useState<SlotStatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchMode, setSearchMode] = useState<'unified' | 'location' | 'slotId'>('unified');
  const [searchQuery, setSearchQuery] = useState('');
  const [locationShelf, setLocationShelf] = useState('');
  const [locationLevel, setLocationLevel] = useState('');
  const [locationSlot, setLocationSlot] = useState('');
  const [slotIdQuery, setSlotIdQuery] = useState('');
  const [searchResult, setSearchResult] = useState<SlotContents | { results: SlotContents[] } | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [shelfStatusFilter, setShelfStatusFilter] = useState<'all' | 'vacant' | 'hasSpace' | 'full'>('all');
  const [showOnlyEmpty, setShowOnlyEmpty] = useState(false);
  const [detailSlot, setDetailSlot] = useState<SlotDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [unreservingId, setUnreservingId] = useState<string | null>(null);
  const [exportDetailLoading, setExportDetailLoading] = useState(false);

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

  useEffect(() => {
    if (!selectedShelfId) return;
    let cancelled = false;
    setLoading(true);
    getSlotStatus({ shelfId: selectedShelfId })
      .then((r) => {
        if (!cancelled) setSlotStatus(Array.isArray(r.slots) ? r.slots : []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedShelfId]);

  function goToShelfDetail(shelfId: string) {
    setSelectedShelfId(shelfId);
    setView('shelf-detail');
    setSearchResult(null);
  }

  function backToShelfList() {
    setSelectedShelfId(null);
    setView('shelf-list');
    setSlotStatus([]);
  }

  function refetchSlotStatus() {
    if (selectedShelfId) {
      getSlotStatus({ shelfId: selectedShelfId })
        .then((r) => setSlotStatus(Array.isArray(r.slots) ? r.slots : []))
        .catch(() => {});
    }
  }

  function runSearch() {
    setSearchError(null);
    setSearchResult(null);
    if (searchMode === 'unified') {
      const q = searchQuery.trim();
      if (!q) return;
      searchReservations(q)
        .then((list) => setSearchResult({ results: list }))
        .catch((e) => setSearchError(e.message));
      return;
    }
    if (searchMode === 'location') {
      // เมื่ออยู่หน้ารายละเอียด Shelf ต้องค้นหาเฉพาะใน shelf นั้น
      const shelf = (view === 'shelf-detail' && selectedShelfId ? selectedShelfId : locationShelf.trim()).trim();
      const level = locationLevel.trim() === '' ? undefined : parseInt(locationLevel, 10);
      const slot = locationSlot.trim() === '' ? undefined : parseInt(locationSlot, 10);
      if (!shelf) {
        setSearchError(null);
        setSearchResult(null);
        return;
      }
      getSlotByLocation(shelf, level, slot)
        .then(setSearchResult)
        .catch((e) => setSearchError(e.message));
      return;
    }
    if (searchMode === 'slotId') {
      const id = parseInt(slotIdQuery.trim(), 10);
      if (!slotIdQuery.trim() || isNaN(id) || id < 1) {
        setSearchError('กรอก Slot ID เป็นตัวเลข');
        return;
      }
      getSlotDetails(id)
        .then((details) => {
          const asContents: SlotContents = {
            slotId: details.slotId,
            shelf: details.shelf,
            level: details.level,
            slot: details.slot,
            locationLabel: details.locationLabel,
            orderId: details.orders.length ? details.orders.map((o) => o.orderId).join(', ') : null,
          };
          setSearchResult(asContents);
        })
        .catch((e) => setSearchError(e.message));
    }
  }

  type SlotFillStatus = 'empty' | 'partial' | 'full';
  type SlotCell = { slotId: number; level: number; slot: number; orderIds: string[]; locationLabel: string; occupied: boolean; fillStatus: SlotFillStatus };

  const slotStatusArray = Array.isArray(slotStatus) ? slotStatus : [];
  const slotStatusFiltered = slotStatusArray.filter((s) => {
    if (showOnlyEmpty) return !s.occupied;
    if (categoryFilter !== 'all') return !s.occupied || s.category === categoryFilter;
    return true;
  });

  /** รายการ Shelf ที่กรองแล้ว สำหรับหน้าข้างนอก (เลือก Shelf) */
  const filteredShelfList = shelfList.filter((s) => {
    if (categoryFilter !== 'all' && (s.category || '').trim() !== categoryFilter) return false;
    const total = s.totalSlots || 1;
    const ratio = s.occupiedSlots / total;
    if (shelfStatusFilter === 'vacant') return s.occupiedSlots === 0;
    if (shelfStatusFilter === 'hasSpace') return ratio < 1;
    if (shelfStatusFilter === 'full') return ratio >= 1;
    return true;
  });

  const byShelf = slotStatusFiltered.reduce<{ [shelf: string]: { [key: string]: SlotCell } }>((acc, s) => {
    if (!acc[s.shelf]) acc[s.shelf] = {};
    const key = `${s.level}-${s.slot}`;
    const slotH = s.slotHeightCm ?? 48;
    const usedH = s.usedHeightCm ?? 0;
    let fillStatus: SlotFillStatus = 'empty';
    if (s.occupied) fillStatus = usedH >= slotH * 0.99 ? 'full' : 'partial';
    acc[s.shelf][key] = {
      slotId: s.slotId,
      level: s.level,
      slot: s.slot,
      orderIds: s.orderIds ?? [],
      locationLabel: s.locationLabel ?? '',
      occupied: s.occupied,
      fillStatus,
    };
    return acc;
  }, {});

  const searchAsByShelf = (): { byShelf: { [shelf: string]: { [key: string]: SlotCell } }; shelves: string[] } | null => {
    if (!searchResult) return null;
    if (searchMode === 'unified' && searchResult && 'results' in searchResult) {
      const raw = (searchResult as { results: SlotContents[] }).results;
      const list = categoryFilter === 'all' ? raw : raw.filter((r) => r.category === categoryFilter);
      const byShelfOut: { [shelf: string]: { [key: string]: SlotCell } } = {};
      for (const r of list) {
        const sh = r.shelf;
        const key = `${r.level}-${r.slot}`;
        if (!byShelfOut[sh]) byShelfOut[sh] = {};
        if (!byShelfOut[sh][key]) byShelfOut[sh][key] = { slotId: r.slotId, level: r.level, slot: r.slot, orderIds: [], locationLabel: r.locationLabel ?? '', occupied: true, fillStatus: 'full' as SlotFillStatus };
        if (r.orderId) byShelfOut[sh][key].orderIds.push(r.orderId);
      }
      return { byShelf: byShelfOut, shelves: Object.keys(byShelfOut).sort() };
    }
    if ((searchMode === 'location' || searchMode === 'slotId') && searchResult && 'slotId' in searchResult && !('results' in searchResult)) {
      const s = searchResult as SlotContents;
      const orderIds = s.orderId ? s.orderId.split(',').map((x) => x.trim()).filter(Boolean) : [];
      const cell: SlotCell = { slotId: s.slotId, level: s.level, slot: s.slot, orderIds, locationLabel: s.locationLabel ?? '', occupied: true, fillStatus: 'full' };
      return { byShelf: { [s.shelf]: { [`${s.level}-${s.slot}`]: cell } }, shelves: [s.shelf] };
    }
    if (searchMode === 'location' && searchResult && 'results' in searchResult) {
      const raw = (searchResult as { results: SlotContents[] }).results;
      const list = categoryFilter === 'all' ? raw : raw.filter((r) => r.category === categoryFilter);
      const byShelfOut: { [shelf: string]: { [key: string]: SlotCell } } = {};
      for (const r of list) {
        const sh = r.shelf;
        const key = `${r.level}-${r.slot}`;
        if (!byShelfOut[sh]) byShelfOut[sh] = {};
        if (!byShelfOut[sh][key]) byShelfOut[sh][key] = { slotId: r.slotId, level: r.level, slot: r.slot, orderIds: [], locationLabel: r.locationLabel ?? '', occupied: true, fillStatus: 'full' as SlotFillStatus };
        if (r.orderId) byShelfOut[sh][key].orderIds.push(r.orderId);
      }
      return { byShelf: byShelfOut, shelves: Object.keys(byShelfOut).sort() };
    }
    return null;
  };

  const searchGrid = searchAsByShelf();
  const displayByShelf = searchGrid ? searchGrid.byShelf : byShelf;
  const displayShelves = searchGrid ? searchGrid.shelves : Object.keys(byShelf).sort();
  const getSlotsForShelf = (shelfId: string): SlotCell[] =>
    Object.values(displayByShelf[shelfId] || {}).sort((a, b) => a.level - b.level || a.slot - b.slot);

  /** หมวดของ shelf ที่กำลังดู (เมื่ออยู่หน้ารายละเอียด Shelf) */
  const currentShelfCategory = view === 'shelf-detail' && selectedShelfId
    ? (shelfList.find((s) => s.shelfId === selectedShelfId)?.category ?? '')
    : null;

  function exportMonitorCsv() {
    const headers = ['Shelf', 'Level', 'Slot', 'Slot ID', 'Order IDs', 'สถานะ'];
    const rows: (string | number)[][] = [];
    displayShelves.forEach((shelfId) => {
      getSlotsForShelf(shelfId).forEach((cell) => {
        const status = cell.fillStatus === 'empty' ? 'ว่าง' : cell.fillStatus === 'partial' ? 'ว่างบางส่วน' : 'เต็ม';
        rows.push([shelfId, cell.level, cell.slot, cell.slotId, cell.orderIds.length ? cell.orderIds.join(', ') : 'ว่าง', status]);
      });
    });
    downloadCsv(headers, rows, `shelf-monitor-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  /** Export รายการ Shelf ตามที่กรอง (หน้าเลือก Shelf) — ข้อมูล: Shelf, หมวด, ช่องทั้งหมด, ช่องที่มีของ, สถานะ */
  function exportShelfListCsv() {
    const headers = ['Shelf', 'หมวด', 'ช่องทั้งหมด', 'ช่องที่มีของ', 'สถานะ'];
    const rows: (string | number)[][] = filteredShelfList.map((s) => {
      const total = s.totalSlots || 1;
      const ratio = s.occupiedSlots / total;
      const status = s.occupiedSlots === 0 ? 'ว่าง' : ratio >= 1 ? 'เต็ม' : ratio >= 0.8 ? 'เกือบเต็ม' : 'บางส่วน';
      return [s.shelfId, s.category || '—', s.totalSlots, s.occupiedSlots, status];
    });
    downloadCsv(headers, rows, `shelf-list-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  /** Export รายละเอียดช่อง ตาม Shelf ที่แสดง (ตาม filter) — แบบข้างในแต่รวมเฉพาะ shelf ที่กรองไว้ */
  async function exportFilteredSlotsDetailCsv() {
    setExportDetailLoading(true);
    setSearchError(null);
    try {
      const allSlots: SlotStatusItem[] = [];
      for (const s of filteredShelfList) {
        const { slots } = await getSlotStatus({ shelfId: s.shelfId });
        if (Array.isArray(slots)) allSlots.push(...slots);
      }
      const headers = ['Shelf', 'Level', 'Slot', 'Slot ID', 'Order IDs', 'สถานะ'];
      const rows: (string | number)[][] = allSlots
        .sort((a, b) => (a.shelf || '').localeCompare(b.shelf || '') || a.level - b.level || a.slot - b.slot)
        .map((s) => {
          const slotH = s.slotHeightCm ?? 48;
          const usedH = s.usedHeightCm ?? 0;
          const status = !s.occupied ? 'ว่าง' : usedH >= slotH * 0.99 ? 'เต็ม' : 'ว่างบางส่วน';
          const orderIds = (s.orderIds ?? []).length ? (s.orderIds ?? []).join(', ') : 'ว่าง';
          return [s.shelf, s.level, s.slot, s.slotId, orderIds, status];
        });
      downloadCsv(headers, rows, `shelf-slots-detail-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (e: any) {
      setSearchError(e?.message || 'โหลดรายละเอียดช่องไม่สำเร็จ');
    } finally {
      setExportDetailLoading(false);
    }
  }

  function openSlotDetail(cell: SlotCell) {
    setDetailLoading(true);
    setDetailSlot(null);
    getSlotDetails(cell.slotId)
      .then(setDetailSlot)
      .finally(() => setDetailLoading(false));
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.title}>Shelf Monitor</h1>
        <nav className={styles.headerNav}>
          <Link href="/">← หน้าแรก</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/add">เพิ่มสินค้า</Link>
          <Link href="/history">ประวัติ</Link>
        </nav>
      </header>

      <section className={styles.section}>
        {view === 'shelf-list' && !searchResult && (
          <>
            <h2 className={styles.sectionTitle}>เลือก Shelf</h2>
            <p className={styles.sectionDesc}>
              เลือก Shelf เพื่อโหลดข้อมูลช่องภายใน (โหลดตามที่เลือก)
            </p>
          </>
        )}
        {view === 'shelf-detail' && selectedShelfId && !searchResult && (
          <>
            <button type="button" onClick={backToShelfList} className={styles.backToShelfList}>
              ← กลับไปรายการ Shelf
            </button>
            <h2 className={styles.sectionTitle}>Shelf {selectedShelfId}</h2>
            <p className={styles.sectionDesc}>
              คลิกช่องที่ต้องการเพื่อดูรายละเอียดสินค้า
            </p>
          </>
        )}

        <div className={styles.toolbarCard}>
          <div className={styles.filterRow}>
            {view === 'shelf-list' && (
              <>
                <span className={styles.muted} style={{ marginRight: '0.25rem' }}>กรอง Shelf:</span>
                <label>หมวด</label>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={styles.select} style={{ minWidth: 120 }}>
                  <option value="all">ทั้งหมด</option>
                  {CATEGORIES.filter((c) => c !== 'all').map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <label>สถานะ</label>
                <select value={shelfStatusFilter} onChange={(e) => setShelfStatusFilter(e.target.value as typeof shelfStatusFilter)} className={styles.select} style={{ minWidth: 140 }}>
                  <option value="all">ทั้งหมด</option>
                  <option value="vacant">ว่าง</option>
                  <option value="hasSpace">มีที่ว่าง</option>
                  <option value="full">เต็ม</option>
                </select>
                <span style={{ marginLeft: '1rem', color: 'var(--muted)' }}>|</span>
              </>
            )}
            <span className={styles.muted} style={{ marginRight: '0.25rem' }}>ค้นหา:</span>
            {view === 'shelf-list' && !searchResult ? (
              <>
                <input type="text" placeholder="Order ID, ชื่อ, Shelf หรือ หมวด" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runSearch()} className={styles.input} style={{ minWidth: 200 }} />
                <button type="button" onClick={runSearch} className={styles.btn}>Search</button>
              </>
            ) : (
              <>
                <select
                  value={view === 'shelf-detail' && searchMode === 'location' ? 'unified' : searchMode}
                  onChange={(e) => setSearchMode(e.target.value as 'unified' | 'location' | 'slotId')}
                  className={styles.select}
                  style={{ minWidth: 220 }}
                >
                  <option value="unified">ค้นหารวม (Order ID / ชื่อ / Shelf / หมวด)</option>
                  <option value="slotId">Slot ID (ตัวเลข)</option>
                  {view !== 'shelf-detail' && <option value="location">By Location (Shelf+Level+Slot)</option>}
                </select>
                {searchMode === 'slotId' ? (
                  <input type="number" placeholder="Slot ID" min={1} value={slotIdQuery} onChange={(e) => setSlotIdQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runSearch()} className={styles.input} style={{ minWidth: 120 }} />
                ) : searchMode === 'location' ? (
                  <>
                    <input type="text" placeholder="Shelf" value={locationShelf} onChange={(e) => setLocationShelf(e.target.value)} className={styles.input} style={{ maxWidth: 80 }} />
                    <input type="number" placeholder="Level" min={1} max={7} value={locationLevel} onChange={(e) => setLocationLevel(e.target.value)} className={styles.input} style={{ maxWidth: 70 }} />
                    <input type="number" placeholder="Slot" min={1} max={50} value={locationSlot} onChange={(e) => setLocationSlot(e.target.value)} className={styles.input} style={{ maxWidth: 70 }} />
                  </>
                ) : (
                  <input type="text" placeholder="Order ID, ชื่อ, Shelf หรือ หมวด" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runSearch()} className={styles.input} style={{ minWidth: 200 }} />
                )}
                <button type="button" onClick={runSearch} className={styles.btn}>Search</button>
                {view === 'shelf-detail' && selectedShelfId && (
                  <>
                    <span style={{ marginLeft: '0.5rem', color: 'var(--muted)' }}>|</span>
                    <span className={styles.muted} style={{ marginRight: '0.25rem' }}>ไปที่</span>
                    <input type="number" placeholder="Level" min={1} max={7} value={locationLevel} onChange={(e) => setLocationLevel(e.target.value)} className={styles.input} style={{ maxWidth: 70 }} />
                    <input type="number" placeholder="Slot" min={1} max={50} value={locationSlot} onChange={(e) => setLocationSlot(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runSearch()} className={styles.input} style={{ maxWidth: 70 }} />
                    <button type="button" onClick={() => { if (locationLevel.trim() && locationSlot.trim()) { setSearchError(null); getSlotByLocation(selectedShelfId, parseInt(locationLevel, 10), parseInt(locationSlot, 10)).then(setSearchResult).catch((e) => setSearchError(e.message)); } }} className={styles.btn}>ไปที่</button>
                  </>
                )}
              </>
            )}
            {displayShelves.length > 0 ? (
              <button type="button" onClick={exportMonitorCsv} className={styles.exportBtn}>Export CSV</button>
            ) : view === 'shelf-list' && filteredShelfList.length > 0 ? (
              <>
                <button type="button" onClick={exportShelfListCsv} className={styles.exportBtn}>Export CSV (สรุป)</button>
                <button type="button" onClick={exportFilteredSlotsDetailCsv} disabled={exportDetailLoading} className={styles.exportBtn} title="Export รายละเอียดช่องเฉพาะ Shelf ตามที่กรอง (ตามที่แสดง)">
                  {exportDetailLoading ? 'กำลังโหลด…' : 'Export CSV (รายละเอียดช่อง)'}
                </button>
              </>
            ) : null}
            {view !== 'shelf-list' && (
              <>
                <span style={{ marginLeft: '1rem', color: 'var(--muted)' }}>|</span>
                <label>หมวด:</label>
                {currentShelfCategory != null ? (
                  <span style={{ marginLeft: '0.25rem', fontWeight: 500 }}>{currentShelfCategory || '—'}</span>
                ) : (
                  <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={styles.select} style={{ minWidth: 120 }}>
                    <option value="all">ทั้งหมด</option>
                    {CATEGORIES.filter((c) => c !== 'all').map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </>
            )}
            {(view === 'shelf-detail' || searchResult) && (
              <>
                <span style={{ marginLeft: '0.5rem', color: 'var(--muted)' }}>|</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showOnlyEmpty} onChange={(e) => setShowOnlyEmpty(e.target.checked)} />
                  <span>เฉพาะช่องว่าง</span>
                </label>
              </>
            )}
          </div>
          {!(view === 'shelf-list' && !searchResult) && view !== 'shelf-detail' && (
            <p className={styles.muted} style={{ fontSize: '0.8rem', marginTop: '0.35rem', marginBottom: 0 }}>
              เลือกแบบค้นหา: <strong>ค้นหารวม</strong> = Order ID / ชื่อสินค้า / Shelf / หมวด · <strong>Slot ID</strong> = เลข ID ของช่อง · <strong>By Location</strong> = Shelf + Level (1–7) + Slot (1–50)
            </p>
          )}
          {(view === 'shelf-detail' || searchResult) && (
            <div className={styles.legend} role="status">
              <span className={styles.legendItem}><span className={styles.legendColorVacant} /> ว่าง</span>
              <span className={styles.legendItem}><span className={styles.legendColorPartial} /> ว่างบางส่วน</span>
              <span className={styles.legendItem}><span className={styles.legendColorFull} /> เต็ม</span>
            </div>
          )}
        </div>

        {searchError && <p className={styles.searchError}>{searchError}</p>}
        {loading && <p className={styles.muted}>Loading…</p>}
        {error && <p className={styles.error}>{error}</p>}

        {view === 'shelf-list' && !searchResult && !loading && !error && (
          <>
            {(categoryFilter !== 'all' || shelfStatusFilter !== 'all') && (
              <p className={styles.muted} style={{ marginBottom: '0.5rem' }}>
                แสดง {filteredShelfList.length} จาก {shelfList.length} shelf
              </p>
            )}
            <div className={styles.shelfListGrid}>
              {filteredShelfList.map((s) => {
                const total = s.totalSlots || 1;
                const ratio = s.occupiedSlots / total;
                const statusLabel = s.occupiedSlots === 0 ? 'ว่าง' : ratio >= 1 ? 'เต็ม' : ratio >= 0.8 ? 'เกือบเต็ม' : 'บางส่วน';
                const statusClass = s.occupiedSlots === 0 ? styles.shelfListCardVacant : ratio >= 1 ? styles.shelfListCardFull : ratio >= 0.8 ? styles.shelfListCardAlmostFull : styles.shelfListCardPartial;
                return (
                  <button
                    type="button"
                    key={s.shelfId}
                    className={`${styles.shelfListCard} ${statusClass}`}
                    onClick={() => goToShelfDetail(s.shelfId)}
                  >
                    <span className={styles.shelfListCardTitle}>Shelf {s.shelfId}</span>
                    <span className={styles.shelfListCardCategory}>หมวด {s.category || '—'}</span>
                    <span className={styles.shelfListCardBadge}>{statusLabel}</span>
                    <span className={styles.shelfListCardMeta}>{s.totalSlots} ช่อง · มีของ {s.occupiedSlots} ช่อง</span>
                  </button>
                );
              })}
              {filteredShelfList.length === 0 && <p className={styles.muted}>ไม่มี Shelf ตาม filter ที่เลือก</p>}
            </div>
          </>
        )}

        {(view === 'shelf-detail' || searchResult) && !loading && (
          <div className={styles.shelves}>
            {displayShelves.map((shelfId) => (
              <div key={shelfId} className={styles.shelfCard}>
                <h3 className={styles.shelfTitle}>Shelf {shelfId}</h3>
                <div className={styles.slotGrid}>
                  {getSlotsForShelf(shelfId).map((cell) => (
                    <div
                      key={`${cell.slotId}-${cell.level}-${cell.slot}`}
                      className={`${styles.slot} ${styles[cell.fillStatus === 'full' ? 'slotFull' : cell.fillStatus === 'partial' ? 'slotPartial' : 'slotVacant']}`}
                      title={`Slot ID: ${cell.slotId} • คลิกดูรายละเอียด`}
                      onClick={() => openSlotDetail(cell)}
                    >
                      <span className={styles.slotLabel}>L{cell.level} S{cell.slot} <span style={{ opacity: 0.7 }}>(ID: {cell.slotId})</span></span>
                      <span className={cell.orderIds.length ? styles.slotOrder : styles.slotEmpty}>
                        {cell.orderIds.length ? cell.orderIds.join(', ') : 'ว่าง'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {displayShelves.length === 0 && view === 'shelf-detail' && (
              <p className={styles.muted}>ไม่มี slot ใน Shelf นี้</p>
            )}
            {displayShelves.length === 0 && searchResult && (
              <p className={styles.muted}>ไม่พบ slot ตามที่ค้นหา</p>
            )}
          </div>
        )}

        {view === 'shelf-detail' && !loading && !error && displayShelves.length === 0 && slotStatusArray.length === 0 && selectedShelfId && (
          <p className={styles.muted}>ไม่มีข้อมูลใน Shelf นี้</p>
        )}
      </section>

      {(detailLoading || detailSlot) && (
        <div className={styles.modalOverlay} onClick={() => !detailLoading && setDetailSlot(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.modalClose} onClick={() => setDetailSlot(null)} aria-label="ปิด">×</button>
            {detailLoading && <p className={styles.muted}>Loading…</p>}
            {detailSlot && !detailLoading && (
              <>
                <h3 className={styles.modalTitle}>{detailSlot.locationLabel}</h3>
                {detailSlot.orders.length === 0 ? (
                  <p className={styles.muted}>ไม่มีออเดอร์ในช่องนี้</p>
                ) : (
                  <>
                    <table className={styles.detailTable}>
                      <thead>
                        <tr>
                          <th>Order ID</th>
                          <th>ชื่อสินค้า</th>
                          <th>หมวด</th>
                          <th>จำนวน</th>
                          <th>ความสูง (cm)</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailSlot.orders.map((o) => (
                          <tr key={o.orderId}>
                            <td>{o.orderId}</td>
                            <td>{o.productName?.trim() ? o.productName : o.orderId}</td>
                            <td>{o.category}</td>
                            <td>{o.quantity ?? 1}</td>
                            <td>{o.heightCm != null ? o.heightCm : '—'}</td>
                            <td>
                              <button
                                type="button"
                                className={styles.unreserveBtn}
                                disabled={unreservingId === o.orderId}
                                onClick={async () => {
                                  setUnreservingId(o.orderId);
                                  try {
                                    await unreserveOrder(o.orderId);
                                    refetchSlotStatus();
                                    const updated = await getSlotDetails(detailSlot.slotId);
                                    if (updated.orders.length === 0) setDetailSlot(null);
                                    else setDetailSlot(updated);
                                  } finally {
                                    setUnreservingId(null);
                                  }
                                }}
                              >
                                {unreservingId === o.orderId ? '…' : 'เอาออก'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className={styles.muted} style={{ marginTop: '0.75rem', fontWeight: 600 }}>
                      ยอดรวม: {detailSlot.orders.reduce((sum, o) => sum + (o.quantity ?? 1), 0)} ชิ้น
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
