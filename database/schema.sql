-- Warehouse Shelf Reservation System - Database Schema
-- MySQL 8.0+

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- Shelves: physical shelf units (e.g. A, B, AD, LBA)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shelves (
  id          VARCHAR(10)  NOT NULL PRIMARY KEY,
  category    VARCHAR(50)  NOT NULL COMMENT 'Shoes, Bags, Collectibles, Apparel',
  max_levels  INT          NOT NULL DEFAULT 7,
  slot_height_cm INT       NOT NULL COMMENT 'Height per slot in cm',
  min_box_height_cm DECIMAL(6,2) NULL COMMENT 'Shoes: ใช้ shelf นี้เมื่อความสูงกล่อง >= ค่านี้ (เช่น A-B = 16)',
  max_box_height_cm DECIMAL(6,2) NULL COMMENT 'Shoes: ใช้ shelf นี้เมื่อความสูงกล่อง < ค่านี้ (เช่น C-D = 16)',
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Levels: levels within a shelf (1 = bottom, 7 = top)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS levels (
  id          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  shelf_id    VARCHAR(10)  NOT NULL,
  level_num   INT          NOT NULL COMMENT '1-7',
  UNIQUE KEY uq_shelf_level (shelf_id, level_num),
  CONSTRAINT fk_levels_shelf FOREIGN KEY (shelf_id) REFERENCES shelves(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Slots: individual storage positions (1-50 per level)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS slots (
  id          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  level_id    INT          NOT NULL,
  slot_num    INT          NOT NULL COMMENT '1-50',
  UNIQUE KEY uq_level_slot (level_id, slot_num),
  CONSTRAINT fk_slots_level FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Orders: incoming orders that need slot allocation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id          VARCHAR(20)  NOT NULL PRIMARY KEY,
  category    VARCHAR(50)  NOT NULL,
  height_cm   DECIMAL(6,2) NULL COMMENT 'Item box height in cm',
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Reservations: which order is stored in which slot
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservations (
  id          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id    VARCHAR(20)  NOT NULL,
  slot_id     INT          NOT NULL,
  reserved_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_order (order_id),
  CONSTRAINT fk_res_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_res_slot  FOREIGN KEY (slot_id) REFERENCES slots(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Indexes for common lookups
-- ---------------------------------------------------------------------------
CREATE INDEX idx_orders_category ON orders(category);
CREATE INDEX idx_reservations_order ON reservations(order_id);
CREATE INDEX idx_reservations_slot ON reservations(slot_id);

-- ---------------------------------------------------------------------------
-- Reservation history: audit log (เมื่อไหร่ ใส่อะไร เอาอะไรออก)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservation_history (
  id            INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  action        VARCHAR(20)  NOT NULL COMMENT 'reserve | unreserve',
  order_id      VARCHAR(20)  NOT NULL,
  slot_id       INT          NULL,
  location_label VARCHAR(255) NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_history_created (created_at),
  INDEX idx_history_order (order_id),
  INDEX idx_history_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- View: slot_id -> human-readable location (Shelf, Level, Slot)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW slot_locations AS
SELECT
  s.id AS slot_id,
  sh.id AS shelf_id,
  l.level_num,
  s.slot_num,
  CONCAT('Shelf: ', sh.id, ' | Level: ', l.level_num, ' | Slot: ', s.slot_num) AS location_label
FROM slots s
JOIN levels l ON s.level_id = l.id
JOIN shelves sh ON l.shelf_id = sh.id;

SET FOREIGN_KEY_CHECKS = 1;
