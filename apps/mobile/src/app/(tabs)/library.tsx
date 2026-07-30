import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useLibrary, useRemoveBookmark, type BookmarkItem } from '../../lib/hooks/useLibrary';

const COLORS = ['#2d1b69','#4e2d1a','#1a4e2d','#1a2d4e','#4e1a3a'];
const LIST_NAMES = ['Reading', 'Plan to Read', 'Completed', 'On Hold', 'Dropped'];

function getColor(index: number): string {
  return COLORS[index % COLORS.length];
}

export default function LibraryScreen() {
  const router = useRouter();
  const [activeList, setActiveList] = useState('Reading');
  const { data: libraryData, isLoading } = useLibrary();
  const removeBookmark = useRemoveBookmark();

  const items: BookmarkItem[] = libraryData?.items || [];
  const filtered = activeList === 'Reading'
    ? items
    : items.filter((b: BookmarkItem) => b.listName === activeList);

  const counts: Record<string, number> = {};
  items.forEach((b: BookmarkItem) => { counts[b.listName] = (counts[b.listName] || 0) + 1; });

  const handleRemove = (titleId: string, title: string) => {
    Alert.alert('Remove from Library', `Remove "${title}" from your library?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeBookmark.mutate(titleId) },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>My Library</Text>
          {!isLoading && <Text style={styles.count}>{libraryData?.total || 0} titles</Text>}
        </View>

        {/* List tags */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagRow}>
          {LIST_NAMES.map((name) => {
            const c = counts[name] || 0;
            return (
              <TouchableOpacity
                key={name}
                style={[styles.tag, activeList === name && styles.tagActive]}
                onPress={() => setActiveList(name)}
              >
                <Text style={[styles.tagText, activeList === name && styles.tagActiveText]}>
                  {name} ({c})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {isLoading ? (
          <ActivityIndicator color="#e94560" style={{ padding: 40 }} />
        ) : (
          <>
            {filtered.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Your library is empty</Text>
                <TouchableOpacity
                  style={styles.browseBtn}
                  onPress={() => router.push('/(tabs)/browse' as any)}
                >
                  <Text style={styles.browseBtnText}>Browse Manga</Text>
                </TouchableOpacity>
              </View>
            ) : (
              filtered.map((bookmark: BookmarkItem) => (
                <TouchableOpacity
                  key={bookmark.id}
                  style={styles.libItem}
                  onPress={() => router.push(`/title/${bookmark.title.slug}` as any)}
                  onLongPress={() => handleRemove(bookmark.titleId, bookmark.title.title)}
                >
                  <View style={[styles.libCover, { backgroundColor: getColor(filtered.indexOf(bookmark)) }]} />
                  <View style={styles.libInfo}>
                    <Text style={styles.libTitle} numberOfLines={1}>{bookmark.title.title}</Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.libSub}>{bookmark.title.type}</Text>
                      <Text style={styles.libList}>{bookmark.listName}</Text>
                    </View>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', paddingBottom: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  title: { color: '#fff', fontSize: 16, fontWeight: '500' },
  count: { color: '#666', fontSize: 10 },
  tagRow: { paddingHorizontal: 14, gap: 6, paddingBottom: 10 },
  tag: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: '#1e1e35' },
  tagActive: { backgroundColor: '#e94560' },
  tagText: { fontSize: 10, color: '#aaa' },
  tagActiveText: { color: '#fff' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#666', fontSize: 13, marginBottom: 16 },
  browseBtn: { backgroundColor: '#e94560', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  browseBtnText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  libItem: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1a1a2e', alignItems: 'center', gap: 10 },
  libCover: { width: 44, height: 60, borderRadius: 6 },
  libInfo: { flex: 1 },
  libTitle: { color: '#fff', fontSize: 12, fontWeight: '500' },
  metaRow: { flexDirection: 'row', gap: 6, marginTop: 1 },
  libSub: { color: '#666', fontSize: 9 },
  libList: { color: '#e94560', fontSize: 9 },
  chevron: { color: '#444', fontSize: 18 },
});
