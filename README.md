# Warehouse Shelf Reservation System

ระบบจองชั้นวางสินค้าในคลัง (Shelf / Level / Slot) พร้อม API และหน้า Monitor สำหรับค้นหา Order ID / Slot ID

---

## โหลดไปใช้

- เปิดลิงก์ repository → กด **Code** → **Download ZIP** แล้วแตกไฟล์  
  หรือถ้ามี Git: `git clone <ลิงก์ repo>`
- ทำตาม **วิธีติดตั้ง.md** ในโปรเจกต์ (สร้าง DB ใน MySQL → ตั้งค่า `backend/.env` → รัน backend → รัน frontend)

---

## โครงสร้างโปรเจกต์

```
warehouse-shelf-system/
├── backend/          # Node.js + Express + TypeScript
│   └── src/
│       ├── config/   # DB config
│       ├── controllers/
│       ├── services/
│       ├── routes/
│       └── types/
├── frontend/         # Next.js
│   └── app/
│       ├── page.tsx       # หน้าแรก
│       ├── dashboard/     # Dashboard + กราฟ
│       ├── monitor/       # Monitor + ค้นหา
│       ├── add/           # เพิ่มสินค้าเข้าคลัง (จอง slot)
│       ├── history/       # ประวัติการเคลื่อนไหว
│       └── reserve/       # redirect → /add
├── database/
│   ├── schema.sql   # สร้างตาราง
│   ├── seed.sql     # ข้อมูลชั้นวางตัวอย่าง
│   ├── migration-*.sql
│   └── ORDERS-10000-DATASET.xlsx  # ชุดข้อมูลออเดอร์
├── scripts/
│   └── setup-database.bat  # สคริปต์ตั้งค่า DB (Windows)
├── README.md
├── วิธีติดตั้ง.md
└── ข้อกำหนด-PDF-เช็คลิสต์.md
```

## ความต้องการของระบบ

- **Node.js** 18+
- **MySQL** 8.0+
- **npm** หรือ **yarn**

## การติดตั้งและรัน

### 1. Database (MySQL)

สร้าง database และรัน schema + seed:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS warehouse_shelf;"
mysql -u root -p warehouse_shelf < database/schema.sql
mysql -u root -p warehouse_shelf < database/seed.sql
```

หรือใน MySQL Client:

```sql
CREATE DATABASE IF NOT EXISTS warehouse_shelf;
USE warehouse_shelf;
SOURCE path/to/database/schema.sql;
SOURCE path/to/database/seed.sql;
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# แก้ .env ให้ตรงกับ MySQL (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME)
npm install
npm run dev
```

API จะรันที่ `http://localhost:4000`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

เปิดเบราว์เซอร์ที่ `http://localhost:3000`

