import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryProvider } from '../lib/queryClient';

export default function RootLayout() {
  return (
    <QueryProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0a0a14' },
        }}
      />
    </QueryProvider>
  );
}
