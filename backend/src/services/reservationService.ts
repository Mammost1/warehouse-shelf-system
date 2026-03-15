import pool from '../config/database';
import type { ReserveSlotBody, OrderLocationResponse, SlotContentsResponse } from '../types';

export async function reserveSlot(body: ReserveSlotBody): Promise<{ slotId: number; shelf: string; level: number; slot: number }> {
  const { orderId, category, heightCm, productName, quantity } = body;
  const orderHeight = heightCm != null ? Number(heightCm) : 0;

  const [existingOrder] = await pool.query<{ id: string }[]>(
    'SELECT id FROM orders WHERE id = ?',
    [orderId]
  );
  const orderExists = Array.isArray(existingOrder) && existingOrder.length > 0;

  if (!orderExists) {
    const productNameVal = (productName != null && String(productName).trim()) ? String(productName).trim() : null;
    const quantityVal = quantity != null && Number(quantity) >= 1 ? Number(quantity) : 1;
    try {
      await pool.query(
        'INSERT INTO orders (id, category, height_cm, product_name, quantity) VALUES (?, ?, ?, ?, ?)',
        [orderId, category, heightCm ?? null, productNameVal, quantityVal]
      );
    } catch (e: any) {
      if (e?.code === 'ER_BAD_FIELD_ERROR') {
        await pool.query(
          'INSERT INTO orders (id, category, height_cm) VALUES (?, ?, ?)',
          [orderId, category, heightCm ?? null]
        );
      } else {
        throw e;
      }
    }
  }

  const [existingRes] = await pool.query<{ slot_id: number }[]>(
    'SELECT slot_id FROM reservations WHERE order_id = ?',
    [orderId]
  );
  if (Array.isArray(existingRes) && existingRes.length > 0) {
    const slotId = (existingRes[0] as { slot_id: number }).slot_id;
    const [loc] = await pool.query(
      'SELECT * FROM slot_locations WHERE slot_id = ?',
      [slotId]
    );
    const row = (loc as any[])[0];
    const err = new Error('รหัสออเดอร์นี้มีในระบบแล้ว (ถูกจองไว้แล้ว)') as Error & { code: string; alreadyAt: { shelf: string; level: number; slot: number; locationLabel: string } };
    err.code = 'ORDER_ALREADY_RESERVED';
    err.alreadyAt = {
      shelf: row.shelf_id,
      level: row.level_num,
      slot: row.slot_num,
      locationLabel: row.location_label ?? `Shelf: ${row.shelf_id} | Level: ${row.level_num} | Slot: ${row.slot_num}`,
    };
    throw err;
  }

  // โจทย์ PDF: Shoes สูง >= 16 cm ใช้ A-B, สูง < 16 cm ใช้ C-D; ประเภทอื่นไม่กรองความสูง
  const [shelves] = await pool.query<any[]>(
    `SELECT id, slot_height_cm FROM shelves WHERE category = ?
     AND (min_box_height_cm IS NULL OR ? >= min_box_height_cm)
     AND (max_box_height_cm IS NULL OR ? < max_box_height_cm)
     ORDER BY id ASC`,
    [category, orderHeight, orderHeight]
  );
  if (!Array.isArray(shelves) || shelves.length === 0) {
    throw new Error(`No shelf found for category: ${category}`);
  }

  for (const sh of shelves) {
    const slotHeightCm = Number(sh.slot_height_cm) || 48;
    const [levels] = await pool.query<any[]>(
      `SELECT l.id, l.level_num FROM levels l WHERE l.shelf_id = ? ORDER BY l.level_num ASC`,
      [sh.id]
    );
    if (!Array.isArray(levels)) continue;

    for (const lv of levels) {
      const [slotsWithUsed] = await pool.query<any[]>(
        `SELECT s.id, s.slot_num, COALESCE(SUM(o.height_cm), 0) AS used_cm
         FROM slots s
         LEFT JOIN reservations r ON r.slot_id = s.id
         LEFT JOIN orders o ON o.id = r.order_id
         WHERE s.level_id = ?
         GROUP BY s.id, s.slot_num
         ORDER BY s.slot_num ASC`,
        [lv.id]
      );
      if (!Array.isArray(slotsWithUsed)) continue;

      for (const row of slotsWithUsed) {
        const used = Number(row.used_cm) || 0;
        if (used + orderHeight <= slotHeightCm) {
          const slotId = row.id;
          await pool.query(
            'INSERT INTO reservations (order_id, slot_id) VALUES (?, ?)',
            [orderId, slotId]
          );
          const [loc] = await pool.query(
            'SELECT * FROM slot_locations WHERE slot_id = ?',
            [slotId]
          );
          const locRow = (loc as any[])[0];
          const locationLabel = locRow?.location_label ?? `Shelf: ${locRow?.shelf_id} | Level: ${locRow?.level_num} | Slot: ${locRow?.slot_num}`;
          await logReservationHistory('reserve', orderId, slotId, locationLabel);
          return { slotId: locRow.slot_id, shelf: locRow.shelf_id, level: locRow.level_num, slot: locRow.slot_num };
        }
      }
    }
  }

  throw new Error(`No available slot for category: ${category}`);
}

