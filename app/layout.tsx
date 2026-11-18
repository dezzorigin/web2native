import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css'; // Global styles

const inter = Inter({
 subsets: ['latin'],
 variable: '--font-sans',
});

export const metadata: Metadata = {
 title: 'Web2Native — Ubah Website jadi Aplikasi Android & iOS',
 description: 'Masukkan nama aplikasi dan URL website — Web2Native membungkusnya jadi APK & IPA demo lewat webtonative.com. Tanpa coding.',
 icons: {
  icon: '/favicon.svg',
 },
 openGraph: {
  title: 'Web2Native — Ubah Website jadi Aplikasi Android & iOS',
  description: 'Masukkan nama aplikasi dan URL website — Web2Native membungkusnya jadi APK & IPA demo lewat webtonative.com. Tanpa coding.',
  type: 'website',
 },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
 return (
 <html lang="id" className={`${inter.variable}`}>
 <body className="antialiased font-sans" suppressHydrationWarning>{children}</body>
 </html>
 );
}
