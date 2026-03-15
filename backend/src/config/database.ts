// โหลด .env ก่อนสร้าง pool เพื่อให้ DB_PASSWORD พร้อม (Backend ไม่โหลด dotenv ที่ index)
require('dotenv').config();

import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'warehouse_shelf',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