export async function getOrderLocation(orderId: string): Promise<OrderLocationResponse | null> {
  const [rows] = await pool.query<any[]>(
    `SELECT r.order_id, sl.slot_id, sl.shelf_id, sl.level_num, sl.slot_num, sl.location_label
     FROM reservations r
     JOIN slot_locations sl ON sl.slot_id = r.slot_id
     WHERE r.order_id = ?`,
    [orderId]
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const r = rows[0];
  return {
    orderId: r.order_id,
    location: {
      shelf: r.shelf_id,
      level: r.level_num,
      slot: r.slot_num,
      slotId: r.slot_id,
      locationLabel: r.location_label,
    },
  };
}

export async function getSlotContents(slotId: number): Promise<SlotContentsResponse | null> {
  const [rows] = await pool.query<any[]>(
    `SELECT sl.slot_id, sl.shelf_id, sl.level_num, sl.slot_num, sl.location_label, r.order_id
     FROM slot_locations sl
     LEFT JOIN reservations r ON r.slot_id = sl.slot_id
     WHERE sl.slot_id = ?`,
    [slotId]
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const r = rows[0];
  const orderIds = rows.map((x) => x.order_id).filter(Boolean);
  return {
    slotId: r.slot_id,
    shelf: r.shelf_id,
    level: r.level_num,
    slot: r.slot_num,
    locationLabel: r.location_label,
    orderId: orderIds.length > 0 ? orderIds.join(', ') : null,
  };
}

export async function getSlotByLocation(shelf: string, level?: number, slotNum?: number): Promise<SlotContentsResponse | null> {
  const sh = shelf?.trim()?.toUpperCase();
  if (!sh) return null;
  if (level != null && slotNum != null) {
    const [rows] = await pool.query<any[]>(
      `SELECT slot_id FROM slot_locations WHERE shelf_id = ? AND level_num = ? AND slot_num = ?`,
      [sh, level, slotNum]
    );
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return getSlotContents(rows[0].slot_id);
  }
  return null;
}

/** ค้นแบบไม่เจาะจง: ใส่เฉพาะ Shelf หรือ Shelf+Level ได้ — ใช้ LIKE แบบมีตัวอักษรอยู่ตรงไหนก็ได้ เช่น ใส่ a เจอ A, AA, LBA */
export async function getReservationsByLocation(shelf: string, level?: number, slotNum?: number): Promise<(SlotContentsResponse & { category?: string })[]> {
  const sh = shelf?.trim()?.toUpperCase();
  if (!sh) return [];
  let sql = `SELECT sl.slot_id, sl.shelf_id, sl.level_num, sl.slot_num, sl.location_label, r.order_id, o.category
     FROM slot_locations sl
     INNER JOIN reservations r ON r.slot_id = sl.slot_id
     INNER JOIN orders o ON o.id = r.order_id
     WHERE sl.shelf_id LIKE CONCAT('%', ?, '%')`;
  const params: (string | number)[] = [sh];
  if (level != null && !isNaN(level)) {
    sql += ` AND sl.level_num = ?`;
    params.push(level);
  }
  if (slotNum != null && !isNaN(slotNum)) {
    sql += ` AND sl.slot_num = ?`;
    params.push(slotNum);
  }
  sql += ` ORDER BY sl.shelf_id, sl.level_num, sl.slot_num`;
  const [rows] = await pool.query<any[]>(sql, params);
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    slotId: r.slot_id,
    shelf: r.shelf_id,
    level: r.level_num,
    slot: r.slot_num,
    locationLabel: r.location_label,
    orderId: r.order_id ?? null,
    category: r.category ?? undefined,
  }));
}

