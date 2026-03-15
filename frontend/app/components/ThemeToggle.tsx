'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'warehouse-theme';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(STORAGE_KEY) as 'dark' | 'light' | null;
    const prefer = stored ?? 'dark';
    setTheme(prefer);
    document.documentElement.setAttribute('data-theme', prefer === 'light' ? 'light' : '');
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next === 'light' ? 'light' : '');
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      style={{
        padding: '0.35rem 0.6rem',
        fontSize: '0.8rem',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        color: 'var(--text)',
        cursor: 'pointer',
      }}
      title={theme === 'dark' ? 'สลับเป็นโทนสว่าง' : 'สลับเป็นโทนเข้ม'}
    >
      {theme === 'dark' ? '☀️ โทนสว่าง' : '🌙 โทนเข้ม'}
    </button>
  );
}
