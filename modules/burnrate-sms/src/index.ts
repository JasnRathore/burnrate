import { requireNativeModule, type EventSubscription } from 'expo-modules-core';
import { Platform } from 'react-native';

export type BurnrateSmsEvent = {
  message: string;
  receivedAt: number;
  sender: string;
};

export type BurnrateSmsSubscription = Pick<EventSubscription, 'remove'>;

type BurnrateSmsModule = {
  addListener: (eventName: 'onSmsReceived', listener: (event: BurnrateSmsEvent) => void) => EventSubscription;
  getPermissionStatusAsync: () => Promise<string>;
  isAvailableAsync: () => Promise<boolean>;
  requestPermissionsAsync: () => Promise<string>;
  startListeningAsync: () => Promise<boolean>;
  stopListeningAsync: () => Promise<boolean>;
};

let nativeModule: BurnrateSmsModule | null | undefined;

function getNativeModule() {
  if (nativeModule !== undefined) {
    return nativeModule;
  }
  try {
    nativeModule = Platform.OS === 'android' ? requireNativeModule<BurnrateSmsModule>('BurnrateSms') : null;
  } catch {
    nativeModule = null;
  }
  return nativeModule;
}

export async function isAvailableAsync() {
  return Boolean(await getNativeModule()?.isAvailableAsync().catch(() => false));
}

export async function getPermissionStatusAsync() {
  return (await getNativeModule()?.getPermissionStatusAsync().catch(() => 'unavailable')) ?? 'unavailable';
}

export async function requestPermissionsAsync() {
  return (await getNativeModule()?.requestPermissionsAsync().catch(() => 'unavailable')) ?? 'unavailable';
}

export async function startListeningAsync() {
  return Boolean(await getNativeModule()?.startListeningAsync().catch(() => false));
}

export async function stopListeningAsync() {
  return Boolean(await getNativeModule()?.stopListeningAsync().catch(() => false));
}

export function addSmsReceivedListener(listener: (event: BurnrateSmsEvent) => void): BurnrateSmsSubscription {
  const subscription = getNativeModule()?.addListener('onSmsReceived', listener);
  return subscription ?? { remove: () => undefined };
}