export interface SlotOrderDetail {
  orderId: string;
  category: string;
  heightCm: number | null;
  productName: string | null;
  quantity: number;
  locationLabel: string;
}

export async function getSlotDetails(slotId: number): Promise<{ slotId: number; shelf: string; level: number; slot: number; locationLabel: string; orders: SlotOrderDetail[] } | null> {
  const [locRows] = await pool.query<any[]>(
    `SELECT slot_id, shelf_id, level_num, slot_num, location_label FROM slot_locations WHERE slot_id = ?`,
    [slotId]
  );
  if (!Array.isArray(locRows) || locRows.length === 0) return null;
  const loc = locRows[0];
  const locationLabel = loc.location_label ?? `Shelf: ${loc.shelf_id} | Level: ${loc.level_num} | Slot: ${loc.slot_num}`;
  let orderRows: any[] = [];
  try {
    const [r] = await pool.query<any[]>(
      `SELECT r.order_id, o.category, o.height_cm, o.product_name, COALESCE(o.quantity, 1) AS quantity
       FROM reservations r JOIN orders o ON o.id = r.order_id WHERE r.slot_id = ?`,
      [slotId]
    );
    orderRows = Array.isArray(r) ? r : [];
  } catch {
    const [r] = await pool.query<any[]>(
      `SELECT r.order_id, o.category, o.height_cm
       FROM reservations r JOIN orders o ON o.id = r.order_id WHERE r.slot_id = ?`,
      [slotId]
    );
    orderRows = (Array.isArray(r) ? r : []).map((row) => ({ ...row, product_name: null, quantity: 1 }));
  }
  const orders: SlotOrderDetail[] = orderRows.map((row) => ({
    orderId: row.order_id,
    category: row.category ?? '',
    heightCm: row.height_cm != null ? Number(row.height_cm) : null,
    productName: row.product_name ?? null,
    quantity: row.quantity != null ? Number(row.quantity) : 1,
    locationLabel,
  }));
  return {
    slotId: loc.slot_id,
    shelf: loc.shelf_id,
    level: loc.level_num,
    slot: loc.slot_num,
    locationLabel,
    orders,
  };
}

export async function getAllReservations(): Promise<(SlotContentsResponse & { category?: string })[]> {
  const [rows] = await pool.query<any[]>(
    `SELECT sl.slot_id, sl.shelf_id, sl.level_num, sl.slot_num, sl.location_label, r.order_id, o.category
     FROM slot_locations sl
     INNER JOIN reservations r ON r.slot_id = sl.slot_id
     INNER JOIN orders o ON o.id = r.order_id
     ORDER BY sl.shelf_id, sl.level_num, sl.slot_num`
  );
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    slotId: r.slot_id,
    shelf: r.shelf_id,
    level: r.level_num,
    slot: r.slot_num,
    locationLabel: r.location_label,
    orderId: r.order_id ?? null,
    category: r.category ?? undefined,
  }));
}

const SLOT_STATUS_SELECT = `
  SELECT sl.slot_id, sl.shelf_id, sl.level_num, sl.slot_num, sl.location_label,
    COALESCE(sh.slot_height_cm, 48) AS slot_height_cm,
    (SELECT GROUP_CONCAT(r.order_id) FROM reservations r WHERE r.slot_id = sl.slot_id) AS order_ids,
    (SELECT o.category FROM reservations r JOIN orders o ON o.id = r.order_id WHERE r.slot_id = sl.slot_id LIMIT 1) AS category,
    (SELECT COALESCE(SUM(o.height_cm), 0) FROM reservations r JOIN orders o ON o.id = r.order_id WHERE r.slot_id = sl.slot_id) AS used_height_cm
  FROM slot_locations sl
  JOIN shelves sh ON sh.id = sl.shelf_id
`;

