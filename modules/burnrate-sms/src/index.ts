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

const mockListeners = new Set<(event: BurnrateSmsEvent) => void>();

const mockModule: BurnrateSmsModule = {
  addListener: (eventName, listener) => {
    if (eventName === 'onSmsReceived') {
      mockListeners.add(listener);
    }
    return { remove: () => mockListeners.delete(listener) };
  },
  getPermissionStatusAsync: async () => 'granted',
  isAvailableAsync: async () => true,
  requestPermissionsAsync: async () => 'granted',
  startListeningAsync: async () => true,
  stopListeningAsync: async () => true,
};

// Expose a way to test SMS locally
(globalThis as any).__injectMockSms = (message: string, sender: string = "VK-HDFCBK") => {
  mockListeners.forEach(l => l({ message, receivedAt: Date.now(), sender }));
};

function getNativeModule(): BurnrateSmsModule {
  if (nativeModule !== undefined && nativeModule !== null) {
    return nativeModule;
  }
  try {
    const mn = requireNativeModule<BurnrateSmsModule>('BurnrateSms');
    nativeModule = mn;
  } catch {
    nativeModule = null;
  }
  // Fallback to mock if native module is not present (e.g. in Expo Go)
  if (!nativeModule) {
    nativeModule = mockModule;
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
