import { type PropsWithChildren, type ReactNode } from "react";
import {
  Pressable,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewProps,
  type TextStyle,
  type StyleProp,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useState } from "react";

/**
 * Design tokens inspired by the portfolio bento UI in index.html:
 * rounded cards, soft borders, pastel accent chips, mono body, black/white CTAs.
 */
export const palette = {
  bg: "#0A0A0A",
  border: "rgba(255,255,255,0.12)",
  borderStrong: "rgba(255,255,255,0.18)",
  // Pastel accents (from index.html project tags)
  mint: "#D8F3DC",
  peach: "#FFD6A5",
  cyan: "#9BF6FF",
  blue: "#A2D2FF",
  blush: "#FEC5BB",
  pink: "#FFCAD4",
  lemon: "#FDFFB6",
  // Semantic aliases used across the app
  coral: "#FEC5BB",
  cream: "#FDFFB6",
  gold: "#FFD6A5",
  green: "#D8F3DC",
  celadon: "#9BB8A5",
  ink: "#0A0A0A",
  muted: "#8B8B8B",
  paper: "#FAFAFA",
  panel: "#141414",
  surface: "#111111",
  red: "#FF6B6B",
  silver: "#E8E8E8",
};

type CardTone =
  | "panel"
  | "coral"
  | "gold"
  | "cream"
  | "green"
  | "silver"
  | "mint"
  | "peach"
  | "cyan"
  | "blue"
  | "blush"
  | "pink"
  | "lemon";

export const cardColors: Record<
  CardTone,
  { background: string; border: string; text: string }
> = {
  panel: {
    background: palette.panel,
    border: palette.border,
    text: palette.paper,
  },
  coral: { background: palette.coral, border: "#F5B8AC", text: palette.ink },
  cream: { background: palette.cream, border: "#F0F2A8", text: palette.ink },
  gold: { background: palette.gold, border: "#F0C48F", text: palette.ink },
  green: { background: palette.green, border: "#C2E8C9", text: palette.ink },
  silver: { background: palette.silver, border: "#DCDCDC", text: palette.ink },
  mint: { background: palette.mint, border: "#C2E8C9", text: palette.ink },
  peach: { background: palette.peach, border: "#F0C48F", text: palette.ink },
  cyan: { background: palette.cyan, border: "#7FE9F5", text: palette.ink },
  blue: { background: palette.blue, border: "#8FC0F0", text: palette.ink },
  blush: { background: palette.blush, border: "#F5B8AC", text: palette.ink },
  pink: { background: palette.pink, border: "#F0B8C4", text: palette.ink },
  lemon: { background: palette.lemon, border: "#F0F2A8", text: palette.ink },
};

export function Screen({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: palette.bg,
        flex: 1,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      {children}
    </View>
  );
}

