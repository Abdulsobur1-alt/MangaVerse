import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const COLORS = {
  bg: '#0f0f1a',
  surface: '#1a1a2e',
  accent: '#e94560',
  text: '#fff',
  textSec: '#aaa',
  textMuted: '#666',
  border: '#1e1e35',
};

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>MangaVerse</Text>
          <View style={styles.headerIcons}>
            <Text style={styles.icon}>🔔</Text>
            <Text style={styles.icon}>🔍</Text>
          </View>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroBg} />
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>🔥 Trending #1</Text>
            </View>
            <Text style={styles.heroTitle}>Solo Leveling: Ragnarök</Text>
            <Text style={styles.heroMeta}>Action · Fantasy · Ch. 182 updated</Text>
          </View>
        </View>

        {/* Format Tags */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagRow}
          contentContainerStyle={styles.tagRowContent}
        >
          {['All', 'Manga', 'Manhwa', 'Manhua', 'Light Novel'].map((tag) => (
            <View key={tag} style={[styles.tag, tag === 'All' && styles.tagActive]}>
              <Text
                style={[styles.tagText, tag === 'All' && styles.tagTextActive]}
              >
                {tag}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Hot This Week */}
        <SectionHeader title="Hot This Week" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.cardRow}
          contentContainerStyle={styles.cardRowContent}
        >
          {[
            { title: "Omniscient Reader", ch: "Ch. 221", color: "#2d1b69" },
            { title: "Tower of God", ch: "Ch. 600", color: "#1a3a4e" },
            { title: "Eleceed", ch: "Ch. 270", color: "#4e1a2d" },
            { title: "Mercenary Enrollment", ch: "Ch. 154", color: "#1a4e2d" },
          ].map((item) => (
            <View key={item.title} style={styles.cardSm}>
              <View style={[styles.cardCover, { backgroundColor: item.color }]} />
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.cardCh}>{item.ch}</Text>
            </View>
          ))}
        </ScrollView>
      </ScrollView>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.seeAll}>See all</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  logo: { color: COLORS.text, fontSize: 16, fontWeight: '500' },
  headerIcons: { flexDirection: 'row', gap: 10 },
  icon: { fontSize: 18 },
  hero: {
    height: 200,
    position: 'relative',
    overflow: 'hidden',
  },
  heroBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1448',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  heroContent: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.accent,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  heroBadgeText: { color: '#fff', fontSize: 9, fontWeight: '500' },
  heroTitle: { color: COLORS.text, fontSize: 16, fontWeight: '500' },
  heroMeta: { color: COLORS.textSec, fontSize: 10, marginTop: 3 },
  tagRow: { marginTop: 8 },
  tagRowContent: { paddingHorizontal: 14, gap: 6 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: COLORS.border,
  },
  tagActive: { backgroundColor: COLORS.accent },
  tagText: { fontSize: 9, color: COLORS.textSec },
  tagTextActive: { color: '#fff' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  sectionTitle: { color: COLORS.text, fontSize: 13, fontWeight: '500' },
  seeAll: { color: COLORS.accent, fontSize: 10 },
  cardRow: { marginBottom: 4 },
  cardRowContent: { paddingHorizontal: 14, gap: 10 },
  cardSm: { width: 80 },
  cardCover: { width: 80, height: 112, borderRadius: 8 },
  cardTitle: {
    color: '#ccc',
    fontSize: 9,
    marginTop: 4,
  },
  cardCh: { color: COLORS.textMuted, fontSize: 8, marginTop: 1 },
});
