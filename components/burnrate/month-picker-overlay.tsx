import React, { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Dimensions,
  Modal,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassView } from '@/components/burnrate/glass-view';
import { palette } from '@/components/burnrate/ui';
import { IconSymbol } from '@/components/ui/icon-symbol';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_CLOSE_THRESHOLD = 80;

type MonthPickerOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  currentDate: Date;
  onSelect: (date: Date) => void;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i);

export function MonthPickerOverlay({
  isOpen,
  onClose,
  currentDate,
  onSelect,
}: MonthPickerOverlayProps) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const dragY = useSharedValue(0);

  // ─── Open / close animation ────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setSelectedMonth(currentDate.getMonth());
      setSelectedYear(currentDate.getFullYear());
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
  }, [isOpen, currentDate]);

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

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(new Date(selectedYear, selectedMonth, 1));
    onClose();
  };

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
                <Text style={styles.title}>Jump to Month</Text>
                <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
                  <IconSymbol name="xmark" size={14} color="rgba(255,255,255,0.6)" weight="bold" />
                </Pressable>
              </View>

              <View style={styles.content}>
                
                {/* Year Selector */}
                <View>
                  <Text style={styles.sectionLabel}>YEAR</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearScroll}>
                    {YEARS.map(y => {
                      const active = y === selectedYear;
                      return (
                        <Pressable
                          key={y}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setSelectedYear(y);
                          }}
                          style={[styles.yearChip, active && styles.yearChipActive]}
                        >
                          <Text style={[styles.yearText, active && styles.yearTextActive]}>{y}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Month Selector */}
                <View style={{ marginTop: 20 }}>
                  <Text style={styles.sectionLabel}>MONTH</Text>
                  <View style={styles.monthGrid}>
                    {MONTHS.map((m, i) => {
                      const active = i === selectedMonth;
                      return (
                        <Pressable
                          key={m}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setSelectedMonth(i);
                          }}
                          style={[styles.monthChip, active && styles.monthChipActive]}
                        >
                          <Text style={[styles.monthText, active && styles.monthTextActive]}>{m}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                
                <Pressable onPress={handleConfirm} style={styles.confirmBtn}>
                  <Text style={styles.confirmBtnText}>Apply</Text>
                </Pressable>
              </View>
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
    backgroundColor: 'rgba(14, 14, 14, 0.98)',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.12)',
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
    backgroundColor: 'rgba(255,255,255,0.16)',
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
    fontSize: 22,
    fontWeight: '600',
    color: '#FAFAFA',
    letterSpacing: -0.6,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    marginBottom: 10,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  yearScroll: {
    gap: 8,
  },
  yearChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  yearChipActive: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  yearText: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.muted,
  },
  yearTextActive: {
    color: palette.paper,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthChip: {
    width: '31%', // roughly 1/3 of the row minus gap
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  monthChipActive: {
    backgroundColor: palette.paper,
    borderColor: palette.paper,
  },
  monthText: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.muted,
  },
  monthTextActive: {
    color: palette.ink,
  },
  confirmBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.paper,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 28,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink,
  },
});
