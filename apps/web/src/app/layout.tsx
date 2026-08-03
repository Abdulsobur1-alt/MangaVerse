import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { AuthInitializer } from '@/components/AuthInitializer';
import { PushInitializer } from '@/components/PushInitializer';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: 'MangaVerse — Read Manga, Manhwa & Light Novels',
  description:
    'The ultimate manga reading ecosystem. Discover thousands of manga, manhwa, manhua, and light novels.',
  keywords: [
    'manga', 'manhwa', 'manhua', 'light novel',
    'read manga online', 'webtoon', 'anime', 'comics',
  ],
  openGraph: {
    title: 'MangaVerse',
    description: 'Read Manga, Manhwa & Light Novels online',
    type: 'website',
    siteName: 'MangaVerse',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MangaVerse',
    description: 'Read Manga, Manhwa & Light Novels online',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} bg-mv-dark text-mv-text antialiased`}>
        <Providers>
          <AuthInitializer />
          <PushInitializer />
          {children}
        </Providers>
      </body>
    </html>
  );
}
