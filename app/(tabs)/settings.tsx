import { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { BodyText, Card, Field, Label, PageHeader, PrimaryButton, Screen, palette } from '@/components/burnrate/ui';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { formatInr, parseRupeesToPaise } from '@/features/burnrate/calculations';
import { useBurnrateStore } from '@/features/burnrate/store';
import {
  getSmsPermissionStatusAsync,
  isSmsAvailableAsync,
  requestSmsPermissionsAsync,
  startSmsListeningAsync,
  stopSmsListeningAsync,
} from '@/features/sms/sms-service';

export default function SettingsScreen() {
  const settings = useBurnrateStore((state) => state.settings);
  const setOpeningBalance = useBurnrateStore((state) => state.setOpeningBalance);
  const setSmsConsent = useBurnrateStore((state) => state.setSmsConsent);
  const setSmsMonitoring = useBurnrateStore((state) => state.setSmsMonitoring);
  const resetToFirstRun = useBurnrateStore((state) => state.resetToFirstRun);
  const [balance, setBalance] = useState('');
  const [smsAvailable, setSmsAvailable] = useState(false);
  const [smsStatus, setSmsStatus] = useState('unknown');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    isSmsAvailableAsync().then(setSmsAvailable);
    getSmsPermissionStatusAsync().then(setSmsStatus);
  }, []);

  async function saveBalance() {
    const amountPaise = parseRupeesToPaise(balance);
    if (amountPaise === null) {
      Alert.alert('Balance needed', 'Enter your current available balance in rupees.');
      return;
    }
    await setOpeningBalance(amountPaise);
    setBalance('');
  }

  async function toggleSmsMonitoring(enabled: boolean) {
    if (enabled && !settings.smsConsentGranted) {
      Alert.alert('Consent required', 'Read and accept the SMS disclosure before enabling monitoring.');
      return;
    }
    if (enabled) {
      const nextStatus = await requestSmsPermissionsAsync();
      setSmsStatus(nextStatus);
      if (nextStatus !== 'granted') {
        Alert.alert(
          'SMS permission not granted',
          'Burnrate cannot monitor bank SMS without Android SMS permission.',
        );
        return;
      }
      await startSmsListeningAsync();
    } else {
      await stopSmsListeningAsync();
    }
    await setSmsMonitoring(enabled);
  }

  function confirmResetApp() {
    Alert.alert(
      'Reset Burnrate?',
      'This permanently deletes all transactions, budgets, and settings on this device. The next screen will be first-time onboarding — as if you just installed the app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset everything',
          style: 'destructive',
          onPress: () => {
            void performReset();
          },
        },
      ],
    );
  }

  async function performReset() {
    setResetting(true);
    try {
      try {
        await stopSmsListeningAsync();
      } catch {
        // Listener may already be off.
      }
      await resetToFirstRun();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      router.replace('/onboarding');
    } catch (e) {
      Alert.alert(
        'Reset failed',
        e instanceof Error ? e.message : 'Could not clear local data.',
      );
    } finally {
      setResetting(false);
    }
  }

  return (
    <Screen>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ gap: 14, padding: 16, paddingBottom: 140 }}
      >
        <PageHeader title="Settings" />

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <IconSymbol name="sliders" size={20} color={palette.paper} />
            <Label>Opening balance</Label>
          </View>
          <BodyText muted style={{ marginBottom: 8 }}>
            Current baseline: {formatInr(settings.openingBalancePaise)}
          </BodyText>
          <BodyText muted style={{ marginBottom: 16 }}>
            Home balance starts from this amount, then only adds/subtracts transactions logged after
            you save. Re-save if older activity is throwing the total off.
          </BodyText>
          <Field
            keyboardType="decimal-pad"
            placeholder="Balance in INR"
            value={balance}
            onChangeText={setBalance}
          />
          <View style={{ marginTop: 12 }}>
            <PrimaryButton onPress={saveBalance}>Update balance</PrimaryButton>
          </View>
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <IconSymbol name="bell" size={20} color={palette.paper} />
            <Label>SMS monitoring</Label>
          </View>
          <BodyText style={{ marginBottom: 20 }}>
            Automatically track your expenses by allowing Burnrate to read incoming bank and UPI
            transaction messages.
          </BodyText>
          <View
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <BodyText>Consent granted</BodyText>
            <Switch
              value={settings.smsConsentGranted}
              onValueChange={setSmsConsent}
              trackColor={{ false: 'rgba(255,255,255,0.12)', true: palette.celadon }}
              thumbColor={palette.paper}
            />
          </View>
          <View
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <BodyText>Monitor incoming SMS</BodyText>
            <Switch
              disabled={!smsAvailable}
              value={settings.smsMonitoringEnabled && smsAvailable}
              onValueChange={toggleSmsMonitoring}
              trackColor={{ false: 'rgba(255,255,255,0.12)', true: palette.celadon }}
              thumbColor={palette.paper}
            />
          </View>

          {__DEV__ && (
            <View style={{ marginTop: 24 }}>
              <PrimaryButton
                tone="quiet"
                onPress={() => {
                  if (!(globalThis as any).__injectMockSms) {
                    Alert.alert(
                      'Not available',
                      'Mock SMS injection is only available when using the mocked module.',
                    );
                    return;
                  }
                  (globalThis as any).__injectMockSms(
                    'Rs 240.00 debited from a/c **3421 on 24-05-26 to ZOMATO.',
                    'VK-HDFCBK',
                  );
                  Alert.alert('SMS Simulated', 'A test food transaction SMS has been injected.');
                }}
              >
                Simulate incoming SMS
              </PrimaryButton>
            </View>
          )}
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <IconSymbol name="trash" size={20} color={palette.red} />
            <Label>Danger zone</Label>
          </View>
          <BodyText muted style={{ marginBottom: 16 }}>
            Delete every transaction, budget, and setting stored in SQLite on this phone. After
            reset you will go through first-time onboarding again.
          </BodyText>
          <PrimaryButton tone="danger" onPress={confirmResetApp} disabled={resetting}>
            {resetting ? 'Resetting…' : 'Reset app to first launch'}
          </PrimaryButton>
        </Card>
      </ScrollView>
    </Screen>
  );
}
