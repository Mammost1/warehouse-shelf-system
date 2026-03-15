const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export interface SlotContents {
  slotId: number;
  shelf: string;
  level: number;
  slot: number;
  locationLabel: string;
  orderId: string | null;
  category?: string;
}

export interface SlotOrderDetail {
  orderId: string;
  category: string;
  heightCm: number | null;
  productName?: string | null;
  quantity?: number;
  locationLabel?: string;
}

export interface SlotDetails {
  slotId: number;
  shelf: string;
  level: number;
  slot: number;
  locationLabel: string;
  orders: SlotOrderDetail[];
}

export interface OrderLocation {
  orderId: string;
  location: {
    shelf: string;
    level: number;
    slot: number;
    slotId: number;
    locationLabel: string;
  } | null;
}

export async function reserveSlot(body: {
  orderId: string;
  category: string;
  heightCm?: number;
  productName?: string | null;
  quantity?: number;
}): Promise<{ location: { shelf: string; level: number; slot: number; slotId: number; locationLabel: string } }> {
  const res = await fetch(`${API_BASE}/reserve-slot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data.error || res.statusText;
    if (res.status === 409 && data.alreadyAt) {
      const e = new Error(msg) as Error & { alreadyAt?: { locationLabel: string } };
      e.alreadyAt = data.alreadyAt;
      throw e;
    }
    throw new Error(msg);
  }
  return res.json();
}

export async function getOrderLocation(orderId: string): Promise<OrderLocation> {
  const res = await fetch(`${API_BASE}/order/${encodeURIComponent(orderId)}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error('Order not found');
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export async function getSlotContents(slotId: number): Promise<SlotContents> {
  const res = await fetch(`${API_BASE}/slot/${slotId}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error('Slot not found');
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

/** ค้นตามตำแหน่ง: ใส่เฉพาะ Shelf ก็ได้ หรือ Shelf+Level หรือครบทั้ง 3 — จะได้ slot เดียวหรือรายการหลาย slot */
export async function getSlotByLocation(
  shelf: string,
  level?: number,
  slot?: number
): Promise<SlotContents | { results: SlotContents[] }> {
  const params = new URLSearchParams({ shelf });
  if (level != null && !isNaN(level)) params.set('level', String(level));
  if (slot != null && !isNaN(slot)) params.set('slot', String(slot));
  const res = await fetch(`${API_BASE}/slot-by-location?${params}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error('Slot not found at this location');
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export async function getSlotDetails(slotId: number): Promise<SlotDetails> {
  const res = await fetch(`${API_BASE}/slot/${slotId}/details`);
  if (!res.ok) {
    if (res.status === 404) throw new Error('Slot not found');
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export async function getAllReservations(): Promise<SlotContents[]> {
  const res = await fetch(`${API_BASE}/reservations`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err && typeof err.error === 'string') ? err.error : res.statusText;
    throw new Error(msg || 'Failed to load reservations');
  }
  const data = await res.json();
  return data.reservations || [];
}

/** ค้นหารวม: Order ID, ชื่อสินค้า หรือ Shelf — ช่องเดียว */
export async function searchReservations(q: string): Promise<SlotContents[]> {
  const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  const data = await res.json();
  return data.results || [];
}

export interface SlotStatusItem {
  slotId: number;
  shelf: string;
  level: number;
  slot: number;
  locationLabel: string;
  occupied: boolean;
  orderIds: string[];
  category?: string;
  slotHeightCm: number;
  usedHeightCm: number;
}

/** Slot status — ส่ง shelfId = โหลดเฉพาะ shelf นั้น; shelfLimit/shelfOffset = โหลดทีละกลุ่ม; ไม่ส่ง = โหลดทั้งหมด */
export async function getSlotStatus(params?: { shelfId?: string; shelfLimit?: number; shelfOffset?: number }): Promise<{ slots: SlotStatusItem[]; totalShelves: number }> {
  const sp = new URLSearchParams();
  if (params?.shelfId) sp.set('shelfId', params.shelfId);
  if (params?.shelfLimit != null) sp.set('shelfLimit', String(params.shelfLimit));
  if (params?.shelfOffset != null) sp.set('shelfOffset', String(params.shelfOffset));
  const url = sp.toString() ? `${API_BASE}/slot-status?${sp}` : `${API_BASE}/slot-status`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  const data = await res.json();
  return { slots: data.slots || [], totalShelves: data.totalShelves ?? 0 };
}

export interface ShelfSummary {
  shelfId: string;
  category: string;
  totalSlots: number;
  occupiedSlots: number;
}

/** สรุปแต่ละ shelf: จำนวนช่องทั้งหมด + มีของกี่ช่อง (โหลดเบา สำหรับหน้าเลือก shelf) */
export async function getShelvesSummary(): Promise<ShelfSummary[]> {
  const res = await fetch(`${API_BASE}/shelves-summary`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  const data = await res.json();
  return data.shelves || [];
}

/** ยกเลิกการจอง — เอารายการออกจากช่อง */
export async function unreserveOrder(orderId: string): Promise<{ orderId: string; locationLabel: string | null }> {
  const res = await fetch(`${API_BASE}/unreserve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 404) throw new Error(err.error || 'ไม่พบการจอง');
    throw new Error(err.error || res.statusText);
  }
  const data = await res.json();
  return { orderId: data.orderId, locationLabel: data.locationLabel ?? null };
}

export interface HistoryItem {
  id: number;
  action: string;
  orderId: string;
  slotId: number | null;
  locationLabel: string | null;
  createdAt: string;
  category?: string;
  productName?: string | null;
}

/** ประวัติการเพิ่ม/ลบรายการในคลัง — รองรับ filter หมวด, ช่วงวันที่ */
export async function getReservationHistory(params?: { limit?: number; offset?: number; action?: 'reserve' | 'unreserve'; category?: string; dateFrom?: string; dateTo?: string }): Promise<{ list: HistoryItem[]; total: number }> {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.offset != null) sp.set('offset', String(params.offset));
  if (params?.action) sp.set('action', params.action);
  if (params?.category) sp.set('category', params.category);
  if (params?.dateFrom) sp.set('dateFrom', params.dateFrom);
  if (params?.dateTo) sp.set('dateTo', params.dateTo);
  const res = await fetch(`${API_BASE}/history?${sp}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  const data = await res.json();
  return { list: data.history || [], total: data.total ?? 0 };
}
