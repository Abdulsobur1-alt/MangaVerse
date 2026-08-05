'use client';

import { useMemo } from 'react';
import { TitleCard } from '@/components/home/TitleCard';
import { SectionHeader } from '@/components/home/primitives';
import { useTitles, type TitleListItem } from '@/lib/hooks/useTitles';

/* ═══════════════════════════════════════════════════════════════
   Recommendations — curated rails for the details page.
   • Readers Also Enjoyed: same-genre titles sorted by rating,
     excluding the current title (and anything already shown).
   • More from {author}: same author search, excluding self.
   Both reuse the shared TitleCard system from the homepage.
   ═══════════════════════════════════════════════════════════════ */

interface RecommendationsProps {
  slug: string;
  titleId: string;
  genres: string[];
  author?: string | null;
}

export function Recommendations({ slug, titleId, genres, author }: RecommendationsProps) {
  const topGenres = useMemo(() => genres.slice(0, 2).join(','), [genres]);

  const { data: similarData } = useTitles({ genres: topGenres, limit: 10, sort: 'rating', enabled: !!topGenres });
  const { data: authorData } = useTitles({ search: author ?? '', limit: 8, enabled: !!author });

  const similar = useMemo(
    () => ((similarData?.items ?? []) as TitleListItem[]).filter((t) => t.slug !== slug).slice(0, 8),
    [similarData, slug],
  );
  const byAuthor = useMemo(
    () => ((authorData?.items ?? []) as TitleListItem[]).filter((t) => t.slug !== slug && t.id !== titleId).slice(0, 6),
    [authorData, slug, titleId],
  );

  return (
    <>
      {similar.length > 0 && (
        <section aria-label="Readers also enjoyed">
          <SectionHeader
            title="Readers Also Enjoyed"
            href={`/browse?genres=${topGenres}`}
            sub="Cut from the same cloth"
            icon={<span aria-hidden="true">🤝</span>}
          />
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {similar.map((t) => (
              <TitleCard key={t.id} item={t} />
            ))}
          </div>
        </section>
      )}

      {byAuthor.length > 0 && (
        <section aria-label={`More from ${author}`}>
          <SectionHeader
            title={`More from ${author}`}
            href={`/browse?search=${encodeURIComponent(author ?? '')}`}
            sub="Same author, more stories"
            icon={<span aria-hidden="true">✍️</span>}
          />
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {byAuthor.map((t) => (
              <TitleCard key={t.id} item={t} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
