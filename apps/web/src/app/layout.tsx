import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { AuthInitializer } from '@/components/AuthInitializer';
import { PushInitializer } from '@/components/PushInitializer';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', display: 'swap' });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://mangaverse-web.onrender.com';

export const viewport: Viewport = {
  themeColor: '#0f0f1a',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'MangaVerse — Read Manga, Manhwa & Light Novels',
  description:
    'The ultimate manga reading ecosystem. Discover thousands of manga, manhwa, manhua, and light novels.',
  keywords: [
    'manga', 'manhwa', 'manhua', 'light novel',
    'read manga online', 'webtoon', 'anime', 'comics',
  ],
  applicationName: 'MangaVerse',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'MangaVerse',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    title: 'MangaVerse',
    description: 'Read Manga, Manhwa & Light Novels online',
    type: 'website',
    siteName: 'MangaVerse',
    url: SITE_URL,
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
      <body className={`${inter.variable} ${spaceGrotesk.variable} bg-mv-dark text-mv-text antialiased`}>
        <Providers>
          <AuthInitializer />
          <PushInitializer />
          {children}
        </Providers>
      </body>
    </html>
  );
}