function mapSlotStatusRows(rows: any[]): Array<{
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
}> {
  return (Array.isArray(rows) ? rows : []).map((r) => {
    const orderIds = (r.order_ids && String(r.order_ids)) ? String(r.order_ids).split(',').map((x: string) => x.trim()).filter(Boolean) : [];
    const slotHeightCm = Number(r.slot_height_cm) || 48;
    const usedHeightCm = Number(r.used_height_cm) || 0;
    return {
      slotId: r.slot_id,
      shelf: r.shelf_id,
      level: r.level_num,
      slot: r.slot_num,
      locationLabel: r.location_label ?? '',
      occupied: orderIds.length > 0,
      orderIds,
      category: r.category ?? undefined,
      slotHeightCm,
      usedHeightCm,
    };
  });
}

/** สรุปแต่ละ shelf: หมวด + จำนวนช่องทั้งหมด + มีของกี่ช่อง (โหลดเบา สำหรับหน้าเลือก shelf) */
export async function getShelvesSummary(): Promise<Array<{ shelfId: string; category: string; totalSlots: number; occupiedSlots: number }>> {
  const [rows] = await pool.query<any[]>(
    `SELECT sl.shelf_id AS shelfId,
       sh.category AS category,
       COUNT(DISTINCT sl.slot_id) AS totalSlots,
       COUNT(DISTINCT CASE WHEN r.order_id IS NOT NULL THEN sl.slot_id END) AS occupiedSlots
     FROM slot_locations sl
     JOIN shelves sh ON sh.id = sl.shelf_id
     LEFT JOIN reservations r ON r.slot_id = sl.slot_id
     GROUP BY sl.shelf_id, sh.category
     ORDER BY sl.shelf_id ASC`
  );
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    shelfId: r.shelfId ?? r.shelf_id,
    category: (r.category ?? r.Category ?? '').trim(),
    totalSlots: Number(r.totalSlots) || 0,
    occupiedSlots: Number(r.occupiedSlots) || 0,
  }));
}

/** ทุก slot พร้อมสถานะ — รองรับ shelfId (โหลดเฉพาะ shelf), หรือ shelfLimit/shelfOffset */
export async function getSlotStatus(options: { shelfId?: string; shelfLimit?: number; shelfOffset?: number } = {}): Promise<{ slots: Array<{
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
}>; totalShelves: number }> {
  const shelfId = options.shelfId?.trim();
  const shelfLimit = options.shelfLimit != null ? Math.max(0, options.shelfLimit) : undefined;
  const shelfOffset = options.shelfOffset != null ? Math.max(0, options.shelfOffset) : undefined;

  const [totalRows] = await pool.query<any[]>(`SELECT COUNT(DISTINCT sh.id) AS n FROM shelves sh`);
  const totalShelves = Array.isArray(totalRows) && totalRows[0] ? Number(totalRows[0].n) : 0;

  if (shelfId) {
    const [rows] = await pool.query<any[]>(
      `${SLOT_STATUS_SELECT} WHERE sl.shelf_id = ? ORDER BY sl.level_num, sl.slot_num`,
      [shelfId]
    );
    return { slots: mapSlotStatusRows(rows as any[]), totalShelves };
  }

  if (shelfLimit != null && shelfOffset != null) {
    const [shelfIdsRows] = await pool.query<any[]>(
      `SELECT id FROM shelves ORDER BY id ASC LIMIT ? OFFSET ?`,
      [shelfLimit, shelfOffset]
    );
    const shelfIds = (Array.isArray(shelfIdsRows) ? shelfIdsRows : []).map((r) => r.id);
    if (shelfIds.length === 0) {
      return { slots: [], totalShelves };
    }
    const placeholders = shelfIds.map(() => '?').join(',');
    const [rows] = await pool.query<any[]>(
      `${SLOT_STATUS_SELECT} WHERE sl.shelf_id IN (${placeholders}) ORDER BY sl.shelf_id, sl.level_num, sl.slot_num`,
      shelfIds
    );
    return { slots: mapSlotStatusRows(rows as any[]), totalShelves };
  }

  const [rows] = await pool.query<any[]>(
    `${SLOT_STATUS_SELECT} ORDER BY sl.shelf_id, sl.level_num, sl.slot_num`
  );
  return { slots: mapSlotStatusRows(rows as any[]), totalShelves };
}

