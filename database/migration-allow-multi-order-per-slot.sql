-- รันสำหรับ DB ที่มีอยู่แล้ว ให้ตรงโจทย์ PDF (หนึ่ง slot เก็บหลายออเดอร์ได้ + Shoes แยก A-B / C-D)
-- mysql -u root -p warehouse_shelf < database/migration-allow-multi-order-per-slot.sql

-- (ถ้าใช้ schema.sql ใหม่แล้ว มีคอลัมน์อยู่แล้ว ให้ข้าม 2 บรรทัดนี้ แล้วรันแค่ UPDATE กับ DROP ด้านล่าง)
ALTER TABLE shelves ADD COLUMN min_box_height_cm DECIMAL(6,2) NULL COMMENT 'ใช้เมื่อความสูงกล่อง >= ค่านี้';
ALTER TABLE shelves ADD COLUMN max_box_height_cm DECIMAL(6,2) NULL COMMENT 'ใช้เมื่อความสูงกล่อง < ค่านี้';

UPDATE shelves SET min_box_height_cm = 16, max_box_height_cm = NULL WHERE id IN ('A','B');
UPDATE shelves SET min_box_height_cm = NULL, max_box_height_cm = 16 WHERE id IN ('C','D');

-- อนุญาตให้หนึ่ง slot มีหลายออเดอร์ (ลบ UNIQUE slot_id)
ALTER TABLE reservations DROP INDEX uq_slot;