export function PageHeader({
  title,
  detail,
  right,
}: {
  title: string;
  detail?: string;
  right?: ReactNode;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          selectable
          style={{
            color: palette.paper,
            fontSize: 28,
            fontWeight: "600",
            letterSpacing: -0.8,
            lineHeight: 32,
          }}
        >
          {title}
        </Text>
        {detail ? (
          <Text
            selectable
            style={{
              color: palette.muted,
              fontSize: 13,
              lineHeight: 18,
              fontFamily: "monospace",
            }}
          >
            {detail}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Card({
  children,
  style,
  tone = "panel",
  shape = "rect",
  showHandle = false,
}: PropsWithChildren<
  ViewProps & {
    tone?: CardTone;
    shape?: "organic-left" | "organic-right" | "capsule" | "rect";
    showHandle?: boolean;
    favoriteKey?: string;
  }
>) {
  const color = cardColors[tone];

  // Bento-style radii (index.html uses ~26–30px). Organic variants stay soft but less extreme.
  const borderRadiusStyle = {
    "organic-left": {
      borderTopLeftRadius: 16,
      borderTopRightRadius: 26,
      borderBottomRightRadius: 26,
      borderBottomLeftRadius: 26,
    },
    "organic-right": {
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      borderBottomRightRadius: 16,
      borderBottomLeftRadius: 26,
    },
    capsule: {
      borderRadius: 40,
    },
    rect: {
      borderRadius: 26,
    },
  }[shape];

  return (
    <View
      style={[
        {
          backgroundColor: color.background,
          borderColor: color.border,
          borderCurve: "continuous",
          borderWidth: 1,
          gap: 8,
          position: "relative",
          overflow: "hidden",
          padding: 18,
        },
        borderRadiusStyle,
        style,
      ]}
    >
      {showHandle && (
        <View
          style={{
            width: 36,
            height: 4,
            backgroundColor:
              tone === "panel" ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)",
            borderRadius: 2,
            alignSelf: "center",
            marginBottom: -2,
          }}
        />
      )}

      {children}
    </View>
  );
}

export function Label({
  children,
  dark = false,
  style,
}: PropsWithChildren<{ dark?: boolean; style?: StyleProp<TextStyle> }>) {
  return (
    <Text
      style={[
        {
          color: dark ? "rgba(10,10,10,0.55)" : palette.muted,
          fontSize: 12,
          fontWeight: "600",
          letterSpacing: 0.2,
          textTransform: "uppercase",
          fontFamily: "monospace",
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function ValueText({
  children,
  dark = false,
}: PropsWithChildren<{ dark?: boolean }>) {
  return (
    <Text
      selectable
      style={{
        color: dark ? palette.ink : palette.paper,
        fontSize: 44,
        fontVariant: ["tabular-nums"],
        fontWeight: "600",
        letterSpacing: -1.2,
      }}
    >
      {children}
    </Text>
  );
}

export function AnimatedValueText({
  value,
  formatter,
  dark = false,
}: {
  value: number;
  formatter: (val: number) => string;
  dark?: boolean;
}) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let startTimestamp: number;
    const duration = 600;
    const startValue = displayValue;
    const distance = value - startValue;
    if (distance === 0) return;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + distance * ease);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setDisplayValue(value);
      }
    };
    requestAnimationFrame(step);
  }, [value]);

  return (
    <Text
      selectable
      style={{
        color: dark ? palette.ink : palette.paper,
        fontSize: 44,
        fontVariant: ["tabular-nums"],
        fontWeight: "600",
        letterSpacing: -1.2,
      }}
    >
      {formatter(displayValue)}
    </Text>
  );
}

export function BodyText({
  children,
  dark = false,
  muted = false,
  style,
}: PropsWithChildren<{
  dark?: boolean;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
}>) {
  const color = muted
    ? dark
      ? "rgba(10,10,10,0.5)"
      : palette.muted
    : dark
      ? palette.ink
      : palette.paper;
  return (
    <Text
      selectable
      style={[
        {
          color,
          fontSize: 14,
          lineHeight: 21,
          fontFamily: "monospace",
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Field(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={palette.muted}
      {...props}
      style={[
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderCurve: "continuous",
          borderRadius: 12,
          borderWidth: 1,
          color: palette.paper,
          fontSize: 16,
          minHeight: 48,
          paddingHorizontal: 14,
          fontFamily: "monospace",
        },
        props.style,
      ]}
    />
  );
}

export function PrimaryButton({
  children,
  disabled,
  onPress,
  tone = "primary",
}: PropsWithChildren<{
  disabled?: boolean;
  onPress: () => void;
  tone?: "primary" | "danger" | "quiet";
}>) {
  // Dark-mode CTA from index.html: white fill / black text
  const backgroundColor =
    tone === "danger"
      ? palette.red
      : tone === "quiet"
        ? palette.surface
        : palette.paper;
  const color =
    tone === "danger"
      ? palette.paper
      : tone === "quiet"
        ? palette.paper
        : palette.ink;
  const borderColor =
    tone === "quiet" ? palette.border : "transparent";

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor,
        borderColor,
        borderCurve: "continuous",
        borderRadius: 10,
        borderWidth: tone === "quiet" ? 1 : 0,
        opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        paddingHorizontal: 16,
        paddingVertical: 13,
        transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
      })}
    >
      <Text
        style={{
          color,
          fontSize: 14,
          fontWeight: "700",
          letterSpacing: 0.1,
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}

export function Pill({
  children,
  active = false,
  dark = false,
  onPress,
}: PropsWithChildren<{
  active?: boolean;
  dark?: boolean;
  onPress?: () => void;
}>) {
  const Wrapper = onPress ? Pressable : View;
  const borderColor = dark ? "rgba(0,0,0,0.18)" : palette.border;
  const activeBackground = dark ? palette.ink : palette.paper;
  const textColor = active
    ? dark
      ? palette.paper
      : palette.ink
    : dark
      ? palette.ink
      : palette.paper;

  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  return (
    <Wrapper
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress ? handlePress : undefined}
      style={({ pressed }: any) => ({
        alignItems: "center",
        backgroundColor: active ? activeBackground : "transparent",
        borderColor: active ? activeBackground : borderColor,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: "row",
        minHeight: 36,
        paddingHorizontal: 12,
        paddingVertical: 6,
        opacity: onPress && pressed ? 0.85 : 1,
        transform: [{ scale: onPress && pressed ? 0.95 : 1 }],
      })}
    >
      <Text
        style={{
          color: textColor,
          fontSize: 13,
          fontWeight: "600",
          fontFamily: "monospace",
        }}
      >
        {children}
      </Text>
    </Wrapper>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {options.map((option) => (
        <Pill
          active={option.value === value}
          key={option.value}
          onPress={() => onChange(option.value)}
        >
          {option.label}
        </Pill>
      ))}
    </View>
  );
}

export function ProgressBar({
  dark = false,
  progress,
  tone = "default",
}: {
  dark?: boolean;
  progress: number;
  tone?: "default" | "bad";
}) {
  return (
    <View
      style={{
        backgroundColor: dark ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.08)",
        borderRadius: 999,
        height: 6,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          backgroundColor:
            tone === "bad"
              ? palette.red
              : dark
                ? palette.ink
                : palette.celadon,
          height: 6,
          width: `${Math.max(4, Math.min(100, progress * 100))}%`,
          borderRadius: 999,
        }}
      />
    </View>
  );
}

/** Soft pastel tag chip — matches index.html project tags */
export function Tag({
  children,
  color = palette.mint,
}: PropsWithChildren<{ color?: string }>) {
  return (
    <View
      style={{
        backgroundColor: color,
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
      }}
    >
      <Text
        style={{
          color: palette.ink,
          fontSize: 12,
          fontWeight: "600",
          fontFamily: "monospace",
        }}
      >
        {children}
      </Text>
    </View>
  );
}
