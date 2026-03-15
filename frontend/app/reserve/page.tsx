import { redirect } from 'next/navigation';

/** รวมกับหน้าเพิ่มสินค้าแล้ว — redirect ไป /add */
export default function ReservePage() {
  redirect('/add');
}
