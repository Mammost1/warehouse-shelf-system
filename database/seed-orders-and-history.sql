-- ใส่ orders + reservations + reservation_history พร้อมกัน (รันหลัง schema + seed)
-- รัน: mysql -u root -p warehouse_shelf < database/seed-orders-and-history.sql
-- เวลาเริ่มรันใหม่: schema → seed → seed-orders-and-history จะได้ประวัติมาพร้อมข้อมูลตั้งแต่ต้น

-- ตัวอย่างออเดอร์
INSERT IGNORE INTO orders (id, category, height_cm) VALUES
('ORD00001', 'Shoes', 15),
('ORD00002', 'Shoes', 14),
('ORD00003', 'Apparel', 20),
('ORD00004', 'Bags', 25),
('ORD00005', 'Collectibles', 10);

-- จองช่อง (slot แรก 5 ช่อง)
INSERT IGNORE INTO reservations (order_id, slot_id) SELECT 'ORD00001', id FROM slots ORDER BY id LIMIT 1 OFFSET 0;
INSERT IGNORE INTO reservations (order_id, slot_id) SELECT 'ORD00002', id FROM slots ORDER BY id LIMIT 1 OFFSET 1;
INSERT IGNORE INTO reservations (order_id, slot_id) SELECT 'ORD00003', id FROM slots ORDER BY id LIMIT 1 OFFSET 2;
INSERT IGNORE INTO reservations (order_id, slot_id) SELECT 'ORD00004', id FROM slots ORDER BY id LIMIT 1 OFFSET 3;
INSERT IGNORE INTO reservations (order_id, slot_id) SELECT 'ORD00005', id FROM slots ORDER BY id LIMIT 1 OFFSET 4;

-- ประวัติ "เพิ่มเข้าคลัง" ใส่พร้อมกัน (จาก reservations + slot_locations)
INSERT IGNORE INTO reservation_history (action, order_id, slot_id, location_label, created_at)
SELECT 'reserve', r.order_id, r.slot_id, sl.location_label, NOW()
FROM reservations r
JOIN slot_locations sl ON sl.slot_id = r.slot_id
WHERE r.order_id IN ('ORD00001','ORD00002','ORD00003','ORD00004','ORD00005')
  AND NOT EXISTS (SELECT 1 FROM reservation_history h WHERE h.order_id = r.order_id AND h.action = 'reserve' LIMIT 1);
