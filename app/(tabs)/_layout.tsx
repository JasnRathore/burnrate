import { Tabs } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { CustomTabBar } from '@/components/burnrate/custom-tab-bar';
import { QuickEntryOverlay } from '@/components/burnrate/quick-entry-overlay';

export default function TabLayout() {
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <Tabs
        tabBar={(props: BottomTabBarProps) => (
          <CustomTabBar
            {...props}
            onPlusPress={() => setIsQuickEntryOpen(true)}
          />
        )}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
          }}
        />
        <Tabs.Screen
          name="transactions"
          options={{
            title: 'Transactions',
          }}
        />
        <Tabs.Screen
          name="budgets"
          options={{
            title: 'Budgets',
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
          }}
        />
      </Tabs>

      {/* Low-Friction Overlay Sheets */}
      <QuickEntryOverlay
        isOpen={isQuickEntryOpen}
        onClose={() => setIsQuickEntryOpen(false)}
      />

    </View>
  );
}
