import { useState, useMemo, useRef, useCallback } from "react";
import {
  Alert,
  Animated,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import {
  BodyText,
  PageHeader,
  Screen,
  palette,
} from "@/components/burnrate/ui";
import { formatInr } from "@/features/burnrate/calculations";
import { useBurnrateStore } from "@/features/burnrate/store";
import { type Transaction, getCategoryIcon } from "@/features/burnrate/types";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { TransactionFilterOverlay } from "@/components/burnrate/transaction-filter-overlay";
import { MonthPickerOverlay } from "@/components/burnrate/month-picker-overlay";
import { EditTransactionOverlay } from "@/components/burnrate/edit-transaction-overlay";



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
        // If they dragged past halfway OR flicked fast to the left
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
      onPanResponderTerminate: () => {
        // If a scroll takes over mid-swipe, snap it shut
        close();
      },
    })
  ).current;

  return (
    <View style={{ overflow: "hidden" }}>
      {/* Background actions */}
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
          onPress={() => {
            close();
            onEdit();
          }}
          style={{ backgroundColor: palette.paper, flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <IconSymbol name="pencil" size={22} color={palette.ink} />
        </Pressable>
        <Pressable
          onPress={() => {
            close();
            onDelete();
          }}
          style={{ backgroundColor: palette.coral, flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <IconSymbol name="trash" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* Foreground content */}
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
  transaction: Transaction;
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
  // Decide whether the menu opens upward or downward
  const MENU_HEIGHT = 104;
  const SCREEN_THRESHOLD = 500;
  const openUp = menu.y > SCREEN_THRESHOLD;

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Full-screen dismiss layer */}
      <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />

      {/* Floating card */}
      <View
        style={[
          styles.menuCard,
          openUp
            ? { top: menu.y - MENU_HEIGHT - 8 }
            : { top: menu.y + 8 },
          // Clamp to right edge
          { right: 20 },
        ]}
        pointerEvents="box-none"
      >
        {/* Edit */}
        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={onEdit}
        >
          <IconSymbol name="pencil" size={16} color={palette.paper} />
          <Text style={styles.menuItemText}>Edit</Text>
        </Pressable>

        <View style={styles.menuDivider} />

        {/* Delete */}
        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={onDelete}
        >
          <IconSymbol name="trash" size={16} color={palette.coral} />
          <Text style={[styles.menuItemText, { color: palette.coral }]}>Delete</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const transactions    = useBurnrateStore((s) => s.transactions);
  const deleteTransaction = useBurnrateStore((s) => s.deleteTransaction);

  const [currentDate,       setCurrentDate]       = useState(() => new Date());
  const [filterType,        setFilterType]         = useState<"all" | "expense" | "income">("all");
  const [filterCategory,    setFilterCategory]     = useState<string>("all");
  const [isFilterOpen,      setIsFilterOpen]       = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen]  = useState(false);
  const [activeMenu,        setActiveMenu]         = useState<MenuState | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const date = new Date(t.occurredAt);
      if (
        date.getMonth()    !== currentDate.getMonth() ||
        date.getFullYear() !== currentDate.getFullYear()
      ) return false;
      if (filterType     !== "all" && t.direction !== filterType)   return false;
      if (filterCategory !== "all" && t.category  !== filterCategory) return false;
      return true;
    });
  }, [transactions, currentDate, filterType, filterCategory]);

  const netTotal = useMemo(() =>
    filteredTransactions.reduce((sum, t) =>
      t.direction === "income" ? sum + t.amountPaise : sum - t.amountPaise, 0),
    [filteredTransactions]
  );

  const now = new Date();
  const isCurrentMonth =
    currentDate.getMonth()    === now.getMonth() &&
    currentDate.getFullYear() === now.getFullYear();

  const isFiltered = filterType !== "all" || filterCategory !== "all" || !isCurrentMonth;

  const resetFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFilterType("all");
    setFilterCategory("all");
    setCurrentDate(new Date());
  };

  // ── Handle delete ──────────────────────────────────────────────────────────
  const handleDelete = (transaction: Transaction) => {
    setActiveMenu(null);
    Alert.alert(
      "Delete Transaction",
      `Remove "${transaction.merchant}" permanently?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            deleteTransaction(transaction.id);
          },
        },
      ]
    );
  };

  const scrollY = useRef(new Animated.Value(0)).current;
  // Heights of the two overlay regions (not including safe-area inset)
  const HEADER_H = 54;
  const FILTER_H = 76;  // pill 52px + paddingTop:8 + paddingBottom:8 + border

  // Both overlays slide up together at the scroll rate, clamped once the
  // filter bar reaches the top. useNativeDriver:true → runs on UI thread, no jitter.
  const overlayTranslate = scrollY.interpolate({
    inputRange: [0, HEADER_H],
    outputRange: [0, -HEADER_H],
    extrapolate: "clamp",
  });
  // Header fades out quickly as you start scrolling
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_H * 0.6],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <Screen>
      {/* ── Scrollable list ──────────────────────────────────────────────── */}
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 140 }}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
      >
        {/* Spacer: ScrollView already starts below insets.top via Screen's paddingTop,
            so we only need HEADER_H + FILTER_H here to make room for the overlays */}
        <View style={{ height: HEADER_H + FILTER_H }} />

        {/* Empty state */}
        {filteredTransactions.length === 0 && (
          <View style={{ paddingVertical: 40, paddingHorizontal: 16, alignItems: "center" }}>
            <BodyText muted>No transactions found for these filters.</BodyText>
          </View>
        )}

        {/* Transaction rows */}
        {filteredTransactions.map((transaction) => {
          const isIncome = transaction.direction === "income";
          const iconColor = isIncome ? palette.green : palette.coral;
          const bgTint    = isIncome ? "rgba(183, 240, 108, 0.12)" : "rgba(255, 112, 89, 0.12)";
          const formattedDate = new Date(transaction.occurredAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });

          return (
            <SwipeableRow
              key={transaction.id}
              onEdit={() => setEditingTransaction(transaction)}
              onDelete={() => handleDelete(transaction)}
            >
              <View style={styles.row}>
              {/* Category icon */}
              <View style={[styles.iconBubble, { backgroundColor: bgTint }]}>
                <IconSymbol
                  name={getCategoryIcon(transaction.category)}
                  size={24}
                  color={iconColor}
                  weight="duotone"
                />
              </View>

              {/* Details */}
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Text style={styles.merchant} numberOfLines={1}>
                    {transaction.merchant}
                  </Text>
                  <Text
                    selectable
                    style={[styles.amount, { color: isIncome ? palette.green : palette.paper }]}
                  >
                    {isIncome ? "+" : ""}{formatInr(transaction.amountPaise)}
                  </Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.meta}>{transaction.category}</Text>
                  <View style={styles.dot} />
                  <Text style={styles.meta}>{formattedDate}</Text>
                  {transaction.source === "sms" && (
                    <>
                      <View style={styles.dot} />
                      <View style={styles.smsBadge}>
                        <Text style={styles.smsText}>SMS</Text>
                      </View>
                    </>
                  )}
                </View>
              </View>

              {/* ⋮ button */}
              <Pressable
                hitSlop={8}
                onPress={(e) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveMenu({
                    transaction,
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
      </Animated.ScrollView>

      {/* ── Page header overlay (slides up & fades) ──────────────────────── */}
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: insets.top,   // offset by safe-area so we don't overlap the status bar
          left: 0, right: 0,
          height: HEADER_H,
          backgroundColor: palette.bg,
          paddingHorizontal: 16,
          paddingTop: 16,
          transform: [{ translateY: overlayTranslate }],
          opacity: headerOpacity,
        }}
      >
        <PageHeader
          title="Transactions"
          right={
            <Text
              style={{
                fontSize: 15,
                fontWeight: "800",
                fontVariant: ["tabular-nums"],
                color: netTotal >= 0 ? palette.green : palette.coral,
              }}
            >
              {netTotal >= 0 ? "+" : ""}{formatInr(netTotal)}
            </Text>
          }
        />
      </Animated.View>

      {/* ── Filter bar overlay (slides up, then sticks at top) ───────────── */}
      <Animated.View
        style={{
          position: "absolute",
          top: insets.top + HEADER_H,  // safe-area + header height
          left: 0, right: 0,
          backgroundColor: palette.bg,
          transform: [{ translateY: overlayTranslate }],
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          {/* Month Navigator */}
          <View style={styles.monthNav}>
            <Pressable
              onPress={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              hitSlop={10}
            >
              <IconSymbol name="chevron.left" size={20} color={palette.paper} />
            </Pressable>

            <Pressable onPress={() => setIsMonthPickerOpen(true)} hitSlop={5}>
              <Text style={styles.monthText}>
                {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                if (isCurrentMonth) return;
                setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
              }}
              hitSlop={10}
              style={{ opacity: isCurrentMonth ? 0.3 : 1 }}
            >
              <IconSymbol name="chevron.right" size={20} color={palette.paper} />
            </Pressable>
          </View>

          {/* Action Buttons */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 0 }}>
            {isFiltered && (
              <Pressable onPress={resetFilters} style={styles.iconBtn}>
                <IconSymbol name="arrow.counterclockwise" size={20} color={palette.muted} />
              </Pressable>
            )}
            <Pressable onPress={() => setIsFilterOpen(true)} style={[styles.iconBtn, styles.iconBtnDark]}>
              <IconSymbol name="sliders" size={20} color={palette.paper} />
              {(filterType !== "all" || filterCategory !== "all") && (
                <View style={styles.filterDot} />
              )}
            </Pressable>
          </View>
        </View>
      </Animated.View>



      {/* Context menu */}
      {activeMenu && (
        <ContextMenu
          menu={activeMenu}
          onClose={() => setActiveMenu(null)}
          onEdit={() => {
            setEditingTransaction(activeMenu.transaction);
            setActiveMenu(null);
          }}
          onDelete={() => handleDelete(activeMenu.transaction)}
        />
      )}

      {/* Edit overlay */}
      <EditTransactionOverlay
        transaction={editingTransaction}
        onClose={() => setEditingTransaction(null)}
      />

      {/* Filter overlay */}
      <TransactionFilterOverlay
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filterType={filterType}
        setFilterType={setFilterType}
        filterCategory={filterCategory}
        setFilterCategory={setFilterCategory}
      />

      {/* Month picker */}
      <MonthPickerOverlay
        isOpen={isMonthPickerOpen}
        onClose={() => setIsMonthPickerOpen(false)}
        currentDate={currentDate}
        onSelect={setCurrentDate}
      />
    </Screen>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Month navigator
  monthNav: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#141412",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  monthText: {
    color: palette.paper,
    fontSize: 16,
    fontWeight: "800",
  },
  // Shared icon button
  iconBtn: {
    width: 52,
    height: 52,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnDark: {
    backgroundColor: "#141412",
    borderColor: palette.border,
    position: "relative",
  },
  filterDot: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.coral,
  },
  // Transaction row
  row: {
    borderBottomColor: "rgba(255,255,255,0.06)",
    borderBottomWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  merchant: {
    color: palette.paper,
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  amount: {
    fontSize: 16,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  meta: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: "500",
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  smsBadge: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  smsText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  dotsBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  // Context menu card
  menuCard: {
    position: "absolute",
    width: 160,
    backgroundColor: "#1E1E1C",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 20,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemPressed: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  menuItemText: {
    color: palette.paper,
    fontSize: 15,
    fontWeight: "600",
  },
  menuDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    marginHorizontal: 12,
  },
});
