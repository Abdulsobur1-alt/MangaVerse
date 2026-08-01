import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '../../../store/authStore';
import {
  useCommunityPost, useVotePost, useAddComment,
} from '../../../lib/queryClient';

export default function CommunityPostScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuthStore();
  const { data: post, isLoading } = useCommunityPost(id || '');
  const votePost = useVotePost();
  const addComment = useAddComment();
  const [commentBody, setCommentBody] = useState('');

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#e94560" size="large" />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.errorText}>Post not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 10 }}>
          <Text style={styles.backLink}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleVote = async () => {
    if (!token) return;
    try {
      await votePost.mutateAsync(post.id);
    } catch {
      // Error handled by mutation
    }
  };

  const handleComment = async () => {
    if (!token || commentBody.trim().length === 0) return;
    try {
      await addComment.mutate({ postId: post.id, body: commentBody.trim() });
      setCommentBody('');
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Text style={styles.backLink}>← Back to Community</Text>
        </TouchableOpacity>

        {/* Post */}
        <View style={styles.postCard}>
          <View style={styles.postHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{post.author.displayName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.postAuthor}>{post.author.displayName}</Text>
                <View style={[styles.tagBadge, { backgroundColor: '#d4a01722' }]}>
                  <Text style={[styles.tagBadgeText, { color: '#d4a017' }]}>{post.tag.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.postTime}>
                {post.series ? post.series.title : 'Community'} · {post.views} views
              </Text>
            </View>
          </View>

          <Text style={styles.postTitle}>{post.title}</Text>
          <Text style={styles.postBody}>{post.body}</Text>

          <TouchableOpacity
            onPress={handleVote}
            disabled={!token || votePost.isPending}
            style={[styles.voteBtn, post.voted && styles.voteBtnActive]}
          >
            <Text style={[styles.voteBtnText, post.voted && styles.voteBtnTextActive]}>
              {post.voted ? '▲ Upvoted' : '▲ Upvote'} · {post.upvotes}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Comments */}
        <Text style={styles.sectionTitle}>💬 Replies ({post.comments.length})</Text>

        {token ? (
          <View style={styles.commentInputRow}>
            <TextInput
              value={commentBody}
              onChangeText={setCommentBody}
              placeholder="Write a reply..."
              placeholderTextColor="#555"
              style={styles.commentInput}
              onSubmitEditing={handleComment}
            />
            <TouchableOpacity
              onPress={handleComment}
              disabled={commentBody.trim().length === 0 || addComment.isPending}
              style={[styles.replyBtn, (commentBody.trim().length === 0 || addComment.isPending) && styles.btnDisabled]}
            >
              <Text style={styles.replyBtnText}>{addComment.isPending ? '...' : 'Reply'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.loginHint}>
            <Text style={styles.loginHintText}>Sign in to join the discussion.</Text>
          </View>
        )}

        {post.comments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No replies yet. Be the first!</Text>
          </View>
        ) : (
          post.comments.map((comment) => (
            <View key={comment.id} style={styles.commentCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <View style={styles.commentAvatar}>
                  <Text style={styles.commentAvatarText}>{comment.author.displayName.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.commentAuthor}>{comment.author.displayName}</Text>
              </View>
              <Text style={styles.commentBody}>{comment.body}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  backRow: { paddingHorizontal: 16, paddingTop: 14 },
  backLink: { color: '#e94560', fontSize: 11 },
  errorText: { color: '#888', fontSize: 14 },
  postCard: { backgroundColor: '#14142a', borderRadius: 12, margin: 16, marginBottom: 8, padding: 14 },
  postHeader: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#e9456022', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#e94560', fontSize: 12, fontWeight: '600' },
  postAuthor: { color: '#eee', fontSize: 12, fontWeight: '500' },
  tagBadge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  tagBadgeText: { fontSize: 7, fontWeight: '600' },
  postTime: { color: '#666', fontSize: 9, marginTop: 3 },
  postTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8, lineHeight: 22 },
  postBody: { color: '#bbb', fontSize: 12, lineHeight: 19 },
  voteBtn: { backgroundColor: '#1e1e35', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, alignSelf: 'flex-start', marginTop: 12 },
  voteBtnActive: { backgroundColor: '#e9456022' },
  voteBtnText: { color: '#888', fontSize: 10 },
  voteBtnTextActive: { color: '#e94560', fontWeight: '500' },
  sectionTitle: { color: '#fff', fontSize: 13, fontWeight: '500', paddingHorizontal: 16, marginTop: 12, marginBottom: 8 },
  commentInputRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  commentInput: { flex: 1, backgroundColor: '#1a1a30', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#ddd', fontSize: 11 },
  replyBtn: { backgroundColor: '#e94560', borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
  replyBtnText: { color: '#fff', fontSize: 10, fontWeight: '500' },
  btnDisabled: { opacity: 0.4 },
  loginHint: { backgroundColor: '#14142a', borderRadius: 8, marginHorizontal: 16, padding: 10 },
  loginHintText: { color: '#666', fontSize: 10 },
  commentCard: { backgroundColor: '#14142a', borderRadius: 10, marginHorizontal: 16, marginBottom: 8, padding: 12 },
  commentAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#e9456022', justifyContent: 'center', alignItems: 'center' },
  commentAvatarText: { color: '#e94560', fontSize: 9, fontWeight: '600' },
  commentAuthor: { color: '#ddd', fontSize: 11, fontWeight: '500' },
  commentBody: { color: '#999', fontSize: 11, lineHeight: 17 },
  emptyCard: { backgroundColor: '#14142a', borderRadius: 12, marginHorizontal: 16, padding: 20, alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 11 },
});
