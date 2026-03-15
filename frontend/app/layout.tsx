import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';
import { ThemeToggle } from './components/ThemeToggle';

const dmSans = DM_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Warehouse Shelf Monitor',
  description: 'Monitor and search warehouse shelf reservations',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={dmSans.variable}>
      <body>
        <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 50 }}>
          <ThemeToggle />
        </div>
        {children}
      </body>
    </html>
  );
}