/** บันทึกประวัติการจอง/ยกเลิก (reservation_history) — ถ้าตารางไม่มีจะข้าม ไม่ throw */
async function logReservationHistory(
  action: 'reserve' | 'unreserve',
  orderId: string,
  slotId: number | null,
  locationLabel: string | null
): Promise<void> {
  try {
    await pool.query(
      'INSERT INTO reservation_history (action, order_id, slot_id, location_label) VALUES (?, ?, ?, ?)',
      [action, orderId, slotId, locationLabel]
    );
  } catch (err: any) {
    if (err?.code === 'ER_NO_SUCH_TABLE' || (err?.message && String(err.message).includes("doesn't exist"))) {
      return; // ตารางยังไม่มี — ข้าม ไม่ให้แอปล้ม
    }
    throw err;
  }
}

/** ยกเลิกการจอง — เอารายการออกจากช่อง (บันทึกประวัติก่อน) */
export async function unreserveOrder(orderId: string): Promise<{ orderId: string; locationLabel: string | null }> {
  const [resRows] = await pool.query<any[]>(
    'SELECT r.slot_id, sl.location_label FROM reservations r LEFT JOIN slot_locations sl ON sl.slot_id = r.slot_id WHERE r.order_id = ?',
    [orderId]
  );
  if (!Array.isArray(resRows) || resRows.length === 0) {
    throw new Error(`Order ${orderId} ไม่มีการจองอยู่`);
  }
  const slotId = resRows[0].slot_id;
  const locationLabel = resRows[0].location_label ?? null;
  await pool.query('DELETE FROM reservations WHERE order_id = ?', [orderId]);
  await logReservationHistory('unreserve', orderId, slotId, locationLabel);
  return { orderId, locationLabel };
}

