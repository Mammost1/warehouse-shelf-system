/**
 * อัปเดตชื่อสินค้า (product_name) ในตาราง orders จากไฟล์ Excel
 * ใช้เมื่อนำเข้าไปแล้วแต่ชื่อไม่ขึ้น (product_name เป็น NULL)
 * ใช้: npm run update-product-names -- <path-to-xlsx>
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

import * as path from 'path';
import * as fs from 'fs';
import * as X from 'xlsx';
import pool from '../config/database';

function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i] as string[];
    const hasOrderId = row.some((c) => /order\s*id/i.test(String(c)));
    if (hasOrderId) return i;
  }
  return 0;
}

function findProductNameCol(header: string[]): number {
  const exact = header.findIndex((h) => /^product\s+name$/i.test(String(h).trim()));
  if (exact >= 0) return exact;
  return header.findIndex((h) => /name|product|ชื่อสินค้า/i.test(String(h)) && !/order\s*id/i.test(String(h)));
}

async function main() {
  const defaultPath = path.join(__dirname, '../../../database/ORDERS-10000-DATASET.xlsx');
  const filePath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : defaultPath;
  if (!fs.existsSync(filePath)) {
    console.error('ไม่พบไฟล์:', filePath);
    console.error('ใช้: npm run update-product-names -- ..\\database\\ORDERS-10000-DATASET.xlsx');
    process.exit(1);
  }

  console.log('กำลังอ่านไฟล์:', filePath);
  const workbook = X.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = X.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  if (!rows.length) {
    console.error('ไฟล์ไม่มีข้อมูล');
    process.exit(1);
  }

  const headerRowIndex = findHeaderRow(rows);
  const header = rows[headerRowIndex] as string[];
  const orderIdCol = header.findIndex((h) => /order\s*id/i.test(String(h)));
  const nameCol = findProductNameCol(header);

  if (orderIdCol < 0) {
    console.error('ไม่พบคอลัมน์ Order ID. หัวคอลัมน์:', header);
    process.exit(1);
  }
  if (nameCol < 0) {
    console.error('ไม่พบคอลัมน์ Product Name / ชื่อสินค้า. หัวคอลัมน์:', header);
    process.exit(1);
  }

  console.log('ใช้คอลัมน์ Order ID =', header[orderIdCol], ', Product Name =', header[nameCol]);

  const dataRows = rows.slice(headerRowIndex + 1) as unknown[][];
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const orderId = row[orderIdCol] != null ? String(row[orderIdCol]).trim() : '';
    const productName = nameCol >= 0 && row[nameCol] != null ? String(row[nameCol]).trim() : '';
    if (!orderId) {
      skipped++;
      continue;
    }
    if (!productName) {
      skipped++;
      continue;
    }
    try {
      const [result] = await pool.query<{ affectedRows?: number }>('UPDATE orders SET product_name = ? WHERE id = ?', [productName, orderId]);
      if ((result as any)?.affectedRows > 0) updated++;
    } catch (e) {
      if (updated + skipped <= 3) console.error('แถว', i + 2, orderId, e);
    }
  }

  console.log('');
  console.log('เสร็จสิ้น: อัปเดตชื่อสินค้า', updated, 'รายการ, ข้าม', skipped, 'แถว');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
