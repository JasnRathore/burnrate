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

export const palette = {
  bg: "#050505",
  border: "#2B2A27",
  coral: "#FF7059",
  cream: "#FFF4C7",
  gold: "#FFD84D",
  green: "#B7F06C",
  ink: "#070707",
  muted: "#9B9A92",
  paper: "#FFFFFF",
  panel: "#141412",
  red: "#FF6A5C",
  silver: "#DDE2DD",
};

type CardTone = "panel" | "coral" | "gold" | "cream" | "green" | "silver";

export const cardColors: Record<
  CardTone,
  { background: string; border: string; text: string }
> = {
  coral: { background: palette.coral, border: "#FF8B78", text: palette.ink },
  cream: { background: palette.cream, border: "#FFF8D8", text: palette.ink },
  gold: { background: palette.gold, border: "#FFE47A", text: palette.ink },
  green: { background: palette.green, border: "#CCFF8C", text: palette.ink },
  panel: {
    background: palette.panel,
    border: palette.border,
    text: palette.paper,
  },
  silver: { background: palette.silver, border: "#EDF1ED", text: palette.ink },
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
      <View style={{ flex: 1, gap: 3 }}>
        <Text
          selectable
          style={{ color: palette.paper, fontSize: 18, fontWeight: "900" }}
        >
          {title}
        </Text>
        {detail ? (
          <Text
            selectable
            style={{ color: palette.muted, fontSize: 13, lineHeight: 18 }}
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

  // Border radius map
  const borderRadiusStyle = {
    "organic-left": {
      borderTopLeftRadius: 8,
      borderTopRightRadius: 60,
      borderBottomRightRadius: 60,
      borderBottomLeftRadius: 60,
    },
    "organic-right": {
      borderTopLeftRadius: 60,
      borderTopRightRadius: 60,
      borderBottomRightRadius: 8,
      borderBottomLeftRadius: 60,
    },
    capsule: {
      borderRadius: 40,
    },
    rect: {
      borderRadius: 16,
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
          gap: 6,
          position: "relative",
          overflow: "hidden",
          padding: 16,
        },
        borderRadiusStyle,
        style,
      ]}
    >
      {/* Decorative top drag handle */}
      {showHandle && (
        <View
          style={{
            width: 32,
            height: 3,
            backgroundColor:
              tone === "panel" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
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
          color: dark ? "#4C3A2E" : palette.muted,
          fontSize: 11,
          fontWeight: "900",
          letterSpacing: 0,
          textTransform: "uppercase",
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
        fontSize: 48,
        fontVariant: ["tabular-nums"],
        fontWeight: "900",
      }}
    >
      {children}
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
      ? "#5E5547"
      : palette.muted
    : dark
      ? palette.ink
      : palette.paper;
  return (
    <Text selectable style={[{ color, fontSize: 15, lineHeight: 21 }, style]}>
      {children}
    </Text>
  );
}

export function Field(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor="#77736A"
      {...props}
      style={[
        {
          backgroundColor: "#0D0D0C",
          borderColor: palette.border,
          borderCurve: "continuous",
          borderRadius: 8,
          borderWidth: 1,
          color: palette.paper,
          fontSize: 16,
          minHeight: 48,
          paddingHorizontal: 14,
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
  const backgroundColor =
    tone === "danger"
      ? palette.red
      : tone === "quiet"
        ? "#20201E"
        : palette.cream;
  const color = tone === "primary" ? palette.ink : palette.paper;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor,
        borderCurve: "continuous",
        borderRadius: 8,
        opacity: disabled ? 0.45 : pressed ? 0.82 : 1,
        paddingHorizontal: 14,
        paddingVertical: 13,
      })}
    >
      <Text style={{ color, fontSize: 15, fontWeight: "900" }}>{children}</Text>
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
  const borderColor = dark ? "rgba(0,0,0,0.3)" : palette.border;
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
        borderRadius: 999,
        borderWidth: 1,
        flexDirection: "row",
        minHeight: 38,
        paddingHorizontal: 14,
        opacity: onPress && pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: textColor, fontSize: 14, fontWeight: "800" }}>
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
        backgroundColor: dark ? "rgba(0,0,0,0.14)" : "#252522",
        borderRadius: 999,
        height: 8,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          backgroundColor:
            tone === "bad" ? palette.red : dark ? palette.ink : palette.cream,
          height: 8,
          width: `${Math.max(4, Math.min(100, progress * 100))}%`,
        }}
      />
    </View>
  );
}
