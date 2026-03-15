import Link from 'next/link';
import styles from './home.module.css';

export default function HomePage() {
  return (
    <main className={styles.hero}>
      <div className={styles.orb1} aria-hidden />
      <div className={styles.orb2} aria-hidden />
      <div className={styles.heroInner}>
        <p className={styles.badge}>คลังสินค้า</p>
        <h1 className={styles.headline}>Warehouse Shelf System</h1>
        <p className={styles.subtitle}>
          ระบบจองช่องเก็บสินค้าและตรวจสอบสถานะตามตำแหน่ง Shelf, Level, Slot
        </p>
        <nav className={styles.actions}>
          <Link href="/dashboard" className={styles.primaryBtn}>
            <span aria-hidden>📈</span>
            Dashboard
          </Link>
          <Link href="/monitor" className={styles.secondaryBtn}>
            <span aria-hidden>📊</span>
            เปิด Monitor
          </Link>
          <Link href="/add" className={styles.secondaryBtn}>
            <span aria-hidden>➕</span>
            เพิ่มสินค้าเข้าคลัง
          </Link>
          <Link href="/history" className={styles.secondaryBtn}>
            <span aria-hidden>📋</span>
            ประวัติการเคลื่อนไหว
          </Link>
        </nav>
      </div>
    </main>
  );
}
