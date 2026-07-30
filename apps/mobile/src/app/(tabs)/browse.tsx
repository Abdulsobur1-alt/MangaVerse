import { useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useTitles, useSearch } from '../../lib/queryClient';
import type { TitleItem } from '../../lib/api';

const TAGS = ['All', 'Action', 'Romance', 'Isekai', 'Horror', 'Fantasy'];

export default function BrowseScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('All');
  const [page, setPage] = useState(1);

  const isSearching = search.length > 1;
  const { data: searchResults } = useSearch(isSearching ? search : '');
  const { data: browseData, isLoading } = useTitles({
    page,
    limit: 20,
    genre: activeTag === 'All' ? undefined : activeTag.toLowerCase(),
  });

  const items = isSearching ? searchResults?.items : browseData?.items;
  const total = isSearching ? searchResults?.total : browseData?.total;

  const renderItem = useCallback(({ item }: { item: TitleItem }) => (
    <TouchableOpacity
      style={styles.gridCard}
      onPress={() => router.push(`/title/${item.slug}` as any)}
    >
      <View style={[styles.gridCover, { backgroundColor: ['#2d1b69','#1a3a2d','#4e2d1a','#1a2d4e','#3a1a4e','#1a4e3a','#4e3a1a','#1a4e4e','#4e1a4e'][Math.floor(Math.random()*9)] }]} />
      <Text style={styles.gridTitle} numberOfLines={2}>{item.title}</Text>
      <View style={styles.typeBadge}><Text style={styles.typeText}>{item.type}</Text></View>
    </TouchableOpacity>
  ), [router]);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Browse</Text>

        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search titles..."
            placeholderTextColor="#444"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagRow}>
          {TAGS.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={[styles.tag, tag === activeTag && styles.tagActive]}
              onPress={() => { setActiveTag(tag); setPage(1); }}
            >
              <Text style={[styles.tagText, tag === activeTag && styles.tagActiveText]}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.resultBar}>
          <Text style={styles.resultCount}>{total || 0} titles</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color="#e94560" style={{ padding: 20 }} />
        ) : (
          <View style={styles.grid}>
            {items?.map((item) => (
              <View key={item.id} style={{ width: '30%' }}>
                {renderItem({ item })}
              </View>
            ))}
            {items?.length === 0 && (
              <Text style={{ color: '#666', fontSize: 12, textAlign: 'center', padding: 40, width: '100%' }}>
                No titles found
              </Text>
            )}
          </View>
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
  tagRow: { paddingHorizontal: 14, gap: 6, paddingBottom: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: '#1e1e35' },
  tagActive: { backgroundColor: '#e94560' },
  tagText: { fontSize: 10, color: '#aaa' },
  tagActiveText: { color: '#fff' },
  resultBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 8 },
  resultCount: { color: '#888', fontSize: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, gap: 10 },
  gridCard: { width: '100%' as any },
  gridCover: { width: '100%', aspectRatio: 3/4, borderRadius: 8 },
  gridTitle: { color: '#ccc', fontSize: 9, marginTop: 4, lineHeight: 12 },
  typeBadge: { alignSelf: 'flex-start', backgroundColor: '#1e1e35', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginTop: 2 },
  typeText: { color: '#aaa', fontSize: 7 },
});