ถ้า API อยู่ที่พอร์ตอื่น ให้ตั้งค่าใน `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

### 4. นำเข้าข้อมูลออเดอร์จาก Excel (ORDERS-10000-DATASET.xlsx)

ไฟล์ชุดข้อมูลอยู่แล้วในโปรเจกต์ที่ `database/ORDERS-10000-DATASET.xlsx` (แนบมาพร้อมส่ง ไม่ต้องดาวน์โหลดแยก)

เมื่อ MySQL รันและรัน schema + seed แล้ว ให้รันคำสั่งนี้จากโฟลเดอร์ `backend`:

```bash
cd backend
npm run import-orders -- "../database/ORDERS-10000-DATASET.xlsx"
```

(Windows ถ้าใช้ path เต็ม เช่น `C:\Users\...\warehouse-shelf-system\database\ORDERS-10000-DATASET.xlsx` ก็ได้)

สคริปต์จะอ่านคอลัมน์ **ORDER ID**, **CATEGORY**, **BOX HEIGHT (CM)** แล้วนำเข้าลงตาราง `orders` และจอง slot ให้ทุกออเดอร์อัตโนมัติ (category ในไฟล์เช่น shoes → Shoes, apparel → Apparel ให้ตรงกับ shelf)

### 5. (ถ้า DB สร้างไว้ก่อนแล้ว) รัน Migration ให้ตรงโจทย์ PDF

ถ้าเคยสร้าง DB มาก่อนที่มีการอัปเดตตามโจทย์ PDF (หนึ่ง slot เก็บหลายออเดอร์ได้ + Shoes แยก A–B / C–D ตามความสูง) ให้รัน:

```bash
mysql -u root -p warehouse_shelf < database/migration-allow-multi-order-per-slot.sql
```

ถ้า error ว่า column มีอยู่แล้ว ให้รันแค่ส่วน UPDATE และ `ALTER TABLE reservations DROP INDEX uq_slot;` เองใน MySQL Client

**ถ้าต้องการแสดงชื่อสินค้า + จำนวนใน Monitor และค้นหาด้วยชื่อ:** รัน migration เพิ่มคอลัมน์ใน `orders`:

```bash
mysql -u root -p warehouse_shelf < database/migration-orders-name-quantity.sql
```

หลังรันแล้ว ใน modal รายละเอียด slot จะมีคอลัมน์ ชื่อสินค้า / ตำแหน่ง / จำนวน และยอดรวม และค้นหารวม (Order ID / ชื่อ / Shelf) จะค้นชื่อสินค้าได้

**ถ้าต้องการหน้าประวัติการเคลื่อนไหว (เพิ่ม/ลบรายการ เมื่อไหร่):** รัน migration ประวัติ:

```bash
mysql -u root -p warehouse_shelf < database/migration-reservation-history.sql
```

หลังรันแล้ว หน้า **ประวัติการเคลื่อนไหว** จะแสดงได้ และปุ่ม **เอาออกจากช่อง** ใน Monitor จะบันทึกประวัติเมื่อยกเลิกจอง

## ความสอดคล้องกับโจทย์ PDF (Warehouse Inventory)

- **ลำดับการเลือกที่วาง:** Level 1→7, Shelf เรียง A–Z, Slot 1→50
- **ความสูงรวมใน slot:** หนึ่ง slot เก็บได้หลายออเดอร์จนความสูงรวมไม่เกินความสูงของ slot (48/33/50 cm ตามประเภท)
- **Shoes แยกตามความสูง:** กล่องสูง **≥ 16 cm** ใช้ Shelf A–B; **< 16 cm** ใช้ Shelf C–D (และ E–H ถ้ามี)
- **Backend:** API จอง Shelf + ค้นหา (Order ID / Slot ID)
- **Frontend:** Monitor ดูรายการสินค้าในแต่ละ Shelf, ค้นหาด้วย Order ID หรือ Slot ID

## API

Base URL: `http://localhost:4000` (path `/api` สำหรับ API ด้านล่าง)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check — ตรวจว่า API และ DB ยังรันอยู่ (ไม่ต้องใส่ prefix `/api`) |
| POST | `/api/reserve-slot` | จอง slot ให้ order (body: `orderId`, `category`, `heightCm?`, `productName?`) |
| GET | `/api/order/:orderId` | หาตำแหน่งของ order |
| GET | `/api/slot/:slotId` | ดูว่า slot นั้นมี order อะไร |
| GET | `/api/reservations` | รายการ slot ที่ถูกจองทั้งหมด |
| GET | `/api/shelves-summary` | สรุป shelf สำหรับ Dashboard |
| GET | `/api/history` | ประวัติการจอง/ปล่อย (query: limit, offset, action, category, dateFrom, dateTo) |

### ตัวอย่าง POST /reserve-slot

```json
POST /api/reserve-slot
Content-Type: application/json

{
  "orderId": "ORD00001",
  "category": "Apparel",
  "heightCm": 12
}
```

Response (201):

```json
{
  "message": "Slot reserved",
  "location": {
    "shelf": "AD",
    "level": 1,
    "slot": 1,
    "slotId": 123,
    "locationLabel": "Shelf: AD | Level: 1 | Slot: 1"
  }
}
```

### ตัวอย่าง GET /order/:orderId

```
GET /api/order/ORD00001
```

Response (200):

