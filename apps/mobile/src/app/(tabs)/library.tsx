import { View, Text, ScrollView, StyleSheet } from 'react-native';

export default function LibraryScreen() {
  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>My Library</Text>
        </View>

        {/* Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagRow}
        >
          {['All', 'Reading', 'Completed', 'On Hold'].map((tag) => (
            <View
              key={tag}
              style={[styles.tag, tag === 'All' && styles.tagActive]}
            >
              <Text
                style={[styles.tagText, tag === 'All' && styles.tagTextActive]}
              >
                {tag}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Library Items */}
        {[
          { title: 'Omniscient Reader', progress: 89, ch: 'Ch. 198 / 221', updated: 'Updated 2h ago', color: '#2d1b69', isNew: true },
          { title: 'Solo Leveling: Ragnarök', progress: 24, ch: 'Ch. 44 / 182', updated: 'Updated 1d ago', color: '#4e2d1a', isNew: true },
          { title: 'The Beginning After the End', progress: 92, ch: 'Ch. 180 / 195', updated: 'Up to date', color: '#1a4e2d', isNew: false },
          { title: 'Chainsaw Man', progress: 71, ch: 'Ch. 120 / 168', updated: 'Updated 5h ago', color: '#4e1a3a', isNew: true },
          { title: 'Sword Art Online (LN)', progress: 44, ch: 'Vol. 12 / 27', updated: 'Up to date', color: '#1a2d4e', isNew: false },
        ].map((item) => (
          <View key={item.title} style={styles.libItem}>
            <View style={[styles.libCover, { backgroundColor: item.color }]} />
            <View style={styles.libInfo}>
              <Text style={styles.libTitle}>{item.title}</Text>
              <Text style={styles.libSub}>{item.ch}</Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${item.progress}%` },
                  ]}
                />
              </View>
              <Text style={styles.libSub}>{item.updated}</Text>
            </View>
            {item.isNew && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEW</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', paddingBottom: 60 },
  header: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  title: { color: '#fff', fontSize: 16, fontWeight: '500' },
  tagRow: { paddingHorizontal: 14, gap: 6, paddingBottom: 10 },
  tag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, backgroundColor: '#1e1e35' },
  tagActive: { backgroundColor: '#e94560' },
  tagText: { fontSize: 9, color: '#aaa' },
  tagTextActive: { color: '#fff' },
  libItem: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
    alignItems: 'center',
    gap: 10,
  },
  libCover: { width: 52, height: 72, borderRadius: 6 },
  libInfo: { flex: 1 },
  libTitle: { color: '#fff', fontSize: 12, fontWeight: '500' },
  libSub: { color: '#666', fontSize: 10, marginTop: 1 },
  progressBar: { height: 3, backgroundColor: '#1e1e35', borderRadius: 2, marginTop: 6 },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: '#e94560' },
  newBadge: { backgroundColor: '#e94560', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  newBadgeText: { color: '#fff', fontSize: 8 },
});
