import React from "react";
import { Platform, View, type ViewProps } from "react-native";
import { BlurView } from "expo-blur";

type GlassViewProps = ViewProps & {
  intensity?: number;
  tint?: "light" | "dark" | "default";
};

/**
 * A cross-platform Glassmorphic/Frosted container.
 * Uses hardware-accelerated iOS BlurView on Apple platforms,
 * and a calibrated translucent fallback on Android/Web to prevent native view manager warnings.
 */
export function GlassView({
  intensity = 20,
  tint = "dark",
  style,
  children,
  ...props
}: GlassViewProps) {
  if (Platform.OS === "ios") {
    return (
      <BlurView intensity={intensity} tint={tint} style={style} {...props}>
        {children}
      </BlurView>
    );
  }

  // Calibrated Android/Web premium fallback
  const backgroundColor =
    tint === "light"
      ? `rgba(255, 255, 255, ${Math.min(0.25, 0.05 + intensity / 300)})`
      : tint === "dark"
        ? `rgba(18, 18, 16, ${Math.min(0.97, 0.85 + intensity / 400)})`
        : `rgba(20, 20, 18, ${Math.min(0.95, 0.8 + intensity / 400)})`;

  return (
    <View style={[{ backgroundColor }, style]} {...props}>
      {children}
    </View>
  );
}
