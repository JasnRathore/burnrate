import { Platform } from 'react-native';

import { parseFinancialSms } from '@/features/sms/sms-parser';
import { useBurnrateStore } from '@/features/burnrate/store';
import {
  addSmsReceivedListener,
  getPermissionStatusAsync,
  isAvailableAsync,
  requestPermissionsAsync,
  startListeningAsync,
  stopListeningAsync,
  type BurnrateSmsSubscription,
} from '@/modules/burnrate-sms/src';

export function registerSmsImportPipeline(enabled: boolean): BurnrateSmsSubscription | null {
  if (!enabled || Platform.OS !== 'android') {
    stopListeningAsync().catch(() => undefined);
    return null;
  }

  startListeningAsync().catch(() => undefined);
  return addSmsReceivedListener(async (event) => {
    const parsed = await parseFinancialSms(event.message, event.receivedAt);
    if (parsed) {
      await useBurnrateStore.getState().importSmsParse(parsed);
    }
  });
}

export const isSmsAvailableAsync = isAvailableAsync;
export const getSmsPermissionStatusAsync = getPermissionStatusAsync;
export const requestSmsPermissionsAsync = requestPermissionsAsync;
export const startSmsListeningAsync = startListeningAsync;
export const stopSmsListeningAsync = stopListeningAsync;
