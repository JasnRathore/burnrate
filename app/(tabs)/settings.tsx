import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, Switch, View } from 'react-native';

import { BodyText, Card, Field, Label, PageHeader, Pill, PrimaryButton, Screen, palette } from '@/components/burnrate/ui';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { formatInr, rupeesToPaise } from '@/features/burnrate/calculations';
import { useBurnrateStore } from '@/features/burnrate/store';
import { getSmsPermissionStatusAsync, isSmsAvailableAsync, requestSmsPermissionsAsync, startSmsListeningAsync, stopSmsListeningAsync } from '@/features/sms/sms-service';

export default function SettingsScreen() {
  const settings = useBurnrateStore((state) => state.settings);
  const setOpeningBalance = useBurnrateStore((state) => state.setOpeningBalance);
  const setSmsConsent = useBurnrateStore((state) => state.setSmsConsent);
  const setSmsMonitoring = useBurnrateStore((state) => state.setSmsMonitoring);
  const [balance, setBalance] = useState('');
  const [smsAvailable, setSmsAvailable] = useState(false);
  const [smsStatus, setSmsStatus] = useState('unknown');

  useEffect(() => {
    isSmsAvailableAsync().then(setSmsAvailable);
    getSmsPermissionStatusAsync().then(setSmsStatus);
  }, []);

  async function saveBalance() {
    const amountPaise = rupeesToPaise(balance);
    if (!amountPaise) {
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
        Alert.alert('SMS permission not granted', 'Burnrate cannot monitor bank SMS without Android SMS permission.');
        return;
      }
      await startSmsListeningAsync();
    } else {
      await stopSmsListeningAsync();
    }
    await setSmsMonitoring(enabled);
  }

  return (
    <Screen>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, padding: 16, paddingBottom: 140 }}>
        <PageHeader title="Settings" />

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <IconSymbol name="sliders" size={20} color={palette.paper} />
            <Label>Opening balance</Label>
          </View>
          <BodyText muted style={{ marginBottom: 16 }}>Current baseline: {formatInr(settings.openingBalancePaise)}</BodyText>
          <Field keyboardType="decimal-pad" placeholder="Balance in INR" value={balance} onChangeText={setBalance} />
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
            Automatically track your expenses by allowing Burnrate to read incoming bank and UPI transaction messages.
          </BodyText>
          <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <BodyText>Consent granted</BodyText>
            <Switch value={settings.smsConsentGranted} onValueChange={setSmsConsent} trackColor={{ false: 'rgba(255,255,255,0.1)', true: palette.paper }} />
          </View>
          <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <BodyText>Monitor incoming SMS</BodyText>
            <Switch
              disabled={!smsAvailable}
              value={settings.smsMonitoringEnabled && smsAvailable}
              onValueChange={toggleSmsMonitoring}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: palette.paper }}
            />
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}
