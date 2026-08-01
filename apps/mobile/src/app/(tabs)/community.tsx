import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import {
  useCommunityPosts, useCreatePost, useReadingClubs, useCreateClub,
  useJoinClub, useLeaveClub, usePredictions, useVotePrediction,
} from '../../lib/queryClient';

const TAG_COLORS: Record<string, string> = {
  theory: '#a05bdf',
  prediction: '#d4a017',
  discussion: '#4aa0e0',
  review: '#4ae0a0',
};

export default function CommunityScreen() {
  const router = useRouter();
  const { token } = useAuthStore();
  const [showCreate, setShowCreate] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postBody, setPostBody] = useState('');
  const [postTag, setPostTag] = useState('discussion');
  const [clubName, setClubName] = useState('');
  const [showCreateClub, setShowCreateClub] = useState(false);

  const { data: postsData, isLoading } = useCommunityPosts();
  const createPost = useCreatePost();
  const { data: clubsData } = useReadingClubs();
  const createClub = useCreateClub();
  const joinClub = useJoinClub();
  const leaveClub = useLeaveClub();
  const { data: predictionsData } = usePredictions();
  const votePrediction = useVotePrediction();

  const posts = postsData?.items || [];
  const clubs = clubsData?.items || [];
  const predictions = predictionsData?.items || [];

  const handleCreatePost = async () => {
    if (!token || postTitle.length < 3 || postBody.length < 10) return;
    try {
      await createPost.mutateAsync({ title: postTitle, body: postBody, tag: postTag });
      setPostTitle('');
      setPostBody('');
      setShowCreate(false);
    } catch {
      // Error handled by mutation
    }
  };

  const handleCreateClub = async () => {
    if (!token || clubName.length < 3) return;
    try {
      await createClub.mutateAsync(clubName);
      setClubName('');
      setShowCreateClub(false);
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Community</Text>
            <Text style={styles.headerSub}>Discussions · Clubs · Predictions</Text>
          </View>
          {token && (
            <TouchableOpacity
              style={styles.newPostBtn}
              onPress={() => setShowCreate(!showCreate)}
            >
              <Text style={styles.newPostBtnText}>{showCreate ? 'Cancel' : '+ New Post'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Create post form */}
        {showCreate && (
          <View style={styles.createCard}>
            <View style={styles.tagRow}>
              {['theory', 'prediction', 'discussion', 'review'].map((tag) => (
                <TouchableOpacity
                  key={tag}
                  onPress={() => setPostTag(tag)}
                  style={[styles.tagChip, postTag === tag && { backgroundColor: '#e94560' }]}
                >
                  <Text style={[styles.tagChipText, postTag === tag && { color: '#fff' }]}>
                    {tag.charAt(0).toUpperCase() + tag.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              value={postTitle}
              onChangeText={setPostTitle}
              placeholder="Post title (min. 3 chars)"
              placeholderTextColor="#555"
              style={styles.input}
            />
            <TextInput
              value={postBody}
              onChangeText={setPostBody}
              placeholder="Share your theory, prediction, or discussion..."
              placeholderTextColor="#555"
              style={[styles.input, styles.textArea]}
              multiline
              numberOfLines={4}
            />
            <TouchableOpacity
              style={[styles.primaryBtn, (postTitle.length < 3 || postBody.length < 10 || createPost.isPending) && styles.btnDisabled]}
              disabled={postTitle.length < 3 || postBody.length < 10 || createPost.isPending}
              onPress={handleCreatePost}
            >
              <Text style={styles.primaryBtnText}>{createPost.isPending ? 'Publishing...' : 'Publish'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Feed */}
        <Text style={styles.sectionTitle}>🔥 Recent Posts</Text>
        {isLoading ? (
          <ActivityIndicator color="#e94560" style={{ padding: 30 }} />
        ) : posts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No posts yet</Text>
            <Text style={styles.emptySub}>
              {token ? 'Be the first to start a discussion!' : 'Sign in to join the conversation.'}
            </Text>
          </View>
        ) : (
          posts.map((post) => (
            <TouchableOpacity
              key={post.id}
              style={styles.postCard}
              onPress={() => router.push(`/community/${post.id}` as any)}
            >
              <View style={styles.postHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{post.author.displayName.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.postMeta}>
                  <View style={styles.postMetaRow}>
                    <Text style={styles.postAuthor}>{post.author.displayName}</Text>
                    <View style={[styles.tagBadge, { backgroundColor: `${TAG_COLORS[post.tag] || '#4aa0e0'}22` }]}>
                      <Text style={[styles.tagBadgeText, { color: TAG_COLORS[post.tag] || '#4aa0e0' }]}>
                        {post.tag.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.postTime}>
                    {post.series ? post.series.title : 'Community'}
                  </Text>
                </View>
              </View>
              <Text style={styles.postTitle}>{post.title}</Text>
              <Text style={styles.postBody} numberOfLines={3}>{post.body}</Text>
              <View style={styles.postFooter}>
                <Text style={styles.postStat}>💬 {post.comments}</Text>
                <Text style={styles.postStat}>👁 {post.views}</Text>
                <Text style={[styles.postStat, post.voted && { color: '#e94560' }]}>⬆ {post.upvotes}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Clubs */}
        <View style={styles.clubHeaderRow}>
          <Text style={styles.sectionTitle}>📚 Reading Clubs</Text>
          {token && (
            <TouchableOpacity onPress={() => setShowCreateClub(!showCreateClub)}>
              <Text style={styles.linkText}>{showCreateClub ? 'Cancel' : '+ New'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {showCreateClub && (
          <View style={styles.createCard}>
            <TextInput
              value={clubName}
              onChangeText={setClubName}
              placeholder="Club name"
              placeholderTextColor="#555"
              style={styles.input}
            />
            <TouchableOpacity
              style={[styles.primaryBtn, (clubName.length < 3 || createClub.isPending) && styles.btnDisabled]}
              disabled={clubName.length < 3 || createClub.isPending}
              onPress={handleCreateClub}
            >
              <Text style={styles.primaryBtnText}>Create Club</Text>
            </TouchableOpacity>
          </View>
        )}

        {clubs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No clubs yet</Text>
          </View>
        ) : (
          clubs.slice(0, 5).map((club) => (
            <View key={club.id} style={styles.clubRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.clubName} numberOfLines={1}>{club.name}</Text>
                <Text style={styles.clubMembers}>{club.memberCount} members</Text>
              </View>
              {token && (
                <TouchableOpacity
                  onPress={() => (club.joined ? leaveClub.mutate(club.id) : joinClub.mutate(club.id))}
                  style={[styles.joinBtn, club.joined && styles.joinedBtn]}
                >
                  <Text style={[styles.joinBtnText, club.joined && styles.joinedBtnText]}>
                    {club.joined ? 'Joined' : 'Join'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}

        {/* Predictions */}
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>🔮 Predictions</Text>
        {predictions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No predictions open</Text>
          </View>
        ) : (
          predictions.slice(0, 3).map((pred) => {
            const closed = !!pred.result;
            return (
              <View key={pred.id} style={styles.predCard}>
                <Text style={styles.predQuestion}>{pred.question}</Text>
                {pred.title && (
                  <Text style={styles.predTitleLink}>{pred.title.title}</Text>
                )}
                {pred.result && (
                  <View style={styles.predResolvedBanner}>
                    <Text style={styles.predResolvedText}>✓ Resolved: {pred.result}</Text>
                  </View>
                )}
                <View style={{ marginTop: 8, gap: 6 }}>
                  {pred.options.slice(0, 2).map((opt) => {
                    const stake = pred.optionStakes[opt] || 0;
                    const pct = pred.totalStaked > 0 ? Math.round((stake / pred.totalStaked) * 100) : 0;
                    const isWinner = pred.result === opt;
                    return (
                      <TouchableOpacity
                        key={opt}
                        disabled={!token || !!pred.myVote || closed}
                        onPress={() => votePrediction.mutate({ predictionId: pred.id, option: opt, coins: 5 })}
                        style={[styles.predOption, isWinner && styles.predOptionWinner, closed && !isWinner && styles.predOptionClosed]}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={[styles.predOptionText, isWinner && styles.predOptionWinnerText]} numberOfLines={1}>
                            {opt}{isWinner ? ' ✓' : ''}
                          </Text>
                          <Text style={styles.predPct}>{pct}%</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <Text style={styles.predMeta}>🪙 {pred.totalStaked.toLocaleString()} staked</Text>
                  {pred.myVote && pred.result && pred.myVote.won ? (
                    <Text style={styles.predWon}>
                      {pred.myVote.payout && pred.myVote.payout > 0
                        ? `You won +${pred.myVote.payout} 🪙`
                        : 'Your pick won 🎉'}
                    </Text>
                  ) : pred.myVote && pred.result ? (
                    <Text style={styles.predLost}>You lost · {pred.myVote.option}</Text>
                  ) : pred.myVote ? (
                    <Text style={styles.predMyVote}>Your vote: {pred.myVote.option}</Text>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '600' },
  headerSub: { color: '#666', fontSize: 10, marginTop: 2 },
  newPostBtn: { backgroundColor: '#e94560', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  newPostBtnText: { color: '#fff', fontSize: 10, fontWeight: '500' },
  sectionTitle: { color: '#fff', fontSize: 13, fontWeight: '500', paddingHorizontal: 16, marginTop: 12, marginBottom: 8 },
  createCard: { backgroundColor: '#14142a', borderRadius: 12, marginHorizontal: 16, marginBottom: 10, padding: 12 },
  tagRow: { flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  tagChip: { backgroundColor: '#1e1e35', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  tagChipText: { color: '#aaa', fontSize: 9 },
  input: { backgroundColor: '#1a1a30', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#ddd', fontSize: 11, marginBottom: 8 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  primaryBtn: { backgroundColor: '#e94560', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 11, fontWeight: '500' },
  btnDisabled: { opacity: 0.4 },
  postCard: { backgroundColor: '#14142a', borderRadius: 12, marginHorizontal: 16, marginBottom: 8, padding: 12 },
  postHeader: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#e9456022', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#e94560', fontSize: 11, fontWeight: '600' },
  postMeta: { flex: 1 },
  postMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postAuthor: { color: '#eee', fontSize: 11, fontWeight: '500' },
  tagBadge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  tagBadgeText: { fontSize: 7, fontWeight: '600' },
  postTime: { color: '#666', fontSize: 9, marginTop: 2 },
  postTitle: { color: '#fff', fontSize: 13, fontWeight: '500', marginBottom: 4 },
  postBody: { color: '#999', fontSize: 11, lineHeight: 16 },
  postFooter: { flexDirection: 'row', gap: 14, marginTop: 8 },
  postStat: { color: '#666', fontSize: 10 },
  clubHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linkText: { color: '#e94560', fontSize: 10, paddingRight: 16 },
  clubRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#14142a', borderRadius: 10, marginHorizontal: 16, marginBottom: 6, padding: 10 },
  clubName: { color: '#ccc', fontSize: 11 },
  clubMembers: { color: '#666', fontSize: 9, marginTop: 2 },
  joinBtn: { backgroundColor: '#e94560', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  joinedBtn: { backgroundColor: '#1e1e35' },
  joinBtnText: { color: '#fff', fontSize: 9, fontWeight: '500' },
  joinedBtnText: { color: '#888' },
  predCard: { backgroundColor: '#14142a', borderRadius: 12, marginHorizontal: 16, marginBottom: 8, padding: 12 },
  predQuestion: { color: '#ddd', fontSize: 11, lineHeight: 16 },
  predTitleLink: { color: '#e94560', fontSize: 9, marginTop: 4 },
  predResolvedBanner: { marginTop: 8, borderRadius: 6, borderWidth: 1, borderColor: '#22c55e33', backgroundColor: '#22c55e0d', paddingHorizontal: 8, paddingVertical: 4 },
  predResolvedText: { color: '#4ade80', fontSize: 8, fontWeight: '600' },
  predOption: { backgroundColor: '#1a1a30', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  predOptionWinner: { backgroundColor: '#22c55e14', borderWidth: 1, borderColor: '#22c55e55' },
  predOptionClosed: { backgroundColor: '#1a1a3022', opacity: 0.6 },
  predOptionText: { color: '#bbb', fontSize: 10, flex: 1 },
  predOptionWinnerText: { color: '#4ade80', fontWeight: '500' },
  predPct: { color: '#d4a017', fontSize: 10, fontWeight: '500' },
  predMeta: { color: '#666', fontSize: 9 },
  predMyVote: { color: '#d4a017', fontSize: 9 },
  predWon: { color: '#4ade80', fontSize: 9, fontWeight: '600' },
  predLost: { color: '#f87171', fontSize: 9 },
  emptyCard: { backgroundColor: '#14142a', borderRadius: 12, marginHorizontal: 16, marginBottom: 8, padding: 20, alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 12 },
  emptySub: { color: '#555', fontSize: 10, marginTop: 4, textAlign: 'center' },
});
