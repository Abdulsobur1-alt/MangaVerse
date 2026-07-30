import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MangaVerse — Read Manga, Manhwa & Light Novels',
  description:
    'The ultimate manga reading ecosystem. Discover thousands of manga, manhwa, manhua, and light novels.',
  keywords: [
    'manga',
    'manhwa',
    'manhua',
    'light novel',
    'read manga online',
    'anime',
  ],
  openGraph: {
    title: 'MangaVerse',
    description: 'Read Manga, Manhwa & Light Novels online',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
