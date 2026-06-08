import React, { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { GlassView } from '@/components/burnrate/glass-view';
import { Field, Label, palette } from '@/components/burnrate/ui';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useBurnrateStore } from '@/features/burnrate/store';
import { CATEGORIES } from '@/features/burnrate/types';
import { rupeesToPaise } from '@/features/burnrate/calculations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_CLOSE_THRESHOLD = 80;

type QuickEntryOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
};

const DIRECTION_OPTIONS: { label: string; value: 'expense' | 'income' }[] = [
  { label: 'Expense', value: 'expense' },
  { label: 'Income', value: 'income' },
];

export function QuickEntryOverlay({ isOpen, onClose }: QuickEntryOverlayProps) {
  const createTransaction = useBurnrateStore((s) => s.createTransaction);
  const insets = useSafeAreaInsets();

  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [direction, setDirection] = useState<'expense' | 'income'>('expense');
  const [category, setCategory] = useState<string>('Food');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  // Tracks drag offset during pan gesture
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
      setIsCategoryDropdownOpen(false);
    }
  }, [isOpen]);

  // ─── Hardware Back Button ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const onBackPress = () => {
      handleClose();
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
          runOnJS(handleClose)();
        } else {
          translateY.value = withTiming(0, { duration: 250 });
          dragY.value = 0;
        }
      },
    })
  ).current;

  // ─── Animated styles ──────────────────────────────────────────────────────
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value * 0.6 }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // ─── Derived state ────────────────────────────────────────────────────────
  const currentAmountPaise = amount ? rupeesToPaise(amount) : 0;
  const canSave = currentAmountPaise > 0;

  const handleClose = () => {
    onClose();
  };

  const handleSave = async () => {
    if (!canSave) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await createTransaction({
      amountPaise: currentAmountPaise,
      category: direction === 'income' ? 'Income' : category,
      direction: direction,
      merchant: merchant.trim() || (direction === 'income' ? 'Income' : 'Expense'),
    });
    setSaving(false);
    setAmount('');
    setMerchant('');
    setCategory('Food');
    setDirection('expense');
    onClose();
  };

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 1000, elevation: 1000 }]} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
        keyboardVerticalOffset={0}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.sheet, sheetStyle]}>
          <GlassView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />

          {/* Draggable Handle Area */}
          <View style={styles.handleArea} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>

          <View style={[styles.sheetInner, { paddingBottom: Math.max(insets.bottom + 8, 24) }]}>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Add Transaction</Text>
                <Text style={styles.subtitle}>Enter amount and select category</Text>
              </View>
              <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={10}>
                <IconSymbol
                  name="xmark"
                  size={14}
                  color="rgba(255,255,255,0.6)"
                  weight="bold"
                />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Amount Input */}
              <View style={styles.section}>
                <Label style={styles.sectionLabel}>Amount (₹)</Label>
                <Field
                  autoFocus
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  value={amount}
                  onChangeText={setAmount}
                  style={styles.inputField}
                  returnKeyType="next"
                />
              </View>

              {/* Merchant */}
              <View style={styles.section}>
                <Label style={styles.sectionLabel}>Merchant / Description</Label>
                <Field
                  placeholder="e.g. Zomato, Metro card…"
                  value={merchant}
                  onChangeText={setMerchant}
                  style={styles.inputField}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
              </View>

              {/* Type toggle */}
              <View style={styles.section}>
                <Label style={styles.sectionLabel}>Type</Label>
                <View style={styles.toggleRow}>
                  {DIRECTION_OPTIONS.map((opt) => {
                    const active = direction === opt.value;
                    const isExpense = opt.value === 'expense';
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => {
                          Keyboard.dismiss();
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setDirection(opt.value);
                          setIsCategoryDropdownOpen(false);
                        }}
                        style={[
                          styles.toggleChip,
                          active && {
                            backgroundColor: isExpense ? palette.coral : palette.green,
                            borderColor: isExpense ? palette.coral : palette.green,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.toggleChipText,
                            { color: active ? palette.ink : palette.muted },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Category Scroll */}
              {direction === 'expense' && (
                <View style={styles.section}>
                  <Label style={styles.sectionLabel}>Category</Label>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                    keyboardShouldPersistTaps="handled"
                  >
                    {CATEGORIES.filter((c) => c !== 'Income').map((cat) => {
                      const active = category === cat;
                      return (
                        <Pressable
                          key={cat}
                          onPress={() => {
                            Keyboard.dismiss();
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setCategory(cat);
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
              )}

              {/* Confirm Button */}
              <Pressable
                onPress={handleSave}
                disabled={!canSave || saving}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  canSave
                    ? {
                        backgroundColor:
                          direction === 'income' ? palette.green : palette.cream,
                        opacity: pressed ? 0.82 : 1,
                      }
                    : styles.confirmBtnDisabled,
                ]}
              >
                <IconSymbol
                  name={saving ? 'ellipsis' : 'checkmark'}
                  size={16}
                  color={canSave ? palette.ink : 'rgba(255,255,255,0.25)'}
                  weight="bold"
                />
                <Text
                  style={[
                    styles.confirmBtnText,
                    { color: canSave ? palette.ink : 'rgba(255,255,255,0.25)' },
                  ]}
                >
                  {saving ? 'Saving…' : 'Confirm & Save'}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  keyboardContainer: {
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
    flexShrink: 1,
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
  subtitle: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 2,
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
    gap: 12,
    paddingBottom: 36,
  },
  amountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  amountBadgeSign: {
    fontSize: 18,
    fontWeight: '900',
    color: palette.ink,
  },
  amountBadgeValue: {
    fontSize: 18,
    fontWeight: '900',
    color: palette.ink,
  },
  amountBadgeMerchant: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(7,7,7,0.55)',
    maxWidth: 120,
    marginLeft: 4,
  },
  inputField: {
    fontSize: 17,
    minHeight: 48,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  section: {
    gap: 6,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleChip: {
    flex: 1,
    paddingVertical: 9,
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
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '900',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 16,
    marginTop: 4,
  },
  confirmBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    fontSize: 14,
    fontWeight: '700',
    color: palette.muted,
  },
  chipTextActive: {
    color: palette.ink,
  },
});
