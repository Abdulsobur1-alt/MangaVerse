import { View, Text, ScrollView, StyleSheet } from 'react-native';

export default function BrowseScreen() {
  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Browse</Text>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchText}>Search titles...</Text>
        </View>

        {/* Genre Tags */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagRow}
        >
          {['All', 'Action', 'Romance', 'Isekai', 'Horror', 'Fantasy'].map(
            (tag) => (
              <View
                key={tag}
                style={[styles.tag, tag === 'All' && styles.tagActive]}
              >
                <Text
                  style={[
                    styles.tagText,
                    tag === 'All' && styles.tagTextActive,
                  ]}
                >
                  {tag}
                </Text>
              </View>
            ),
          )}
        </ScrollView>

        {/* Results Bar */}
        <View style={styles.resultsBar}>
          <Text style={styles.resultCount}>12,480 titles</Text>
          <View style={styles.filterBtn}>
            <Text style={styles.filterText}>Filter</Text>
          </View>
        </View>

        {/* Grid */}
        <View style={styles.grid}>
          {[
            { title: "Omniscient Reader's Viewpoint", badge: 'Manhwa' },
            { title: 'The Beginning After the End', badge: 'Manhwa' },
            { title: 'Demon Slayer', badge: 'Manga' },
            { title: 'Sword Art Online', badge: 'Light Novel' },
            { title: 'I Am the Sorcerer King', badge: 'Manhwa' },
            { title: 'Tales of Demons and Gods', badge: 'Manhua' },
            { title: 'One Piece', badge: 'Manga' },
            { title: 'Battle Through the Heavens', badge: 'Manhua' },
            { title: 'A Returners Magic', badge: 'Manhwa' },
          ].map((item) => (
            <View key={item.title} style={styles.gridCard}>
              <View
                style={[
                  styles.gridCover,
                  { backgroundColor: ['#2d1b69', '#1a3a2d', '#4e2d1a', '#1a2d4e', '#3a1a4e', '#1a4e3a', '#4e3a1a', '#1a4e4e', '#4e1a4e'][Math.floor(Math.random() * 9)] },
                ]}
              />
              <Text style={styles.gridTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={styles.gridBadge}>
                <Text style={styles.gridBadgeText}>{item.badge}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', paddingBottom: 60 },
  title: { color: '#fff', fontSize: 16, fontWeight: '500', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    marginHorizontal: 14,
    marginVertical: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchIcon: { fontSize: 14 },
  searchText: { color: '#444', fontSize: 12 },
  tagRow: { paddingHorizontal: 14, gap: 6, paddingBottom: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, backgroundColor: '#1e1e35' },
  tagActive: { backgroundColor: '#e94560' },
  tagText: { fontSize: 9, color: '#aaa' },
  tagTextActive: { color: '#fff' },
  resultsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  resultCount: { color: '#888', fontSize: 10 },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  filterText: { fontSize: 10, color: '#888' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    gap: 10,
  },
  gridCard: { width: '30%' },
  gridCover: { width: '100%', aspectRatio: 3 / 4, borderRadius: 8 },
  gridTitle: { color: '#ccc', fontSize: 9, marginTop: 4, lineHeight: 12 },
  gridBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1e1e35',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginTop: 2,
  },
  gridBadgeText: { color: '#aaa', fontSize: 7 },
});
