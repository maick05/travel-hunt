import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';

import { PasswordGate } from '@/components/password-gate';
import { Colors } from '@/constants/theme';

const queryClient = new QueryClient();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.light.accent,
    background: Colors.light.background,
    card: Colors.light.background,
    text: Colors.light.text,
    border: Colors.light.border,
  },
};

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={theme}>
        <PasswordGate>
          <Stack
            screenOptions={{
              headerShadowVisible: false,
              headerStyle: { backgroundColor: Colors.light.text },
              headerTintColor: '#FFFFFF',
              headerTitleStyle: { fontWeight: '700', fontSize: 18 },
            }}>
            <Stack.Screen name="index" options={{ title: 'Travel Hunt' }} />
            <Stack.Screen name="trip" options={{ title: 'Viagem' }} />
          </Stack>
        </PasswordGate>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
