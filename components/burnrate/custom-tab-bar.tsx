import React from "react";
import { Pressable, StyleSheet, View, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { GlassView } from "@/components/burnrate/glass-view";

import { palette } from "@/components/burnrate/ui";
import { IconSymbol } from "@/components/ui/icon-symbol";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type CustomTabBarProps = {
  state: any;
  descriptors: any;
  navigation: any;
  onPlusPress: () => void;
};

export function CustomTabBar({
  state,
  descriptors,
  navigation,
  onPlusPress,
}: CustomTabBarProps) {
  const insets = useSafeAreaInsets();

  const handleTabPress = (route: any, isFocused: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  const getIconName = (routeName: string) => {
    switch (routeName) {
      case "index":
        return "house.fill";
      case "transactions":
        return "list.bullet.rectangle";
      case "budgets":
        return "gauge.with.dots.needle.67percent";
      case "settings":
        return "gearshape.fill";
      default:
        return "house.fill";
    }
  };

  // Split routes: first 2 on left, last 2 on right
  const leftRoutes = state.routes.slice(0, 2);
  const rightRoutes = state.routes.slice(2, 4);

  const renderTabButton = (route: any, index: number) => {
    const actualIndex = state.routes.indexOf(route);
    const { options } = descriptors[route.key];
    const isFocused = state.index === actualIndex;

    const color = isFocused ? palette.paper : palette.muted;

    return (
      <Pressable
        key={route.key}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel}
        testID={options.tabBarButtonTestID}
        onPress={() => handleTabPress(route, isFocused)}
        style={styles.tabButton}
      >
        <IconSymbol
          name={getIconName(route.name)}
          size={24}
          color={color}
          weight={isFocused ? "fill" : "regular"}
        />
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.outerContainer,
        { bottom: insets.bottom > 0 ? insets.bottom + 8 : 16 },
      ]}
    >
      <View style={styles.floatingDock}>
        <GlassView
          intensity={50}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
        />

        {/* Left Tabs */}
        <View style={styles.tabSection}>
          {leftRoutes.map((route: any, idx: number) =>
            renderTabButton(route, idx),
          )}
        </View>

        {/* Center Plus Button */}
        <View style={styles.centerActions}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onPlusPress();
            }}
            style={({ pressed }) => [
              styles.plusButton,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <IconSymbol name="plus" size={24} color="#0A0A0A" weight="bold" />
          </Pressable>
        </View>

        {/* Right Tabs */}
        <View style={styles.tabSection}>
          {rightRoutes.map((route: any, idx: number) =>
            renderTabButton(route, idx),
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    backgroundColor: "transparent",
    zIndex: 100,
  },
  floatingDock: {
    width: SCREEN_WIDTH * 0.94,
    height: 76,
    borderRadius: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(14, 14, 14, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  tabSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    width: "32%",
    justifyContent: "center",
  },
  tabButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  centerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  plusButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    // Dark-mode CTA from index.html: solid light fill
    backgroundColor: "#FAFAFA",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },

});
