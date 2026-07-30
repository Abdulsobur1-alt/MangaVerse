import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}><Text style={styles.avatarText}>AJ</Text></View>
          <Text style={styles.name}>Akin Johnson</Text>
          <Text style={styles.email}>akin.johnson@gmail.com</Text>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statBox}><Text style={styles.statNumber}>48</Text><Text style={styles.statLabel}>Reading</Text></View>
          <View style={[styles.statBox, styles.statBoxMiddle]}><Text style={styles.statNumber}>12</Text><Text style={styles.statLabel}>Completed</Text></View>
          <View style={styles.statBox}><Text style={styles.statNumber}>1,240</Text><Text style={styles.statLabel}>Chapters</Text></View>
        </View>

        <View style={styles.coinBanner}>
          <View><Text style={styles.coinLabel}>Coin Balance</Text><Text style={styles.coinValue}>💰 120 coins</Text></View>
          <TouchableOpacity style={styles.coinBtn}><Text style={styles.coinBtnText}>Buy Coins</Text></TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.premiumBanner}>
          <View><Text style={styles.premiumTitle}>Go Premium</Text><Text style={styles.premiumSub}>No ads · Offline · Early access</Text></View>
          <Text style={styles.premiumPrice}>$3.99/mo</Text>
        </TouchableOpacity>

        {[
          { icon: '🕐', label: 'Reading History' },
          { icon: '🔔', label: 'Notifications' },
          { icon: '🌙', label: 'Dark / Light Mode' },
          { icon: '⬇️', label: 'Downloads' },
          { icon: '❓', label: 'Help & Support' },
        ].map((item) => (
          <TouchableOpacity key={item.label} style={styles.menuItem}>
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuChevron}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', paddingBottom: 60 },
  profileHeader: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#e94560', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '500' },
  name: { color: '#fff', fontSize: 15, fontWeight: '500' },
  email: { color: '#666', fontSize: 10 },
  statRow: { flexDirection: 'row', paddingHorizontal: 14, paddingBottom: 14 },
  statBox: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', paddingVertical: 10 },
  statBoxMiddle: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#0f0f1a' },
  statNumber: { color: '#fff', fontSize: 16, fontWeight: '500' },
  statLabel: { color: '#666', fontSize: 9, marginTop: 2 },
  coinBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 10, marginHorizontal: 14, marginBottom: 12, padding: 12 },
  coinLabel: { color: '#666', fontSize: 10 },
  coinValue: { color: '#f0c040', fontSize: 18, fontWeight: '500' },
  coinBtn: { backgroundColor: '#e94560', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  coinBtnText: { color: '#fff', fontSize: 10 },
  premiumBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e94560', borderRadius: 10, marginHorizontal: 14, marginBottom: 8, padding: 10 },
  premiumTitle: { color: '#fff', fontSize: 11, fontWeight: '500' },
  premiumSub: { color: '#ffaaaa', fontSize: 9, marginTop: 2 },
  premiumPrice: { color: '#fff', fontSize: 11, fontWeight: '500' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a2e', gap: 12 },
  menuIcon: { fontSize: 16, width: 20 },
  menuLabel: { color: '#ccc', fontSize: 12, flex: 1 },
  menuChevron: { color: '#444', fontSize: 16 },
});
