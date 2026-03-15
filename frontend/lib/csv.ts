/** สร้าง CSV และ trigger download (ใส่ BOM ให้ Excel อ่านไทยได้) */
export function downloadCsv(
  headers: string[],
  rows: (string | number)[][],
  filename: string
): void {
  const escape = (v: string | number): string => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const line = (row: (string | number)[]) => row.map(escape).join(',');
  const csv = '\uFEFF' + [headers.join(','), ...rows.map(line)].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
