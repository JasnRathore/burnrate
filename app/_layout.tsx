import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import 'react-native-reanimated';

import { attachNetworkListener, useBurnrateStore } from '@/features/burnrate/store';
import { registerSmsImportPipeline } from '@/features/sms/sms-service';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const initialize = useBurnrateStore((state) => state.initialize);
  const smsMonitoringEnabled = useBurnrateStore((state) => state.settings.smsMonitoringEnabled);

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

  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
