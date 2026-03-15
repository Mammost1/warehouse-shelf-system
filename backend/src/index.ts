// โหลด .env ก่อนทุกอย่าง เพื่อให้ DB_PASSWORD พร้อมก่อนเชื่อม MySQL
require('dotenv').config();

import express from 'express';
import cors from 'cors';
import reservationRoutes from './routes/reservationRoutes';
import pool from './config/database';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api', reservationRoutes);

/** Health check — ใช้ตรวจว่า API และ DB ยังรันอยู่ (monitor / load balancer) */
app.get('/health', async (_req, res) => {
  const payload: { status: string; service: string; db?: string } = {
    status: 'ok',
    service: 'warehouse-shelf-api',
  };
  try {
    await pool.query('SELECT 1');
    payload.db = 'ok';
  } catch {
    payload.db = 'error';
    payload.status = 'degraded';
  }
  const statusCode = payload.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(payload);
});

app.listen(PORT, () => {
  console.log(`Warehouse Shelf API running at http://localhost:${PORT}`);
});
