/**
 * นำเข้าออเดอร์จากไฟล์ Excel (ORDERS-10000-DATASET.xlsx) ลง DB
 * และจอง slot ให้แต่ละออเดอร์อัตโนมัติ
 *
 * ใช้: npm run import-orders [path/to/file.xlsx]
 */

// โหลด .env ก่อนทุกอย่าง เพื่อให้ process.env.DB_PASSWORD พร้อมก่อนเชื่อม DB
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

import * as path from 'path';
import * as fs from 'fs';
import * as X from 'xlsx';

const KNOWN_CATEGORIES: Record<string, string> = {
  shoes: 'Shoes',
  apparel: 'Apparel',
  bags: 'Bags',
  collectibles: 'Collectibles',
  collectible: 'Collectibles', // Excel บางแถวใช้ singular
};

function normalizeCategory(value: unknown): string {
  if (value == null || value === '') return 'Apparel';
  let s = String(value).trim().toLowerCase();
  const lastWord = s.split(/\s+/).pop() || s;
  if (KNOWN_CATEGORIES[lastWord]) return KNOWN_CATEGORIES[lastWord];
  if (KNOWN_CATEGORIES[s]) return KNOWN_CATEGORIES[s];
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getOrderId(value: unknown): string | null {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

async function main() {
  const filePath =
    process.argv[2] ||
    path.join(process.env.USERPROFILE || '', 'Downloads', 'ORDERS-10000-DATASET.xlsx');

  if (!fs.existsSync(filePath)) {
    console.error('ไม่พบไฟล์:', filePath);
    console.error('ใช้: npm run import-orders -- <path-to-xlsx>');
    process.exit(1);
  }

  console.log('กำลังอ่านไฟล์:', filePath);
  const workbook = X.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = X.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

  if (!rows.length) {
    console.error('ไฟล์ไม่มีข้อมูล');
    process.exit(1);
  }

  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i] as string[];
    if (row.some((c) => /order\s*id/i.test(String(c)))) {
      headerRowIndex = i;
      break;
    }
  }
  const header = rows[headerRowIndex] as string[];
  const orderIdCol = header.findIndex((h) => /order\s*id/i.test(String(h)));
  const categoryCol = header.findIndex((h) => /category|quantity|type|ประเภท/i.test(String(h)));
  const heightCol = header.findIndex((h) => /height|box/i.test(String(h)));
  const nameColExact = header.findIndex((h) => /^product\s+name$/i.test(String(h).trim()));
  const nameCol = nameColExact >= 0 ? nameColExact : header.findIndex((h) => /name|product|ชื่อ/i.test(String(h)) && !/order\s*id/i.test(String(h)));

  if (orderIdCol < 0) {
    console.error('ไม่พบคอลัมน์ Order ID ในไฟล์. หัวตาราง:', header);
    process.exit(1);
  }
  const categoryColOk = categoryCol >= 0;
  if (!categoryColOk) {
    console.warn('ไม่พบคอลัมน์ Category จะใช้ Apparel เป็นค่าเริ่มต้น');
  }
  if (nameCol >= 0) {
    console.log('ใช้คอลัมน์ชื่อสินค้า:', header[nameCol]);
  }

  const dataRows = rows.slice(headerRowIndex + 1) as unknown[][];
  let ok = 0;
  let skip = 0;
  let err = 0;

  console.log(`พบ ${dataRows.length} แถว กำลังนำเข้าและจอง slot...`);

  const { reserveSlot } = await import('../services/reservationService');

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const orderId = getOrderId(row[orderIdCol]);
    if (!orderId) {
      skip++;
      continue;
    }
    const category = categoryColOk ? normalizeCategory(row[categoryCol]) : 'Apparel';
    const heightCm = getNumber(heightCol >= 0 ? row[heightCol] : null);
    const productName = nameCol >= 0 && row[nameCol] != null && String(row[nameCol]).trim() ? String(row[nameCol]).trim() : undefined;

    try {
      await reserveSlot({ orderId, category, heightCm: heightCm ?? undefined, productName });
      ok++;
      if ((i + 1) % 500 === 0) console.log(`  ... ${i + 1}/${dataRows.length}`);
    } catch (e: unknown) {
      err++;
      const msg = e instanceof Error ? e.message : String(e);
      if (err <= 5) console.error(`  แถว ${i + 2} (${orderId}):`, msg);
    }
  }

  console.log('');
  console.log('เสร็จสิ้น:', { นำเข้าสำเร็จ: ok, ข้าม: skip, ผิดพลาด: err });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