/** อ่านประวัติการจอง/ยกเลิก — รองรับ filter หมวด, ช่วงวันที่; คืนชื่อสินค้า (product_name) จาก orders */
export async function getReservationHistory(options: { limit?: number; offset?: number; action?: 'reserve' | 'unreserve'; category?: string; dateFrom?: string; dateTo?: string } = {}): Promise<{ list: Array<{
  id: number;
  action: string;
  orderId: string;
  slotId: number | null;
  locationLabel: string | null;
  createdAt: Date;
  category?: string;
  productName?: string | null;
}>; total: number }> {
  try {
    const limit = Math.min(Math.max(0, options.limit ?? 100), 500);
    const offset = Math.max(0, options.offset ?? 0);
    const category = (options.category ?? '').trim() || undefined;
    const dateFrom = (options.dateFrom ?? '').trim() || undefined;
    const dateTo = (options.dateTo ?? '').trim() || undefined;

    const fromJoin = 'FROM reservation_history h LEFT JOIN orders o ON o.id = h.order_id';
    const whereAction = options.action ? ' AND h.action = ?' : '';
    const whereCategory = category ? ' AND o.category = ?' : '';
    const whereDateFrom = dateFrom ? ' AND h.created_at >= ?' : '';
    const whereDateTo = dateTo ? ' AND h.created_at <= ?' : '';
    const countParams: (string | number)[] = [];
    if (options.action) countParams.push(options.action);
    if (category) countParams.push(category);
    if (dateFrom) countParams.push(dateFrom + ' 00:00:00');
    if (dateTo) countParams.push(dateTo + ' 23:59:59');

    let countSql = `SELECT COUNT(*) AS total ${fromJoin} WHERE 1=1${whereAction}${whereCategory}${whereDateFrom}${whereDateTo}`;
    const [countRows] = await pool.query<any[]>(countSql, countParams);
    const total = Array.isArray(countRows) && countRows[0] ? Number(countRows[0].total) : 0;

    const selectFieldsWithName = 'h.id, h.action, h.order_id AS orderId, h.slot_id AS slotId, h.location_label AS locationLabel, h.created_at AS createdAt, o.category AS category, o.product_name AS productName';
    const selectFieldsWithoutName = 'h.id, h.action, h.order_id AS orderId, h.slot_id AS slotId, h.location_label AS locationLabel, h.created_at AS createdAt, o.category AS category';
    const params: (string | number)[] = [...countParams, limit, offset];
    let rows: any[] = [];
    try {
      const [r] = await pool.query<any[]>(`SELECT ${selectFieldsWithName} ${fromJoin} WHERE 1=1${whereAction}${whereCategory}${whereDateFrom}${whereDateTo} ORDER BY h.created_at DESC LIMIT ? OFFSET ?`, params);
      rows = Array.isArray(r) ? r : [];
    } catch (e: any) {
      if (e?.code === 'ER_BAD_FIELD_ERROR' && e?.message?.includes('product_name')) {
        const [r] = await pool.query<any[]>(`SELECT ${selectFieldsWithoutName} ${fromJoin} WHERE 1=1${whereAction}${whereCategory}${whereDateFrom}${whereDateTo} ORDER BY h.created_at DESC LIMIT ? OFFSET ?`, params);
        rows = Array.isArray(r) ? r : [];
      } else {
        throw e;
      }
    }
    const list = rows.map((r: any) => ({
      id: r.id,
      action: r.action,
      orderId: r.orderId ?? r.order_id,
      slotId: r.slotId ?? r.slot_id ?? null,
      locationLabel: r.locationLabel ?? r.location_label ?? null,
      createdAt: r.createdAt ?? r.created_at,
      ...(r.category != null && { category: r.category }),
      ...(r.productName !== undefined && { productName: r.productName ?? null }),
    }));
    return { list, total };
  } catch (err: any) {
    if (err?.code === 'ER_NO_SUCH_TABLE' || (err?.message && String(err.message).includes("doesn't exist"))) {
      return { list: [], total: 0 };
    }
    throw err;
  }
}

/** ค้นหารวม: Order ID, ชื่อสินค้า (product_name), Shelf หรือหมวด (category) — ใส่คำเดียว */
export async function searchReservations(q: string): Promise<(SlotContentsResponse & { category?: string })[]> {
  const term = (q ?? '').trim();
  if (!term) return [];
  const likeArg = `%${term.replace(/%/g, '\\%')}%`;
  const baseSelect = `SELECT sl.slot_id, sl.shelf_id, sl.level_num, sl.slot_num, sl.location_label, r.order_id, o.category
     FROM slot_locations sl INNER JOIN reservations r ON r.slot_id = sl.slot_id INNER JOIN orders o ON o.id = r.order_id`;
  let rows: any[] = [];
  try {
    const [r] = await pool.query<any[]>(
      `${baseSelect} WHERE o.id LIKE ? OR sl.shelf_id LIKE ? OR (o.product_name IS NOT NULL AND o.product_name LIKE ?) OR o.category LIKE ? ORDER BY sl.shelf_id, sl.level_num, sl.slot_num`,
      [likeArg, likeArg, likeArg, likeArg]
    );
    rows = Array.isArray(r) ? r : [];
  } catch {
    const [r] = await pool.query<any[]>(
      `${baseSelect} WHERE o.id LIKE ? OR sl.shelf_id LIKE ? OR o.category LIKE ? ORDER BY sl.shelf_id, sl.level_num, sl.slot_num`,
      [likeArg, likeArg, likeArg]
    );
    rows = Array.isArray(r) ? r : [];
  }
  return rows.map((r) => ({
    slotId: r.slot_id,
    shelf: r.shelf_id,
    level: r.level_num,
    slot: r.slot_num,
    locationLabel: r.location_label,
    orderId: r.order_id ?? null,
    category: r.category ?? undefined,
  }));
}
