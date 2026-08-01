import { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTrending, useTitles, useRecentlyUpdated } from '../../lib/queryClient';
import { useReadingProgress } from '../../lib/hooks/useReading';
import { useAuthStore } from '../../store/authStore';

const { width: SCREEN_W } = Dimensions.get('window');
const GENRES = ['Action', 'Romance', 'Fantasy', 'Isekai', 'Horror', 'Comedy', 'Mystery', 'Sci-Fi', 'Sports'];

function formatTimeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function HomeScreen() {
  const router = useRouter();
  const { token } = useAuthStore();
  const { data: trending, isLoading: trendingLoading } = useTrending();
  const { data: latest, isLoading: latestLoading } = useTitles({ sort: 'newest', limit: 10 });
  const { data: recentlyUpdated, isLoading: updatesLoading } = useRecentlyUpdated();
  const { data: readingData } = useReadingProgress(!!token);

  const [heroIndex, setHeroIndex] = useState(0);
  const heroScrollRef = useRef<ScrollView>(null);
  const heroTitles = trending?.slice(0, 5) || [];

  // Auto-rotate hero carousel
  useEffect(() => {
    if (heroTitles.length < 2) return;
    const interval = setInterval(() => {
      const next = (heroIndex + 1) % heroTitles.length;
      setHeroIndex(next);
      heroScrollRef.current?.scrollTo({ x: next * SCREEN_W, animated: true });
    }, 5000);
    return () => clearInterval(interval);
  }, [heroIndex, heroTitles.length]);

  const handleHeroScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (idx !== heroIndex && idx >= 0 && idx < heroTitles.length) {
      setHeroIndex(idx);
    }
  };

  // Continue reading from reading progress
  const continueReading = token && readingData
    ? (readingData as any[])
        .filter((e: any) => !e.completed)
        .slice(0, 6)
    : [];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>Manga<Text style={styles.logoAccent}>Verse</Text></Text>
          {token && (
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => router.push('/library' as any)}
            >
              <Text style={styles.headerBtnText}>My Library</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ─── Hero Carousel ───────────────────────────── */}
        {heroTitles.length > 0 ? (
          <View>
            <ScrollView
              ref={heroScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleHeroScroll}
            >
              {heroTitles.map((item, idx) => (
                <TouchableOpacity
                  key={item.slug}
                  style={[styles.hero, { width: SCREEN_W }]}
                  activeOpacity={0.9}
                  onPress={() => router.push(`/title/${item.slug}` as any)}
                >
                  {item.coverUrl ? (
                    <Image source={{ uri: item.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  ) : null}
                  <View style={[styles.heroOverlay, StyleSheet.absoluteFill]} />
                  <View style={styles.heroContent}>
                    <View style={styles.heroBadgeRow}>
                      <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>🔥 Trending #{idx + 1}</Text></View>
                      <View style={styles.heroTypeBadge}>
                        <Text style={styles.heroTypeText}>
                          {item.type === 'MANHWA' ? '🇰🇷 Manhwa' : item.type === 'MANHUA' ? '🇨🇳 Manhua' : item.type?.replace(/_/g, ' ')}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.heroTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.heroMeta} numberOfLines={1}>
                      {item.genres?.slice(0, 3).map(g => g.charAt(0).toUpperCase() + g.slice(1)).join(' · ') || ''}
                    </Text>
                    <View style={styles.heroActions}>
                      <View style={styles.heroReadBtn}><Text style={styles.heroReadText}>▶ Read Now</Text></View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {/* Dots */}
            {heroTitles.length > 1 && (
              <View style={styles.dots}>
                {heroTitles.map((_, i) => (
                  <View key={i} style={[styles.dot, i === heroIndex && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>
        ) : null}

        {/* ─── Continue Reading ────────────────────────── */}
        {continueReading.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📖 Continue Reading</Text>
              <TouchableOpacity onPress={() => router.push('/library' as any)}>
                <Text style={styles.seeAll}>View all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowContent}>
              {continueReading.map((entry: any) => (
                <TouchableOpacity
                  key={entry.id}
                  style={styles.contCard}
                  onPress={() => router.push(`/reader/${entry.chapter.id}` as any)}
                >
                  <View style={styles.contCoverWrap}>
                    {entry.chapter.series.coverUrl ? (
                      <Image source={{ uri: entry.chapter.series.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    ) : null}
                    <View style={[styles.contCoverOverlay, StyleSheet.absoluteFill]} />
                    <View style={styles.contCoverInfo}>
                      <Text style={styles.contTitle} numberOfLines={1}>{entry.chapter.series.title}</Text>
                      <Text style={styles.contMeta}>
                        Ch. {entry.chapter.number}
                        {entry.pageNumber ? ` · ${Math.round(entry.pageNumber / (entry.chapter.pageCount || 20) * 100)}%` : ''}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ─── Trending Now ─────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🔥 Trending Now</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/browse' as any)}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {trendingLoading ? (
            <ActivityIndicator color="#e94560" style={{ padding: 20 }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowContent}>
              {trending?.slice(0, 10).map((item, idx) => (
                <TouchableOpacity key={item.id} style={styles.cardSm} onPress={() => router.push(`/title/${item.slug}` as any)}>
                  <View style={styles.cardCover}>
                    {item.coverUrl ? (
                      <Image source={{ uri: item.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    ) : (
                      <View style={styles.cardCoverFallback}><Text style={styles.cardFallbackText}>{item.title}</Text></View>
                    )}
                    <View style={styles.rankBadge}><Text style={styles.rankText}>#{idx + 1}</Text></View>
                    {item.rating ? (
                      <View style={styles.ratingBadge}><Text style={styles.ratingText}>⭐{item.rating.toFixed(1)}</Text></View>
                    ) : null}
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.cardCh}>
                    {item.type === 'LIGHT_NOVEL' ? 'LN' : item.type?.charAt(0).toUpperCase() + item.type?.slice(1).toLowerCase()} · {item.totalChapters || '?'} ch
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ─── New Updates ──────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🆕 New Updates</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/browse' as any)}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {updatesLoading ? (
            <ActivityIndicator color="#e94560" style={{ padding: 20 }} />
          ) : recentlyUpdated && recentlyUpdated.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowContent}>
              {recentlyUpdated.slice(0, 10).map((item) => {
                const timeAgo = item.latestChapter ? formatTimeAgo(item.latestChapter.createdAt) : '';
                return (
                  <TouchableOpacity key={item.id} style={styles.cardSm} onPress={() => router.push(`/title/${item.slug}` as any)}>
                    <View style={styles.cardCover}>
                      {item.coverUrl ? (
                        <Image source={{ uri: item.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      ) : (
                        <View style={styles.cardCoverFallback}><Text style={styles.cardFallbackText}>{item.title}</Text></View>
                      )}
                      {item.latestChapter ? (
                        <View style={styles.chapterBadge}><Text style={styles.chapterBadgeText}>Ch. {item.latestChapter.number}</Text></View>
                      ) : null}
                    </View>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                    {timeAgo ? <Text style={styles.updateTime}>▲ {timeAgo}</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={styles.emptyText}>No recent updates yet</Text>
          )}
        </View>

        {/* ─── New Releases ─────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>✨ New Releases</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/browse' as any)}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {latestLoading ? (
            <ActivityIndicator color="#e94560" style={{ padding: 20 }} />
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowContent}>
            {latest?.items?.slice(0, 10).map((item) => (
              <TouchableOpacity key={item.id} style={styles.cardSm} onPress={() => router.push(`/title/${item.slug}` as any)}>
                <View style={styles.cardCover}>
                  {item.coverUrl ? (
                    <Image source={{ uri: item.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  ) : (
                    <View style={styles.cardCoverFallback}><Text style={styles.cardFallbackText}>{item.title}</Text></View>
                  )}
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.cardCh}>{item.type === 'LIGHT_NOVEL' ? 'LN' : item.type?.slice(0, 2)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ─── Browse by Genre ──────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Browse by Genre</Text>
          <View style={styles.genreWrap}>
            {GENRES.map((g) => (
              <TouchableOpacity
                key={g}
                style={styles.genreChip}
                onPress={() => router.push(`/(tabs)/browse?genre=${g.toLowerCase()}` as any)}
              >
                <Text style={styles.genreChipText}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  scroll: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  logo: { color: '#e94560', fontSize: 16, fontWeight: '600' },
  logoAccent: { color: '#7b2fbe' },
  headerBtn: { backgroundColor: '#1e1e35', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 },
  headerBtnText: { color: '#aaa', fontSize: 10 },
  hero: { height: 220, position: 'relative' },
  heroOverlay: { backgroundColor: 'rgba(10,10,22,0.62)' },
  heroContent: { paddingHorizontal: 16, paddingBottom: 18, justifyContent: 'flex-end', flex: 1 },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  heroBadge: { backgroundColor: '#e94560', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  heroBadgeText: { color: '#fff', fontSize: 9, fontWeight: '600' },
  heroTypeBadge: { backgroundColor: 'rgba(26,26,46,0.85)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  heroTypeText: { color: '#888', fontSize: 8 },
  heroTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  heroMeta: { color: '#aaa', fontSize: 10, marginTop: 4 },
  heroActions: { marginTop: 10 },
  heroReadBtn: { alignSelf: 'flex-start', backgroundColor: '#e94560', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 7 },
  heroReadText: { color: '#fff', fontSize: 11, fontWeight: '500' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingVertical: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2a2a45' },
  dotActive: { backgroundColor: '#e94560', width: 16 },
  section: { marginTop: 14, marginBottom: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 8 },
  sectionTitle: { color: '#fff', fontSize: 13, fontWeight: '500', paddingHorizontal: 14 },
  seeAll: { color: '#e94560', fontSize: 10 },
  rowContent: { paddingHorizontal: 14, gap: 10 },
  contCard: { width: 150 },
  contCoverWrap: { height: 92, borderRadius: 10, overflow: 'hidden', backgroundColor: '#1e1e35' },
  contCoverOverlay: { backgroundColor: 'rgba(10,10,22,0.45)', justifyContent: 'flex-end' },
  contCoverInfo: { position: 'absolute', bottom: 8, left: 10, right: 10 },
  contTitle: { color: '#fff', fontSize: 11, fontWeight: '500' },
  contMeta: { color: '#bbb', fontSize: 9, marginTop: 2 },
  cardSm: { width: 86 },
  cardCover: { width: 86, height: 120, borderRadius: 8, backgroundColor: '#1e1e35', overflow: 'hidden', justifyContent: 'flex-start', alignItems: 'flex-start' },
  cardCoverFallback: { flex: 1, justifyContent: 'center', padding: 4 },
  cardFallbackText: { color: '#666', fontSize: 8, textAlign: 'center' },
  rankBadge: { backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, margin: 4 },
  rankText: { color: '#fff', fontSize: 8, fontWeight: '600' },
  ratingBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  ratingText: { color: '#f0c040', fontSize: 8 },
  chapterBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: '#e94560', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  chapterBadgeText: { color: '#fff', fontSize: 8, fontWeight: '600' },
  cardTitle: { color: '#ccc', fontSize: 9, marginTop: 4, lineHeight: 12 },
  cardCh: { color: '#666', fontSize: 8, marginTop: 1 },
  updateTime: { color: '#4ade80', fontSize: 8, marginTop: 1 },
  emptyText: { color: '#666', fontSize: 11, textAlign: 'center', padding: 16 },
  genreWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingTop: 4 },
  genreChip: { backgroundColor: '#1e1e35', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 },
  genreChipText: { color: '#aaa', fontSize: 10 },
});