```json
{
  "orderId": "ORD00001",
  "location": {
    "shelf": "AD",
    "level": 1,
    "slot": 1,
    "slotId": 123,
    "locationLabel": "Shelf: AD | Level: 1 | Slot: 1"
  }
}
```

### ตัวอย่าง GET /slot/:slotId

```
GET /api/slot/123
```

Response (200):

```json
{
  "slotId": 123,
  "shelf": "AD",
  "level": 1,
  "slot": 1,
  "locationLabel": "Shelf: AD | Level: 1 | Slot: 1",
  "orderId": "ORD00001"
}
```

## Database Schema (สรุป)

- **shelves** – ชั้นวาง (id, category, slot_height_cm)
- **levels** – ระดับในแต่ละ shelf (level_num 1–7)
- **slots** – ช่องในแต่ละ level (slot_num 1–50)
- **orders** – ออเดอร์ (id, category, height_cm)
- **reservations** – การจอง (order_id, slot_id)
- **slot_locations** (view) – แปลง slot_id เป็นข้อความ Shelf | Level | Slot

ถ้าต้องการ**เปิดดูข้อมูลใน DB** (เห็นตาราง/ข้อมูลจริง): ใช้โปรแกรมเช่น **MySQL Workbench** หรือ **DBeaver** ต่อด้วย Host/User/Password/DB ตาม `backend/.env` — รายละเอียดอยู่ในไฟล์ **วิธีติดตั้ง.md** หัวข้อ "ดูข้อมูลใน Database (MySQL)"

## การทดสอบ

หลังติดตั้งและรัน MySQL, Backend, Frontend ตามหัวข้อ **การติดตั้งและรัน** ด้านบน ให้ทดสอบตามลำดับนี้:

1. **Health check (Backend)**  
   เปิด `http://localhost:4000/health` ในเบราว์เซอร์ หรือรัน `curl http://localhost:4000/health`  
   - ควรได้ `{"status":"ok","service":"warehouse-shelf-api","db":"ok"}` และ HTTP 200  
   - ถ้า `db: "error"` แปลว่าเชื่อม MySQL ไม่ได้ ให้เช็ค `.env` และสถานะ MySQL  

2. **หน้าแรก**  
   เปิด `http://localhost:3000` → ควรเห็นหัวข้อ "Warehouse Shelf System" และปุ่ม Dashboard, เปิด Monitor, เพิ่มสินค้าเข้าคลัง, ประวัติการเคลื่อนไหว  

3. **เพิ่มสินค้า (จองช่อง)**  
   กด **เพิ่มสินค้าเข้าคลัง** → กรอกรหัสออเดอร์ (เช่น `ORD00001`), หมวด (เช่น Apparel), ความสูงถ้ามี → กด **เก็บเข้าคลัง**  
   - ควรได้ข้อความจัดเก็บเรียบร้อย และตำแหน่ง Shelf · Level · Slot  

4. **Monitor**  
   กด **เปิด Monitor** → เลือก Shelf (หรือกรองหมวด) → ควรเห็น grid ช่องสี (เขียว/ส้ม/แดง = ว่าง/บางส่วน/เต็ม)  
   - ลองค้นหา Order ID หรือชื่อสินค้า (ถ้ารัน migration ชื่อสินค้าและ import Excel แล้ว)  

5. **Dashboard**  
   กด **Dashboard** → ควรเห็นตัวเลขจำนวน Shelf, ช่องทั้งหมด, ช่องที่บรรจุสินค้า, สัดส่วนที่ใช้ และกราฟ (สัดส่วน Shelf ตามสถานะ, จำนวน Shelf ต่อหมวด ฯลฯ)  

6. **ประวัติการเคลื่อนไหว**  
   กด **ประวัติการเคลื่อนไหว** → ควรเห็นตารางรายการจอง/ปล่อย (ถ้ารัน migration ประวัติและมีข้อมูลแล้ว)  

ถ้าทุกขั้นผ่าน แสดงว่าติดตั้งและรันระบบได้ถูกต้อง

## สร้าง Production Build

```bash
# Backend
cd backend && npm run build && npm start

# Frontend
cd frontend && npm run build && npm start
```
