import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const { login, register, isLoading } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (mode === 'signup' && (!displayName || password.length < 8)) {
      setError('Display name required and password must be at least 8 characters');
      return;
    }
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, displayName);
      }
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.logo}>Manga<Text style={styles.logoAccent}>Verse</Text></Text>
        <Text style={styles.subtitle}>
          {mode === 'login' ? 'Welcome back, reader' : 'Start your reading journey'}
        </Text>

        <View style={styles.card}>
          {/* Mode toggle */}
          <View style={styles.toggleRow}>
            {(['login', 'signup'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => { setMode(m); setError(''); }}
                style={[styles.toggleBtn, mode === m && styles.toggleBtnActive]}
              >
                <Text style={[styles.toggleText, mode === m && styles.toggleTextActive]}>
                  {m === 'login' ? 'Sign In' : 'Sign Up'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {mode === 'signup' && (
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Display name"
              placeholderTextColor="#555"
              style={styles.input}
              autoComplete="name"
            />
          )}
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#555"
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#555"
            style={styles.input}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={mode === 'signup' ? 'new-password' : 'password'}
          />

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isLoading}
            style={[styles.submitBtn, isLoading && styles.btnDisabled]}
          >
            <Text style={styles.submitText}>
              {isLoading
                ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { color: '#e94560', fontSize: 28, fontWeight: '700', textAlign: 'center' },
  logoAccent: { color: '#7b2fbe' },
  subtitle: { color: '#888', fontSize: 12, textAlign: 'center', marginTop: 6, marginBottom: 24 },
  card: { backgroundColor: '#14142a', borderRadius: 14, padding: 18, borderWidth: 1, borderColor: '#1e1e35' },
  toggleRow: { flexDirection: 'row', backgroundColor: '#1a1a30', borderRadius: 8, padding: 3, marginBottom: 16 },
  toggleBtn: { flex: 1, borderRadius: 6, paddingVertical: 8, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#e94560' },
  toggleText: { color: '#888', fontSize: 11, fontWeight: '500' },
  toggleTextActive: { color: '#fff' },
  errorBox: { backgroundColor: '#3d1414', borderRadius: 8, padding: 10, marginBottom: 12 },
  errorText: { color: '#f87171', fontSize: 10 },
  input: {
    backgroundColor: '#1a1a30', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    color: '#ddd', fontSize: 12, marginBottom: 10, borderWidth: 1, borderColor: '#1e1e35',
  },
  submitBtn: { backgroundColor: '#e94560', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  submitText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
  backRow: { alignItems: 'center', marginTop: 14 },
  backText: { color: '#888', fontSize: 11 },
});
