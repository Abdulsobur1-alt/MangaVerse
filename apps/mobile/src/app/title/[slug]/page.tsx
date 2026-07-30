import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTitle, useTitleReviews, useCreateReview, useDeleteReview } from '../../../lib/queryClient';

const CH_PER_PAGE = 50;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function TitleDetailScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const slugStr = typeof slug === 'string' ? slug : '';
  const [chaptersPage, setChaptersPage] = useState(1);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState('');
  const { data: title, isLoading } = useTitle(slugStr, chaptersPage, CH_PER_PAGE);
  const { data: reviewsData } = useTitleReviews(slugStr, { page: reviewsPage, limit: 5 });
  const createReview = useCreateReview(slugStr);
  const deleteReview = useDeleteReview();

  const handleSubmitReview = async () => {
    if (reviewBody.length < 10) return;
    try {
      await createReview.mutateAsync({ rating: reviewRating, body: reviewBody });
      setShowReviewForm(false);
      setReviewBody('');
      setReviewRating(5);
    } catch {}
  };

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

  const chapters = title.chapters || [];
  const pagination = title.chaptersPagination || { page: 1, total: 0, hasMore: false };
  const readCount = chapters.filter(ch => ch.progress?.completed).length;
  const totalPages = Math.ceil(pagination.total / CH_PER_PAGE);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {/* Cover + Action area */}
        <View style={styles.coverSection}>
          <View style={[styles.cover, { backgroundColor: '#2d1b69' }]}>
            <Text style={styles.coverPlaceholder}>{title.title}</Text>
          </View>
          <View style={styles.coverActions}>
            <TouchableOpacity
              style={styles.readBtn}
              onPress={() => chapters[0] && router.push(`/reader/${chapters[0].id}` as any)}
            >
              <Text style={styles.readBtnText}>▶ Start Reading</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.titleText}>{title.title}</Text>
          {title.alternativeTitles && (
            <Text style={styles.altTitleText}>{title.alternativeTitles}</Text>
          )}

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
            {title.genres?.slice(0, 6).map((g) => (
              <View key={g} style={styles.genrePill}><Text style={styles.genreText}>{g.replace(/_/g, ' ')}</Text></View>
            ))}
          </View>

          {(title.author || title.artist) && (
            <Text style={styles.authorText}>
              {title.author && `By ${title.author}`}{title.artist ? ` · ${title.artist}` : ''}
            </Text>
          )}

          {title.synopsis && (
            <View style={styles.synopsisSection}>
              <Text style={styles.sectionLabel}>Synopsis</Text>
              <Text style={styles.synopsisText}>{title.synopsis}</Text>
            </View>
          )}

          {/* Reading Progress */}
          {pagination.total > 0 && (
            <View style={styles.progressCard}>
              <View style={styles.progressRow}>
                <Text style={styles.sectionLabel}>Progress</Text>
                <Text style={styles.progressPct}>{pagination.total > 0 ? Math.round((readCount / pagination.total) * 100) : 0}%</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${pagination.total > 0 ? Math.round((readCount / pagination.total) * 100) : 0}%` }]} />
              </View>
              <Text style={styles.progressDetail}>{readCount} / {pagination.total} chapters</Text>
            </View>
          )}

          {/* Chapter List */}
          <Text style={styles.chSectionTitle}>
            Chapters · {pagination.total}
          </Text>

          {chapters.length === 0 ? (
            <Text style={{ color: '#666', fontSize: 12, textAlign: 'center', padding: 20 }}>
              No chapters available yet
            </Text>
          ) : (
            <>
              {chapters.map((ch) => {
                const isCompleted = ch.progress?.completed;
                const isInProgress = ch.progress && !ch.progress.completed;
                return (
                  <TouchableOpacity
                    key={ch.id}
                    style={styles.chapterItem}
                    onPress={() => router.push(`/reader/${ch.id}` as any)}
                  >
                    <View style={styles.chapterLeft}>
                      {/* Status indicator */}
                      <View style={[
                        styles.statusDot,
                        isCompleted ? styles.statusDotDone : isInProgress ? styles.statusDotProgress : styles.statusDotEmpty
                      ]}>
                        {isCompleted && <Text style={{ color: '#4ade80', fontSize: 8 }}>✓</Text>}
                        {isInProgress && <Text style={{ color: '#e94560', fontSize: 6 }}>●</Text>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[
                          styles.chapterNumber,
                          isCompleted && { color: '#4ade80', opacity: 0.7 }
                        ]}>
                          Ch. {ch.number}
                        </Text>
                        {ch.title && <Text style={styles.chapterTitle} numberOfLines={1}>{ch.title}</Text>}
                      </View>
                    </View>
                    <View style={styles.chapterRight}>
                      <Text style={styles.chapterMeta}>{ch.pageCount || '?'}p</Text>
                      {ch.createdAt && <Text style={styles.chapterMeta}>{formatDate(ch.createdAt)}</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Page nav */}
              {totalPages > 1 && (
                <View style={styles.pageNav}>
                  <TouchableOpacity
                    style={[styles.pageBtn, chaptersPage <= 1 && { opacity: 0.3 }]}
                    disabled={chaptersPage <= 1}
                    onPress={() => setChaptersPage(p => Math.max(1, p - 1))}
                  >
                    <Text style={styles.pageBtnText}>← Prev</Text>
                  </TouchableOpacity>
                  <Text style={styles.pageIndicator}>{chaptersPage} / {totalPages}</Text>
                  <TouchableOpacity
                    style={[styles.pageBtn, !pagination.hasMore && { opacity: 0.3 }]}
                    disabled={!pagination.hasMore}
                    onPress={() => setChaptersPage(p => p + 1)}
                  >
                    <Text style={styles.pageBtnText}>Next →</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
          {/* Reviews Section */}
          <View style={{ marginTop: 20, borderTopWidth: 1, borderTopColor: '#1a1a2e', paddingTop: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ color: '#ccc', fontSize: 14, fontWeight: '500' }}>
                Reviews · {reviewsData?.totalReviews || 0}
              </Text>
              {reviewsData?.averageRating && (
                <Text style={{ color: '#f0c040', fontSize: 10 }}>⭐ {reviewsData.averageRating.toFixed(1)}</Text>
              )}
            </View>

            {/* Write Review Button */}
            <TouchableOpacity
              style={{ backgroundColor: '#e94560', borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginBottom: 12 }}
              onPress={() => setShowReviewForm(!showReviewForm)}
            >
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '500' }}>
                {showReviewForm ? 'Cancel' : 'Write Review'}
              </Text>
            </TouchableOpacity>

            {/* Review Form */}
            {showReviewForm && (
              <View style={{ backgroundColor: '#1a1a2e', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <Text style={{ color: '#fff', fontSize: 11, marginBottom: 8 }}>Rating (1-10)</Text>
                <View style={{ flexDirection: 'row', gap: 4, marginBottom: 10 }}>
                  {[1,2,3,4,5,6,7,8,9,10].map((r) => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setReviewRating(r)}
                      style={{
                        width: 26, height: 26, borderRadius: 4,
                        backgroundColor: reviewRating >= r ? '#e94560' : '#252540',
                        justifyContent: 'center', alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 9, fontWeight: '600' }}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={{ backgroundColor: '#252540', borderRadius: 8, padding: 10, color: '#ccc', fontSize: 11, minHeight: 60, textAlignVertical: 'top' }}
                  placeholder="What did you think? (min. 10 chars)"
                  placeholderTextColor="#555"
                  value={reviewBody}
                  onChangeText={setReviewBody}
                  multiline
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                  <TouchableOpacity
                    onPress={handleSubmitReview}
                    disabled={reviewBody.length < 10 || createReview.isPending}
                    style={{
                      backgroundColor: reviewBody.length >= 10 ? '#e94560' : '#252540',
                      borderRadius: 6, paddingHorizontal: 16, paddingVertical: 7,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 10 }}>
                      {createReview.isPending ? '...' : 'Submit'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Reviews List */}
            {!reviewsData || reviewsData.items.length === 0 ? (
              <Text style={{ color: '#666', fontSize: 11, textAlign: 'center', padding: 16 }}>
                No reviews yet. Be the first!
              </Text>
            ) : (
              <>
                {reviewsData.items.map((review) => (
                  <View key={review.id} style={{ backgroundColor: '#1a1a2e', borderRadius: 10, padding: 12, marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#2d1040', justifyContent: 'center', alignItems: 'center' }}>
                          <Text style={{ color: '#e94560', fontSize: 9, fontWeight: '600' }}>
                            {review.user.displayName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <Text style={{ color: '#ccc', fontSize: 10 }}>{review.user.displayName}</Text>
                      </View>
                      <Text style={{ color: '#f0c040', fontSize: 10, fontWeight: '600' }}>{review.rating}/10</Text>
                    </View>
                    {review.body && (
                      <Text style={{ color: '#aaa', fontSize: 10, lineHeight: 15 }} numberOfLines={4}>
                        {review.body}
                      </Text>
                    )}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                      <Text style={{ color: '#555', fontSize: 8 }}>
                        {formatDate(review.createdAt)}
                      </Text>
                    </View>
                  </View>
                ))}

                {/* Review Pagination */}
                {reviewsData.total > reviewsData.limit && (
                  <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
                    <TouchableOpacity
                      onPress={() => setReviewsPage(p => Math.max(1, p - 1))}
                      disabled={reviewsPage <= 1}
                      style={{ opacity: reviewsPage <= 1 ? 0.3 : 1 }}
                    >
                      <Text style={{ color: '#888', fontSize: 11 }}>← Prev</Text>
                    </TouchableOpacity>
                    <Text style={{ color: '#666', fontSize: 10 }}>{reviewsPage}/{Math.ceil(reviewsData.total / reviewsData.limit)}</Text>
                    <TouchableOpacity
                      onPress={() => setReviewsPage(p => p + 1)}
                      disabled={!reviewsData.hasMore}
                      style={{ opacity: !reviewsData.hasMore ? 0.3 : 1 }}
                    >
                      <Text style={{ color: '#888', fontSize: 11 }}>Next →</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  backBtn: { padding: 14, paddingBottom: 4 },
  backText: { color: '#e94560', fontSize: 12 },
  coverSection: { alignItems: 'center', padding: 14, gap: 10 },
  cover: { width: 180, height: 240, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  coverPlaceholder: { color: '#ccc', fontSize: 12, textAlign: 'center', padding: 10 },
  coverActions: { width: '100%', paddingHorizontal: 20 },
  readBtn: { backgroundColor: '#e94560', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  readBtnText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  infoSection: { padding: 14, paddingTop: 0 },
  titleText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  altTitleText: { color: '#666', fontSize: 10, marginTop: 2, fontStyle: 'italic' },
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
  sectionLabel: { color: '#888', fontSize: 10, fontWeight: '600', marginBottom: 4 },
  synopsisText: { color: '#aaa', fontSize: 11, lineHeight: 17 },
  progressCard: { backgroundColor: '#1a1a2e', borderRadius: 10, padding: 12, marginTop: 12 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressPct: { color: '#e94560', fontSize: 12, fontWeight: '500' },
  progressBar: { height: 4, backgroundColor: '#252540', borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#e94560', borderRadius: 2 },
  progressDetail: { color: '#666', fontSize: 9, marginTop: 3 },
  chSectionTitle: { color: '#ccc', fontSize: 14, fontWeight: '500', marginTop: 16, marginBottom: 8 },
  chapterItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  chapterLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  chapterRight: { alignItems: 'flex-end', gap: 2 },
  statusDot: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  statusDotDone: { backgroundColor: '#4ade8020', borderWidth: 1, borderColor: '#4ade8050' },
  statusDotProgress: { backgroundColor: '#e9456020', borderWidth: 1, borderColor: '#e9456050' },
  statusDotEmpty: { backgroundColor: '#1e1e35', borderWidth: 1, borderColor: '#252540' },
  chapterNumber: { color: '#ccc', fontSize: 12 },
  chapterTitle: { color: '#666', fontSize: 10, marginTop: 1 },
  chapterMeta: { color: '#555', fontSize: 9 },
  pageNav: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, paddingVertical: 14 },
  pageBtn: { backgroundColor: '#1e1e35', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  pageBtnText: { color: '#888', fontSize: 11 },
  pageIndicator: { color: '#666', fontSize: 11 },
});
