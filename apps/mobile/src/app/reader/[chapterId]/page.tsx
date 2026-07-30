import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useChapter } from '../../../lib/queryClient';

export default function ReaderScreen() {
  const router = useRouter();
  const { chapterId } = useLocalSearchParams<{ chapterId: string }>();
  const { data: chapter, isLoading } = useChapter(chapterId || '');

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#e94560" size="large" />
      </View>
    );
  }

  if (!chapter) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#888' }}>Chapter not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 10 }}>
          <Text style={{ color: '#e94560', fontSize: 12 }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pageCount = chapter.pageCount || 10;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Reader Top Bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 44, backgroundColor: '#0d0d1e', borderBottomWidth: 1, borderBottomColor: '#1a1a30', paddingHorizontal: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: '#e94560', fontSize: 12 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: '#888', fontSize: 11, marginLeft: 12, flex: 1 }} numberOfLines={1}>
          {chapter.series.title} · Ch.{chapter.number}
        </Text>
      </View>

      {/* Reader Content */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ alignItems: 'center' }}>
        {Array.from({ length: Math.min(pageCount, 8) }).map((_, i) => (
          <View
            key={i}
            style={{
              width: '100%',
              height: 240,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: i % 2 === 0 ? '#0d0d14' : '#0a0a10',
              borderBottomWidth: 1,
              borderBottomColor: '#111',
            }}
          >
            <Text style={{ color: '#333', fontSize: 10 }}>
              [Page {i + 1}]
            </Text>
          </View>
        ))}
        {pageCount > 8 && (
          <View style={{ padding: 20 }}>
            <Text style={{ color: '#444', fontSize: 10 }}>+{pageCount - 8} more pages</Text>
          </View>
        )}
      </ScrollView>

      {/* Reader Bottom Bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 40, backgroundColor: '#0d0d1e', borderTopWidth: 1, borderTopColor: '#1a1a30', paddingHorizontal: 12, gap: 8 }}>
        <TouchableOpacity style={{ backgroundColor: '#1a1a2e', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 4 }}>  
          <Text style={{ color: '#888', fontSize: 10 }}>← Prev</Text>
        </TouchableOpacity>
        <Text style={{ color: '#666', fontSize: 10, flex: 1, textAlign: 'center' }}>Page 1 / {pageCount}</Text>
        <TouchableOpacity style={{ backgroundColor: '#1a1a2e', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ color: '#888', fontSize: 10 }}>Next →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
