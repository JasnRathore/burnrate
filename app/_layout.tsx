import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import 'react-native-reanimated';

import { palette } from '@/components/burnrate/ui';
import { attachNetworkListener, useBurnrateStore } from '@/features/burnrate/store';
import { registerSmsImportPipeline } from '@/features/sms/sms-service';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const initialize = useBurnrateStore((state) => state.initialize);
  const isInitialized = useBurnrateStore((state) => state.isInitialized);
  const isLoading = useBurnrateStore((state) => state.isLoading);
  const error = useBurnrateStore((state) => state.error);
  const onboardingCompleted = useBurnrateStore(
    (state) => state.settings.onboardingCompleted
  );
  const smsMonitoringEnabled = useBurnrateStore(
    (state) => state.settings.smsMonitoringEnabled
  );

  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    initialize();
    const unsubscribe = attachNetworkListener();
    return () => unsubscribe();
  }, [initialize]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setButtonStyleAsync('light');
    }
  }, []);

  useEffect(() => {
    const subscription = registerSmsImportPipeline(smsMonitoringEnabled);
    return () => subscription?.remove();
  }, [smsMonitoringEnabled]);

  // Gate: wait for nav + SQLite init, then send users through onboarding if needed.
  useEffect(() => {
    if (!isInitialized || !navigationState?.key) return;

    const onOnboarding = segments[0] === 'onboarding';

    if (!onboardingCompleted && !onOnboarding) {
      router.replace('/onboarding');
      return;
    }

    if (onboardingCompleted && onOnboarding) {
      router.replace('/(tabs)');
    }
  }, [isInitialized, onboardingCompleted, segments, router, navigationState?.key]);

  if (!isInitialized || isLoading || !navigationState?.key) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: palette.bg,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 24,
        }}
      >
        <ActivityIndicator color={palette.paper} size="large" />
        {error ? (
          <Text
            style={{
              color: palette.red,
              textAlign: 'center',
              fontFamily: 'monospace',
              fontSize: 13,
            }}
          >
            {error}
          </Text>
        ) : null}
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.bg },
        }}
      >
        <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="modal"
          options={{ presentation: 'modal', title: 'Modal', headerShown: true }}
        />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
