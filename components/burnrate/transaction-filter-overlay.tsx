import React, { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Dimensions,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Modal,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassView } from '@/components/burnrate/glass-view';
import { Label, palette } from '@/components/burnrate/ui';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CATEGORIES } from '@/features/burnrate/types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_CLOSE_THRESHOLD = 80;

type TransactionFilterOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  filterType: 'all' | 'expense' | 'income';
  setFilterType: (v: 'all' | 'expense' | 'income') => void;
  filterCategory: string;
  setFilterCategory: (v: string) => void;
};

const DIRECTION_OPTIONS: { label: string; value: 'all' | 'expense' | 'income' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Expense', value: 'expense' },
  { label: 'Income', value: 'income' },
];

export function TransactionFilterOverlay({
  isOpen,
  onClose,
  filterType,
  setFilterType,
  filterCategory,
  setFilterCategory,
}: TransactionFilterOverlayProps) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const dragY = useSharedValue(0);

  // ─── Open / close animation ────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      dragY.value = 0;
      translateY.value = withTiming(0, { duration: 300 });
      backdropOpacity.value = withTiming(1, { duration: 250 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      backdropOpacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 260 }, (finished) => {
        if (finished) runOnJS(setVisible)(false);
      });
    }
  }, [isOpen]);

  // ─── Hardware Back Button ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const onBackPress = () => {
      onClose();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [isOpen]);

  // ─── Swipe gesture ────────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy }) => dy > 6,
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) {
          dragY.value = dy;
          translateY.value = dy;
        }
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > SWIPE_CLOSE_THRESHOLD || vy > 0.8) {
          runOnJS(onClose)();
        } else {
          translateY.value = withTiming(0, { duration: 250 });
          dragY.value = 0;
        }
      },
    })
  ).current;

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value * 0.6 }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <View style={[StyleSheet.absoluteFillObject, { zIndex: 1000, elevation: 1000 }]} pointerEvents="box-none">
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        </Animated.View>

      <View style={styles.container} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, sheetStyle]}>
          <GlassView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />

          <View style={styles.handleArea} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>

          <View style={[styles.sheetInner, { paddingBottom: Math.max(insets.bottom + 8, 24) }]}>
            <View style={styles.header}>
              <Text style={styles.title}>Filter Transactions</Text>
              <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
                <IconSymbol name="xmark" size={14} color="rgba(255,255,255,0.6)" weight="bold" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              
              {/* Type Filter */}
              <View style={styles.section}>
                <Label style={styles.sectionLabel}>Type</Label>
                <View style={styles.toggleRow}>
                  {DIRECTION_OPTIONS.map((opt) => {
                    const active = filterType === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setFilterType(opt.value);
                        }}
                        style={[
                          styles.toggleChip,
                          active && {
                            backgroundColor: palette.paper,
                            borderColor: palette.paper,
                          },
                        ]}
                      >
                        <Text style={[styles.toggleChipText, { color: active ? palette.ink : palette.muted }]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Category Filter */}
              <View style={styles.section}>
                <Label style={styles.sectionLabel}>Category</Label>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipGrid}>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setFilterCategory('all');
                    }}
                    style={[styles.chip, filterCategory === 'all' && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, filterCategory === 'all' && styles.chipTextActive]}>
                      All Categories
                    </Text>
                  </Pressable>

                  {CATEGORIES.map((cat) => {
                    const active = filterCategory === cat;
                    return (
                      <Pressable
                        key={cat}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setFilterCategory(cat);
                        }}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {cat}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
              
              <Pressable
                onPress={onClose}
                style={styles.confirmBtn}
              >
                <Text style={styles.confirmBtnText}>Show Results</Text>
              </Pressable>
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'rgba(16, 16, 14, 0.97)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: SCREEN_HEIGHT * 0.88,
    overflow: 'hidden',
    paddingBottom: 100,
    marginBottom: -100,
  },
  handleArea: {
    paddingTop: 12,
    paddingBottom: 6,
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 2,
  },
  sheetInner: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    gap: 24,
    paddingBottom: 36,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 12,
    letterSpacing: 0.5,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleChip: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleChipText: {
    fontSize: 14,
    fontWeight: '800',
  },
  chipGrid: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipActive: {
    backgroundColor: palette.paper,
    borderColor: palette.paper,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.muted,
  },
  chipTextActive: {
    color: palette.ink,
  },
  confirmBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.paper,
    paddingVertical: 15,
    borderRadius: 16,
    marginTop: 12,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: palette.ink,
  },
});
