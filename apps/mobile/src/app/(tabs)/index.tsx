import { ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTrending, useTitles } from '../../lib/queryClient';

export default function HomeScreen() {
  const router = useRouter();
  const { data: trending, isLoading: trendingLoading } = useTrending();
  const { data: latest } = useTitles({ sort: 'newest', limit: 8 });

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>Manga<span style={styles.logoAccent}>Verse</span></Text>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroBg} />
          <View style={styles.heroContent}>
            <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>🔥 Trending #1</Text></View>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {trending?.[0]?.title || 'Solo Leveling: Ragnarök'}
            </Text>
            <Text style={styles.heroMeta} numberOfLines={1}>
              {trending?.[0]?.genres?.slice(0, 3).join(' · ') || 'Action · Fantasy'}
            </Text>
          </View>
        </View>

        {/* Trending */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trending Now</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/browse' as any)}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {trendingLoading ? (
          <ActivityIndicator color="#e94560" style={{ padding: 20 }} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardRow} contentContainerStyle={styles.cardRowContent}>
            {trending?.slice(0, 8).map((item, idx) => (
              <TouchableOpacity key={item.id} style={styles.cardSm} onPress={() => router.push(`/title/${item.slug}` as any)}>
                <View style={[styles.cardCover, { backgroundColor: ['#2d1b69','#1a3a4e','#4e1a2d','#1a4e2d','#3a2d1a','#5e1b3a','#1b3a5e','#3d1b69'][idx] }]}>
                  <View style={styles.rankBadge}><Text style={styles.rankText}>#{idx + 1}</Text></View>
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.cardCh}>{item.type} · {item.rating?.toFixed(1) || 'N/A'}⭐</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Latest */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>New Releases</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardRow} contentContainerStyle={styles.cardRowContent}>
          {latest?.items?.slice(0, 6).map((item) => (
            <TouchableOpacity key={item.id} style={styles.cardSm} onPress={() => router.push(`/title/${item.slug}` as any)}>
              <View style={[styles.cardCover, { backgroundColor: ['#1e3a5e','#5e1e3a','#3a5e1e','#5e3a1e','#2d1b69','#1a3a2d'][Math.floor(Math.random()*6)] }]} />
              <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.cardCh}>{item.type}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  scroll: { flex: 1 },
  header: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  logo: { color: '#e94560', fontSize: 16, fontWeight: '600' },
  logoAccent: { color: '#7b2fbe' },
  hero: { height: 200, position: 'relative', overflow: 'hidden' },
  heroBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#1a1448' },
  heroContent: { position: 'absolute', bottom: 12, left: 14, right: 14 },
  heroBadge: { alignSelf: 'flex-start', backgroundColor: '#e94560', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 6 },
  heroBadgeText: { color: '#fff', fontSize: 9, fontWeight: '500' },
  heroTitle: { color: '#fff', fontSize: 16, fontWeight: '500' },
  heroMeta: { color: '#aaa', fontSize: 10, marginTop: 3 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingTop: 16, paddingBottom: 8 },
  sectionTitle: { color: '#fff', fontSize: 13, fontWeight: '500' },
  seeAll: { color: '#e94560', fontSize: 10 },
  cardRow: { marginBottom: 4 },
  cardRowContent: { paddingHorizontal: 14, gap: 10 },
  cardSm: { width: 80 },
  cardCover: { width: 80, height: 112, borderRadius: 8, justifyContent: 'flex-start', alignItems: 'flex-start' },
  rankBadge: { backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, margin: 4 },
  rankText: { color: '#fff', fontSize: 8 },
  cardTitle: { color: '#ccc', fontSize: 9, marginTop: 4, lineHeight: 12 },
  cardCh: { color: '#666', fontSize: 8, marginTop: 1 },
});
