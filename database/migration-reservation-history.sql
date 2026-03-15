-- ประวัติการจอง/ยกเลิกจอง — ใส่อันนี้ ลบอันนี้ เวลาเท่าไหร่
-- รัน: mysql -u root -p warehouse_shelf < database/migration-reservation-history.sql

CREATE TABLE IF NOT EXISTS reservation_history (
  id            INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  action        VARCHAR(20)  NOT NULL COMMENT 'reserve | unreserve',
  order_id      VARCHAR(20)  NOT NULL,
  slot_id       INT          NULL COMMENT 'NULL ถ้า unreserve แล้ว slot ถูกลบ',
  location_label VARCHAR(255) NULL COMMENT 'Shelf | Level | Slot ไว้โชว์',
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_history_created (created_at),
  INDEX idx_history_order (order_id),
  INDEX idx_history_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
