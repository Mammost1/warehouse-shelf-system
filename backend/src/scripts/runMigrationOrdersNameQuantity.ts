/**
 * รัน migration เพิ่ม product_name, quantity ในตาราง orders
 * ใช้: npm run migrate:orders-name-quantity (จากโฟลเดอร์ backend)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

import pool from '../config/database';

async function main() {
  try {
    try {
      await pool.query(`ALTER TABLE orders ADD COLUMN product_name VARCHAR(255) NULL COMMENT 'ชื่อสินค้า' AFTER category`);
    } catch (e: any) {
      if (e?.code !== 'ER_DUP_FIELD_NAME') throw e;
    }
    try {
      await pool.query(`ALTER TABLE orders ADD COLUMN quantity INT NOT NULL DEFAULT 1 COMMENT 'จำนวน' AFTER height_cm`);
    } catch (e: any) {
      if (e?.code !== 'ER_DUP_FIELD_NAME') throw e;
    }
    console.log('Migration สำเร็จ: คอลัมน์ product_name, quantity ในตาราง orders พร้อมแล้ว');
  } catch (e: any) {
    console.error('Migration ล้มเหลว:', e?.message || e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
