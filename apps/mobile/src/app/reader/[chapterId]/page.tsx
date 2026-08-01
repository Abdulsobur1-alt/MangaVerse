import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, StyleSheet, Platform, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useChapter, useCoinBalance, useUnlockChapter } from '../../../lib/queryClient';
import { COIN_UNLOCK_COST } from '@mangaverse/shared';
import { useAuthStore } from '../../../store/authStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAGE_WIDTH = Math.min(SCREEN_WIDTH, 700);

interface PageData {
  index: number;
  url: string;
  width: number;
  height: number;
}

interface AdjacentChapter {
  id: string;
  number: number;
}

export default function ReaderScreen() {
  const router = useRouter();
  const { chapterId } = useLocalSearchParams<{ chapterId: string }>();
  const chapterIdStr = typeof chapterId === 'string' ? chapterId : '';
  const { data: chapter, isLoading } = useChapter(chapterIdStr);
  const { token } = useAuthStore();
  const { data: coinData } = useCoinBalance();
  const unlockChapter = useUnlockChapter();
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const [pages, setPages] = useState<PageData[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pagesLoading, setPagesLoading] = useState(true);
  const [adjacentInfo, setAdjacentInfo] = useState<{ prevChapter: AdjacentChapter | null; nextChapter: AdjacentChapter | null }>({ prevChapter: null, nextChapter: null });
  const [showControls, setShowControls] = useState(true);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState(false);

  // Fetch pages and adjacent chapters
  useEffect(() => {
    if (!chapterId) return;
    setPagesLoading(true);
    setCurrentPage(0);

    const baseUrl = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001');
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    Promise.all([
      fetch(`${baseUrl}/api/chapters/${chapterId}/pages`, { headers }).then(r => r.json()),
      fetch(`${baseUrl}/api/chapters/${chapterId}/adjacent`, { headers }).then(r => r.json()),
    ])
      .then(([pagesRes, adjRes]) => {
        if (pagesRes.success) {
          setPages(pagesRes.data.pages);
          setTotalPages(pagesRes.data.total);
        }
        if (adjRes.success) {
          setAdjacentInfo(adjRes.data);
        }
      })
      .catch(() => {})
      .finally(() => setPagesLoading(false));
  }, [chapterId, token, chapter?.unlocked, chapter?.locked]);

  // Auto-hide controls after 3 seconds
  useEffect(() => {
    if (showControls) {
      const id = setTimeout(() => setShowControls(false), 3000);
      return () => clearTimeout(id);
    }
  }, [showControls]);

  // Reset loading/error states when navigating to a new page
  useEffect(() => {
    setPageLoading(true);
    setPageError(false);
  }, [currentPage]);

  // Tap handler for navigation
  const handleTap = (evt: { nativeEvent: { locationX: number } }) => {
    const x = evt.nativeEvent.locationX;
    setShowControls(true);

    if (x < SCREEN_WIDTH * 0.3) {
      // Tap left: go back
      if (currentPage > 0) {
        setCurrentPage(p => p - 1);
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      } else if (adjacentInfo.prevChapter) {
        router.replace(`/reader/${adjacentInfo.prevChapter.id}` as any);
      }
    } else if (x > SCREEN_WIDTH * 0.7) {
      // Tap right: go forward
      if (currentPage < totalPages - 1) {
        setCurrentPage(p => p + 1);
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      } else if (adjacentInfo.nextChapter) {
        router.replace(`/reader/${adjacentInfo.nextChapter.id}` as any);
      }
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#e94560" size="large" />
      </View>
    );
  }

  if (!chapter) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.errorText}>Chapter not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 10 }}>
          <Text style={styles.backLink}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Coin-locked gate ─────────────────────────────
  if (chapter.locked && !chapter.unlocked) {
    const cost = chapter.unlockCost ?? COIN_UNLOCK_COST;
    const balance = coinData?.balance ?? 0;
    const canAfford = balance >= cost;

    const handleUnlock = async () => {
      setUnlockError(null);
      try {
        await unlockChapter.mutateAsync(chapter.id);
      } catch {
        setUnlockError('Could not unlock this chapter. You may need more coins.');
      }
    };

    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Text style={styles.lockEmoji}>🔒</Text>
        <Text style={styles.lockTitle}>Chapter Locked</Text>
        <Text style={styles.lockMeta} numberOfLines={2}>
          Ch. {chapter.number} · {chapter.series.title}
        </Text>
        <Text style={styles.lockBalance}>
          Your balance: <Text style={{ color: '#f0c040' }}>{balance} 🪙</Text>
        </Text>

        {token ? (
          <TouchableOpacity
            style={[
              styles.unlockBtn,
              (!canAfford || unlockChapter.isPending) && styles.unlockBtnDisabled,
            ]}
            disabled={!canAfford || unlockChapter.isPending}
            onPress={handleUnlock}
          >
            <Text style={styles.unlockBtnText}>
              {unlockChapter.isPending
                ? 'Unlocking...'
                : canAfford
                ? `Unlock for ${cost} 🪙`
                : `Need ${cost - balance} more coins`}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.unlockBtn}
            onPress={() => router.push('/login' as any)}
          >
            <Text style={styles.unlockBtnText}>Sign in to unlock</Text>
          </TouchableOpacity>
        )}

        {unlockError && <Text style={styles.lockError}>{unlockError}</Text>}

        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 14 }}>
          <Text style={styles.backLink}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progressPct = totalPages > 0 ? Math.round(((currentPage + 1) / totalPages) * 100) : 0;
  const pageColors = ['#1a1a2e','#16213e','#0f3460','#1a1a3e','#2d1b69','#1b3a5e','#3d1b69','#1b5e3d','#5e1b3a','#3a5e1b','#1b3a2d','#4e2d1a'];

  return (
    <View style={styles.container}>
      {/* Top Controls */}
      {showControls && (
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backBtn}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.chapterInfo} numberOfLines={1}>
            {chapter.series.title} · Ch.{chapter.number}
          </Text>
          <View style={styles.progressDot}>
            <Text style={styles.progressDotText}>{progressPct}%</Text>
          </View>
        </View>
      )}

      {/* Reader Content */}
      {pagesLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color="#e94560" size="large" />
          <Text style={{ color: '#666', fontSize: 11, marginTop: 8 }}>Loading pages...</Text>
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={1}
          style={{ flex: 1 }}
          onPress={handleTap}
        >
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ alignItems: 'center', minHeight: '100%' }}
            showsVerticalScrollIndicator={false}
          >
            {/* Current Page - Real image with fallback */}
            <View
              style={[
                styles.pageContainer,
                { backgroundColor: pageColors[currentPage % pageColors.length] },
              ]}
            >
              {pages[currentPage] && !pageError ? (
                <View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                  {pageLoading && (
                    <ActivityIndicator color="#e94560" style={{ position: 'absolute', zIndex: 1 }} />
                  )}
                  <Image
                    source={{ uri: pages[currentPage].url }}
                    style={{ width: '100%', aspectRatio: 800/1200, maxHeight: '90%' }}
                    resizeMode="contain"
                    onLoad={() => setPageLoading(false)}
                    onError={() => { setPageLoading(false); setPageError(true); }}
                  />
                </View>
              ) : (
                <View style={styles.pageContent}>
                  <Text style={styles.pageNumber}>Ch. {chapter.number}</Text>
                  <Text style={styles.pageCount}>Page {currentPage + 1} of {totalPages}</Text>
                  <View style={styles.progressLine}>
                    <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
                  </View>
                  {pageError && (
                    <Text style={{ color: '#ff444460', fontSize: 12, marginTop: 8 }}>Image failed to load</Text>
                  )}
                  <View style={styles.panelPreview}>
                    <View style={styles.panelRow}>
                      <View style={[styles.panel, { backgroundColor: '#ffffff08' }]} />
                      <View style={[styles.panel, { backgroundColor: '#ffffff08' }]} />
                      <View style={[styles.panel, { backgroundColor: '#ffffff08' }]} />
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Bottom Controls */}
            <View style={styles.bottomBar}>
              <TouchableOpacity
                style={[
                  styles.navBtn,
                  (currentPage === 0 && !adjacentInfo.prevChapter) && styles.navBtnDisabled,
                ]}
                onPress={() => {
                  if (currentPage > 0) {
                    setCurrentPage(p => p - 1);
                    scrollRef.current?.scrollTo({ y: 0, animated: false });
                  } else if (adjacentInfo.prevChapter) {
                    router.replace(`/reader/${adjacentInfo.prevChapter.id}` as any);
                  }
                }}
                disabled={currentPage === 0 && !adjacentInfo.prevChapter}
              >
                <Text style={[styles.navText, (currentPage === 0 && !adjacentInfo.prevChapter) && styles.navTextDisabled]}>
                  ← Prev
                </Text>
              </TouchableOpacity>

              <Text style={styles.pageIndicator}>
                {currentPage + 1} / {totalPages}
              </Text>

              <TouchableOpacity
                style={[
                  styles.navBtn,
                  (currentPage >= totalPages - 1 && !adjacentInfo.nextChapter) && styles.navBtnDisabled,
                ]}
                onPress={() => {
                  if (currentPage < totalPages - 1) {
                    setCurrentPage(p => p + 1);
                    scrollRef.current?.scrollTo({ y: 0, animated: false });
                  } else if (adjacentInfo.nextChapter) {
                    router.replace(`/reader/${adjacentInfo.nextChapter.id}` as any);
                  }
                }}
                disabled={currentPage >= totalPages - 1 && !adjacentInfo.nextChapter}
              >
                <Text style={[styles.navText, (currentPage >= totalPages - 1 && !adjacentInfo.nextChapter) && styles.navTextDisabled]}>
                  Next →
                </Text>
              </TouchableOpacity>
            </View>

            {/* Keyboard/mode hint */}
            <Text style={styles.hint}>Tap left/right to navigate pages</Text>
          </ScrollView>
        </TouchableOpacity>
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    backgroundColor: '#0d0d1e',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a30',
    paddingHorizontal: 12,
  },
  backBtn: { color: '#e94560', fontSize: 12 },
  chapterInfo: { color: '#888', fontSize: 11, marginLeft: 12, flex: 1 },
  progressDot: {
    backgroundColor: '#e94560',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  progressDotText: { color: '#fff', fontSize: 9, fontWeight: '500' },
  errorText: { color: '#888', fontSize: 14 },
  backLink: { color: '#e94560', fontSize: 12 },
  pageContainer: {
    width: PAGE_WIDTH,
    minHeight: 500,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pageContent: { alignItems: 'center', gap: 16 },
  pageNumber: { color: '#e9456060', fontSize: 22, fontWeight: '300' },
  pageCount: { color: '#e9456040', fontSize: 14, fontWeight: '300' },
  progressLine: {
    width: 160,
    height: 3,
    backgroundColor: '#e9456030',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#e94560',
    borderRadius: 2,
  },
  panelPreview: {
    marginTop: 20,
    backgroundColor: '#e9456008',
    borderRadius: 8,
    padding: 16,
    width: 240,
  },
  panelRow: {
    flexDirection: 'row',
    gap: 8,
  },
  panel: {
    flex: 1,
    height: 60,
    borderRadius: 4,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    width: PAGE_WIDTH,
  },
  navBtn: {
    backgroundColor: '#1a1a2e',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  navBtnDisabled: { opacity: 0.3 },
  navText: { color: '#888', fontSize: 11 },
  navTextDisabled: { color: '#444' },
  pageIndicator: { color: '#666', fontSize: 11, flex: 1, textAlign: 'center' },
  hint: { color: '#444', fontSize: 9, paddingBottom: 40, paddingTop: 4 },
  lockEmoji: { fontSize: 44, marginBottom: 12 },
  lockTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 6 },
  lockMeta: { color: '#888', fontSize: 11, textAlign: 'center', marginBottom: 10 },
  lockBalance: { color: '#aaa', fontSize: 12, marginBottom: 18 },
  unlockBtn: {
    backgroundColor: '#e94560',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  unlockBtnDisabled: { backgroundColor: '#2a2a45' },
  unlockBtnText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  lockError: { color: '#ff4444', fontSize: 10, marginTop: 10, textAlign: 'center' },
});
