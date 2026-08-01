import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useUserStats } from '../../lib/hooks/useAuth';
import { useAchievements } from '../../lib/queryClient';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, token, logout } = useAuthStore();
  const { data: stats } = useUserStats();
  const { data: achievements } = useAchievements();

  const isLoggedIn = !!token;
  const chaptersRead = stats?.chaptersRead || 0;
  const totalBookmarks = stats?.totalBookmarks || 0;
  const streakDays = stats?.streakDays || 0;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {isLoggedIn && user ? (
          <>
            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user.displayName?.charAt(0)?.toUpperCase() || 'U'}
                </Text>
              </View>
              <Text style={styles.name}>{user.displayName}</Text>
              <Text style={styles.email}>{user.email}</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {user.subscriptionTier === 'premium' && (
                  <View style={styles.premiumBadge}>
                    <Text style={styles.premiumBadgeText}>⭐ Premium</Text>
                  </View>
                )}
                {(user.role === 'moderator' || user.role === 'admin') && (
                  <View style={[styles.premiumBadge, { backgroundColor: '#7b2fbe' }]}>
                    <Text style={styles.premiumBadgeText}>
                      {user.role === 'admin' ? '🛡️ Admin' : '🛡️ Moderator'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.statRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{totalBookmarks}</Text>
                <Text style={styles.statLabel}>Library</Text>
              </View>
              <View style={[styles.statBox, styles.statBoxMiddle]}>
                <Text style={styles.statNumber}>{chaptersRead}</Text>
                <Text style={styles.statLabel}>Chapters</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>🔥{streakDays}</Text>
                <Text style={styles.statLabel}>Streak</Text>
              </View>
            </View>

            <View style={styles.coinBanner}>
              <View>
                <Text style={styles.coinLabel}>Coin Balance</Text>
                <Text style={styles.coinValue}>💰 {user.coinBalance} coins</Text>
              </View>
              <TouchableOpacity style={styles.coinBtn}>
                <Text style={styles.coinBtnText}>Buy Coins</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={logout} style={styles.signOutBtn}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>

            {achievements && achievements.items.length > 0 && (
              <View style={styles.achievementsSection}>
                <View style={styles.achievementsHeader}>
                  <Text style={styles.achievementsTitle}>🏆 Achievements</Text>
                  <Text style={styles.achievementsCount}>
                    {achievements.earned} / {achievements.total}
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${achievements.total > 0 ? (achievements.earned / achievements.total) * 100 : 0}%` },
                    ]}
                  />
                </View>
                <View style={styles.badgeGrid}>
                  {achievements.items.map((badge) => (
                    <View
                      key={badge.id}
                      style={[
                        styles.badgeCell,
                        badge.earned ? styles.badgeEarned : styles.badgeLocked,
                      ]}
                    >
                      <Text style={[styles.badgeEmoji, !badge.earned && styles.badgeEmojiLocked]}>
                        {badge.emoji}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[styles.badgeName, badge.earned ? styles.badgeNameEarned : styles.badgeNameLocked]}
                      >
                        {badge.name}
                      </Text>
                      {!badge.earned && (
                        <Text style={styles.badgeProgress}>
                          {badge.current}/{badge.target}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>?</Text>
            </View>
            <Text style={styles.name}>Guest Reader</Text>
            <Text style={styles.email}>Sign in to get started</Text>
            <View style={styles.coinBanner}>
              <View>
                <Text style={styles.coinLabel}>Coin Balance</Text>
                <Text style={styles.coinValue}>💰 0 coins</Text>
              </View>
              <TouchableOpacity style={styles.coinBtn} onPress={() => router.push('/login' as any)}>
                <Text style={styles.coinBtnText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.premiumBanner}>
          <View>
            <Text style={styles.premiumTitle}>Go Premium</Text>
            <Text style={styles.premiumSub}>No ads · Offline · Early access</Text>
          </View>
          <Text style={styles.premiumPrice}>$3.99/mo</Text>
        </TouchableOpacity>

        {[
          { icon: '🕐', label: 'Reading History' },
          { icon: '📚', label: 'My Library' },
          { icon: '🔔', label: 'Notifications' },
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
  premiumBadge: { backgroundColor: '#7b2fbe', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 2 },
  premiumBadgeText: { color: '#fff', fontSize: 9, fontWeight: '500' },
  statRow: { flexDirection: 'row', paddingHorizontal: 14, paddingBottom: 14 },
  statBox: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', paddingVertical: 10, borderRadius: 6 },
  statBoxMiddle: { marginHorizontal: 4 },
  statNumber: { color: '#fff', fontSize: 16, fontWeight: '500' },
  statLabel: { color: '#666', fontSize: 9, marginTop: 2 },
  coinBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 10, marginHorizontal: 14, marginBottom: 12, padding: 12 },
  coinLabel: { color: '#666', fontSize: 10 },
  coinValue: { color: '#f0c040', fontSize: 18, fontWeight: '500' },
  coinBtn: { backgroundColor: '#e94560', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  coinBtnText: { color: '#fff', fontSize: 10 },
  achievementsSection: { marginHorizontal: 14, marginBottom: 12, backgroundColor: '#14142a', borderRadius: 12, padding: 12 },
  achievementsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  achievementsTitle: { color: '#a05bdf', fontSize: 11, fontWeight: '600' },
  achievementsCount: { color: '#888', fontSize: 10 },
  progressTrack: { height: 3, backgroundColor: '#2a2a45', borderRadius: 2, overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: '100%', backgroundColor: '#a05bdf', borderRadius: 2 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgeCell: { width: '30%', alignItems: 'center', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 4 },
  badgeEarned: { backgroundColor: '#2d1b69' },
  badgeLocked: { backgroundColor: '#1a1a30' },
  badgeEmoji: { fontSize: 20, marginBottom: 4 },
  badgeEmojiLocked: { opacity: 0.35 },
  badgeName: { fontSize: 8, textAlign: 'center' },
  badgeNameEarned: { color: '#d4a017', fontWeight: '500' },
  badgeNameLocked: { color: '#666' },
  badgeProgress: { color: '#555', fontSize: 8, marginTop: 2 },
  signOutBtn: { alignSelf: 'center', marginTop: 4, marginBottom: 12, paddingHorizontal: 18, paddingVertical: 8, borderWidth: 1, borderColor: '#2a2a45', borderRadius: 20 },
  signOutText: { color: '#f87171', fontSize: 10, fontWeight: '500' },
  premiumBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e94560', borderRadius: 10, marginHorizontal: 14, marginBottom: 8, padding: 10 },
  premiumTitle: { color: '#fff', fontSize: 11, fontWeight: '500' },
  premiumSub: { color: '#ffaaaa', fontSize: 9, marginTop: 2 },
  premiumPrice: { color: '#fff', fontSize: 11, fontWeight: '500' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a2e', gap: 12 },
  menuIcon: { fontSize: 16, width: 20 },
  menuLabel: { color: '#ccc', fontSize: 12, flex: 1 },
  menuChevron: { color: '#444', fontSize: 16 },
});
