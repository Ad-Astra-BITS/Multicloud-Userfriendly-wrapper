import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

/**
 * Root Layout
 *
 * Main layout wrapper for the Ad Astra application.
 * Uses Inter font for a clean, professional look.
 */

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Ad Astra - Cloud Resource Management',
  description: 'Cloud resource management and cost optimization dashboard',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-slate-950`}>
        {children}
      </body>
    </html>
  );
}
