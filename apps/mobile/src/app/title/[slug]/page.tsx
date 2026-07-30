import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTitle, useChapters } from '../../../lib/queryClient';

export default function TitleDetailScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: title, isLoading } = useTitle(slug || '');
  const { data: chaptersData } = useChapters(slug);

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#e94560" size="large" />
      </View>
    );
  }

  if (!title) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#888' }}>Title not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Back + Cover */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.coverSection}>
          <View style={[styles.cover, { backgroundColor: '#2d1b69' }]}>
            <Text style={styles.coverPlaceholder}>{title.title}</Text>
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.titleText}>{title.title}</Text>

          <View style={styles.metaRow}>
            <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>{title.type}</Text></View>
            <View style={[styles.statusBadge, { backgroundColor: title.status === 'ongoing' ? '#1a3a1a' : '#3a1a1a' }]}>
              <Text style={[styles.statusText, { color: title.status === 'ongoing' ? '#4ade80' : '#f87171' }]}>
                {title.status.charAt(0).toUpperCase() + title.status.slice(1)}
              </Text>
            </View>
            {title.rating && <Text style={styles.ratingText}>⭐ {title.rating.toFixed(1)}</Text>}
          </View>

          <View style={styles.genreRow}>
            {title.genres?.slice(0, 5).map((g) => (
              <View key={g} style={styles.genrePill}><Text style={styles.genreText}>{g.replace(/_/g, ' ')}</Text></View>
            ))}
          </View>

          {title.author && <Text style={styles.authorText}>By {title.author}{title.artist ? ` · ${title.artist}` : ''}</Text>}

          {title.synopsis && (
            <View style={styles.synopsisSection}>
              <Text style={styles.synopsisTitle}>Synopsis</Text>
              <Text style={styles.synopsisText}>{title.synopsis}</Text>
            </View>
          )}

          {/* Chapters */}
          <Text style={styles.chSectionTitle}>Chapters · {chaptersData?.total || title._count?.chapters || 0}</Text>
          {chaptersData?.items?.slice(0, 20).map((ch) => (
            <TouchableOpacity
              key={ch.id}
              style={styles.chapterItem}
              onPress={() => router.push(`/reader/${ch.id}` as any)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.chapterNumber}>Ch. {ch.number}</Text>
                {ch.title && <Text style={styles.chapterTitle}>{ch.title}</Text>}
              </View>
              <Text style={styles.chapterMeta}>{ch.pageCount || '?'}p</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  backBtn: { padding: 14, paddingBottom: 4 },
  backText: { color: '#e94560', fontSize: 12 },
  coverSection: { alignItems: 'center', padding: 14 },
  cover: { width: 180, height: 240, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  coverPlaceholder: { color: '#ccc', fontSize: 12, textAlign: 'center', padding: 10 },
  infoSection: { padding: 14, paddingTop: 0 },
  titleText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  typeBadge: { backgroundColor: '#e94560', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  typeBadgeText: { color: '#fff', fontSize: 9, fontWeight: '500' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 9, fontWeight: '500' },
  ratingText: { fontSize: 10, color: '#f0c040' },
  genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  genrePill: { backgroundColor: '#1e1e35', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  genreText: { color: '#aaa', fontSize: 8 },
  authorText: { color: '#666', fontSize: 10, marginTop: 6 },
  synopsisSection: { marginTop: 12 },
  synopsisTitle: { color: '#888', fontSize: 10, fontWeight: '600', marginBottom: 4 },
  synopsisText: { color: '#aaa', fontSize: 11, lineHeight: 17 },
  chSectionTitle: { color: '#ccc', fontSize: 14, fontWeight: '500', marginTop: 16, marginBottom: 8 },
  chapterItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  chapterNumber: { color: '#ccc', fontSize: 12 },
  chapterTitle: { color: '#666', fontSize: 10, marginTop: 1 },
  chapterMeta: { color: '#555', fontSize: 10 },
});
