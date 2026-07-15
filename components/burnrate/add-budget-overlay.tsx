import React, { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { GlassView } from "@/components/burnrate/glass-view";
import { Field, Label, Pill, PrimaryButton, palette } from "@/components/burnrate/ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useBurnrateStore } from "@/features/burnrate/store";
import { CATEGORIES, type Budget } from "@/features/burnrate/types";
import { rupeesToPaise } from "@/features/burnrate/calculations";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SWIPE_CLOSE_THRESHOLD = 80;

type Props = {
  budget: Budget | null;
  isOpen: boolean;
  onClose: () => void;
};

export function BudgetFormOverlay({ budget, isOpen, onClose }: Props) {
  const saveBudget = useBurnrateStore((s) => s.saveBudget);
  const budgets = useBurnrateStore((s) => s.budgets);
  const insets = useSafeAreaInsets();

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("Food");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const dragY = useSharedValue(0);

  const existingCategories = new Set(budgets.map((b) => b.category));
  const availableCategories = CATEGORIES.filter((c) => c !== 'Income' && !existingCategories.has(c));

  // Reset fields when opened or when target budget changes
  useEffect(() => {
    if (isOpen) {
      if (budget) {
        setAmount((budget.limitPaise / 100).toString());
        setCategory(budget.category);
      } else {
        setAmount("");
        if (availableCategories.length > 0) {
          setCategory(availableCategories[0]);
        }
      }
    }
  }, [isOpen, budget]);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      dragY.value = 0;
      translateY.value = withTiming(0, { duration: 300 });
      backdropOpacity.value = withTiming(1, { duration: 250 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      backdropOpacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(
        SCREEN_HEIGHT,
        { duration: 260 },
        (finished) => {
          if (finished) runOnJS(setVisible)(false);
        },
      );
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onBackPress = () => {
      handleClose();
      return true;
    };
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );
    return () => backHandler.remove();
  }, [isOpen]);

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  const handleSave = async () => {
    if (!amount.trim()) return;

    const limitPaise = rupeesToPaise(amount);
    if (!limitPaise) return;

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await saveBudget(category, limitPaise);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          dragY.value = gestureState.dy;
          translateY.value = gestureState.dy;
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > SWIPE_CLOSE_THRESHOLD || gestureState.vy > 1.5) {
          handleClose();
        } else {
          dragY.value = withTiming(0);
          translateY.value = withTiming(0);
        }
      },
    }),
  ).current;

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleClose}>
      <View style={{ flex: 1 }}>
        <Animated.View style={[styles.backdrop, animatedBackdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardContainer}
        >
          <Animated.View style={[styles.sheet, animatedSheetStyle]}>
            <View style={styles.sheetInner}>
              <View style={styles.handleArea} {...panResponder.panHandlers}>
                <View style={styles.handle} />
              </View>

              <View style={styles.header}>
                <Text style={styles.title}>{budget ? "Edit Budget" : "Add Budget"}</Text>
                <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={10}>
                  <IconSymbol name="xmark" size={14} color="rgba(255,255,255,0.6)" weight="bold" />
                </Pressable>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                {!budget && availableCategories.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                    <Text style={{ color: palette.paper, fontSize: 16 }}>You have budgets for every category.</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.section}>
                      <Label style={styles.sectionLabel}>Category</Label>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {budget ? (
                           <Pill active dark>{budget.category}</Pill>
                        ) : availableCategories.map((cat) => {
                          const active = category === cat;
                          return (
                            <Pressable
                              key={cat}
                              onPress={() => {
                                Keyboard.dismiss();
                                setCategory(cat);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              }}
                              style={[styles.chip, active && styles.chipActive]}
                            >
                              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                {cat}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>

                    <View style={styles.section}>
                      <Label style={styles.sectionLabel}>Monthly Limit</Label>
                      <TextInput
                        keyboardType="decimal-pad"
                        placeholder="Limit in INR"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        value={amount}
                        onChangeText={setAmount}
                        style={styles.inputField}
                        autoFocus
                      />
                    </View>

                    <Pressable
                      onPress={handleSave}
                      disabled={saving || !amount.trim()}
                      style={({ pressed }) => [
                        styles.confirmBtn,
                        !saving && amount.trim()
                          ? { backgroundColor: palette.paper, opacity: pressed ? 0.82 : 1 }
                          : styles.confirmBtnDisabled,
                      ]}
                    >
                      <Text style={[
                        styles.confirmBtnText,
                        { color: !saving && amount.trim() ? palette.ink : "rgba(255,255,255,0.25)" }
                      ]}>
                        {saving ? "Saving..." : "Save Budget"}
                      </Text>
                    </Pressable>
                  </>
                )}
              </ScrollView>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "rgba(14, 14, 14, 0.98)",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "rgba(255,255,255,0.12)",
    maxHeight: SCREEN_HEIGHT * 0.88,
    overflow: "hidden",
    paddingBottom: 100,
    marginBottom: -100,
  },
  handleArea: {
    paddingTop: 12,
    paddingBottom: 6,
    alignItems: "center",
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 2,
  },
  sheetInner: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexShrink: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    marginTop: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: "#FAFAFA",
    letterSpacing: -0.6,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    gap: 20,
    paddingBottom: 36,
  },
  section: { gap: 8 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.5 },
  inputField: {
    fontSize: 16,
    minHeight: 48,
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    backgroundColor: palette.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    color: palette.paper,
    fontFamily: "monospace",
  },
  confirmBtnText: { fontSize: 14, fontWeight: "700" },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
    marginTop: 4,
  },
  confirmBtnDisabled: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  chipActive: { backgroundColor: palette.paper, borderColor: palette.paper },
  chipText: { fontSize: 13, fontWeight: "600", color: palette.muted, fontFamily: "monospace" },
  chipTextActive: { color: palette.ink },
});
