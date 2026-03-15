'use client';

import { useState } from 'react';
import { reserveSlot } from '@/lib/api';
import Link from 'next/link';
import styles from './add.module.css';

const CATEGORIES = [
  { value: 'Apparel', label: 'เสื้อผ้า' },
  { value: 'Shoes', label: 'รองเท้า' },
  { value: 'Bags', label: 'กระเป๋า' },
  { value: 'Collectibles', label: 'ของสะสม' },
];

export default function AddProductPage() {
  const [orderId, setOrderId] = useState('');
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('Apparel');
  const [heightCm, setHeightCm] = useState('');
  const [result, setResult] = useState<{ locationLabel: string; shelf: string; level: number; slot: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSubmitting(true);
    try {
      const res = await reserveSlot({
        orderId: orderId.trim(),
        category,
        heightCm: heightCm ? parseFloat(heightCm) : undefined,
        productName: productName.trim() || undefined,
      });
      setResult({
        locationLabel: res.location.locationLabel,
        shelf: res.location.shelf,
        level: res.location.level,
        slot: res.location.slot,
      });
      setOrderId('');
      setProductName('');
      setHeightCm('');
    } catch (err: unknown) {
      const e = err as Error & { alreadyAt?: { locationLabel: string } };
      if (e.alreadyAt?.locationLabel) {
        setError(`รหัสออเดอร์นี้มีในระบบแล้ว ที่ ${e.alreadyAt.locationLabel}`);
      } else {
        setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <header className={styles.header}>
          <Link href="/" className={styles.back}>← กลับหน้าแรก</Link>
          <h1 className={styles.title}>เพิ่มสินค้าเข้าคลัง</h1>
          <p className={styles.subtitle}>กรอกรายการสินค้า ระบบจัดสรรช่องเก็บอัตโนมัติตามหมวดและความสูง</p>
        </header>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="orderId">รหัสออเดอร์ *</label>
            <input
              id="orderId"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="เช่น ORD00001"
              required
              className={styles.input}
              autoComplete="off"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="productName">ชื่อสินค้า</label>
            <input
              id="productName"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="ชื่อสินค้า (ไม่บังคับ)"
              className={styles.input}
              autoComplete="off"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="category">หมวดสินค้า *</label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={styles.select}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="heightCm">ความสูงกล่อง (ซม.) — สำหรับจัดชั้นตามความสูง (เช่น รองเท้า)</label>
            <input
              id="heightCm"
              type="number"
              step="0.1"
              min="0"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="เช่น 16"
              className={styles.input}
            />
          </div>
          <button type="submit" disabled={submitting} className={styles.btn}>
            {submitting ? 'กำลังจัดสรรช่อง…' : 'เก็บเข้าคลัง'}
          </button>
        </form>

        {error && <p className={styles.error}>{error}</p>}
        {result && (
          <div className={styles.result}>
            <span className={styles.resultIcon} aria-hidden>✓</span>
            <p className={styles.resultTitle}>จัดเก็บเรียบร้อย</p>
            <p className={styles.resultLocation}>{result.locationLabel}</p>
            <p className={styles.resultMeta}>Shelf {result.shelf} · Level {result.level} · Slot {result.slot}</p>
            <Link href="/monitor" className={styles.resultLink}>ดูใน Monitor →</Link>
          </div>
        )}
      </div>
    </main>
  );
}
