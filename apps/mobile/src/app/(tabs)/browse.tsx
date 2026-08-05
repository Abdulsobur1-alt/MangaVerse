import { useState, useRef } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTitles, useSearch } from '../../lib/queryClient';
import type { TitleItem } from '../../lib/api';

const FORMATS = ['All', 'manga', 'manhwa', 'manhua', 'light_novel'];
const SORTS = ['trending', 'newest', 'rating'];
const COVER_COLORS = ['#2d1b69','#1a3a2d','#4e2d1a','#1a2d4e','#3a1a4e','#1a4e3a','#4e3a1a','#1a4e4e','#4e1a4e'];

/** Deterministic placeholder color so covers don't shift on every re-render. */
function coverColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return COVER_COLORS[hash % COVER_COLORS.length];
}

export default function BrowseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ genre?: string }>();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFormat, setActiveFormat] = useState('All');
  const [sort, setSort] = useState('trending');
  const [page, setPage] = useState(1);

  // Read optional genre filter from the URL (set by home screen genre chips)
  const urlGenre = typeof params.genre === 'string' ? params.genre : undefined;

  const isSearching = debouncedSearch.length > 1;
  const { data: searchResults } = useSearch(isSearching ? debouncedSearch : '');
  const { data: browseData, isLoading } = useTitles({
    page,
    limit: 20,
    type: activeFormat === 'All' ? undefined : activeFormat,
    genre: urlGenre,
    sort,
  });

  const items = (isSearching ? searchResults?.items : browseData?.items) as TitleItem[] | undefined;
  const total = isSearching ? searchResults?.total : browseData?.total;

  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleSearch = (text: string) => {
    setSearch(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(text);
      setPage(1);
    }, 400);
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Browse</Text>

        {/* Search */}
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search titles..."
            placeholderTextColor="#444"
            value={search}
            onChangeText={handleSearch}
          />
        </View>

        {/* Format pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagRow}>
          {FORMATS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.tag, (f === 'All' && activeFormat === 'All') || f === activeFormat ? styles.tagActive : null]}
              onPress={() => { setActiveFormat(f); setPage(1); }}
            >
              <Text style={[styles.tagText, (f === 'All' && activeFormat === 'All') || f === activeFormat ? styles.tagActiveText : null]}>
                {f === 'light_novel' ? 'Light Novel' : f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Active genre filter (from home chips) */}
        {urlGenre && (
          <View style={styles.genreFilterBar}>
            <View style={styles.genreFilterTag}>
              <Text style={styles.genreFilterText}>Genre: {urlGenre.charAt(0).toUpperCase() + urlGenre.slice(1)}</Text>
              <TouchableOpacity onPress={() => { setPage(1); router.setParams({ genre: '' }); }}>
                <Text style={styles.genreFilterClear}>×</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Sort + result count */}
        <View style={styles.resultBar}>
          <Text style={styles.resultCount}>{total || 0} titles</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortRow}>
            {SORTS.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.sortPill, sort === s && styles.sortPillActive]}
                onPress={() => setSort(s)}
              >
                <Text style={[styles.sortText, sort === s && styles.sortTextActive]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Results */}
        {isLoading ? (
          <ActivityIndicator color="#e94560" style={{ padding: 20 }} />
        ) : (
          <>
            <View style={styles.grid}>
              {items?.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.gridCard}
                  onPress={() => router.push(`/title/${item.slug}` as any)}
                >
                  <View style={[styles.gridCover, { backgroundColor: coverColor(item.id) }]} />
                  <Text style={styles.gridTitle} numberOfLines={2}>{item.title}</Text>
                  <View style={styles.metaRow}>
                    <View style={styles.typeBadge}><Text style={styles.typeText}>{item.type?.slice(0, 2)}</Text></View>
                    {item.rating && <Text style={styles.ratingText}>⭐{item.rating.toFixed(1)}</Text>}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {items?.length === 0 && (
              <Text style={{ color: '#666', fontSize: 12, textAlign: 'center', padding: 40 }}>
                No titles found
              </Text>
            )}

            {/* Pagination */}
            {(browseData?.total || 0) > 20 && (
              <View style={styles.pageNav}>
                <TouchableOpacity
                  style={[styles.pageBtn, page <= 1 && { opacity: 0.3 }]}
                  disabled={page <= 1}
                  onPress={() => setPage(p => Math.max(1, p - 1))}
                >
                  <Text style={styles.pageBtnText}>← Prev</Text>
                </TouchableOpacity>
                <Text style={styles.pageIndicator}>{page} / {Math.ceil((browseData?.total || 0) / 20)}</Text>
                <TouchableOpacity
                  style={[styles.pageBtn, !browseData?.hasMore && { opacity: 0.3 }]}
                  disabled={!browseData?.hasMore}
                  onPress={() => setPage(p => p + 1)}
                >
                  <Text style={styles.pageBtnText}>Next →</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', paddingBottom: 60 },
  title: { color: '#fff', fontSize: 16, fontWeight: '500', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
  searchBar: { backgroundColor: '#1a1a2e', borderRadius: 10, marginHorizontal: 14, marginVertical: 10, paddingHorizontal: 12, paddingVertical: 2 },
  searchInput: { color: '#ccc', fontSize: 12, paddingVertical: 8 },
  tagRow: { paddingHorizontal: 14, gap: 6, paddingBottom: 6 },
  tag: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: '#1e1e35' },
  tagActive: { backgroundColor: '#e94560' },
  tagText: { fontSize: 10, color: '#aaa' },
  tagActiveText: { color: '#fff' },
  genreFilterBar: { flexDirection: 'row', paddingHorizontal: 14, paddingBottom: 8 },
  genreFilterTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#7b2fbe20', borderColor: '#7b2fbe40', borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  genreFilterText: { color: '#b57de0', fontSize: 10 },
  genreFilterClear: { color: '#b57de0', fontSize: 13, marginLeft: 2 },
  resultBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 8 },
  resultCount: { color: '#888', fontSize: 9 },
  sortRow: { flex: 1, marginLeft: 8 },
  sortPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: '#1e1e35', marginRight: 4 },
  sortPillActive: { backgroundColor: '#e9456020' },
  sortText: { fontSize: 9, color: '#888' },
  sortTextActive: { color: '#e94560' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, gap: 10 },
  gridCard: { width: '30%' },
  gridCover: { width: '100%', aspectRatio: 3/4, borderRadius: 8 },
  gridTitle: { color: '#ccc', fontSize: 9, marginTop: 4, lineHeight: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  typeBadge: { backgroundColor: '#1e1e35', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  typeText: { color: '#aaa', fontSize: 7 },
  ratingText: { color: '#f0c040', fontSize: 8 },
  pageNav: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, paddingVertical: 16 },
  pageBtn: { backgroundColor: '#1e1e35', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  pageBtnText: { color: '#888', fontSize: 11 },
  pageIndicator: { color: '#666', fontSize: 11 },
});
