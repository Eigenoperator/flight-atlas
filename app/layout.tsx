import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Flight Atlas — Map Your Flight Log',
  description: 'A private-by-design, interactive atlas for flight logs imported from Excel, CSV or JSON.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
