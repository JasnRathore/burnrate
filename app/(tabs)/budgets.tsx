import { useState, useRef, useCallback } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View, Pressable, Animated, PanResponder, Modal, Dimensions } from 'react-native';

import { PageHeader, PrimaryButton, ProgressBar, Screen, palette } from '@/components/burnrate/ui';
import { formatInr, rupeesToPaise } from '@/features/burnrate/calculations';
import { CATEGORIES, getCategoryIcon } from '@/features/burnrate/types';
import { useBurnrateStore } from '@/features/burnrate/store';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BudgetFormOverlay } from '@/components/burnrate/add-budget-overlay';
import { type Budget } from '@/features/burnrate/types';
import * as Haptics from 'expo-haptics';

// ─── Swipeable Row ─────────────────────────────────────────────────────────────
const SWIPE_THRESHOLD = -140;
const SWIPE_WIDTH = 140;

function SwipeableRow({
  children,
  onEdit,
  onDelete,
}: {
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const rowOpen = useRef(false);

  const close = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 2,
      speed: 14,
    }).start();
    rowOpen.current = false;
  }, [translateX]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const x = Math.min(0, Math.max(g.dx + (rowOpen.current ? SWIPE_THRESHOLD : 0), -SWIPE_WIDTH));
        translateX.setValue(x);
      },
      onPanResponderRelease: (_, g) => {
        const currentX = g.dx + (rowOpen.current ? SWIPE_THRESHOLD : 0);
        if (currentX < SWIPE_THRESHOLD / 2 || g.vx < -0.5) {
          Animated.spring(translateX, {
            toValue: SWIPE_THRESHOLD,
            useNativeDriver: true,
            bounciness: 2,
            speed: 14,
          }).start();
          rowOpen.current = true;
        } else {
          close();
        }
      },
      onPanResponderTerminate: () => close(),
    })
  ).current;

  return (
    <View style={{ overflow: "hidden" }}>
      <View
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: SWIPE_WIDTH,
          flexDirection: "row",
          zIndex: 0,
        }}
      >
        <Pressable
          onPress={() => { close(); onEdit(); }}
          style={{ backgroundColor: palette.paper, flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <IconSymbol name="pencil" size={22} color={palette.ink} />
        </Pressable>
        <Pressable
          onPress={() => { close(); onDelete(); }}
          style={{ backgroundColor: palette.red, flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <IconSymbol name="trash" size={22} color="#fff" />
        </Pressable>
      </View>

      <Animated.View
        style={{ transform: [{ translateX }], backgroundColor: palette.bg, zIndex: 1, elevation: 1, width: "100%" }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

// ─── Context Menu ────────────────────────────────────────────────────────────
type MenuState = {
  budget: Budget;
  x: number;
  y: number;
};

function ContextMenu({
  menu,
  onClose,
  onEdit,
  onDelete,
}: {
  menu: MenuState;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const MENU_HEIGHT = 104;
  const screenHeight = Dimensions.get('window').height;
  const openUp = menu.y > screenHeight - MENU_HEIGHT - 100;

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      <View
        style={[
          styles.menuCard,
          openUp ? { top: menu.y - MENU_HEIGHT - 8 } : { top: menu.y + 8 },
          { right: 20 },
        ]}
        pointerEvents="box-none"
      >
        <Pressable style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]} onPress={onEdit}>
          <IconSymbol name="pencil" size={16} color={palette.paper} />
          <Text style={styles.menuItemText}>Edit</Text>
        </Pressable>
        <View style={styles.menuDivider} />
        <Pressable style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]} onPress={onDelete}>
          <IconSymbol name="trash" size={16} color={palette.red} />
          <Text style={[styles.menuItemText, { color: palette.red }]}>Delete</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

export default function BudgetsScreen() {
  const budgets        = useBurnrateStore((s) => s.budgets);
  const summary        = useBurnrateStore((s) => s.summary);
  const saveBudget     = useBurnrateStore((s) => s.saveBudget);
  const deleteBudget   = useBurnrateStore((s) => s.deleteBudget);

  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuState | null>(null);

  const existingCategories = new Set(budgets.map((b) => b.category));
  const availableCategories = CATEGORIES.filter((c) => c !== 'Income' && !existingCategories.has(c));

  function handleDelete(id: string, category: string) {
    Alert.alert('Remove budget', `Delete the ${category} budget?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deleteBudget(id);
        },
      },
    ]);
  }

  return (
    <Screen>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ gap: 14, padding: 16, paddingBottom: 140 }}
      >
        <PageHeader title="Budgets" />

        {/* ── Add budget button ───────────────────────────────────────── */}
        <View style={{ marginBottom: 8 }}>
          <PrimaryButton
            onPress={() => {
              if (availableCategories.length === 0) {
                Alert.alert('All set', 'You have budgets for every category.');
                return;
              }
              setEditingBudget(null);
              setIsOverlayOpen(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            {budgets.length === 0 ? 'Add your first budget' : 'Add budget'}
          </PrimaryButton>
        </View>

        {budgets.length === 0 ? (
          <View style={{ paddingVertical: 24, paddingHorizontal: 4 }}>
            <Text style={{ color: palette.muted, fontSize: 14, fontFamily: 'monospace', lineHeight: 20 }}>
              Set your first monthly budget to start tracking your spending.
            </Text>
          </View>
        ) : null}

        {/* ── Budget list ──────────────────────────────────────────────── */}
        {budgets.length > 0 && (
          <View>
            {budgets.map((budget, i) => {
              const spent = summary.categoryBreakdown.find((x) => x.category === budget.category)?.amountPaise ?? 0;
              const ratio = budget.limitPaise > 0 ? spent / budget.limitPaise : 0;
              const isOver = ratio >= 1;
              const pct = Math.round(ratio * 100);

              return (
                <SwipeableRow
                  key={budget.id}
                  onEdit={() => {
                    setEditingBudget(budget);
                    setIsOverlayOpen(true);
                  }}
                  onDelete={() => handleDelete(budget.id, budget.category)}
                >
                  <View style={styles.budgetRow}>
                    {/* Icon */}
                    <View style={[styles.iconBubble, { backgroundColor: isOver ? 'rgba(255,107,107,0.14)' : 'rgba(155,184,165,0.14)' }]}>
                      <IconSymbol
                        name={getCategoryIcon(budget.category)}
                        size={24}
                        color={isOver ? palette.red : palette.celadon}
                        weight="duotone"
                      />
                    </View>

                    {/* Details */}
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.categoryName}>{budget.category}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.spentText, isOver && { color: palette.red }]}>
                            {formatInr(spent)}
                          </Text>
                          <Text style={styles.limitText}>/ {formatInr(budget.limitPaise)}</Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <ProgressBar progress={ratio} tone={isOver ? 'bad' : 'default'} />
                        </View>
                        <Text style={[styles.pctText, isOver && { color: palette.red }]}>
                          {pct}%
                        </Text>
                      </View>
                    </View>

                    {/* ⋮ button */}
                    <Pressable
                      hitSlop={8}
                      onPress={(e) => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setActiveMenu({
                          budget,
                          x: e.nativeEvent.pageX,
                          y: e.nativeEvent.pageY,
                        });
                      }}
                      style={styles.dotsBtn}
                    >
                      <IconSymbol name="ellipsis.vertical" size={18} color={palette.muted} />
                    </Pressable>
                  </View>
                </SwipeableRow>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Context Menu */}
      {activeMenu && (
        <ContextMenu
          menu={activeMenu}
          onClose={() => setActiveMenu(null)}
          onEdit={() => {
            setEditingBudget(activeMenu.budget);
            setIsOverlayOpen(true);
            setActiveMenu(null);
          }}
          onDelete={() => {
            handleDelete(activeMenu.budget.id, activeMenu.budget.category);
            setActiveMenu(null);
          }}
        />
      )}

      {/* ── Add budget overlay ───────────────────────────────────────── */}
      <BudgetFormOverlay
        budget={editingBudget}
        isOpen={isOverlayOpen}
        onClose={() => setIsOverlayOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    color: palette.paper,
    fontSize: 15,
    fontWeight: '600',
  },
  spentText: {
    color: palette.paper,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  limitText: {
    color: palette.muted,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    fontFamily: 'monospace',
  },
  pctText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 32,
    textAlign: 'right',
    fontFamily: 'monospace',
  },
  dotsBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  menuCard: {
    position: 'absolute',
    width: 160,
    backgroundColor: palette.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  menuItemText: {
    color: palette.paper,
    fontSize: 14,
    fontWeight: '600',
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 12,
  },
});
