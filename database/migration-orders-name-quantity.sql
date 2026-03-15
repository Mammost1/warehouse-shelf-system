-- Add product name and quantity to orders (for Monitor display and search by name)
ALTER TABLE orders
  ADD COLUMN product_name VARCHAR(255) NULL COMMENT 'ชื่อสินค้า' AFTER category,
  ADD COLUMN quantity INT NOT NULL DEFAULT 1 COMMENT 'จำนวน' AFTER height_cm;
